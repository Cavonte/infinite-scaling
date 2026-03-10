# Multi-tenant e-commerce marketplace

A progressive Node.js/TypeScript API exploring real-world scaling patterns in the context of an online store. 
This is a demo and reference for read replicas, Redis caching, distributed locks, rate limiting and sharding.

The store features products management, user management, and order management. 
Products and orders are scoped to stores, enabling shard routing by `store_id`.

See outcomes and analysis in the `benchmark/` folder.

## Stack

- **Runtime**: Node.js, TypeScript (ESM), tsx, pnpm
- **Framework**: Hono (`@hono/node-server`)
- **DB**: PostgreSQL via `postgres` (raw sql tags), Drizzle ORM for schema/migrations
- **Cache**: ioredis
- **Infra**: Docker Compose (pg-primary, replicas, shards + shard replicas, redis)
- **Lint/Format**: Biome

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- Docker / Podman + Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:
- `pg-primary` on port `5432`
- `pg-replica-1` on port `5433`
- `pg-replica-2` on port `5434`
- `pg-shard-1` on port `5435`
- `pg-shard-2` on port `5436`
- `pg-shard-1-replica` on port `5437`
- `pg-shard-2-replica` on port `5438`
- `redis` on port `6379`

### 2. Configure environment

```env
# Server
PORT=3000

# Database — primary + replicas (users, unsharded data)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/infinite_scaling
DATABASE_URL_REPLICA_1=postgres://postgres:postgres@localhost:5433/infinite_scaling
DATABASE_URL_REPLICA_2=postgres://postgres:postgres@localhost:5434/infinite_scaling

# Shards (products, skus — routed by store_id % 2)
DATABASE_URL_SHARD_1=postgres://postgres:postgres@localhost:5435/infinite_scaling
DATABASE_URL_SHARD_1_REPLICA=postgres://postgres:postgres@localhost:5437/infinite_scaling
DATABASE_URL_SHARD_2=postgres://postgres:postgres@localhost:5436/infinite_scaling
DATABASE_URL_SHARD_2_REPLICA=postgres://postgres:postgres@localhost:5438/infinite_scaling

# Redis
REDIS_URL=redis://localhost:6379

# Feature flags (all off by default)
FEATURE_READ_REPLICAS=false
FEATURE_REDIS_CACHE=false
FEATURE_SHARDING=false
FEATURE_RATE_LIMIT=false
```

### 3. Run migrations and seed

Migrations must be run against all databases

```bash
# Primary
pnpm db:migrate

# Shards
DATABASE_URL=postgres://postgres:postgres@localhost:5435/infinite_scaling pnpm db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5436/infinite_scaling pnpm db:migrate
```

Seed with sharding enabled so data is distributed correctly:

```bash
FEATURE_SHARDING=true pnpm db:seed
```

#### What the seed writes where

| Table | Primary | Shard 1 (even store_ids) | Shard 2 (odd store_ids) |
|---|---|---|---|
| `stores` | all 10k | all 10k (reference table) | all 10k (reference table) |
| `products` | all 100k | ~50k (`store_id % 2 == 0`) | ~50k (`store_id % 2 == 1`) |
| `skus` | all 300k | ~150k (follows products) | ~150k (follows products) |
| `users` | all 20k | — | — |
| `orders` | all 2M | — | — |
| `order_items` | all 6M | — | — |

**Stores are a reference table** — duplicated across all shards so FK constraints hold (`products.store_id → stores.id`). Products and SKUs use **explicit IDs** in the seed so all databases share the same ID space (each shard's auto-increment sequence would otherwise diverge and break FK lookups). Shard replicas receive data via streaming replication from their shard primary.

### 4. Start the dev server

```bash
pnpm dev
```

Server runs at `http://localhost:3000`.

## API

### Products (store-scoped)
```
GET    /stores/:storeId/products
GET    /stores/:storeId/products/:productId
POST   /stores/:storeId/products
PUT    /stores/:storeId/products/:productId
DELETE /stores/:storeId/products/:productId
```

### Orders
```
POST   /stores/:storeId/orders
```

### Users
```
GET    /users
GET    /users/:id
POST   /users
PUT    /users/:id
DELETE /users/:id
```

### Health
```
GET /health
GET /health/db
GET /health/redis
```

## Feature Flags

All flags are off by default. Toggle via env vars.

| Flag | Effect |
|---|---|
| `FEATURE_READ_REPLICAS` | Route reads to replicas (round-robin, with primary fallback) |
| `FEATURE_REDIS_CACHE` | Cache-aside for product reads. Keys scoped to `store_id`. |
| `FEATURE_SHARDING` | Route product/order writes to shard by `store_id % 2` |
| `FEATURE_RATE_LIMIT` | Sliding window rate limiting per IP |

## DB Routing

`db_router.ts` centralises all routing logic:

- `db.read` — replicas when `FEATURE_READ_REPLICAS=true`, else primary. Used by users.
- `db.write` — always primary. Used by users.
- `db.shard(storeId).read` — shard replica when both flags on, shard primary otherwise, falls back to primary when sharding off.
- `db.shard(storeId).write` — shard primary when sharding on, primary otherwise.
