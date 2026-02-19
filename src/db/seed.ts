import postgres from "postgres";
import { faker } from "@faker-js/faker";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = postgres(DATABASE_URL, { max: 5 });

const BATCH_SIZE = 1000;

const STORES = 10_000;
const PRODUCTS = 100_000; // 10 per store
const SKUS_PER_PRODUCT = 3; // 300k skus
const USERS = 20_000;
const ORDERS = 2_000_000; // 100 per user
const ITEMS_PER_ORDER = 3; // 6M order_items

async function batchInsert<T extends Record<string, unknown>>(
	label: string,
	total: number,
	generator: (i: number) => T,
	insert: (rows: T[]) => Promise<unknown>,
) {
	console.log(`Seeding ${label} (${total.toLocaleString()} rows)...`);
	let inserted = 0;
	const rows: T[] = [];

	for (let i = 1; i <= total; i++) {
		rows.push(generator(i));

		if (rows.length === BATCH_SIZE || i === total) {
			await insert([...rows]);
			inserted += rows.length;
			rows.length = 0;

			if (inserted % 100_000 === 0 || inserted === total) {
				console.log(
					`  ${label}: ${inserted.toLocaleString()} / ${total.toLocaleString()}`,
				);
			}
		}
	}
}

async function main() {
	console.time("seed");

	await batchInsert(
		"stores",
		STORES,
		() => ({
			name: faker.company.name(),
			description: faker.company.catchPhrase(),
			category: faker.commerce.department(),
		}),
		(rows) => sql`INSERT INTO stores ${sql(rows)}`,
	);

	await batchInsert(
		"products",
		PRODUCTS,
		(i) => ({
			store_id: Math.ceil(i / 10),
			name: faker.commerce.productName(),
			description: faker.commerce.productDescription(),
			price: faker.commerce.price({ min: 1, max: 1000, dec: 2 }),
			listed: true,
		}),
		(rows) => sql`INSERT INTO products ${sql(rows)}`,
	);

	await batchInsert(
		"skus",
		PRODUCTS * SKUS_PER_PRODUCT,
		(i) => ({
			product_id: Math.ceil(i / SKUS_PER_PRODUCT),
			description: faker.commerce.productAdjective(),
			supply: faker.number.int({ min: 0, max: 500 }),
		}),
		(rows) => sql`INSERT INTO skus ${sql(rows)}`,
	);

	await batchInsert(
		"users",
		USERS,
		() => ({
			name: faker.person.fullName(),
			location: faker.location.city(),
		}),
		(rows) => sql`INSERT INTO users ${sql(rows)}`,
	);

	await batchInsert(
		"orders",
		ORDERS,
		(i) => ({
			user_id: Math.ceil(i / 100),
			status: faker.helpers.arrayElement([
				"pending",
				"paid",
				"shipped",
				"cancelled",
			]),
			created_at: faker.date.past({ years: 2 }),
			updated_at: faker.date.recent({ days: 30 }),
		}),
		(rows) => sql`INSERT INTO orders ${sql(rows)}`,
	);

	await batchInsert(
		"order_items",
		ORDERS * ITEMS_PER_ORDER,
		(i) => {
			const orderId = Math.ceil(i / ITEMS_PER_ORDER);
			const productId = faker.number.int({ min: 1, max: PRODUCTS });
			const skuId =
				(productId - 1) * SKUS_PER_PRODUCT +
				faker.number.int({ min: 1, max: SKUS_PER_PRODUCT });
			return {
				order_id: orderId,
				product_id: productId,
				sku_id: skuId,
				quantity: faker.number.int({ min: 1, max: 5 }),
				price: faker.commerce.price({ min: 1, max: 1000, dec: 2 }),
			};
		},
		(rows) => sql`INSERT INTO order_items ${sql(rows)}`,
	);

	console.timeEnd("seed");
	await sql.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
