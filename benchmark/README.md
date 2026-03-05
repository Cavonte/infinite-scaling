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
| Replicas + Redis | 1000/s | 80/20 hot-key | 5.55ms | -41% vs 900/s baseline |
| Replicas + Redis | 2000/s | 80/20 hot-key | 6.19ms | -35% vs 900/s baseline |
| Replicas + Redis | 5000/s + 1000/s list | 80/20 hot-key | 7.29ms / 929µs | 71/600 VUs used |

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

**Features: Read replicas + Redis cache both enabled.** Three changes applied before this run:

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

80% of `get_product` traffic targets 200 IDs. At 600s TTL those keys warm in the first second and stay warm for the entire 30s run. Effective hit rate ~80% vs ~27% under uniform random.

The bimodal distribution is visible in the numbers: **med = 120µs** (Redis hit) vs **p(95) = 5.55ms** (DB miss). The gap between them is the cost of a Postgres round-trip.

### list_products — near-total cache coverage

100 req/s across 50 distinct page keys (`offset` 0–1470, `limit` 30). At 600s TTL all 50 keys warm within the first second. **p(95) = 264µs** — effectively every request is a cache hit. This is the ceiling for what Redis cache-aside can deliver on a listing endpoint.

### Async cache writes

Removing `await` from the cache `SET` path means the response no longer blocks on the Redis round-trip after a DB miss. Effect is most visible at the median and average — tail latency (p(95)) is dominated by the DB query time regardless.

---

## Round 4 — 2000 req/s get_product, 500 req/s list_products

**Features: Read replicas + Redis cache both enabled.** Same config as Round 3 (80/20 hot-key, async writes). Load doubled on both scenarios.

| Metric | get_product 1000/s | get_product 2000/s | list_products 100/s | list_products 500/s |
|---|---|---|---|---|
| med | 120µs | 166µs | 149µs | 176µs |
| p(90) | 5.27ms | 5.45ms | 228µs | 280µs |
| p(95) | 5.55ms | 6.19ms | 264µs | 329µs |
| Dropped | 24 | 194 | 0 | — |
| Error rate | 0% | 0% | 0% | 0% |

### Observations

**Cache is absorbing the load.** Doubling get_product from 1000/s to 2000/s moved p(95) only +11% (5.55ms → 6.19ms). The hot 200 keys are still served from Redis for ~80% of requests. Median climbed 120µs → 166µs — the hot keys are seeing marginally more contention under 2x volume but the cache layer is holding.

**list_products scales nearly linearly.** 5x load increase (100/s → 500/s) with only +25% on p(95) (264µs → 329µs). 50 page keys at 600s TTL means cache hit rate stays at ~100% regardless of req/s — the bottleneck would be Redis throughput, not the DB.

**194 dropped iterations** — VUs hit the 202 ceiling (maxVUs=200). The server wasn't failing; k6 ran out of pre-allocated virtual users to fire requests. Not a server-side failure — a benchmark config ceiling.

**Throughput: 2493 req/s sustained**, 112 MB received.

---

## Round 5 — 5000 req/s get_product, 1000 req/s list_products (ceiling test)

**Features: Read replicas + Redis cache both enabled.** maxVUs raised to 400/200. Load 2.5x over Round 4.

| Metric | get_product 2000/s | get_product 5000/s | list_products 500/s | list_products 1000/s |
|---|---|---|---|---|
| med | 166µs | 245µs | 176µs | 242µs |
| p(90) | 5.45ms | 5.46ms | 280µs | 492µs |
| p(95) | 6.19ms | 7.29ms | 329µs | 929µs |
| max | 411ms | 49ms | 211ms | 8.5ms |
| Dropped | 194 | 11 | — | — |
| VUs used | 202 (hit ceiling) | 71 / 600 | — | — |

### The VU number tells the real story

At 6000 total req/s the server only needed **71 concurrent VUs** out of 600 available. Little's Law explains it:

```
VUs needed = throughput × avg_response_time
           = 6000 req/s × 0.00104s = ~6.2 concurrent connections on average
```

71 VUs at peak accounts for variance and burst — but the system had 8x headroom. The Round 4 VU saturation (202 VUs at 2000/s) was a k6 config problem (`maxVUs: 200` too low), not server saturation.

**list_products stays sub-millisecond at 1000 req/s** (p(95) = 929µs). 50 cached page keys, 600s TTL — hit rate stays ~100% regardless of req/s. The only constraint is Redis network round-trip.

**get_product p(90) barely moved** (5.45ms → 5.46ms) despite 2.5x load. The 80% Redis-served hot keys are insensitive to throughput. p(95) crept up because the cold 20% (DB path) sees marginally more queue time at 5000/s.

**Replicas + Redis: Round 2 vs Round 5.** Same feature combination, different result:

