import postgres from "postgres";
import { env } from "../config/env.js";
import { features } from "../config/features.js";

const main = postgres(env.databaseUrl, { max: 10 });
const replicas = [
	postgres(env.databaseUrlReplica1, { max: 10 }),
	postgres(env.databaseUrlReplica2, { max: 10 }),
];

let counter = 0;

export const db = {
	get read(): postgres.Sql {
		if (!features.readReplicas) return main;
		counter = (counter + 1) % replicas.length;
		return replicas[counter];
	},
	get write(): postgres.Sql {
		return main;
	},
};
