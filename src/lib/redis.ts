import { Redis as IORedis } from "ioredis";
import { env } from "../config/env.js";

let client: IORedis | null = null;

export function getRedis(): IORedis {
	return (client ??= new IORedis(env.redisUrl, { lazyConnect: true }));
}

export async function getKey(key: string): Promise<string | null> {
	return getRedis()
		.get(key)
		.catch((err) => {
			console.error("Cache get failed:", err);
			return null;
		});
}

export function setKey(key: string, value: string, ttlSeconds: number): void {
	getRedis()
		.set(key, value, "EX", ttlSeconds)
		.catch((err) => console.error("Cache set failed:", err));
}

export function delKeys(...keys: string[]): void {
	getRedis()
		.del(...keys)
		.catch((err) => console.error("Cache del failed:", err));
}

//Todo cleaner way of doing this is to an a generation counter and use that in the product key.
// `products:listed:${gen}:offset:${offset}:limit:${limit}`,
// old keys will disappear eventually due to TTL
export function delPattern(pattern: string): void {
	getRedis()
		.keys(pattern)
		.then((keys) => {
			if (keys.length > 0) {
				getRedis()
					.del(...keys)
					.catch((err) => console.error("Cache del failed:", err));
			}
		})
		.catch((err) => console.error("Cache pattern scan failed:", err));
}
