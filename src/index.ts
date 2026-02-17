import { serve } from "@hono/node-server";
import { Hono } from "hono";
import postgres from "postgres";
import { Redis as IORedis } from "ioredis";
import { env } from "./config/env.js";

const app = new Hono();

// Lazy connections — created on first health check
let sql: postgres.Sql | null = null;
let redis: IORedis | null = null;

function getSQL() {
  return (sql ??= postgres(env.databaseUrl, { max: 1 }));
}

function getRedis() {
  return (redis ??= new IORedis(env.redisUrl, { lazyConnect: true }));
}


app.get("/health", (c) => {
  return c.json({ status: "ok" });
});


app.get("/health/db", async (c) => {
  try {
    const result = await getSQL()`SELECT 1 as connected`;
    return c.json({ status: "ok", result: result[0] });
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
