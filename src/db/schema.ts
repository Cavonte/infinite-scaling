import { serial, integer, text, boolean, numeric, timestamp, pgTable } from "drizzle-orm/pg-core";

export const stores = pgTable('stores', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
});

export const products = pgTable('products', {
    id: serial('id').primaryKey(),
    storeId: integer('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    listed: boolean('listed').notNull().default(false),
});

export const skus = pgTable('skus', {
    id: serial('id').primaryKey(),
    description: text('description'),
    product: integer('product_id').notNull().references(() => products.id),
    supply: integer('supply').notNull()
});

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    location: text('location'),
});

export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id),
    productId: integer('product_id').notNull().references(() => products.id),
    skuId: integer('sku_id').notNull().references(() => skus.id),
    quantity: integer('quantity').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
});
