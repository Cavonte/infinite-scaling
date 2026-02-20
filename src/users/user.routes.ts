import { Hono } from "hono";
import { userService } from "./user.service.js";

export const userRoutes = new Hono();

userRoutes.get("/", async (c) => {
	return c.json(await userService.listUsers());
});

userRoutes.get("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		return c.json(await userService.getUser(id));
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

userRoutes.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const user = await userService.createUser(body);
		return c.json(user, 201);
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

userRoutes.put("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const body = await c.req.json();
		return c.json(await userService.updateUser(id, body));
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
