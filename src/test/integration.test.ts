import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { db } from "../db/db_router.js";
import { orderRoutes } from "../orders/order.routes.js";
import { productRoutes } from "../products/product.routes.js";
import { userRoutes } from "../users/user.routes.js";

const app = new Hono()
	.route("/", orderRoutes)
	.route("/users", userRoutes)
	.route("/", productRoutes);

// Shared fixture IDs — set during tests, used in afterAll cleanup
let storeId: number;
let userId: number;
let productId: number;
let skuId: number;
let orderId: number;

beforeAll(async () => {
	// Seed uses explicit product/sku IDs which leaves sequences behind — advance them before inserting
	await db.write`SELECT setval('products_id_seq', GREATEST((SELECT MAX(id) FROM products), 1))`;
	await db.write`SELECT setval('skus_id_seq', GREATEST((SELECT MAX(id) FROM skus), 1))`;

	// No stores API — insert directly
	const [store] = await db.write<{ id: number }[]>`
		INSERT INTO stores (name, description, category)
		VALUES ('Integration Test Store', 'Created by integration tests', 'test')
		RETURNING id
	`;
	storeId = store.id;
});

afterAll(async () => {
	// Delete in FK-safe order
	if (orderId) {
		await db.write`DELETE FROM order_items WHERE order_id = ${orderId}`;
		await db.write`DELETE FROM orders WHERE id = ${orderId}`;
	}
	if (skuId) await db.write`DELETE FROM skus WHERE id = ${skuId}`;
	if (productId) await db.write`DELETE FROM products WHERE id = ${productId}`;
	if (storeId) await db.write`DELETE FROM stores WHERE id = ${storeId}`;
	if (userId) await db.write`DELETE FROM users WHERE id = ${userId}`;
});

describe("User happy path", () => {
	it("creates a user and returns 201 with the user body", async () => {
		const res = await app.request("/users", {
			method: "POST",
			body: JSON.stringify({ name: "Integration Test User", location: "Test City" }),
			headers: { "Content-Type": "application/json" },
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toMatchObject({ name: "Integration Test User", location: "Test City" });
		expect(typeof body.id).toBe("number");
		userId = body.id;
	});

	it("fetches the created user by id", async () => {
		const res = await app.request(`/users/${userId}`);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			id: userId,
			name: "Integration Test User",
			location: "Test City",
		});
	});
});

describe("Product happy path", () => {
	it("creates a product and returns 201 with the product body", async () => {
		const res = await app.request(`/stores/${storeId}/products/`, {
			method: "POST",
			body: JSON.stringify({ name: "Test Widget", price: "19.99", listed: true }),
			headers: { "Content-Type": "application/json" },
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toMatchObject({ name: "Test Widget", price: "19.99", listed: true, storeId });
		expect(typeof body.id).toBe("number");
		productId = body.id;
	});

	it("fetches the created product by id with an empty skus array", async () => {
		const res = await app.request(`/stores/${storeId}/products/${productId}`);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({ id: productId, name: "Test Widget", storeId });
		expect(body.skus).toEqual([]);
	});
});

describe("Order happy path", () => {
	beforeAll(async () => {
		// No SKU API — insert directly so we have a known supply level
		const [sku] = await db.write<{ id: number }[]>`
			INSERT INTO skus (product_id, description, supply)
			VALUES (${productId}, 'Standard', 10)
			RETURNING id
		`;
		skuId = sku.id;
	});

	it("places an order and returns 201 with the order id", async () => {
		const res = await app.request(`/stores/${storeId}/orders`, {
			method: "POST",
			body: JSON.stringify({
				userId,
				items: [{ productId, skuId, quantity: 2, price: 19.99 }],
			}),
			headers: { "Content-Type": "application/json" },
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(typeof body.id).toBe("number");
		orderId = body.id;
	});

	it("decrements sku supply by the ordered quantity", async () => {
		const [sku] = await db.write<{ supply: number }[]>`
			SELECT supply FROM skus WHERE id = ${skuId}
		`;
		expect(sku.supply).toBe(8); // 10 - 2
	});
});
