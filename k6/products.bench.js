import http from "k6/http";
import { check } from "k6";

// Override with: k6 run --env BASE_URL=http://localhost:3000 products.bench.js
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const MAX_PRODUCT_ID = 100000;

export const options = {
  scenarios: {
    // Heavy read on the list endpoint — biggest cache win expected here
    // list_products: {
    //   executor: "constant-arrival-rate",
    //   rate: 100,
    //   timeUnit: "1s",
    //   duration: "15s",
    //   preAllocatedVUs: 20,
    //   maxVUs: 80,
    //   exec: "listProducts",
    // },
    // Mixed single-product reads across random IDs
    get_product: {
      executor: "constant-arrival-rate",
      rate: 900,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: "getProduct",
    },
  },
  thresholds: {
    // Per-scenario latency targets
    "http_req_duration{scenario:list_products}": ["p(95)<1000"],
    "http_req_duration{scenario:get_product}": ["p(95)<300"],
    // Overall error rate must stay below 1%
    http_req_failed: ["rate<0.01"],
  },
};

// export function listProducts() {
//   const res = http.get(`${BASE_URL}/products`);
//   check(res, {
//     "list: status 200": (r) => r.status === 200,
//   });
// }

export function getProduct() {
  const id = Math.ceil(Math.random() * MAX_PRODUCT_ID);
  const res = http.get(`${BASE_URL}/products/${id}`);
  check(res, {
    "get: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
}
