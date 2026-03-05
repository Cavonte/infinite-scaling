import http from "k6/http";
import { check } from "k6";

// Override with: k6 run --env BASE_URL=http://localhost:3000 products.bench.js
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const MAX_PRODUCT_ID = 100000;
const HOT_PRODUCT_COUNT = 200; // top products that get 80% of traffic
const LIST_PAGE_SIZE = 30;
const LIST_CURSOR_COUNT = 50; // number of distinct cursors to simulate (spread across product IDs)
const WRITE_POOL_START = HOT_PRODUCT_COUNT + 1; // 201 — separate from hot read pool
const WRITE_POOL_SIZE = 1000; // fixed pool of products to update — keeps dataset stable

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
  },
  thresholds: {
    "http_req_duration{scenario:list_products}": ["p(95)<1000"],
    "http_req_duration{scenario:get_product}": ["p(95)<300"],
    "http_req_duration{scenario:update_product}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export function listProducts() {
  // simulate browsing different pages by spreading cursors evenly across product ID space
  const cursorIndex = Math.floor(Math.random() * LIST_CURSOR_COUNT);
  const cursor = cursorIndex * LIST_PAGE_SIZE;
  const res = http.get(`${BASE_URL}/products?limit=${LIST_PAGE_SIZE}&cursor=${cursor}`);
  check(res, {
    "list: status 200": (r) => r.status === 200,
  });
}

export function updateProduct() {
  //Intentionally targeting products not part of the hot read
  const id = WRITE_POOL_START + Math.floor(Math.random() * WRITE_POOL_SIZE);
  const res = http.put(
    `${BASE_URL}/products/${id}`,
    JSON.stringify({ price: +(Math.random() * 500).toFixed(2) }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, {
    "update: status 200": (r) => r.status === 200,
  });
}

export function getProduct() {
  // 80/20 split: hot products vs uniform random
  const id =
    Math.random() < 0.8
      ? Math.ceil(Math.random() * HOT_PRODUCT_COUNT)
      : Math.ceil(Math.random() * MAX_PRODUCT_ID);
  const res = http.get(`${BASE_URL}/products/${id}`);
  check(res, {
    "get: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
}
