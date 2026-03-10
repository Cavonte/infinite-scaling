/**
 * Resets supply for all SKUs in the order pool (products 2201–6200, skus 6601–18600)
 * back to 500 so repeated benchmark runs start from a consistent baseline.
 *
 * Run with: pnpm db:resupply
 *
 * Updates primary and both shards (when FEATURE_SHARDING=true).
 */

import postgres from "postgres";

const SUPPLY = 500;
// k6 order pool: products 2201–6200, 3 SKUs each
const SKU_ID_MIN = (2201 - 1) * 3 + 1; // 6601
const SKU_ID_MAX = 6200 * 3;            // 18600

function connect(url: string) {
	return postgres(url, { max: 3 });
}

async function resetSupply(sql: postgres.Sql, label: string) {
	const result = await sql`
		UPDATE skus
		SET supply = ${SUPPLY}
		WHERE id BETWEEN ${SKU_ID_MIN} AND ${SKU_ID_MAX}
	`;
	console.log(`${label}: reset ${result.count} SKUs to supply=${SUPPLY}`);
}

async function main() {
	const primary = process.env.DATABASE_URL;
	const shard1 = process.env.SHARD1_DATABASE_URL;
	const shard2 = process.env.SHARD2_DATABASE_URL;

	if (!primary) throw new Error("DATABASE_URL not set");

	const connections: Array<{ sql: postgres.Sql; label: string }> = [
		{ sql: connect(primary), label: "primary" },
	];

	if (shard1) connections.push({ sql: connect(shard1), label: "shard-1" });
	if (shard2) connections.push({ sql: connect(shard2), label: "shard-2" });

	await Promise.all(connections.map(({ sql, label }) => resetSupply(sql, label)));
	await Promise.all(connections.map(({ sql }) => sql.end()));

	console.log("Done.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
