import type postgres from "postgres";

export type Sku = {
	id: number;
	supply: number;
};

export type OrderItem = {
	productId: number;
	skuId: number;
	quantity: number;
	price: number;
};

export type Order = {
	id: number;
	userId: number;
};

export const orderRepository = {
	async findSkuForUpdate(skuId: number, sql: postgres.Sql): Promise<Sku | null> {
		const rows = await sql<Sku[]>`
			SELECT id, supply FROM skus WHERE id = ${skuId} FOR UPDATE
		`;
		return rows[0] ?? null;
	},

	async decrementSupply(skuId: number, quantity: number, sql: postgres.Sql): Promise<Sku | null> {
		const rows = await sql<Sku[]>`
			UPDATE skus
			SET supply = supply - ${quantity}
			WHERE id = ${skuId} AND supply >= ${quantity}
			RETURNING id, supply
		`;
		return rows[0] ?? null;
	},

	async createOrder(userId: number, items: OrderItem[], sql: postgres.Sql): Promise<Order> {
		const rows = await sql<Order[]>`
			INSERT INTO orders (user_id) VALUES (${userId}) RETURNING id, user_id
		`;
		const order = rows[0];

		for (const item of items) {
			await sql`
				INSERT INTO order_items (order_id, product_id, sku_id, quantity, price)
				VALUES (${order.id}, ${item.productId}, ${item.skuId}, ${item.quantity}, ${item.price})
			`;
		}

		return order;
	},
};
