# Testing

Status: **current** (CHK-28). The test layers from D19, how to run each one on your machine, which CI job runs it, and how a ticket's acceptance criteria become tests. Layers that aren't built yet are marked _Planned_ with the ticket that brings them.

Code samples are excerpts of real tests, copied as they are; [`packages/config/test/guides.test.ts`](../../packages/config/test/guides.test.ts) fails when a sample no longer matches its file. How code is written: [conventions](conventions.md).

## The rules

- **Every acceptance criterion is covered by a test, and CI blocks the merge until they pass.** There is no coverage percentage target (D19, [Definition of Done](../../CONTRIBUTING.md#definition-of-done)).
- **Module tests run against a real Postgres, never database mocks** (D19). Each test worker gets its own database.
- **Test data is fake.** No real people, real emails or production exports, in tests or in the seed (ADR-0013, D9).

## Layers

| Layer | What it shows | Files | Run locally | CI job |
|---|---|---|---|---|
| Static checks | lint, types, formatting | every package | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | `checks` |
| Boundaries | modules are used only through their entry points; no cycles (ADR-0003, ADR-0007) | [`dependency-cruiser.js`](../../packages/config/dependency-cruiser.js) | `pnpm boundaries` | `checks` |
| Unit | logic with no database: adapters, the web app's server code and components, the stack's config | `test/*.test.ts` in `packages/adapters`, `packages/config`, `stack` and `apps/web` | `pnpm test` | `checks` |
| Docs | a doc that code or agents rely on still matches the code and the rules | [`packages/config/test`](../../packages/config/test), [`apps/web/test/docs.test.ts`](../../apps/web/test/docs.test.ts), [`stack/test/docs.test.ts`](../../stack/test/docs.test.ts) | `pnpm test` | `checks` |
| Module | a module's queries, constraints and seed on a migrated Postgres | `test/*.test.ts` in `packages/db` and `packages/modules/*` | `pnpm stack`, then `pnpm test` | `checks` |
| Job | a transaction adds the right job; a handler does its work and is idempotent (ADR-0008) | module tests using `queuedJobs` and `runJob`; the worker itself in [`apps/worker/test`](../../apps/worker/test) | `pnpm stack`, then `pnpm test` | `checks` |
| Stack | the running stack: services, HTTPS, storage CORS, Postgres extensions, the email and storage adapters | `live/*.test.ts` in `stack` and `packages/adapters` | `pnpm stack`, then `pnpm stack:check` | `stack` |
| End-to-end | the production build in a browser: hydration, CSP, languages | [`apps/web/e2e/*.spec.ts`](../../apps/web/e2e) | `pnpm stack`, `pnpm --filter @chaku/web build`, then `pnpm --filter @chaku/web test:e2e` | `e2e` |
| Page accessibility | axe finds no WCAG 2.2 AA problem on any page (D18) | [`apps/web/e2e/accessibility.spec.ts`](../../apps/web/e2e/accessibility.spec.ts) | as end-to-end | `e2e` |
| Secrets | no secret in the diff (ADR-0013) | every commit | the pre-commit hook on `git commit` | `gitleaks` |
| Component accessibility | Storybook stories in light and dark pass the accessibility addon (D18, ADR-0015) | _Planned (CHK-36)_ | | |
| Contract | `game-sdk` against the Reference Game (D19) | _Planned (phase 5, no ticket yet)_ | | |

`ci` is the one required check: it passes only when `checks`, `gitleaks`, `stack` and `e2e` all passed ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). In CI, `checks` runs `pnpm exec turbo run lint typecheck test depcruise --continue` with a Postgres service on the same image as the stack, then `pnpm format:check`.

**Running less.** From the repo root:
- one package: `pnpm turbo run test --filter=@chaku/identity`
- one file: `pnpm --filter @chaku/identity exec vitest run test/jobs.test.ts`
- one Playwright file: `pnpm --filter @chaku/web exec playwright test e2e/locale.spec.ts`

Turborepo caches results. A test that reads files outside its package lists them as `inputs` in that package's `turbo.json`, or a change to them won't rerun it: identity's schema test reads the data model doc ([`packages/modules/identity/turbo.json`](../../packages/modules/identity/turbo.json)), and the docs tests read the docs ([`packages/config/turbo.json`](../../packages/config/turbo.json)).

## Unit tests

Vitest, in each package's `test/` folder. They need no services.

- **Pass adapters in.** Code that logs or reports takes the adapter as an argument, so a test passes a fake that collects what it got: `createRpcHandler(router, { log, errors })` in [`apps/web/test/rpc-handler.test.ts`](../../apps/web/test/rpc-handler.test.ts), `createLogger({ destination })` in [`packages/adapters/test/log.test.ts`](../../packages/adapters/test/log.test.ts).
- **Prove D9 with a marker.** Those tests put a recognisable string in the input and check it never reaches a log line or an error report.
- **React components** render under `happy-dom`: start the file with `// @vitest-environment happy-dom` ([`apps/web/test/error-page.test.tsx`](../../apps/web/test/error-page.test.tsx)).
- **The web app's environment.** [`apps/web/test/setup.ts`](../../apps/web/test/setup.ts) loads `.env`, then `.env.example`, as the app does.
- **Property tests** with `fast-check` (ADR-0011) arrive with the code that needs them: the formatting parser in `packages/content` and the realtime engine's apply functions ([web data flow](../architecture/web-data-flow.md#realtime-events-into-the-cache)). _Planned (no ticket yet)._

## Module tests on Postgres

Start the stack (`pnpm stack`) first. The harness in `@chaku/db/testing` ([`packages/db/src/testing`](../../packages/db/src/testing)) does the rest:

1. Before a package's tests, its global setup builds a template database from the migrations and Graphile Worker's schema, once. The template is named after a hash of both, so new migrations get a new template.
2. Each Vitest worker clones its own database from the template, named `chaku_test_<package>_<worker>`. Tests running at once never share a database, and none of them touches the `chaku` database `pnpm dev` uses.
3. Before each test, every module table and the job queue are emptied. Each test sets up its own data.
4. After the run, the package's test databases are dropped.

`DATABASE_URL` comes from the environment, then `.env`, then `.env.example`; CI's Postgres service listens on the same address.

To use it, spread `databaseTests` into the package's Vitest config.

From [`packages/modules/identity/vitest.config.ts`](../../packages/modules/identity/vitest.config.ts):

```ts
import { databaseTests } from '@chaku/db/testing/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { ...databaseTests } });
```

Then call `useTestDatabase()` at the top of a test file and use `database.db` inside tests and hooks.

## Job tests

`@chaku/db/testing` has two helpers for jobs (ADR-0008):

- `queuedJobs(db)`: the jobs in the queue, oldest first, with their payloads and options. Use it to show a change added its job, or that a rolled-back change added none.
- `runJob(db, moduleJobs, job, payload, attempt)`: runs the module's handler once, as the worker would, after checking the payload. Run it twice to show the handler is idempotent.

From [`packages/db/test/jobs.test.ts`](../../packages/db/test/jobs.test.ts):

```ts
  it('never stores a job whose transaction rolls back', async () => {
    const failing = transaction(database.db, async (scope) => {
      await addJob(scope, readPositionMoved, { chatId, memberId, readSeq: 7 });
      throw new Error('the change failed');
    });
    await expect(failing).rejects.toThrow('the change failed');
    expect(await queuedJobs(database.db)).toEqual([]);
  });
```

From [`packages/modules/identity/test/jobs.test.ts`](../../packages/modules/identity/test/jobs.test.ts):

```ts
  it('leaves the same state when it runs twice', async () => {
    await runJob(database.db, identityJobs, deleteExpiredSessions, {});
    const once = await tokens();
    await runJob(database.db, identityJobs, deleteExpiredSessions, {}, 2);
    expect(await tokens()).toEqual(once);
  });
```

The worker's own wiring (payload checks, retries, cron, shutdown, logs without payloads) is tested once, in [`apps/worker/test/worker.test.ts`](../../apps/worker/test/worker.test.ts). A module's tests don't need to start the worker.

## End-to-end tests

Playwright 1.63 against the **production build**, served by the standalone server and reached through Caddy at `https://chaku.localhost`, as a Member's browser would ([`apps/web/playwright.config.ts`](../../apps/web/playwright.config.ts), D19, ADR-0006).

1. `pnpm stack`
2. `pnpm --filter @chaku/web build`
3. `pnpm --filter @chaku/web test:e2e`. It starts the built server on port 3000, or reuses one that is already running.

The first time, install the browser: `pnpm --filter @chaku/web exec playwright install chromium`.

- Tests run in Chromium. In CI each test gets one retry, and a failing test keeps its trace.
- Every page goes through axe with the WCAG 2.2 AA tags. A new page is added to the list.

From [`apps/web/e2e/accessibility.spec.ts`](../../apps/web/e2e/accessibility.spec.ts):

```ts
for (const path of ['/', '/no-such-page']) {
  test(`${path} has no automatically detectable accessibility problems`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
```

**Logging in through Mailpit.** _Planned (CHK-20 and CHK-41)._ End-to-end tests log in the real way, with an email code, and need no dev login switcher, so they work against production builds and previews (ADR-0010):
- CHK-20's integration tests drive Better Auth's API and read the code from Mailpit's API (the stack's Mailpit, web UI at `https://mail.chaku.localhost`).
- CHK-41's Playwright tests log a seeded Member in through `/login`, read the code from the Mailpit API, and land on `/`.

