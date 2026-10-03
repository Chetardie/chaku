---
name: new-module
description: Scaffold a module package in packages/modules/<name> the way identity is built (package, public entry point, Postgres schema, jobs with the Member erasure stub, seed, schema test against the data model doc) and register it in the worker, pnpm db:reset and the data model doc. Use when a ticket starts one of the modules from ADR-0003 and spec §5.2 (chat, games, results, feed, notifications, moderation, media), or the user says "new module" or "/new-module".
---

# New module

A module is a pnpm package in `packages/modules/<name>` with one public entry point (`src/index.ts`) and one Postgres schema named after it (ADR-0003, ADR-0007). `identity` is the example to copy. The scaffold below writes it the same way every time; don't create the files by hand.

## 1. Check it should exist

- The module is listed in ADR-0003 (amended by ADR-0007 and ADR-0014) and spec §5.2. A module that isn't needs a decision first: stop and use `/new-adr`.
- Read its section in [`docs/architecture/data-model.md`](../../../docs/architecture/data-model.md), the ADRs it names, and the [CONTEXT.md](../../../CONTEXT.md) terms for its area. Names in code follow CONTEXT.md.

## 2. Scaffold

```bash
node packages/config/src/agent/new-module.ts <name> "<what it owns, a few words>"
```

`<name>` is 2–30 lowercase letters; it becomes the folder, the package `@chaku/<name>` and the schema. The script refuses a module that exists. It writes:

| File | What |
|---|---|
| `package.json` | `@chaku/<name>`, `exports: { ".": "./src/index.ts" }`, `lint`/`typecheck`/`test`, versions from the catalog |
| `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `turbo.json` | the same as identity's |
| `src/index.ts` | the public entry point: exports the jobs, `eraseMember` and the seed |
| `src/schema.ts` | `export const <name> = snakeCase.schema('<name>')`, no tables yet |
| `src/jobs.ts` | `<name>Jobs: ModuleJobs` (no handlers yet) and `eraseMember(db, memberId)`, a list of erasure steps, empty |
| `src/seed.ts` | `seed<Name>(db)`, a list of seed steps, empty |
| `test/schema.test.ts` | `describeDataModelSchema('<name>', database)`: the migrated schema equals the doc section |
| `test/jobs.test.ts` | erasure runs twice to the same state; job payloads carry IDs only (D9) |

And it registers the module:
- `docs/architecture/data-model.md`: a `## \`<name>\`` section with an empty Erasure table, before `## Ranking`, unless the doc already has one (every planned module does)
- `apps/worker/src/modules.ts` and `apps/worker/package.json`: `<name>Jobs`
- `stack/src/database.ts` and `stack/package.json`: `seed<Name>` in the `pnpm db:reset` seeds, after identity's

## 3. Install, migrate, check

```bash
pnpm install
pnpm db:generate --name <name>_schema
```

Read the generated `packages/db/migrations/<timestamp>_<name>_schema/migration.sql`: it should be `CREATE SCHEMA "<name>";` and nothing else. Then:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm boundaries
pnpm format:check
```

All pass for a module with no tables. For a planned module whose doc section already lists tables, `test/schema.test.ts` fails until the tables exist: add them with the `new-migration` skill in the same branch.

## 4. Finish

- Add the module to the "Built so far" list under Layout in `CLAUDE.md`.
- Fill in the stubs as the ticket needs: tables (`new-migration`), public functions in `src/index.ts`, jobs with `defineJob`/`handle` in `src/jobs.ts` ([Jobs](../../../docs/architecture/overview.md#jobs)), fake seed rows.
- A table that stores Member data (any `ID → identity.members.id`) gets an erasure step in `src/jobs.ts`, a row in the doc's Erasure table, and a test. `eraseMember` isn't wired to `member.erasure_requested` yet; CHK-42 adds delivery to every module.

## Don't

- **No cross-module joins or foreign keys.** Another module's rows are referenced by ID only (`ID →` in the doc), and read through its batch functions, such as `identity.getProfiles(ids)` (ADR-0007). Never import another module's `schema.ts`.
- **No deep imports.** Other code imports only `@chaku/<name>`; never `@chaku/<name>/src/...`, and no second entry in `exports`. Inside the module, import another module only through its package name. `pnpm boundaries` fails otherwise (ADR-0003).
- **No shared data.** Code several modules need goes into `packages/content`, which owns no tables (ADR-0007).
- **No `graphile-worker` import.** Define and add jobs with `defineJob`, `addJob` and `handle` from `@chaku/db`; only `apps/worker` runs them (ADR-0008). Job payloads, logs and analytics never carry Message or Comment bodies (D9).
- **No tables without the doc.** A table, its doc section and its schema test change together (`new-migration`).
- **No `pnpm db:reset` against anything but your own local stack.** If other sessions share the stack, ask first. Never point any of this at production data (D9, ADR-0013).
