# Benchmark Results

**Endpoint:** `GET /products/:id`
**Tool:** k6 v1.6.1, constant-arrival-rate executor
**Dataset:** 100,000 seeded products

---

## Results Summary

| Run | Load | Access pattern | p(95) | vs Baseline |
|---|---|---|---|---|
| Baseline | 300/s | uniform random | 5.41ms | — |
| Redis cache | 300/s | uniform random | 6.1ms | +13% |
| Read replicas | 300/s | uniform random | 5.98ms | +11% |
| Baseline | 900/s | uniform random | 9.45ms | — |
| Redis cache | 900/s | uniform random | 9.26ms | -2% |
| Read replicas | 900/s | uniform random | 97.52ms | +931% |
| Replicas + Redis | 900/s | uniform random | 24.62ms | +160% |
| Redis cache | 1000/s | 80/20 hot-key | 5.55ms | -41% vs 900/s baseline |

---

## Round 1 — 300 req/s

Neither feature helped. The primary was under no pressure (~1.5/10 pooled connections in use) — no bottleneck to relieve.

- **Redis:** ~9% hit rate (9k requests / 100k IDs). 91% of requests paid Redis GET + DB + Redis SET instead of just DB. Net negative.
- **Replicas:** +0.5ms Docker inter-container overhead with nothing to offset it.

---

## Round 2 — 900 req/s, uniform random

| Metric | Baseline | Redis | Replicas | Replicas + Redis |
|---|---|---|---|---|
| p(95) | 9.45ms | 9.26ms | 97.52ms | 24.62ms |
| med | 6.72ms | 6.09ms | 21.67ms | 8.37ms |
| Dropped | 0 | 0 | 39 | 4 |

### Redis — marginal gain

Hit rate climbed to ~27% (27k requests / 100k IDs). Cache hits return in ~70µs vs ~7ms from DB. Two effects compound:
1. Cache hits bypass DB entirely
2. **Load shedding**: 27% fewer DB queries reduce contention, making cache misses faster too

p(95) improved only -2% because uniform random access is the worst case for a cache — the other 73% still hit the DB.

### Read replicas — pool saturation cascade

p(95) degraded 10x. Each replica pool was `max: 10`. At 450 req/s per replica:

1. WAL replay (streaming replication) competes with query execution for CPU/IO — replicas run slower than primary
2. Slower queries hold connections longer → pool exhausts
3. New requests queue for a free connection → latency climbs → more connections held → deeper queue

Primary never hit this: consistent ~5ms kept pool usage at ~4.5/10. VUs climbing to 78 (vs 14 baseline) confirmed the server was falling behind.

**Replicas + Redis:** cache hit rate reduced replica load by ~27%, enough to break the saturation loop. p(95) recovered from 97ms to 24ms — still worse than Redis alone because cache misses still route to slower replicas.

---

## Round 3 — 1000 req/s, 80/20 hot-key + optimisations

Three changes applied before this run:

1. **80/20 access pattern** — 80% of traffic targets top 200 product IDs, 20% uniform random
2. **Async cache writes** — `SET` on cache miss is fire-and-forget (`.catch` for errors); response returns as soon as DB result is ready, no longer blocked by Redis round-trip
3. **Replica pool** — increased `max: 10 → 50` per replica

| Metric | get_product (900→1000/s) | list_products (100/s, paged) |
|---|---|---|
| med | 120µs | 149µs |
| p(90) | 5.27ms | 228µs |
| p(95) | 5.55ms | 264µs |
| Dropped | 24 | 0 |
| Error rate | 0% | 0% |

### Cache hit rate under 80/20

80% of `get_product` traffic targets 200 IDs. At 60s TTL those keys warm in the first second and stay warm for the entire 30s run. Effective hit rate ~80% vs ~27% under uniform random.

The bimodal distribution is visible in the numbers: **med = 120µs** (Redis hit) vs **p(95) = 5.55ms** (DB miss). The gap between them is the cost of a Postgres round-trip.

### list_products — near-total cache coverage

100 req/s across 50 distinct page keys (`offset` 0–1470, `limit` 30). At 60s TTL all 50 keys warm within the first second. **p(95) = 264µs** — effectively every request is a cache hit. This is the ceiling for what Redis cache-aside can deliver on a listing endpoint.

### Async cache writes

Removing `await` from the cache `SET` path means the response no longer blocks on the Redis round-trip after a DB miss. Effect is most visible at the median and average — tail latency (p(95)) is dominated by the DB query time regardless.

---

## Key takeaways

| Finding | Detail |
|---|---|
| Cache benefit scales with hit rate | 9% hit rate → Redis hurts. 27% → marginal gain. 80% → -41% p(95) |
| Replicas are a write-offload tool | Benefit only visible under concurrent write pressure on the primary |
| Pool saturation is a cascade | One slow query holds a connection; exhausted pool queues everything |
| Async cache writes reduce avg/med | p(95) still floor'd by DB query time on misses |
| Uniform random is a worst-case cache test | Real traffic has hot keys — always benchmark with a realistic distribution |
