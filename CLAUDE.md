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
  lib/
    redis.ts            # Shared lazy Redis singleton — getRedis() used by service layer + health check
  middleware/
    ryow.ts             # Read-your-own-writes middleware — sets forcePrimary on context after writes
  users/
    user.repository.ts  # Raw SQL: findAll, findById, findByIdOnPrimary, create, update, delete
    user.service.ts     # Business logic + validation, calls repository
    user.routes.ts      # Hono routes: GET / POST /:id PUT /:id DELETE /:id, uses ryow middleware
  products/
    product.repository.ts  # Raw SQL: findAllListed, findById (json_agg join), findByIdPrimary, create, update, delete
    product.service.ts     # Cache-aside logic (features.redisCache), calls repository
    product.routes.ts      # Hono routes: GET / GET /:id POST PUT /:id DELETE /:id, uses ryow middleware
docker-compose.yml      # PG primary + 2 replicas + Redis
drizzle.config.ts       # Drizzle-kit config
k6/
  products.bench.js     # k6 benchmark: constant-arrival-rate 900 req/s, GET /products/:id
benchmark/
  RESULTS.md            # Full benchmark results and analysis for all runs
```

## Scripts
- `pnpm dev` — tsx watch with .env
- `pnpm db:generate` — drizzle-kit generate migration
- `pnpm db:migrate` — run migrations
- `pnpm db:seed` — seed data
- `pnpm lint` / `pnpm format` — biome
- `pnpm bench` — k6 baseline (no features)

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

## Repository / Service / Route Pattern
All domain modules follow this structure (see users/ and products/ as reference):
- **repository** — raw SQL only, typed inputs/outputs, uses db.read/db.write
- **service** — validation, business logic, cache-aside if applicable
- **routes** — thin Hono handlers, parse request, call service, format response
- **ryow middleware** — applied to all route groups; sets `forcePrimary: boolean` on context; routes pass it down to service → repository to hit primary instead of replica when needed

## Cache-Aside Pattern (products)
Cache keys: `products:listed` (list), `products:{id}` (single). TTL: 60s.
- GET: check Redis → hit returns immediately, miss queries DB then populates cache
- POST/PUT/DELETE: write to DB then `del` affected keys
- All cache logic gated on `features.redisCache` — flag off = straight DB, no Redis overhead
