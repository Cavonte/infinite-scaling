import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { db } from "./db/db_router.js";
import { getRedis } from "./lib/redis.js";
import { productRoutes } from "./products/product.routes.js";
import { userRoutes } from "./users/user.routes.js";

const app = new Hono();

app.route("/users", userRoutes);
app.route("/products", productRoutes);

app.get("/health", (c) => {
	return c.json({ status: "ok" });
});

app.get("/health/db", async (c) => {
	try {
		const results = await Promise.allSettled([
			db.write`SELECT 1 as connected`,
			db.read`SELECT 1 as connected`,
		]);

		return c.json({ status: "ok", result: results });
	} catch (err) {
		return c.json({ status: "error", message: String(err) }, 500);
	}
});

app.get("/health/redis", async (c) => {
	try {
		const client = getRedis();
		if (client.status === "wait") await client.connect();
		const pong = await client.ping();
		return c.json({ status: "ok", ping: pong });
	} catch (err) {
		return c.json({ status: "error", message: String(err) }, 500);
	}
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
	console.log(`Server running on http://localhost:${info.port}`);
});
