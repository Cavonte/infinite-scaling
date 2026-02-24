import { features } from "../config/features.js";
import { getRedis } from "../lib/redis.js";
import {
	productRepository,
	type CreateProductInput,
	type UpdateProductInput,
} from "./product.repository.js";

const CACHE_TTL_SECONDS = 60;
const KEYS = {
	list: "products:listed",
	product: (id: number) => `products:${id}`,
} as const;

export const productService = {
	async listProducts() {
		if (features.redisCache) {
			const cached = await getRedis().get(KEYS.list);
			if (cached) return JSON.parse(cached);
		}

		const products = await productRepository.findAllListed();

		if (features.redisCache) {
			await getRedis().set(
				KEYS.list,
				JSON.stringify(products),
				"EX",
				CACHE_TTL_SECONDS,
			);
		}

		return products;
	},

	async getByid(id: number, forcePrimary: boolean = false) {
		if (features.redisCache) {
			const cached = await getRedis().get(KEYS.product(id));
			if (cached) return JSON.parse(cached);
		}

		const product = forcePrimary
			? await productRepository.findByIdPrimary(id)
			: await productRepository.findById(id);
		if (!product) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			await getRedis().set(
				KEYS.product(id),
				JSON.stringify(product),
				"EX",
				CACHE_TTL_SECONDS,
			);
		}

		return product;
	},

	async createProduct(input: CreateProductInput) {
		if (!input.name?.trim()) throw new Error("name is required");
		if (!input.storeId) throw new Error("storeId is required");
		if (!input.price) throw new Error("price is required");

		const product = await productRepository.create(input);

		if (features.redisCache) {
			await getRedis().del(KEYS.list);
		}

		return product;
	},

	async updateProduct(id: number, input: UpdateProductInput) {
		const product = await productRepository.update(id, input);
		if (!product) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			await getRedis().del(KEYS.product(id), KEYS.list);
		}

		return product;
	},

	async deleteProduct(id: number) {
		const deleted = await productRepository.delete(id);
		if (!deleted) throw new Error(`Product ${id} not found`);

		if (features.redisCache) {
			await getRedis().del(KEYS.product(id), KEYS.list);
		}
	},
};