**The flows D19 requires end-to-end:**
- signup through an Invite. _Planned (CHK-21)._
- two-browser realtime chat, and reconnect catch-up including edits, deletes and Reactions made while offline. _Planned (phase 2, no ticket yet)._
- the Reference Game from invite to result. _Planned (phase 5, no ticket yet)._
- authorization tests that try to read other people's Chats. Which reads they try is the security doc's authorization test matrix. _Planned (CHK-30)._

## Fixtures and seed data

- **The seed is the shared fixture.** `seedIdentity(db)` loads the fixed fake Members: an Admin, Alice, Bohdan, Chen and Daryna, in an invite tree, with fixed IDs and times ([`identity/src/seed.ts`](../../packages/modules/identity/src/seed.ts), [local development guide](local-development.md#database)). A module test calls it in `beforeEach`, because tables are emptied before every test.
- **Data only one test needs is made in that test**, on top of the seed: the sessions in [`identity/test/jobs.test.ts`](../../packages/modules/identity/test/jobs.test.ts), or jobs defined just for the test (`test.noted`) in [`apps/worker/test/worker.test.ts`](../../apps/worker/test/worker.test.ts).
- **Emails use reserved domains**: `example.com` or a name under `.test`. [`identity/test/seed.test.ts`](../../packages/modules/identity/test/seed.test.ts) checks the seed does.
- **Fixed IDs are UUIDv7-shaped**, so they sort and validate like real ones.

## From acceptance criteria to tests

1. **The ticket's criteria are written to be tested** before it gets `agent-ready` ([workflow, Definition of Ready](../process/workflow.md#definition-of-ready-agent-ready)).
2. **Each test file opens with a comment saying what it shows and where that comes from**: the ticket (`// CHK-18: …`), and the decisions or ADRs behind it. A reviewer finds the test for a criterion by its ticket number.
3. **Tests are named after the behaviour, in CONTEXT.md terms**: `it('leaves the same state when it runs twice')`, not `it('works')`.
4. **The PR maps each criterion to its test.** The [PR template](../../.github/pull_request_template.md) has a section "Acceptance criteria → tests"; tick each criterion and name the file that covers it.

From [`apps/worker/test/worker.test.ts`](../../apps/worker/test/worker.test.ts):

```ts
// CHK-18: the worker runs jobs added inside transactions (ADR-0008), checks payloads, retries and
// logs failures without payloads (D9), registers module cron items and stops gracefully.
```

**Docs criteria get docs tests.** When a ticket's criterion is about a doc that code or agents rely on, a test reads the doc like data and checks it against the code or the rules: [`data-model.test.ts`](../../packages/config/test/data-model.test.ts) checks that no foreign key crosses module schemas, [`web-data-flow.test.ts`](../../packages/config/test/web-data-flow.test.ts) that the doc says what it was checked against, and [`guides.test.ts`](../../packages/config/test/guides.test.ts) that these guides' links and samples are real.

Examples from merged tickets:

| Ticket | Criterion | Test |
|---|---|---|
| CHK-18 | a job added in a transaction that rolls back is never stored | [`packages/db/test/jobs.test.ts`](../../packages/db/test/jobs.test.ts) |
| CHK-18 | failures are logged without payloads | [`apps/worker/test/worker.test.ts`](../../apps/worker/test/worker.test.ts) |
| CHK-19 | the interface language comes from the cookie, then the browser, never the URL | [`apps/web/test/locale.test.ts`](../../apps/web/test/locale.test.ts), [`apps/web/e2e/locale.spec.ts`](../../apps/web/e2e/locale.spec.ts) |
| CHK-17 | the seed has fake Members only | [`packages/modules/identity/test/seed.test.ts`](../../packages/modules/identity/test/seed.test.ts) |
| CHK-15 | the data model keeps every foreign key inside its module | [`packages/config/test/data-model.test.ts`](../../packages/config/test/data-model.test.ts) |
