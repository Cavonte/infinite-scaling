# Infinite Scaling - Architecture Decisions

## Project Goal

Interview prep project to demonstrate deep understanding of scaling patterns. Build a working system, not just theory.

## Project Overview

A **multi-tenant e-commerce marketplace** (simplified Shopify) designed to demonstrate scaling patterns in TypeScript.

Multiple stores, each with products, orders, and customers. The architecture showcases sharding, read replicas, and Redis caching at scale.

## Why E-Commerce Marketplace

- **Sharding feels natural** — stores are isolated tenants, no cross-shard joins needed
- **Read/write split is obvious** — shoppers browse (reads) vs merchants manage inventory (writes)
- **Redis use cases are varied** — caching, sessions, carts, rate limiting
- **Scope stays small** — just stores, products, and orders

## Core Entities

- **Stores** — determines the shard
- **Products** — read-heavy, cache-friendly
- **Orders** — write-heavy, hits primary

## Tech Stack

| Concern | Decision | Package/Tool |
|---|---|---|
| Database | PostgreSQL | `postgres` (via Docker) |
| ORM | Drizzle | `drizzle-orm`, `drizzle-kit` |
| Sharding | App-level routing | Custom `ShardRouter` — hash/range-based routing by `store_id` |
| Read Replicas | Decorator/router pattern | Custom `createRoutedDb()` wrapping Drizzle |
| Redis client | ioredis | `ioredis` |
| Runtime | Node.js | `tsx` for TS execution, `pnpm` for packages |
| Containerization | Docker Compose | PG primary + replicas + Redis |

## Architecture Details

### Sharding (App-Level Routing)
- Build a **shard map** that assigns `store_id` ranges/hashes to specific PG instances
- `ShardRouter` resolves a shard key to the correct Drizzle DB instance
- Each shard is an independent PostgreSQL database
- Migrations run per-shard via drizzle-kit
- No cross-shard joins — queries are scoped to a single store

### Read Replicas (Decorator/Router Pattern)
- `createRoutedDb()` returns a Drizzle-compatible interface
- Internally routes: `SELECT` queries -> replica pool, mutations -> primary pool
- PostgreSQL streaming replication in Docker Compose (1 primary, 1-2 replicas)
- Key interview talking points:
  - **Replication lag** — stale reads from replicas
  - **Read-your-own-writes** — route to primary after a write within the same session
  - **Failover** — promoting a replica to primary
  - **Load balancing** — round-robin across replicas

### Redis Use Cases (ioredis)
1. **Cache-aside** — cache product listings by store, invalidate on product update
2. **Session/cart storage** — ephemeral data with TTL, no DB hit for active carts
3. **Rate limiting** — sliding window algorithm on API endpoints
4. **Distributed locks** — Redlock pattern to prevent double-order submission

## Decisions Log

- **Database: PostgreSQL** — best TypeScript ecosystem support, strong JSON (`jsonb`), Citus extension as a sharding upgrade path
- **ORM: Drizzle** — explicit control over multiple DB connections for sharding/replica routing, schema in TypeScript, built-in migrations via drizzle-kit
- **Sharding: App-level routing** — build shard map, ShardRouter, and per-shard migrations manually to understand sharding internals (interview prep)
- **Read Replicas: Decorator/router pattern** — `createRoutedDb()` that wraps Drizzle and automatically routes reads to replicas, writes to primary. PG streaming replication in Docker Compose. Key talking points: replication lag, read-your-own-writes, failover.
- **Redis: ioredis** — industry standard Node.js client. Four use cases: (1) cache-aside for product listings, (2) session/cart storage with TTL, (3) rate limiting with sliding window, (4) distributed locks via Redlock for double-order prevention.
- **Runtime: Node.js** — with pnpm for package management, tsx for native TypeScript execution. Familiar to interviewers, full ecosystem compatibility.
