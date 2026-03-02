# Benchmark Results

---

## Round 1 — 300 req/s (exploratory)

- **Tool:** k6 v1.6.1
- **Endpoint:** `GET /products/:id`
- **Executor:** constant-arrival-rate — 300 req/s for 30s
- **VUs:** preAllocatedVUs=30, maxVUs=120
- **Access pattern:** uniform random IDs across 100,000 seeded products
- **Threshold:** p(95) < 300ms

| Metric | Baseline | Redis Cache | Read Replicas |
|---|---|---|---|
| Requests | 9001 at 300/s | 9001 at 300/s | 9001 at 300/s |
| avg | 5.01ms | 5.39ms | 5.48ms |
| min | 4.58ms | 90.61µs | 5.03ms |
| med | 4.95ms | 5.49ms | 5.38ms |
| p(95) | 5.41ms | 6.1ms | 5.98ms |
| max | 25.46ms | 33.23ms | 26.74ms |
| Dropped | 0 | 0 | 0 |

### Key findings at 300 req/s

At this load the primary was under no meaningful pressure (~1.5 of 10 pooled connections in use). Neither feature improved results because there was no bottleneck to solve.

- **Redis** hurt p(95) slightly: only ~9% cache hit rate (9001 requests / 100k IDs). 91% of requests paid Redis GET + DB + Redis SET instead of just DB.
- **Replicas** added ~0.5ms overhead from Docker inter-container network routing with no benefit to offset it.

---

## Round 2 — 900 req/s (meaningful load)

- **Executor:** constant-arrival-rate — 900 req/s for 30s
- **VUs:** preAllocatedVUs=50, maxVUs=200
- **Access pattern:** same — uniform random IDs across 100,000 seeded products
- **Threshold:** p(95) < 300ms

| Metric | Baseline | Redis Cache | Read Replicas | Replicas + Redis |
|---|---|---|---|---|
| Requests | 27001 | 27001 | 26962 | 26996 |
| avg | 7.11ms | 6.17ms | 33.82ms | 10.87ms |
| min | 4.87ms | 68.63µs | 9.44ms | 76.88µs |
| med | 6.72ms | 6.09ms | 21.67ms | 8.37ms |
| p(90) | 8.27ms | 8.13ms | 66.19ms | 19.36ms |
| p(95) | 9.45ms | 9.26ms | 97.52ms | 24.62ms |
| max | 35ms | 180ms | 396ms | 213ms |
| VUs needed | 5–14 | 4–8 | 14–78 | 3–39 |
| Dropped | 0 | 0 | 39 | 4 |

---

## Analysis

### Redis Cache — starts helping at higher load

At 300/s Redis hurt (9% hit rate, overhead outweighs savings). At 900/s Redis helps (avg -13%, p(95) -2%):

```
300 req/s → 9,001 requests  / 100,000 IDs ≈  ~9% hit rate  → Redis hurts
900 req/s → 27,001 requests / 100,000 IDs ≈ ~27% hit rate  → Redis helps
```

Two effects compound at higher load:
1. Higher hit rate means more requests return in ~70µs (pure Redis, no DB)
2. **Load shedding**: cache hits reduce concurrent pressure on Postgres, making cache misses faster too — the backend queues less, so even the 73% of requests that miss the cache benefit indirectly

The higher max (180ms vs 35ms) reflects cold cache misses under pressure: Redis GET miss + Postgres query under contention + Redis SET on the way out creates occasional tail spikes.

**Redis cache benefit scales with load, not against it.**

### Read Replicas — catastrophic degradation at 900 req/s

At 300/s replicas added 0.5ms. At 900/s they degraded p(95) by 10x (9.45ms → 97.52ms). This is a feedback loop:

1. Replica containers do continuous WAL replay (streaming replication) which competes with query processing for CPU/IO
2. Replica queries run slightly slower than primary as a result
3. Each replica pool is `max: 10` connections. At 450 req/s per replica, any latency increase tips the pool toward saturation
4. Saturated pool → requests queue → latency climbs → more connections needed → deeper queue

The primary never hit this at 900/s because it held consistent ~5ms responses, keeping pool usage at ~4.5/10. The replicas started slower and couldn't recover.

VUs climbing to 78 (vs 14 for baseline) confirms the server was falling behind — k6 needed more concurrent workers to keep firing requests because responses were so slow.

### Replicas + Redis — cache rescues replicas from saturation

Adding Redis cache to the replica setup pulled p(95) from 97ms back to 24ms. The ~27% cache hit rate reduced load on each replica by ~27%, enough to prevent the worst pool saturation cascades. But cache misses still route to slow replicas, so the combined run is still worse than Redis alone against the primary (24ms vs 9.26ms).

Redis did not fix the replica problem — it masked enough of it to avoid collapse.

### The right scenario for read replicas

This benchmark had no concurrent writes. Read replicas are designed for:

```
Heavy writes saturating primary → read latency spikes on primary
With replicas → reads bypass the write queue entirely
```

To show replica benefit: run concurrent `POST /products` writes against the primary while benchmarking `GET /products/:id`. The baseline would degrade under write pressure; the replica run would hold steady.

---

## Summary Table

| Run | Load | p(95) | vs Baseline | Root cause |
|---|---|---|---|---|
| Baseline | 300/s | 5.41ms | — | — |
| Redis | 300/s | 6.1ms | +0.69ms | ~9% hit rate — overhead > savings |
| Replicas | 300/s | 5.98ms | +0.57ms | No bottleneck to relieve |
| Baseline | 900/s | 9.45ms | — | — |
| Redis | 900/s | 9.26ms | -0.19ms | ~27% hit rate + load shedding |
| Replicas | 900/s | 97.52ms | +88ms | WAL replay + pool saturation cascade |
| Replicas + Redis | 900/s | 24.62ms | +15ms | Cache reduces replica load enough to prevent collapse |


