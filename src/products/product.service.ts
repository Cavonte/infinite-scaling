import { features } from "../config/features.js";
import { delKeys, delPattern, getKey, setKey } from "../lib/redis.js";
import {
	productRepository,
	type CreateProductInput,
	type UpdateProductInput,
} from "./product.repository.js";

const CACHE_TTL_SECONDS = 60;
const KEYS = {
	listKey: (storeId: number, limit: number, cursor?: number) =>
		`products:store:${storeId}:listed:cursor:${cursor ?? 0}:limit:${limit}`,
	listPattern: (storeId: number) => `products:store:${storeId}:listed:*`,
	product: (productId: number) => `products:${productId}`,
} as const;

export const productService = {
	async listProducts(storeId: number, limit: number, cursor?: number) {
		if (features.redisCache) {
			const key = KEYS.listKey(storeId, limit, cursor);
			const cached = await getKey(key);
			if (cached) return JSON.parse(cached);
		}

		const products = await productRepository.findAllListed(
			storeId,
			limit,
			cursor,
		);

		// 		Set key async
		if (features.redisCache) {
			setKey(
				KEYS.listKey(storeId, limit, cursor),
				JSON.stringify(products),
				CACHE_TTL_SECONDS,
			);
		}

		return products;
	},

	async getByid(
		storeId: number,
		productId: number,
		forcePrimary: boolean = false,
	) {
		if (features.redisCache) {
			const cached = await getKey(KEYS.product(productId));
			if (cached) return JSON.parse(cached);
		}

		const product = forcePrimary
			? await productRepository.findByIdPrimary(storeId, productId)
			: await productRepository.findById(storeId, productId);
		if (!product) throw new Error(`Product ${productId} not found`);

		if (features.redisCache) {
			setKey(
				KEYS.product(productId),
				JSON.stringify(product),
				CACHE_TTL_SECONDS,
			);
		}

		return product;
	},

	async createProduct(storeId: number, input: CreateProductInput) {
		if (!input.name?.trim()) throw new Error("name is required");
		if (!input.price) throw new Error("price is required");

		const product = await productRepository.create(storeId, input);

		if (features.redisCache) {
			delPattern(KEYS.listPattern(storeId));
		}

		return product;
	},

	async updateProduct(
		storeId: number,
		productId: number,
		input: UpdateProductInput,
	) {
		const product = await productRepository.update(storeId, productId, input);
		if (!product) throw new Error(`Product ${productId} not found`);

		if (features.redisCache) {
			//Todo cleaner way of doing this is to an a generation counter and use that in the product key.
			// `products:listed:${gen}:offset:${offset}:limit:${limit}`,
			// old keys will disappear eventually due to TTL
			delKeys(KEYS.product(productId));
			delPattern(KEYS.listPattern(storeId));
		}

		return product;
	},

	async deleteProduct(storeId: number, productId: number) {
		const deleted = await productRepository.delete(storeId, productId);
		if (!deleted) throw new Error(`Product ${productId} not found`);

		if (features.redisCache) {
			delKeys(KEYS.product(productId));
			delPattern(KEYS.listPattern(storeId));
		}
	},
};
