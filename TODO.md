# Infinite Scaling - TODO

## Phase 1: Project Setup
- [x] Initialize Node.js project with pnpm and TypeScript
- [x] Configure `tsconfig.json`, `tsx`, linting
- [x] Set up Docker Compose (PG primary + 2 replicas + Redis)
- [x] Verify all containers start and are reachable

## Phase 2: Database Schema & ORM
- [x] Define Drizzle schema: `stores`, `products`, `orders`, `order_items`
- [x] Configure drizzle-kit for migrations
- [x] Run initial migration against a single PG instance
- [x] Seed sample data (10k stores, 100k products, 2M orders, 6M order_items)

## Phase 3: Feature Flags & Config
- [x] Create `scalingConfig` object (sharding, readReplicas, redisCache, rateLimit, distributedLocks)
- [x] Wire flags into app so each layer checks its flag before routing
- [x] All flags default to `false` (baseline mode)

## Phase 4: Read Replicas
- [x] Configure PG streaming replication in Docker Compose (primary -> replicas)
- [x] Build `db_router.ts` module-level singleton (reads -> replica, writes -> primary)
- [x] Implement round-robin load balancing across replicas
- [x] Handle read-your-own-writes (route to primary after recent write)
- [x] Test: verify reads hit replicas, writes hit primary
- [x] Failure scenario: kill a replica — does the router fall back gracefully?

## Phase 5: Redis — Cache-Aside
- [ ] Set up ioredis connection
- [ ] Implement cache-aside for product listings (GET /stores/:id/products)
- [ ] Implement cache invalidation on product create/update/delete
- [ ] Test: verify cache hit/miss behavior
- [ ] Failure scenario: kill Redis — does the app degrade gracefully or crash?

## Phase 5.5: Benchmark — Baseline vs Read Replicas vs Redis
- [ ] Build `GET /stores/:id/products` endpoint (baseline — direct primary query)
- [ ] Run k6 load test: baseline, record p50/p95/p99 latency + RPS
- [ ] Enable read replica routing, re-run k6, compare
- [ ] Enable Redis cache, re-run k6, compare
- [ ] Document results: what improved, by how much, and why

## Phase 6: Sharding
- [ ] Create shard map config (store_id ranges -> PG connection strings)
- [ ] Build `ShardRouter` class (resolves shard key to Drizzle instance)
- [ ] Update Docker Compose to run multiple PG instances (2-3 shards)
- [ ] Run migrations across all shards
- [ ] Build API endpoints that route through ShardRouter
- [ ] Test: create stores on different shards, query correctly
- [ ] Document: how cross-shard queries are handled (or explicitly not supported)
- [ ] Failure scenario: take down one shard — what does the API return?

## Phase 7: Redis — Session & Cart Storage
- [ ] Implement cart storage in Redis (hash per cart, TTL expiry)
- [ ] API endpoints: add to cart, view cart, remove from cart
- [ ] Test: cart persists across requests, expires after TTL

## Phase 8: Redis — Rate Limiting
- [ ] Implement sliding window rate limiter middleware
- [ ] Apply to API endpoints (e.g., max 100 requests/minute)
- [ ] Test: verify requests are blocked after limit exceeded

## Phase 9: Redis — Distributed Locks
- [ ] Implement Redlock pattern for order submission
- [ ] Prevent double-order: acquire lock on `store:order:customer_id`
- [ ] Test: concurrent order submissions, only one succeeds

## Phase 10: Circuit Breaker
- [ ] Implement circuit breaker for database connections (open/half-open/closed states)
- [ ] Track failure rate per shard — open circuit on threshold breach
- [ ] Probe with single request in half-open state before closing
- [ ] Test: force shard failure, verify circuit opens and requests fail fast
- [ ] Document: why fail-fast is better than hanging threads

## Phase 11: Benchmarking with k6
- [ ] Install k6
- [ ] Write k6 scenario: 1,000 RPS, 70/30 read/write mix
- [ ] Run benchmark 1: Baseline (all flags off)
- [ ] Run benchmark 2: + Read replicas
- [ ] Run benchmark 3: + Redis cache
- [ ] Run benchmark 4: + Sharding
- [ ] Collect p50/p95/p99 latency, throughput, error rate for each run
- [ ] Compare results and document improvements

## Phase 12: Polish & Interview Prep
- [ ] Add API documentation / route summary
- [ ] Write README with architecture diagram and trade-offs per module
- [ ] Prepare talking points for each scaling pattern (see system_design_drills.md)
- [ ] Document one real failure you encountered per phase and how you fixed it
- [ ] Summarize benchmark results with before/after comparisons
