import Redlock, { ExecutionError } from "redlock";
import type { Lock } from "redlock";
import { db } from "../db/db_router.js";
import { getRedis } from "../lib/redis.js";
import {
	orderRepository,
	type OrderItem,
	type TxSql,
} from "./order.repository.js";

const redlock = new Redlock([getRedis()], {
	retryCount: 3,
	retryDelay: 100,
	retryJitter: 50,
});

const DEFAULT_LOCK_DURATION = 5000;

export const orderService = {
	async placeOrder(userId: number, items: OrderItem[]) {
		const locks: Lock[] = [];

		try {
			for (const item of items) {
				locks.push(await redlock.acquire([`lock:sku:${item.skuId}`], DEFAULT_LOCK_DURATION));
			}

			return await db.write.begin(async (sql) => {
				const tx = sql as TxSql;

				for (const item of items) {
					const supply = await orderRepository.decrementSupply(item.skuId, item.quantity, tx);
					if (supply === null) {
						throw new Error(`Insufficient stock for SKU ${item.skuId}`);
					}
				}

				return orderRepository.createOrder(userId, items, tx);
			});
		} catch (err) {
			if (err instanceof ExecutionError) {
				throw new Error("Could not acquire lock — too much contention, try again");
			}
			throw err;
		} finally {
			for (const lock of locks) {
				await lock.release();
			}
		}
	},
};
