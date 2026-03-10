import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		testTimeout: 15000,
		setupFiles: ["./src/test/setup.ts"],
	},
});
