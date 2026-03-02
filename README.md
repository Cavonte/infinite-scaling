# Sample Large Scale App

A progressive Node.js/TypeScript API exploring real-world scaling patterns. This is is a demo and referrence for read replicas, Redis caching, sharding, rate limiting, and distributed locks.

See outcomes and analysis in benchMark folder

## Stack

- **Runtime**: Node.js, TypeScript (ESM), tsx, pnpm
- **Framework**: Hono (`@hono/node-server`)
- **DB**: PostgreSQL via `postgres` (raw sql tags), Drizzle ORM for schema/migrations
- **Cache**: ioredis
- **Infra**: Docker Compose (pg-primary, pg-replica-1, pg-replica-2, redis)
- **Lint/Format**: Biome

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- Docker + Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:
- `pg-primary` on port `5432`
- `pg-replica-1` on port `5433`
- `pg-replica-2` on port `5434`
- `redis` on port `6379`

### 2. Configure environment

Create a `.env` file in the project root:

```env
# Server
PORT=3000

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/infinite_scaling
DATABASE_URL_REPLICA_1=postgres://postgres:postgres@localhost:5433/infinite_scaling
DATABASE_URL_REPLICA_2=postgres://postgres:postgres@localhost:5434/infinite_scaling

# Redis
REDIS_URL=redis://localhost:6379

# Feature flags (all off by default)
FEATURE_READ_REPLICAS=false
FEATURE_REDIS_CACHE=false
FEATURE_SHARDING=false
FEATURE_RATE_LIMIT=false
FEATURE_DISTRIBUTED_LOCKS=false
```

### 3. Run migrations and seed
db:migrate This creates the basic structure and schema. I.e. User, Product, Sku, Order and Order Items.
db:seed Fills up the schema with 8 millions rows. I.e. enough to cause a read query to take around 50ms.

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Start the dev server

```bash
pnpm dev
```

Server runs at `http://localhost:3000`.
