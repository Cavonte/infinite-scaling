import { db } from "../db/db_router.js";

export type Product = {
	id: number;
	storeId: number;
	name: string;
	description: string | null;
	price: string;
	listed: boolean;
};

export type Sku = {
	id: number;
	description: string | null;
	supply: number;
};

export type ProductWithSkus = Product & { skus: Sku[] };

export type CreateProductInput = {
	storeId: number;
	name: string;
	description?: string;
	price: string;
	listed?: boolean;
};

export type UpdateProductInput = {
	name?: string;
	description?: string;
	price?: string;
	listed?: boolean;
};

export const productRepository = {
	async findAllListed(): Promise<Product[]> {
		return db.read<Product[]>`
      SELECT id, store_id AS "storeId", name, description, price, listed
      FROM products
      WHERE listed = true
      ORDER BY id
    `;
	},

	async findById(id: number): Promise<ProductWithSkus | null> {
		const rows = await db.read<ProductWithSkus[]>`
      SELECT
        p.id,
        p.store_id AS "storeId",
        p.name,
        p.description,
        p.price,
        p.listed,
        COALESCE(
          json_agg(json_build_object('id', s.id, 'description', s.description, 'supply', s.supply))
          FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS skus
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id
      WHERE p.id = ${id}
      GROUP BY p.id
    `;
		return rows[0] ?? null;
	},

	async create(input: CreateProductInput): Promise<Product> {
		const rows = await db.write<Product[]>`
      INSERT INTO products (store_id, name, description, price, listed)
      VALUES (${input.storeId}, ${input.name}, ${input.description ?? null}, ${input.price}, ${input.listed ?? false})
      RETURNING id, store_id AS "storeId", name, description, price, listed
    `;
		return rows[0];
	},

	async update(id: number, input: UpdateProductInput): Promise<Product | null> {
		const rows = await db.write<Product[]>`
      UPDATE products
      SET
        name        = COALESCE(${input.name ?? null}, name),
        description = COALESCE(${input.description ?? null}, description),
        price       = COALESCE(${input.price ?? null}, price),
        listed      = COALESCE(${input.listed ?? null}, listed)
      WHERE id = ${id}
      RETURNING id, store_id AS "storeId", name, description, price, listed
    `;
		return rows[0] ?? null;
	},

	async delete(id: number): Promise<boolean> {
		const rows = await db.write<{ id: number }[]>`
      DELETE FROM products WHERE id = ${id} RETURNING id
    `;
		return rows.length > 0;
	},
};
