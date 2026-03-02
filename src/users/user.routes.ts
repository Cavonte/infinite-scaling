import { Hono } from "hono";
import { ryow } from "../middleware/ryow.js";
import { userService } from "./user.service.js";

export const userRoutes = new Hono<{
	Variables: { forcePrimary: boolean };
}>();

userRoutes.use(ryow);

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

userRoutes.get("/", async (c) => {
	const limit = Math.max(
		1,
		Math.min(MAX_LIMIT, Number(c.req.query("limit")) || DEFAULT_LIMIT),
	);
	const offset = Math.max(0, Number(c.req.query("offset")) || 0);
	return c.json(await userService.listUsers(limit, offset));
});

userRoutes.get("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const user = await userService.getUser(id, c.get("forcePrimary"));
		return c.json(user);
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

userRoutes.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const user = await userService.createUser(body);
		return c.json(user, 201, { "x-write-token": String(Date.now()) });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

userRoutes.put("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const body = await c.req.json();
		const user = await userService.updateUser(id, body);
		return c.json(user, 200, { "x-write-token": String(Date.now()) });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

userRoutes.delete("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		await userService.deleteUser(id);
		return new Response(null, { status: 204 });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});
