import { Hono } from "hono";
import { ryow } from "../middleware/ryow.js";
import { productService } from "./product.service.js";

export const productRoutes = new Hono<{
	Variables: { forcePrimary: boolean };
}>();

productRoutes.use(ryow)

productRoutes.get("/", async (c) => {
	return c.json(await productService.listProducts());
});

productRoutes.get("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const product = await productService.getByid(id, c.get("forcePrimary"));
		return c.json(product);
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

productRoutes.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const product = await productService.createProduct(body)
		return c.json(product, 201, { "x-write-token": String(Date.now()) });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

productRoutes.put("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const body = await c.req.json();
		const product = await productService.updateProduct(id, body)
		return c.json(product, 200, { "x-write-token": String(Date.now()) });
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
