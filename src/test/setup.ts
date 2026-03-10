import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env before any module that reads process.env at import time (env.ts)
const envPath = resolve(process.cwd(), ".env");
try {
	const lines = readFileSync(envPath, "utf-8").split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const val = trimmed.slice(eq + 1).trim();
		if (!(key in process.env)) process.env[key] = val;
	}
} catch {
	// .env not found — assume env vars are already set in the environment
}
