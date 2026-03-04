import { features } from "../config/features.js";
import { delKeys, delPattern, getKey, setKey } from "../lib/redis.js";
import {
	productRepository,
	type CreateProductInput,
	type UpdateProductInput,
} from "./product.repository.js";

const CACHE_TTL_SECONDS = 600;
const KEYS = {
	listKey: (cursor?: number, limit: number) =>
		`products:listed:cursor:${cursor ?? 0}:limit:${limit}`,
	listPattern: "products:listed:*",
	product: (id: number) => `products:${id}`,
} as const;

export const productService = {
	async listProducts(limit: number, cursor?: number) {
		if (features.redisCache) {
			console.log("Cache Hit");
			const key = KEYS.listKey(cursor, limit);
			const cached = await getKey(key);
			if (cached) return JSON.parse(cached);
		}

		const products = await productRepository.findAllListed(limit, cursor);

		if (features.redisCache) {
			setKey(
				KEYS.listKey(cursor, limit),
				JSON.stringify(products),
				CACHE_TTL_SECONDS,
			);
		}

		return products;
	},

	async getByid(id: number, forcePrimary: boolean = false) {
		if (features.redisCache) {
			const cached = await getKey(KEYS.product(id));
			if (cached) return JSON.parse(cached);
		}

		const product = forcePrimary
			? await productRepository.findByIdPrimary(id)
			: await productRepository.findById(id);
		if (!product) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			setKey(KEYS.product(id), JSON.stringify(product), CACHE_TTL_SECONDS);
		}

		return product;
	},

	async createProduct(input: CreateProductInput) {
		if (!input.name?.trim()) throw new Error("name is required");
		if (!input.storeId) throw new Error("storeId is required");
		if (!input.price) throw new Error("price is required");

		const product = await productRepository.create(input);

		if (features.redisCache) {
			delPattern(KEYS.listPattern);
		}

		return product;
	},

	async updateProduct(id: number, input: UpdateProductInput) {
		const product = await productRepository.update(id, input);
		if (!product) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			//Todo cleaner way of doing this is to an a generation counter and use that in the product key.
			// `products:listed:${gen}:offset:${offset}:limit:${limit}`,
			// old keys will disappear eventually due to TTL
			delKeys(KEYS.product(id));
			delPattern(KEYS.listPattern);
		}

		return product;
	},

	async deleteProduct(id: number) {
		const deleted = await productRepository.delete(id);
		if (!deleted) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			delKeys(KEYS.product(id));
			delPattern(KEYS.listPattern);
		}
	},
};
