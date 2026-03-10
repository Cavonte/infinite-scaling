import type postgres from "postgres";

export type TxSql = postgres.Sql & { readonly __tx: unique symbol };

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
	async decrementSupply(
		skuId: number,
		quantity: number,
		sql: TxSql,
	): Promise<Sku | null> {
		const rows = await sql<Sku[]>`
			UPDATE skus
			SET supply = supply - ${quantity}
			WHERE id = ${skuId}
			AND supply >= ${quantity}
			RETURNING id, supply
		`;
		return rows[0] ?? null;
	},

	async incrementSupply(
		skuId: number,
		quantity: number,
		sql: TxSql,
	): Promise<void> {
		await sql`
			UPDATE skus
			SET supply = supply + ${quantity}
			WHERE id = ${skuId}
		`;
	},

	async createOrder(
		userId: number,
		items: OrderItem[],
		sql: TxSql,
	): Promise<Order> {
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
