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
- [x] Set up ioredis connection (shared singleton via `src/lib/redis.ts`)
- [x] Implement cache-aside for `GET /products/:id` and `GET /products`
- [x] Implement cache invalidation on product create/update/delete
- [x] Test: verified cache hit/miss behavior via benchmarks
- [ ] Add pagination for `GET /products` — currently returns full table (~21MB), not benchmarkable at scale
- [ ] Failure scenario: kill Redis — does the app degrade gracefully or crash?

## Phase 5.5: Benchmark — Baseline vs Read Replicas vs Redis
- [x] Install k6 and Write k6 scenarios
- [x] Set up k6 (`k6/products.bench.js`, constant-arrival-rate executor)
- [x] Run benchmark 1: Baseline
- [x] Run benchmark 2: + Read replicas
- [x] Run benchmark 3: + Redis cache
- [x] Run benchmark 4: + Replicas and Redis combined
- [x] Documented results in `benchmark/RESULTS.md`
- [ ] Re-run with hot-key access pattern (80/20 split: top 200 products get 80% of traffic)
- [ ] Increase replica connection pool (max: 10 → 25-50) and retest replica saturation point
- [ ] Run benchmark 5: hot-key distribution (realistic traffic pattern)

## Phase 6: Sharding
- [ ] Create shard map config (store_id ranges -> PG connection strings)
- [ ] Build `ShardRouter` class (resolves shard key to Drizzle instance)
- [ ] Update Docker Compose to run multiple PG instances (2-3 shards)
- [ ] Run migrations across all shards
- [ ] Build API endpoints that route through ShardRouter
- [ ] Test: create stores on different shards, query correctly
- [ ] Document: how cross-shard queries are handled (or explicitly not supported)
- [ ] Failure scenario: take down one shard — what does the API return?
- [ ] Run benchmark 6: mixed read/write (proper replica test)
- [ ] Re-run with mixed read/write load to properly benchmark replica offloading
- [ ] Collect results for sharding phase once implemented

## Phase 7.1: Redis — Session & Cart Storage
- [ ] Implement cart storage in Redis (hash per cart, TTL expiry)
- [ ] API endpoints: add to cart, view cart, remove from cart
- [ ] Test: cart persists across requests, expires after TTL

## Phase 7.2: Redis — Rate Limiting
- [ ] Implement sliding window rate limiter middleware
- [ ] Apply to API endpoints (e.g., max 100 requests/minute)
- [ ] Test: verify requests are blocked after limit exceeded

## Phase 7.3: Redis — Distributed Locks
- [ ] Implement Redlock pattern for order submission
- [ ] Prevent double-order: acquire lock on `store:order:customer_id`
- [ ] Test: concurrent order submissions, only one succeeds

## Phase 8: Circuit Breaker
- [ ] Implement circuit breaker for database connections (open/half-open/closed states)
- [ ] Track failure rate per shard — open circuit on threshold breach
- [ ] Probe with single request in half-open state before closing
- [ ] Test: force shard failure, verify circuit opens and requests fail fast
- [ ] Document: why fail-fast is better than hanging threads

## Phase 9: Polish & Interview Prep
- [ ] Add API documentation / route summary
- [ ] Write README with architecture diagram and trade-offs per module
- [ ] Prepare talking points for each scaling pattern (see system_design_drills.md)
- [ ] Document one real failure you encountered per phase and how you fixed it
- [ ] Summarize benchmark results with before/after comparisons
