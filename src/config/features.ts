import { optional } from "./env.js";

export const features = {
	readReplicas: optional("FEATURE_READ_REPLICAS", "false") === "true",
	redisCache: optional("FEATURE_REDIS_CACHE", "false") === "true",
	sharding: optional("FEATURE_SHARDING", "false") === "true",
	rateLimit: optional("FEATURE_RATE_LIMIT", "false") === "true",
} as const;