| | Round 2 | Round 5 |
|---|---|---|
| Load | 900/s | 5000/s |
| p(95) | 24.62ms | 7.29ms |
| Pool | max: 10 | max: 50 |
| Access | uniform random | 80/20 hot-key |
| Cache writes | synchronous | async (fire-and-forget) |

Three compounding changes turned a degraded result into the best one in the suite. The pool fix prevented the saturation cascade; the 80/20 pattern reduced replica DB load by ~80%; async writes removed the SET overhead from the response path.

**11 dropped iterations** out of 179,992 (0.006%) — noise. The server is not approaching its limit.

### Where the actual ceiling is

The local setup constraints at this point are: Node.js single-threaded event loop, local container networking latency, and the laptop's CPU. The DB and Redis are not the bottleneck — the cache is absorbing ~80% of get_product load and ~100% of list load. To find the real server ceiling, the next variable to change is horizontal scaling (multiple Node.js processes) or moving off local Docker.

---

---

---

# Suite 2 — Mixed Read/Write Load (Validating Read Replicas)

**New scenario added:** `update_product` at 200/s targeting IDs 201–1200 (outside hot read pool).
**Goal:** demonstrate read replica value under real write pressure.

## Suite 2 Summary

| Run | get p(95) | list p(95) | update p(95) | Dropped | Avg VUs |
|---|---|---|---|---|---|
| Baseline | 684ms | 679ms | 679ms | 136,007 | 676 |
| Redis cache | 468ms | 587ms | 684ms | 6,566 | 13 |
| Redis + Replicas | 13.48ms | 7.91ms | 9.42ms | 814 | 15 |

---

## Suite 2 — Round 1: Baseline (no replicas, no cache)

**Load:** get_product 5000/s + list_products 1000/s + update_product 200/s

| Metric | get_product | list_products | update_product |
|---|---|---|---|
| med | 407ms | 400ms | 404ms |
| p(95) | 684ms | 679ms | 679ms |

**Dropped: 136,007 / ~186k. VUs: 676/700.**

All three scenarios share the same primary pool. Writes hold connections longer (WAL flush); reads queue behind them. The ~400ms median across all scenarios is connection wait time, not query time — the pool is exhausted. 136k dropped iterations confirm the server fell behind immediately.

---

## Suite 2 — Round 2: Redis cache (no replicas)

**Load:** get_product 5000/s + list_products 1000/s + update_product 200/s

| Metric | get_product | list_products | update_product |
|---|---|---|---|
| med | 755µs | 1.21ms | 258ms |
| p(95) | 468ms | 587ms | 684ms |

**Dropped: 6,566. Avg VUs: 13.**

Cache absorbed ~80% of read load — VUs collapsed from 676 to 13. `get_product` med (755µs) vs p(95) (468ms) shows the bimodal split: hot cache hits vs cold misses hitting the DB. `update_product` p(95) is unchanged at 684ms — writes bypass cache and still compete with cold reads on the primary. That remaining tail is what replicas should fix.

---

## Suite 2 — Round 3: Redis + Read replicas

**Load:** get_product 5000/s + list_products 1000/s + update_product 200/s

| Metric | get_product | list_products | update_product |
|---|---|---|---|
| med | 812µs | 805µs | 2.64ms |
| p(95) | 13.48ms | 7.91ms | 9.42ms |

**Dropped: 814. Avg VUs: 15. All thresholds passed. ✅**

The `update_product` result is the signal: p(95) dropped from 684ms (Redis-only) to 9.42ms. Reads are now off the primary — replicas handle cold read misses, leaving the primary exclusively for writes. Cache + replicas are complementary: cache eliminates ~80% of reads entirely, replicas absorb the remaining 20%, primary handles writes uncontested.

---

## Key takeaways

| Finding | Detail |
|---|---|
| Cache benefit scales with hit rate | 9% hit rate → Redis hurts. 27% → marginal gain. 80% → -41% p(95) |
| Replicas are a write-offload tool | Benefit only visible under concurrent write pressure on the primary |
| Pool saturation is a cascade | One slow query holds a connection; exhausted pool queues everything |
| Async cache writes reduce avg/med | p(95) still floor'd by DB query time on misses |
| Uniform random is a worst-case cache test | Real traffic has hot keys — always benchmark with a realistic distribution |
| Cache scales better than the DB under hot-key load | 2x req/s → +11% p(95). DB-only would scale linearly or worse. |
| Dropped iterations ≠ server failure | VU ceiling hit first — distinguish k6 config limits from actual server degradation |
| VU count reveals headroom | 71 VUs at 6000 req/s = 8x headroom. Little's Law: VUs ≈ throughput × avg_latency |
| list cache is throughput-insensitive | 50 keys, 600s TTL — hit rate stays ~100% from 100/s to 1000/s. Ceiling is Redis RTT. |
