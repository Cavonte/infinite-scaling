function required(key: string): string {
	const value = process.env[key];
	if (!value) throw new Error(`Missing required env var: ${key}`);
	return value;
}

function optional(key: string, fallback: string): string {
	return process.env[key] ?? fallback;
}

export const env = {
	port: Number(optional("PORT", "3000")),
	databaseUrl: required("DATABASE_URL"),
	databaseUrlReplica1: required("DATABASE_URL_REPLICA_1"),
	databaseUrlReplica2: required("DATABASE_URL_REPLICA_2"),
	redisUrl: required("REDIS_URL"),
} as const;
