import http from "k6/http";
import { check } from "k6";

// Override with: k6 run --env BASE_URL=http://localhost:3000 products.bench.js
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const MAX_PRODUCT_ID = 100_000;
const HOT_PRODUCT_COUNT = 200;   // products 1-200 → stores 1-20 (80% of reads)
const PRODUCTS_PER_STORE = 10;   // seed: store_id = Math.ceil(productId / 10)
const WRITE_POOL_START = 1201;   // products 1201-2200 → stores 121-220 (update_product writes here)
const WRITE_POOL_SIZE = 1000;
const ORDER_POOL_START = 2201;   // products 2201-6200 → stores 221-620 (place_order uses here)
const ORDER_POOL_SIZE = 4000;    // large pool → low SKU contention at 50/s
// Each store has 10 products — cursor pagination within a single store is meaningless (limit=30 covers all).
// storeId serves the same role the old cursor index did: 50 distinct cache keys warm in the first second.
const LIST_STORE_POOL = 50;
const MAX_USER_ID = 20_000;

// storeId is encoded in productId via the seed: store_id = ceil(productId / 10)
function storeIdForProduct(productId) {
  return Math.ceil(productId / PRODUCTS_PER_STORE);
}

export const options = {
  scenarios: {
    list_products: {
      executor: "constant-arrival-rate",
      rate: 1000,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 200,
      exec: "listProducts",
    },
    get_product: {
      executor: "constant-arrival-rate",
      rate: 5000,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 400,
      exec: "getProduct",
    },
    update_product: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: "updateProduct",
    },
    place_order: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: "placeOrder",
    },
  },
  thresholds: {
    "http_req_duration{scenario:list_products}": ["p(95)<1000"],
    "http_req_duration{scenario:get_product}": ["p(95)<300"],
    "http_req_duration{scenario:update_product}": ["p(95)<500"],
    "http_req_duration{scenario:place_order}": ["p(95)<1000"],
    "http_req_failed{scenario:get_product}": ["rate<0.01"],
    "http_req_failed{scenario:list_products}": ["rate<0.01"],
    "http_req_failed{scenario:update_product}": ["rate<0.01"],
  },
};

export function listProducts() {
  // storeId varies across LIST_STORE_POOL distinct values — each is a separate cache key.
  // No cursor: each store has 10 products, one page (limit=30) covers all of them.
  const storeId = Math.ceil(Math.random() * LIST_STORE_POOL);
  const res = http.get(`${BASE_URL}/stores/${storeId}/products/?limit=30`);
  check(res, {
    "list: status 200": (r) => r.status === 200,
  });
}

export function getProduct() {
  // 80/20 split: hot products 1-200 vs uniform random across full catalog
  const id =
    Math.random() < 0.8
      ? Math.ceil(Math.random() * HOT_PRODUCT_COUNT)
      : Math.ceil(Math.random() * MAX_PRODUCT_ID);
  const storeId = storeIdForProduct(id);
  const res = http.get(`${BASE_URL}/stores/${storeId}/products/${id}`);
  check(res, {
    "get: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
}

export function updateProduct() {
  // write pool is outside the hot read pool — no cache key overlap with getProduct
  const id = WRITE_POOL_START + Math.floor(Math.random() * WRITE_POOL_SIZE);
  const storeId = storeIdForProduct(id);
  const res = http.put(
    `${BASE_URL}/stores/${storeId}/products/${id}`,
    JSON.stringify({ price: +(Math.random() * 500).toFixed(2) }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, {
    "update: status 200": (r) => r.status === 200,
  });
}

export function placeOrder() {
  // spread users across the pool to prevent per-user lock contention
  const userId = (__VU % MAX_USER_ID) + 1;
  // large order pool (4000 products, 12000 SKUs) keeps per-SKU lock contention low
  const productId = ORDER_POOL_START + Math.floor(Math.random() * ORDER_POOL_SIZE);
  const storeId = storeIdForProduct(productId);
  // pick one of the 3 SKUs for this product
  const skuId = (productId - 1) * 3 + Math.ceil(Math.random() * 3);

  const res = http.post(
    `${BASE_URL}/stores/${storeId}/orders`,
    JSON.stringify({ userId, items: [{ skuId, productId, quantity: 1, price: 9.99 }] }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, {
    "order: 201 | 409 (contention) | 422 (no stock)":
      (r) => r.status === 201 || r.status === 409 || r.status === 422,
  });
}
