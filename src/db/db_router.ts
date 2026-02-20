import postgres from "postgres";
import { env } from "../config/env.js";
import { features } from "../config/features.js";

const main = postgres(env.databaseUrl, { max: 10 });
const replicas = [
	postgres(env.databaseUrlReplica1, { max: 10 }),
	postgres(env.databaseUrlReplica2, { max: 10 }),
];

let counter = 0;

function nextReplica(): postgres.Sql {
	counter = (counter + 1) % replicas.length;
	return replicas[counter];
}

function read<T extends postgres.Row[] = postgres.Row[]>(
	strings: TemplateStringsArray,
	// biome-ignore lint/suspicious/noExplicitAny: mirrors postgres.Sql variadic parameter signature
	...values: any[]
): Promise<T> {
	if (!features.readReplicas) {
		console.log("Reading from Primary");
		return main<T>(strings, ...values);
	}
	const replica = nextReplica();
	console.log("Reding from Replica");
	return replica<T>(strings, ...values).catch((err: Error) => {
		console.warn(
			`[db_router] replica failed, falling back to primary: ${err.message}`,
		);
		return main<T>(strings, ...values);
	});
}

export const db = {
	read,
	get write(): postgres.Sql {
		return main;
	},
};
