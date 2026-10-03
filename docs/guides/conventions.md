# Conventions

Status: **current** (CHK-28). How code is written in this repo. Every rule here comes from the spec, an ADR or the code as it is today, and links to the file that shows it. Rules the code doesn't follow yet are marked _Planned_ with the ticket that brings them. Where nothing decides a question yet, it is listed under [Not decided yet](#not-decided-yet) instead of being made up here.

Code samples are excerpts of real files, copied as they are; [`packages/config/test/guides.test.ts`](../../packages/config/test/guides.test.ts) fails when a sample no longer matches its file.

How to test what you write: [testing guide](testing.md).

## Words

Code, UI copy, tickets and commits use the terms in [CONTEXT.md](../../CONTEXT.md), exactly: Member, Participant, Chat, Message, Game Challenge. Never "user", "conversation", "room" or "DM" ([CLAUDE.md](../../CLAUDE.md#rules)). The same goes for names in code: `members`, `memberId`, `seedMembers` in [`identity/src/schema.ts`](../../packages/modules/identity/src/schema.ts) and [`identity/src/seed.ts`](../../packages/modules/identity/src/seed.ts).

## Naming

| What | Convention | Where it shows |
|---|---|---|
| TypeScript files | kebab-case: `query-client.ts`, `security-headers.ts`, `health-status.tsx`. No lint rule checks it; every file follows it today. Next.js's own file names (`page.tsx`, `[[...rest]]`) stay as Next.js wants them | [`apps/web/src`](../../apps/web/src) |
| Packages | `@chaku/<name>`, versions from the pnpm catalog (`catalog:`), extending `@chaku/config/tsconfig/base.json` or `node.json` | [CLAUDE.md](../../CLAUDE.md#layout), [`packages/config/test/workspace.test.ts`](../../packages/config/test/workspace.test.ts) |
| Postgres schemas | the module's name: `identity`, `chat`, … | [data model](../architecture/data-model.md#conventions) |
| Tables and columns | `snake_case`, tables as plural nouns. TypeScript names are camelCase (`displayName`) and Drizzle writes them as `display_name`, because the schema is made with `snakeCase.schema('<name>')` | [`identity/src/schema.ts`](../../packages/modules/identity/src/schema.ts) |
| Indexes and constraints | `<table>_pkey`, `<table>_<what>_key`, `_idx`, `_fkey`, `_check` | [data model](../architecture/data-model.md#conventions) |
| Jobs | `<area>.<event>` in snake case: `identity.delete_expired_sessions`. `defineJob` throws on any other name | [`packages/db/src/jobs.ts`](../../packages/db/src/jobs.ts) |
| Tests | `test/<subject>.test.ts` for Vitest, `e2e/<subject>.spec.ts` for Playwright, `live/<subject>.test.ts` for checks against the running stack | [testing guide](testing.md#layers) |

From [`packages/modules/identity/src/schema.ts`](../../packages/modules/identity/src/schema.ts):

```ts
export const identity = snakeCase.schema('identity');

/** `id uuid` primary key, made by the database so IDs sort by creation time (ADR-0011). */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const timestamptz = () => timestamp({ withTimezone: true });
```

## IDs

- **The database makes IDs.** Every entity table has an `id uuid` primary key with default `uuidv7()` (Postgres 18), so IDs sort by creation time. Join tables use a composite primary key instead ([data model](../architecture/data-model.md#conventions), ADR-0011). The `id()` helper above is how a schema declares it.
- **Better Auth too.** It is set to `generateId: false`, so the database default makes its IDs as well. _Planned (CHK-20)._
- **Client IDs are never primary keys.** Sending a Message carries a separate `client_id` for idempotency ([data model](../architecture/data-model.md#conventions), [web data flow](../architecture/web-data-flow.md#sending-with-optimistic-updates)). _Planned (the `chat` module, no ticket yet)._
- **Other modules' rows are referenced by ID only**: a plain `uuid` column, no foreign key and no join (ADR-0003, ADR-0007). See [Modules](#modules).
- **Seed IDs are fixed** and UUIDv7-shaped, so `pnpm db:reset` always gives the same data ([`identity/src/seed.ts`](../../packages/modules/identity/src/seed.ts)).

## Modules

A module is a package in `packages/modules/<name>` that owns one Postgres schema (ADR-0003, ADR-0007, D20). [`packages/modules/identity`](../../packages/modules/identity) is the one built so far, and the shape to copy:

| File | Holds |
|---|---|
| `package.json` | `"exports": { ".": "./src/index.ts" }`: one public entry point, nothing else importable |
| `src/index.ts` | what other code may use. Everything else is internal |
| `src/schema.ts` | the module's tables, made with `snakeCase.schema('<name>')`. Every table, column and index is also in the [data model doc](../architecture/data-model.md), and `test/schema.test.ts` compares the migrated database with it |
| `src/jobs.ts` | the module's jobs and handlers, exported as `ModuleJobs` through `src/index.ts` |
| `src/seed.ts` | the module's part of the fixed local seed |
| `vitest.config.ts` | spreads `databaseTests` from `@chaku/db/testing/config` |
| `turbo.json` | extra test inputs, such as the data model doc |

Scaffolding a new module the same way every time is the `new-module` skill. _Planned (CHK-24)._ Until then, copy `identity`, add the module to [`apps/worker/src/modules.ts`](../../apps/worker/src/modules.ts) if it has jobs, and add its section to the data model doc.

**Boundaries.** `pnpm boundaries` runs dependency-cruiser with the rules in [`packages/config/dependency-cruiser.js`](../../packages/config/dependency-cruiser.js). It fails when:
- a module or an app imports another module anywhere but its `src/index.ts`
- a package imports an app, or one app imports another
- `content`, `game-sdk`, `ui`, `config`, `db` or `adapters` imports a module
- anything but `apps/worker` (and the migration runner) imports `graphile-worker`
- a Game imports anything but its own code, `game-sdk`, `ui` and `config`
- there is a cycle, or an import doesn't resolve

**Across modules.** No joins across module schemas. A screen that needs several modules collects IDs, makes one batch call per module (`identity.getProfiles(ids)`), and keeps counters on the owning module's rows (ADR-0007). A module function takes a `Queryable`, a database or a transaction, so the caller decides which transaction it runs in ([`packages/db/src/client.ts`](../../packages/db/src/client.ts)).

**`apps/web` holds routes, pages and wiring**, not business logic (D20). Each oRPC procedure validates its input and calls a module's public entry point ([`apps/web/src/server/rpc/router.ts`](../../apps/web/src/server/rpc/router.ts)). The router has only `health` until the first module namespace arrives. _Planned (CHK-20: the `identity` namespace)._

**Erasure.** Every module that stores Member data handles `member.erasure_requested`, and a test fails when a module with Member-referencing tables has no handler (ADR-0007). _Planned (no ticket yet; the `new-module` skill in CHK-24 adds a handler stub)._ `identity` stores Member data and has no handler yet.

## Jobs

Side effects and timers are Graphile Worker jobs, added in the same transaction as the change, so a job exists if and only if the change was saved (ADR-0008). The full how-to is in the [architecture overview](../architecture/overview.md#jobs). In short:

- **Define** with `defineJob('<area>.<event>', z.object({ … }))`. The payload holds IDs, enums, numbers, booleans and timestamps only: `defineJob` throws on a field that could carry free text ([`packages/db/src/jobs.ts`](../../packages/db/src/jobs.ts), D9).
- **Add** with `addJob(scope, job, payload)` inside `transaction(db, async (scope) => …)` from `@chaku/db`.
- **Handle** with `handle(job, async (payload, { db, log, job, signal }) => …)`, export the handlers as `ModuleJobs` from `src/index.ts`, and list the module in [`apps/worker/src/modules.ts`](../../apps/worker/src/modules.ts).
- **Idempotent:** a job can run more than once. A second run must change nothing.

From [`packages/modules/identity/src/jobs.ts`](../../packages/modules/identity/src/jobs.ts):

```ts
/** Every hour: deletes sessions that expired (D21, ADR-0008). */
export const deleteExpiredSessions = defineJob('identity.delete_expired_sessions', z.object({}));

export const identityJobs: ModuleJobs = {
  handlers: [
    // Deleting what has expired leaves the same rows however often it runs, so a second run
    // after a crash or retry changes nothing.
    handle(deleteExpiredSessions, async (_, { db, log }) => {
      const deleted = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, sql`now()`))
        .returning({ id: sessions.id });
      log.info({ deleted: deleted.length }, 'Deleted expired sessions');
    }),
  ],
  cron: [{ job: deleteExpiredSessions, match: '17 * * * *' }],
};
```

## Errors over oRPC

Every procedure builds on `base` from [`apps/web/src/server/rpc/context.ts`](../../apps/web/src/server/rpc/context.ts), which declares the typed errors the browser narrows with `isDefinedError` (D50, [web data flow](../architecture/web-data-flow.md#errors-auth-failures-and-loading)).

From [`apps/web/src/server/rpc/context.ts`](../../apps/web/src/server/rpc/context.ts):

```ts
export const base = os.$context<BaseContext>().errors({
  /** No session, or it was revoked. */
  UNAUTHORIZED: {},
  /** It doesn't exist, or the viewer may not see it: one answer for both (D9). */
  NOT_FOUND: {},
  /** Visible but not allowed: a Block (D11), Admin tools without a passkey session (D47). */
  FORBIDDEN: {},
  /** A limit from D56. */
  RATE_LIMITED: {
    status: 429,
    data: z.object({ retryAfter: z.number().int().positive() }),
  },
});
```

| Code | Use it when | Don't |
|---|---|---|
| `UNAUTHORIZED` | there is no session, or it was revoked. `requireMember` throws it. _Planned (CHK-20)_ | use it for "logged in but not allowed": that is `FORBIDDEN` |
| `NOT_FOUND` | the item doesn't exist **or the viewer may not see it**. One answer for both, so probing can't tell a private Chat from a missing one (D9) | answer `FORBIDDEN` for something the viewer can't see: that reveals it exists |
| `FORBIDDEN` | the viewer can see it but may not do this: sending to a Member who blocked them (D11), Admin tools without a passkey session (D47). `requireAdmin` throws it. _Planned (CHK-20)_ | |
| `RATE_LIMITED` | a limit from D56 was hit. `data.retryAfter` is in seconds | |
| `BAD_REQUEST` | not declared by us: oRPC throws it when input fails the procedure's Zod schema, with a `ValidationError` as its cause | |
| anything else | a bug. The client gets a 500 | |

In a handler, throw `errors.NOT_FOUND()` from the handler's `errors` argument. oRPC also treats `throw new ORPCError('NOT_FOUND')` as the defined error, because the code matches (oRPC's error handling docs, checked with Context7 on 2026-10-03).

**What reaches the logs.** The `/rpc` handler logs every error with the procedure path and the code, never the input, which can hold Message text (D9). A 4xx is logged at `info` as "procedure refused"; anything else is logged at `error` and sent to the errors adapter ([`apps/web/src/server/rpc/handler.ts`](../../apps/web/src/server/rpc/handler.ts)). The browser side of each code (send to login, "not found" state, a toast) is in the [web data flow doc](../architecture/web-data-flow.md#errors-auth-failures-and-loading); it arrives with the first screens. _Planned (CHK-41)._

## Pagination

Lists page by **keyset**, the last row's sort values, never by offset. Each list screen is one module's query on that module's indexes, with a fixed number of queries per page, never one per row ([data model, List screens](../architecture/data-model.md#list-screens), ADR-0007).

- Message windows load by Chat Sequence number (`seq`) in both directions, and the browser keeps about 200 Messages on the page with TanStack Query's `maxPages` (ADR-0011, [web data flow](../architecture/web-data-flow.md#query-keys)).
- Paged lists are `infinite` queries with keys from oRPC's helpers, never written by hand ([web data flow, rule 4](../architecture/web-data-flow.md#rules)).

No paged procedure exists yet. Page sizes, the shape of the cursor and the response are [not decided yet](#not-decided-yet).

## Dates and times

- **Stored as `timestamptz`**, through the schema's `timestamptz()` helper (above). Calendar values with no time of day are `date`, such as `members.last_seen_on` ([data model](../architecture/data-model.md#conventions)).
- **In TypeScript, a point in time is a `Date`.** Drizzle returns `timestamptz` columns as `Date`, and the oRPC serializer keeps `Date`s as `Date`s over `/rpc` and through hydration ([`apps/web/src/lib/query-client.ts`](../../apps/web/src/lib/query-client.ts)).
- **Job times:** `runAt` is a `Date`; cron patterns are in UTC ([`packages/db/src/jobs.ts`](../../packages/db/src/jobs.ts)). Payloads carry times as `date-time` or `date` strings, which `defineJob` accepts.
- **Shown in the viewer's locale and time zone** (D18), through next-intl, never with hand-built strings. How to format dates and relative times is the i18n guide's job. _Planned (CHK-29)._

## Logging and what never leaves the server

Logs go through `@chaku/adapters/log` ([`packages/adapters/src/log.ts`](../../packages/adapters/src/log.ts)), a `pino` logger. Never import `pino` in an app.

- **Get the logger, don't make one.** The web app uses `adapters().log` from [`apps/web/src/server/adapters.ts`](../../apps/web/src/server/adapters.ts); a job handler uses the `log` in its context, which the worker has already tagged with the job's name, ID and attempt ([`apps/worker/src/runner.ts`](../../apps/worker/src/runner.ts)).
- **Log IDs, codes and counts**: `log.info({ deleted: deleted.length }, 'Deleted expired sessions')`. Fields first, then a short message.
- **Never log Message or Comment bodies** (D9). As a safety net the logger replaces any field called `body`, `text`, `email`, `password`, `token` or `secret`, at the top level and up to three objects deep, and the `cookie`, `set-cookie` and `authorization` headers. Don't rely on it: don't put content in a log call.

From [`apps/web/src/server/rpc/handler.ts`](../../apps/web/src/server/rpc/handler.ts):

```ts
    clientInterceptors: [
      // The procedure path and the error code, never the input: it can hold Message text (D9).
      onError((error, { path }) => {
        const procedure = path.join('.');
        // A 4xx is the caller's problem (validation, a limit, not found); a 5xx is a bug.
        if (error instanceof ORPCError && error.status < 500) {
          log.info({ procedure, code: error.code }, 'procedure refused');
        } else {
          const code = error instanceof ORPCError ? String(error.code) : 'INTERNAL_SERVER_ERROR';
          log.error({ procedure, code }, 'procedure failed');
          errors.capture(error, { tags: { procedure } });
        }
      }),
    ],
```

The same rule, everywhere data leaves the code:

| Where | What keeps content out | File |
|---|---|---|
| Logs | the redaction list; procedure errors log path and code; the worker logs a job's name, ID and attempt, never its payload | [`log.ts`](../../packages/adapters/src/log.ts), [`handler.ts`](../../apps/web/src/server/rpc/handler.ts), [`runner.ts`](../../apps/worker/src/runner.ts) |
| Error reports | `scrubErrorContext()` drops request bodies, cookies, credential headers and query strings before any reporter sees them | [`errors.ts`](../../packages/adapters/src/errors.ts) |
| Analytics | every event and property is declared in `AnalyticsEvents`; a property is a number, a boolean, `null` or a closed set of strings, so free text doesn't type-check | [`analytics.ts`](../../packages/adapters/src/analytics.ts) |
| Job payloads | `defineJob` refuses any field that could carry free text | [`jobs.ts`](../../packages/db/src/jobs.ts) |
| Env errors | a bad variable is reported by name, never by value | [`apps/web/src/env.ts`](../../apps/web/src/env.ts) |

From [`packages/adapters/src/analytics.ts`](../../packages/adapters/src/analytics.ts):

```ts
export interface AnalyticsEvents {
  /** D24: Messages sent per active Member per day. */
  message_sent: { chatKind: 'direct' | 'group' };
}
```

D9 as a full checklist, with the authorization test matrix, is the security doc. _Planned (CHK-30)._

## Environment variables

- **[`.env.example`](../../.env.example) lists every variable**, with values that work only on a local machine. No secrets, ever (ADR-0013). To change a value locally, copy it to `.env`, which is git-ignored; `.env` wins, `.env.example` fills the rest.
- **Each app validates its environment with Zod**: [`apps/web/src/env.ts`](../../apps/web/src/env.ts) and [`apps/worker/src/env.ts`](../../apps/worker/src/env.ts). App code reads `serverEnv()`, not `process.env`.
- **Checked at startup.** The web app's `instrumentation.ts` calls `checkEnvironment()` before the server takes a request, and a bad environment stops the process with the variable's name ([`apps/web/src/server/startup.ts`](../../apps/web/src/server/startup.ts)). The worker checks its own when it starts ([`apps/worker/src/main.ts`](../../apps/worker/src/main.ts)).
- **Every origin comes from the environment** (ADR-0010): `APP_URL`, `REALTIME_URL` and `GAMES_DOMAIN`, so a preview gets the right CSP, CORS and links. Never write a host name into code.
- **Adding a variable:** add it to `.env.example` with a local value and a comment, and to the app's Zod schema.

From [`apps/web/src/env.ts`](../../apps/web/src/env.ts):

```ts
  APP_URL: z.url({ protocol: /^https?$/ }),
  REALTIME_URL: z.url({ protocol: /^wss?$/ }),
  /** Games run on subdomains of this domain (ADR-0002). */
  GAMES_DOMAIN: z.hostname(),
```

Scripts and tests on a developer's machine load the same files with `loadLocalEnv()` from `@chaku/db/migrate`; apps never do ([`packages/db/src/local-env.ts`](../../packages/db/src/local-env.ts)).

## Vendors

Email, storage, push, analytics, error reports and bot checks go only through `@chaku/adapters`, one entry point each ([adapters README](../../packages/adapters/README.md), D23). Apps don't declare `nodemailer`, an S3 client or `pino`, so pnpm can't resolve them from app code.

- The web app makes its adapters once per process in [`apps/web/src/server/adapters.ts`](../../apps/web/src/server/adapters.ts) and reads them with `adapters()`.
- Until phase 4 every adapter is its local or no-op version: email to Mailpit, files to SeaweedFS, the rest logged or dropped (D55). The production versions (Resend, R2, Sentry, PostHog, Turnstile) arrive with their accounts, behind the same interfaces.
- A new vendor gets a new entry point in `@chaku/adapters`, with a local version that works on the stack. The rate limiter is the next one. _Planned (CHK-20: `@chaku/adapters/rate-limit`)._

## Not decided yet

Nothing in the spec, the ADRs or the code settles these. They are open questions on the CHK-28 pull request; once decided, the answer goes here, or into the spec or an ADR.

- **Paging:** default and maximum page sizes; the shape of the cursor (the sort values as fields, or one opaque string); the response shape (`{ items, nextCursor }` or another).
- **The viewer's time zone:** D18 says dates follow the viewer's time zone, but nothing stores it and next-intl has no `timeZone` set in [`apps/web/src/i18n/request.ts`](../../apps/web/src/i18n/request.ts), so server-rendered times have no zone to use.
- **Validation errors in forms:** the web data flow doc shows `BAD_REQUEST` as the field's message, but `base` doesn't declare it, so the browser can't narrow it with `isDefinedError`.
- **Which `FORBIDDEN`:** a Block and a missing passkey session give the same code with no data, so the browser can't pick the right text.
- **Member IDs in logs:** D9 forbids content in logs; nothing says whether a Member's ID may be logged.
- **The process time zone:** nothing sets `TZ` for the apps or the worker.
