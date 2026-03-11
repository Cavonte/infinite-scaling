// Redlock 5 beta omits a `types` condition from its package.json `exports` map,
// so NodeNext module resolution can't find the built-in types. This ambient
// declaration covers the subset used by order.service.ts.
declare module "redlock" {
	import { EventEmitter } from "events";

	interface Settings {
		readonly driftFactor: number;
		readonly retryCount: number;
		readonly retryDelay: number;
		readonly retryJitter: number;
		readonly automaticExtensionThreshold: number;
	}

	export class ExecutionError extends Error {
		readonly attempts: ReadonlyArray<Promise<unknown>>;
		constructor(message: string, attempts: ReadonlyArray<Promise<unknown>>);
	}

	export class Lock {
		readonly resources: string[];
		readonly value: string;
		expiration: number;
		release(): Promise<unknown>;
		extend(duration: number): Promise<Lock>;
	}

	export default class Redlock extends EventEmitter {
		constructor(
			clients: Iterable<unknown>,
			settings?: Partial<Settings>,
		);
		acquire(
			resources: string[],
			duration: number,
			settings?: Partial<Settings>,
		): Promise<Lock>;
	}
}
