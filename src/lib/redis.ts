import { Redis as IORedis } from "ioredis";
import { env } from "../config/env.js";

let client: IORedis | null = null;

export function getRedis(): IORedis {
	return (client ??= new IORedis(env.redisUrl, { lazyConnect: true }));
}
