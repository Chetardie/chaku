# Chaku

Invite-only web messenger (PWA) with Games played beside Chats and a public Feed of Posts in Topics. EN and UK interface.
Stage: Foundation (spec §6, phase 1). The monorepo, shared tooling, CI and the local stack exist; no application code yet.

## Read before working

| What | Where |
|---|---|
| Product spec, binding decisions D1–D58 in §9 | [docs/messenger-app-spec.md](docs/messenger-app-spec.md) |
| Domain language: use these terms exactly in code, UI copy, tickets and commits | [CONTEXT.md](CONTEXT.md) |
| Architecture decisions | [docs/adr/](docs/adr/) |
| System and module map, key flows | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Running the local stack, trusting its certificate, troubleshooting | [docs/guides/local-development.md](docs/guides/local-development.md) |
| How work moves from Linear to merged code | [docs/process/workflow.md](docs/process/workflow.md) |
| Index of all docs, planned and written | [docs/README.md](docs/README.md) |
| Engineering contract: Definition of Done, commits, decisions | [CONTRIBUTING.md](CONTRIBUTING.md) |
| UI copy in EN and UK | [docs/design-system/voice-and-tone.md](docs/design-system/voice-and-tone.md) |
| Team handbook (Linear, private): Start here, How we work, Accounts & access, Support & moderation | Linear team Chaku → Documents (read with the Linear connector) |

## Rules

- **The spec and ADRs are the source of truth.** If a task conflicts with them, stop and say so; never diverge silently. A new architectural decision gets a new ADR (`/new-adr`). When amending an ADR, add an inline note to the changed paragraph (D45).
- **Library versions are newer than your training data** (ADR-0011). Look up current docs with Context7 before writing code against a library. Known traps:
  - Drizzle **1.0 RC**: new migration folder format and relational query API, not 0.x. Casing is set per schema (`snakeCase.schema('identity')`), not in `drizzle()` or the kit config. drizzle-kit ships its own current docs as skills in `node_modules/drizzle-kit/skills`
  - shadcn/ui on **Base UI**, not Radix
  - Tailwind **4**: CSS-first config, no `tailwind.config.js`
  - **oRPC**, not tRPC. **No Server Actions.** Server Components call oRPC procedures in-process (D50)
  - Zod 4, next-intl 4, ESLint 10 flat config, Vitest 5, Storybook 10, Playwright 1.63
  - `react-email` 6 (`@react-email/components` is deprecated), `@serwist/turbopack` (not `@serwist/next`), `@better-auth/passkey` is a separate package
  - TypeScript 6 is `typescript` for tools (`tsc6`); TypeScript 7 is `@typescript/native` and does the type check (`tsc`)
  - pnpm **12**: settings live in `pnpm-workspace.yaml`, not `.npmrc`; no corepack. Every version is a `catalog:` entry (`catalogMode: strict`). New releases are installed only after a day (`minimumReleaseAge`) and install scripts need `allowBuilds`
  - ESLint flat config is shared from `@chaku/config/eslint` (`base`, `node`, `react`, `next`); accessibility rules come from `eslint-plugin-jsx-a11y-x`, not `eslint-plugin-jsx-a11y`
  - Turborepo 2.11 ships its own current docs in `node_modules/turbo/docs`
- **Module boundaries** (ADR-0003, ADR-0007): import another module only through its public entry point. No joins across module schemas. Side effects are jobs added in the same transaction (ADR-0008). Every module storing Member data handles `member.erasure_requested`.
- **Security** (D9, ADR-0013): never log or put Message or Comment bodies into analytics, errors or job payloads. Never connect to production data; only local or preview databases with seed data. The repo is public: no secrets, real people or real emails anywhere in git.
- **Tests:** every acceptance criterion in a ticket is covered by a test. Module tests run against real Postgres, never database mocks (D19).
- **Where docs go:** in the repo if code, agents or the public depend on it, or it changes with code. In Linear (team documents) if it's about people, process or operations. Never put secrets, Member content or Report details in either.
- **Words:** say Member, Participant, Chat, Message, Game Challenge, and so on, as defined in CONTEXT.md. Never "user", "conversation", "room", "DM" in code or copy.

## Commands

Run from the repo root. Each runs in every package through Turborepo, which caches results.

| Command | Does |
|---|---|
| `pnpm install` | Install dependencies (pnpm 12, Node 24) |
| `pnpm lint` | ESLint with type information |
| `pnpm typecheck` | `tsc` (TypeScript 7) |
| `pnpm test` | Vitest. Module tests need Postgres from `pnpm stack`; each test worker gets its own database |
| `pnpm boundaries` | dependency-cruiser: module boundaries and cycles (ADR-0002, ADR-0003, ADR-0007); rules in `packages/config/dependency-cruiser.js` |
| `pnpm build` | Build every app and package that has a build |
| `pnpm dev` | Run every app in development mode |
| `pnpm format` / `pnpm format:check` | Prettier on code and config (Markdown is formatted by hand) |
| `pnpm stack` / `stack:down` / `stack:reset` | Local stack in Docker: Postgres, Redis, SeaweedFS, Mailpit, Caddy on `https://*.localhost`. `reset` wipes data but keeps the trusted certificate |
| `pnpm stack:check` | Checks the running stack (health, HTTPS, storage CORS, Postgres extensions) |
| `pnpm db:migrate` | Applies pending migrations to `DATABASE_URL` |
| `pnpm db:reset` | Drops every module schema, migrates and loads the fixed seed of fake Members (local only) |
| `pnpm db:generate` | drizzle-kit writes a migration for schema changes in `packages/modules/*/src/schema.ts` |

Run one package with a filter: `pnpm turbo run test --filter=@chaku/config`. CI (`.github/workflows/ci.yml`) runs all of these plus `gitleaks`; its `ci` job is the one required check. `pnpm install` also installs a pre-commit hook (`lefthook.yml`) that runs `gitleaks` on staged changes.

## Layout

Spec §5.6: `apps/{web,realtime,worker,games/*}`, `packages/{modules/*,content,db,game-sdk,ui,config}`, `docs/`, plus `stack/` (the local stack: Caddyfile, bucket setup, stack checks). Packages so far: `packages/config`, `packages/db` (pool, transactions, migrations in `packages/db/migrations`, the test harness `@chaku/db/testing`), `packages/modules/identity` and `stack`; the other folders hold a README until their ticket arrives. New packages are named `@chaku/<name>`, take versions from the catalog, and extend `@chaku/config/tsconfig/base.json` (or `node.json`).
