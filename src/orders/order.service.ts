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
	async placeOrder(userId: number, items: OrderItem[]) {
		const locks: Lock[] = [];

		try {
			// user lock first — prevents duplicate concurrent orders from same user
			locks.push(await redlock.acquire([KEYS.order(userId)], DEFAULT_LOCK_DURATION));

			// sort by skuId before acquiring — prevents deadlock between concurrent orders
			const sortedItems = [...items].sort((a, b) => a.skuId - b.skuId);
			for (const item of sortedItems) {
				locks.push(await redlock.acquire([KEYS.sku(item.skuId)], DEFAULT_LOCK_DURATION));
			}

			return await db.write.begin(async (sql) => {
				const tx = sql as TxSql;

				for (const item of items) {
					const supply = await orderRepository.decrementSupply(
						item.skuId,
						item.quantity,
						tx,
					);
					if (supply === null) {
						throw new Error(`Insufficient stock for SKU ${item.skuId}`);
					}
				}

				return orderRepository.createOrder(userId, items, tx);
			});
		} catch (err) {
			if (err instanceof ExecutionError) {
				throw new OrderConflictError("Could not acquire lock, try again");
			}
			throw err;
		} finally {
			await Promise.all(
				locks.map(lock => lock.release().catch(err => console.warn("Failed to release lock:", err))));
		}
	},
};
