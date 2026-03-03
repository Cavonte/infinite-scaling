import http from "k6/http";
import { check } from "k6";

// Override with: k6 run --env BASE_URL=http://localhost:3000 products.bench.js
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const MAX_PRODUCT_ID = 100000;
const HOT_PRODUCT_COUNT = 200; // top products that get 80% of traffic
const LIST_PAGE_SIZE = 30;
const LIST_MAX_PAGES = 50; // browse up to page 50 (offsets 0–1470)

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
  },
  thresholds: {
    "http_req_duration{scenario:list_products}": ["p(95)<1000"],
    "http_req_duration{scenario:get_product}": ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

export function listProducts() {
  const page = Math.floor(Math.random() * LIST_MAX_PAGES);
  const offset = page * LIST_PAGE_SIZE;
  const res = http.get(`${BASE_URL}/products?limit=${LIST_PAGE_SIZE}&offset=${offset}`);
  check(res, {
    "list: status 200": (r) => r.status === 200,
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
