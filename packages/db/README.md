# @chaku/db

The database plumbing every module and app shares. It owns no tables and imports no module (ADR-0007); each module declares its tables in `packages/modules/<name>/src/schema.ts` with `snakeCase.schema('<name>')`.

- **Entry points:** `@chaku/db` is what apps and modules use at runtime: the client, transactions and the types. Apps bundle it, so it reads no files. `@chaku/db/migrate` has the migrations, `resetDatabase` and `loadLocalEnv` for scripts, the stack and tests.
- **Client:** `createDatabase(url)` gives a Drizzle client over a `pg` pool.
- **Transactions:** `transaction(db, async ({ tx, client }) => …)` runs Drizzle writes and raw SQL on the `pg` client in one transaction. Jobs are added with raw SQL in the same transaction as the change (ADR-0008).
- **Migrations:** one history for every module schema in [`migrations/`](migrations) (D36). After changing a `schema.ts`, run `pnpm db:generate` and read the SQL. A test fails while a schema change has no migration. Hand-written SQL, such as an extension or a function an index needs, goes into the generated `migration.sql` before the first run; never edit a migration that has run anywhere.
- **Tests:** module tests run against real Postgres (D19). Spread `databaseTests` from `@chaku/db/testing/config` into the package's Vitest config, then call `useTestDatabase()` from `@chaku/db/testing` in a test file. Each worker gets its own database cloned from a migrated template, and every table is emptied before each test.

Commands and the local seed: [local development guide](../../docs/guides/local-development.md#database).
