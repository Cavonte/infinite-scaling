# Project: infinite-scaling

## Stack
- Runtime: Node.js, TypeScript (ESM), tsx, pnpm
- Framework: Hono (`@hono/node-server`)
- DB: PostgreSQL via `postgres` (raw sql tags), Drizzle ORM for schema/migrations
- Cache: ioredis (IORedis)
- Infra: Docker Compose (pg-primary, pg-replica-1, pg-replica-2, redis)
- Lint/Format: Biome

## Key Files
```
src/
  index.ts              # Hono app, routes, server entrypoint
  config/
    env.ts              # Env vars — exports `env` object + `optional()`/`required()` helpers
    features.ts         # Feature flags — exports `features` object (all default false)
  db/
    db_router.ts        # Read/write router — db.read (replica or primary) / db.write (primary)
    schema.ts           # Drizzle schema: stores, products, skus, users, orders, order_items
    seed.ts             # Seed script (faker), run with `pnpm db:seed`
docker-compose.yml      # PG primary + 2 replicas + Redis
drizzle.config.ts       # Drizzle-kit config
```

## Scripts
- `pnpm dev` — tsx watch with .env
- `pnpm db:generate` — drizzle-kit generate migration
- `pnpm db:migrate` — run migrations
- `pnpm db:seed` — seed data
- `pnpm lint` / `pnpm format` — biome

## Feature Flags (`src/config/features.ts`)
Toggle via env vars or by editing defaults. All off = baseline mode.
- `readReplicas` — route reads to PG replicas
- `redisCache` — cache-aside for product listings
- `sharding` — ShardRouter for multi-PG
- `rateLimit` — sliding window middleware
- `distributedLocks` — Redlock on order submission

## DB Router Pattern
`db.read` → replica (round-robin) when `features.readReplicas`, else primary
`db.write` → always primary
Uses raw `postgres` sql tags (not Drizzle query builder) in routes.

## Phases (current: Phase 3)
1 ✅ Setup | 2 ✅ Schema+Seed | 3 🔄 Feature Flags | 4 Read Replicas | 5 Redis Cache
5.5 Benchmark | 6 Sharding | 7-9 Redis (cart/rate/locks) | 10 Circuit Breaker
11 k6 Benchmarks | 12 Polish
