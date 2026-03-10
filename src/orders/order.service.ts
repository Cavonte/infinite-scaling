import Redlock, { ExecutionError } from "redlock";
import type { Lock } from "redlock";
import { db } from "../db/db_router.js";
import { getRedis } from "../lib/redis.js";
import {
	orderRepository,
	type OrderItem,
	type TxSql,
} from "./order.repository.js";

export class OrderConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OrderConflictError";
	}
}

export class InsufficientStockError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InsufficientStockError";
	}
}

const redlock = new Redlock([getRedis()], {
	retryCount: 3,
	retryDelay: 100,
	retryJitter: 50,
});

const KEYS = {
	sku: (id: number) => `lock:sku:${id}`,
	order: (userId: number) => `store:order:${userId}`,
} as const;

const DEFAULT_LOCK_DURATION = 5000;

export const orderService = {
	async placeOrder(storeId: number, userId: number, items: OrderItem[]) {
		const locks: Lock[] = [];

		try {
			// user lock first — prevents duplicate concurrent orders from same user
			locks.push(
				await redlock.acquire([KEYS.order(userId)], DEFAULT_LOCK_DURATION),
			);

			// sort by skuId before acquiring — prevents deadlock between concurrent orders
			const sortedItems = [...items].sort((a, b) => a.skuId - b.skuId);
			for (const item of sortedItems) {
				locks.push(
					await redlock.acquire([KEYS.sku(item.skuId)], DEFAULT_LOCK_DURATION),
				);
			}

			// Validate user exists before burning lock window, users are on the primary i.e. not sharded
			const userRows = await db.read`SELECT id FROM users WHERE id = ${userId} LIMIT 1`;
			if (!userRows[0]) throw new Error(`User ${userId} not found`);

			// tx1: decrement supply on the correct shard
			await db.shard(storeId).write.begin(async (sql) => {
				const tx = sql as TxSql;
				// Promise all is not ideal here
				for (const item of items) {
					const sku = await orderRepository.decrementSupply(item.skuId, item.quantity, tx);
					if (sku === null) throw new InsufficientStockError(`Insufficient stock for SKU ${item.skuId}`);
				}
			});

			// tx2: create order record on primary
			try {
				return await db.write.begin(async (sql) => {
					const tx = sql as TxSql;
					return orderRepository.createOrder(userId, items, tx);
				});
			} catch (err) {
				// Compensate: restore supply on shard if order creation failed
				await db.shard(storeId).write.begin(async (sql) => {
					const tx = sql as TxSql;
					for (const item of items) {
						await orderRepository.incrementSupply(item.skuId, item.quantity, tx);
					}
				}).catch((compensateErr) =>
					console.error("Compensation failed — inventory may be inconsistent:", compensateErr),
				);
				throw err;
			}
		} catch (err) {
			if (err instanceof ExecutionError) {
				throw new OrderConflictError("Could not acquire lock, try again");
			}
			throw err;
		} finally {
			await Promise.all(
				locks.map((lock) =>
					lock
						.release()
						.catch((err) => console.warn("Failed to release lock:", err)),
				),
			);
		}
	},
};
