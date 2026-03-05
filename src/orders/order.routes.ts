import { Hono } from "hono";
import { orderService } from "./order.service.js";

export const orderRoutes = new Hono();

orderRoutes.post("/", async (c) => {
	try {
		const { userId, items } = await c.req.json();
		if (!userId) return c.json({ error: "userId is required" }, 400);
		if (!Array.isArray(items) || items.length === 0)
			return c.json({ error: "items must be a non-empty array" }, 400);

		const order = await orderService.placeOrder(userId, items);
		return c.json(order, 201);
	} catch (err) {
		const message = (err as Error).message;
		if (
			message.includes("Insufficient stock") ||
			message.includes("contention")
		) {
			return c.json({ error: message }, 409);
		}
		return c.json({ error: message }, 500);
	}
});

