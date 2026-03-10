import postgres from "postgres";
import { env } from "../config/env.js";
import { features } from "../config/features.js";

const main = postgres(env.databaseUrl, { max: 10 });

const replicas = [
	postgres(env.databaseUrlReplica1, { max: 50 }),
	postgres(env.databaseUrlReplica2, { max: 50 }),
];

let replicaCounter = 0;

function read<T extends postgres.Row[] = postgres.Row[]>(
	strings: TemplateStringsArray,
	// biome-ignore lint/suspicious/noExplicitAny: mirrors postgres.Sql variadic parameter signature
	...values: any[]
): Promise<T> {
	if (!features.readReplicas) {
		console.log("[db_router] read → primary");
		return main<T>(strings, ...values);
	}

	const replicaIndex = replicaCounter++ % replicas.length;
	const replica = replicas[replicaIndex];
	console.log(`[db_router] read → replica ${replicaIndex}`);

	return replica<T>(strings, ...values).catch((err: Error) => {
		console.warn(
			`[db_router] replica failed, falling back to primary: ${err.message}`,
		);
		return main<T>(strings, ...values);
	});
}

export type ShardDb = {
	read: postgres.Sql;
	write: postgres.Sql;
};

type ShardPool = {
	write: postgres.Sql;
	replicas: postgres.Sql[];
	replicaCounter: number;
};

const shards: ShardPool[] = [
	{
		write: postgres(env.databaseUrlShard1, { max: 10 }),
		replicas: [postgres(env.databaseUrlShard1Replica, { max: 50 })],
		replicaCounter: 0,
	},
	{
		write: postgres(env.databaseUrlShard2, { max: 10 }),
		replicas: [postgres(env.databaseUrlShard2Replica, { max: 50 })],
		replicaCounter: 0,
	},
];

function getShard(storeId: number): ShardDb {
	if (!features.sharding) {
		console.log("[db_router] sharding off → primary");
		return { read, write: main };
	}

	const shardIndex = storeId % shards.length;
	const shard = shards[shardIndex];

	if (features.readReplicas && shard.replicas.length > 0) {
		const replicaIndex = shard.replicaCounter++ % shard.replicas.length;
		console.log(
			`[db_router] shard ${shardIndex} → write: shard primary, read: shard replica ${replicaIndex}`,
		);
		return { read: shard.replicas[replicaIndex], write: shard.write };
	}

	console.log(
		`[db_router] shard ${shardIndex} → write: shard primary, read: shard primary`,
	);
	return { read: shard.write, write: shard.write };
}

export const db = {
	read,
	get write(): postgres.Sql {
		return main;
	},
	shard: getShard,
};
