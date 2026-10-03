---
name: new-migration
description: Change a module's tables the Chaku way - data model doc, schema.ts, pnpm db:generate, read the SQL, seed and schema test together, then db:reset and tests - with two-step (expand, then contract) changes for a live database and Drizzle 1.0 RC's migration folder format. Use when adding or changing a table, column, index or check in packages/modules/*/src/schema.ts, or the user says "new migration" or "/new-migration".
---

# New migration

One Drizzle migration history covers every module schema (D36), in `packages/db/migrations`. Drizzle 1.0 RC writes one folder per migration: `<timestamp>_<name>/migration.sql` plus `snapshot.json` (the full schema state; generated, never edited, collapsed in GitHub diffs). drizzle-kit's own current docs are skills in `packages/db/node_modules/drizzle-kit/skills` (`drizzle-generate`, `drizzle-hints`).

## Steps

1. **Doc first.** Change the table in the module's section of [`docs/architecture/data-model.md`](../../../docs/architecture/data-model.md): the column table (`` `name` | `type` or `type null` | notes ``, `FK →` only inside the schema, `ID →` across modules), the "Keys and indexes" list (`_pkey`, `_<what>_key`, `_<what>_idx`, `_<what>_check`), the ER diagram, Counters, and a row in the Erasure table if the table stores Member data. `packages/config/test/data-model.test.ts` checks these rules.
2. **Schema.** Change `packages/modules/<name>/src/schema.ts` to match, in identity's style: `id: uuid().primaryKey().default(sql\`uuidv7()\`)`, `timestamp({ withTimezone: true })`, closed sets as `text` plus a named `check`, every index and check named as in the doc. Columns are camelCase in TypeScript; `snakeCase.schema('<name>')` makes them snake_case in Postgres.
3. **Generate.** `pnpm db:generate --name <what_changed>` (for example `chat_messages`). If drizzle-kit asks whether a column was renamed or dropped (`missing_hints`), decide deliberately: see the `drizzle-hints` skill, and the two-step rule below.
4. **Read the SQL** in the new `migration.sql`: names match the doc, defaults are right, no foreign key leaves the schema, nothing is dropped by surprise. SQL drizzle-kit can't write (an extension, a function an index needs) goes into this `migration.sql` by hand before it first runs. Never edit a migration that has run anywhere, including on `main`: write a new one.
5. **Seed and tests together.** Add fake rows to `src/seed.ts` (reserved `example.com` emails, fixed IDs and times, D23, ADR-0013). The module's `test/schema.test.ts` (`describeDataModelSchema`) reads the doc, so it checks the new table with no edit; identity's older test lists its tables by name, so update that list. Add tests for the ticket's behaviour, against real Postgres (D19).
6. **Run.** `pnpm db:reset` on your own local stack (it wipes local data; if other sessions share the stack, ask first, or skip it, since tests use their own databases). Then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm boundaries`. The `@chaku/db` test "has a migration for every change" fails while a schema change has no migration.

## Breaking changes: expand, then contract (D36)

Nothing is deployed before phase 4 (D55), but once a database is live, old code keeps running against the new schema during a deploy. A change that would break the running code goes out in two releases, each with its own migration and pull request:

1. **Expand:** add what's new without breaking what's there: a nullable column or a new table, a check added `NOT VALID`. Code writes both old and new, and reads the old. Backfill in batches (a job, ADR-0008), not in one long transaction.
2. **Contract**, once no running code uses the old shape: switch reads to the new column, then drop the old one, `SET NOT NULL`, or `VALIDATE CONSTRAINT`.

Breaking: renaming or dropping a column or table, changing a type, adding `NOT NULL` without a default, tightening a check. A rename is add, copy, then drop, never drizzle-kit's rename on a live table.

## Don't

- Don't add a foreign key into another module's schema or join across schemas (ADR-0007).
- Don't use Postgres enums: use `text` with a `check` (data model conventions).
- Don't put Message or Comment bodies anywhere but their own table (D9).
- Don't run migrations or `db:reset` against anything but a local or preview database (D9, ADR-0013).
