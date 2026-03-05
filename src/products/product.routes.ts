import { Hono } from "hono";
import { ryow } from "../middleware/ryow.js";
import { productService } from "./product.service.js";

export const productRoutes = new Hono<{
	Variables: { forcePrimary: boolean };
}>();

productRoutes.use(ryow);

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

productRoutes.get("/stores/:storeId/products/", async (c) => {
	const limit = Math.max(
		1,
		Math.min(MAX_LIMIT, Number(c.req.query("limit")) || DEFAULT_LIMIT),
	);
	const storeId = Number(c.req.param("storeId"));
	const cursor = Math.max(0, Number(c.req.query("cursor")) || 0);
	return c.json(await productService.listProducts(storeId, limit, cursor));
});

productRoutes.get("/stores/:storeId/products/:productId", async (c) => {
	try {
		const productId = Number(c.req.param("productId"));
		const storeId = Number(c.req.param("storeId"));
		const product = await productService.getByid(storeId, productId, c.get("forcePrimary"));
		return c.json(product);
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

productRoutes.post("/stores/:storeId/products/", async (c) => {
	try {
		const body = await c.req.json();
		const storeId = Number(c.req.param("storeId"));
		const product = await productService.createProduct(storeId, body);
		return c.json(product, 201, { "x-write-token": String(Date.now()) });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

productRoutes.put("/stores/:storeId/products/:productId", async (c) => {
	try {
		const productId = Number(c.req.param("productId"));
		const storeId = Number(c.req.param("storeId"));
		const body = await c.req.json();
		const product = await productService.updateProduct(storeId, productId, body);
		return c.json(product, 200, { "x-write-token": String(Date.now()) });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});

productRoutes.delete("/stores/:storeId/products/:productId", async (c) => {
	try {
		const productId = Number(c.req.param("productId"));
		const storeId = Number(c.req.param("storeId"));
		await productService.deleteProduct(storeId, productId);
		return new Response(null, { status: 204 });
	} catch (err) {
		return c.json({ error: (err as Error).message }, 404);
	}
});
