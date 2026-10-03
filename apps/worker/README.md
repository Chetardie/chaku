# @chaku/worker

Runs Graphile Worker jobs: module events, email, Push, image processing, timers and cleanup (ADR-0008, D30). It owns no job: each module defines its jobs and handlers and exports them through its public entry point, and [`src/modules.ts`](src/modules.ts) lists those modules.

- [`src/main.ts`](src/main.ts): checks the environment, starts the jobs, stops gracefully on `SIGTERM` or `SIGINT`
- [`src/runner.ts`](src/runner.ts): builds the task list and crontab from the modules, checks each payload before its handler runs, and sends Graphile Worker's log lines through `@chaku/adapters/log` without payloads (D9)
- [`src/env.ts`](src/env.ts): `DATABASE_URL`, `LOG_LEVEL`, `WORKER_CONCURRENCY`

It is bundled with tsdown into one file, `dist/main.mjs` (ADR-0011, D45). Running it: [local development guide](../../docs/guides/local-development.md#worker). Adding a job: [architecture overview](../../docs/architecture/overview.md#jobs).
