---
status: accepted
date: 2026-09-30
amended-by: ADR-0007, ADR-0008
---

# Modular monolith with module packages and outbox events

The main app is one Next.js deployment (`apps/web`), but its business logic is split into modules. Each module is its own pnpm workspace package under `packages/modules/*` (identity, chat, games, results, feed, notifications, moderation, search; ADR-0007 replaced the shared `reactions` and `mentions` modules) with a single public entry point. Each module owns its tables in its own Postgres schema. Modules call each other directly through public entry points when the caller needs an answer now, and use events for side effects. Events are written in the same transaction as the data change, then processed after the save. _(Amended by ADR-0008: the outbox is Graphile Worker's job queue, with jobs added inside the transaction; there is no separate outbox table.)_ Other modules refer to a module's data by ID only; no joins across modules. `apps/web` holds routes, pages and wiring, not business logic. The monorepo runs on pnpm workspaces and Turborepo.

We chose this so a small team, and agents working in parallel, can change one module without understanding the whole app, and so a module could later be split out without rewriting its callers. Separate packages make boundaries enforced (pnpm refuses undeclared imports) rather than a naming convention. The outbox gives reliable events without adding a message broker.

## Considered options

- **One Next.js app with folders per feature:** simplest at first, but nothing enforces boundaries, and they erode quickly, especially with agents writing code.
- **Nx instead of Turborepo:** stronger generators and built-in boundary rules, but heavier. Claude project skills handle scaffolding, and dependency-cruiser handles boundary rules.
- **Microservices:** operational cost far beyond what the beta needs.

## Consequences

- dependency-cruiser in CI fails on deep imports into another module's internals, on imports from `apps/games/*` into app code, and on cycles.
- Cross-module reads that would have been joins become two queries, or a read model built from events.
- The outbox needs a worker and idempotent event handlers. ADR-0008 makes it Graphile Worker in a separate `apps/worker` process from day one.
- Screens that combine data from several modules follow ADR-0007: batch lookups, and counters stored with the item.
