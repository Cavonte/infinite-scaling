import { Hono } from "hono";
import { productService } from "./product.service.js";

export const productRoutes = new Hono();

productRoutes.get("/", async (c) => {
	return c.json(await productService.listProducts());
});



productRoutes.get("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		return c.json(await productService.getProduct(id));
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

productRoutes.post("/", async (c) => {
	try {
		const body = await c.req.json();
		return c.json(await productService.createProduct(body), 201);
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

productRoutes.put("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const body = await c.req.json();
		return c.json(await productService.updateProduct(id, body));
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

productRoutes.delete("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		await productService.deleteProduct(id);
		return new Response(null, { status: 204 });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});
