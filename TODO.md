# Infinite Scaling - TODO

## Phase 1: Project Setup
- [ ] Initialize Node.js project with pnpm and TypeScript
- [ ] Configure `tsconfig.json`, `tsx`, linting
- [ ] Set up Docker Compose (PG primary + 2 replicas + Redis)
- [ ] Verify all containers start and are reachable

## Phase 2: Database Schema & ORM
- [ ] Define Drizzle schema: `stores`, `products`, `orders`, `order_items`
- [ ] Configure drizzle-kit for migrations
- [ ] Run initial migration against a single PG instance
- [ ] Seed sample data (a few stores, products)

## Phase 3: Read Replicas
- [ ] Configure PG streaming replication in Docker Compose (primary -> replicas)
- [ ] Build `createRoutedDb()` decorator (reads -> replica, writes -> primary)
- [ ] Implement round-robin load balancing across replicas
- [ ] Handle read-your-own-writes (route to primary after recent write)
- [ ] Test: verify reads hit replicas, writes hit primary
- [ ] Failure scenario: kill a replica — does the router fall back gracefully?

## Phase 4: Sharding
- [ ] Create shard map config (store_id ranges -> PG connection strings)
- [ ] Build `ShardRouter` class (resolves shard key to Drizzle instance)
- [ ] Update Docker Compose to run multiple PG instances (2-3 shards)
- [ ] Run migrations across all shards
- [ ] Build API endpoints that route through ShardRouter
- [ ] Test: create stores on different shards, query correctly
- [ ] Document: how cross-shard queries are handled (or explicitly not supported)
- [ ] Failure scenario: take down one shard — what does the API return?

## Phase 5: Redis — Cache-Aside
- [ ] Set up ioredis connection
- [ ] Implement cache-aside for product listings (GET /stores/:id/products)
- [ ] Implement cache invalidation on product create/update/delete
- [ ] Test: verify cache hit/miss behavior
- [ ] Failure scenario: kill Redis — does the app degrade gracefully or crash?

## Phase 6: Redis — Session & Cart Storage
- [ ] Implement cart storage in Redis (hash per cart, TTL expiry)
- [ ] API endpoints: add to cart, view cart, remove from cart
- [ ] Test: cart persists across requests, expires after TTL

## Phase 7: Redis — Rate Limiting
- [ ] Implement sliding window rate limiter middleware
- [ ] Apply to API endpoints (e.g., max 100 requests/minute)
- [ ] Test: verify requests are blocked after limit exceeded

## Phase 8: Redis — Distributed Locks
- [ ] Implement Redlock pattern for order submission
- [ ] Prevent double-order: acquire lock on `store:order:customer_id`
- [ ] Test: concurrent order submissions, only one succeeds

## Phase 8.5: Circuit Breaker
- [ ] Implement circuit breaker for database connections (open/half-open/closed states)
- [ ] Track failure rate per shard — open circuit on threshold breach
- [ ] Probe with single request in half-open state before closing
- [ ] Test: force shard failure, verify circuit opens and requests fail fast
- [ ] Document: why fail-fast is better than hanging threads

## Phase 9: Polish & Interview Prep
- [ ] Add API documentation / route summary
- [ ] Write README with architecture diagram and trade-offs per module
- [ ] Prepare talking points for each scaling pattern (see system_design_drills.md)
- [ ] Load test with multiple concurrent requests to demonstrate scaling
- [ ] Document one real failure you encountered per phase and how you fixed it
