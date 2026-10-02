# Chaku

Invite-only web messenger (PWA) with Games played beside Chats and a public Feed of Posts in Topics. EN and UK interface.
Stage: spec and architecture. No application code yet; Foundation (spec §6, phase 1) comes next.

## Read before working

| What | Where |
|---|---|
| Product spec, binding decisions D1–D54 in §9 | [docs/messenger-app-spec.md](docs/messenger-app-spec.md) |
| Domain language: use these terms exactly in code, UI copy, tickets and commits | [CONTEXT.md](CONTEXT.md) |
| Architecture decisions | [docs/adr/](docs/adr/) |
| System and module map, key flows | [docs/architecture/overview.md](docs/architecture/overview.md) |
| How work moves from Linear to merged code | [docs/process/workflow.md](docs/process/workflow.md) |
| Index of all docs, planned and written | [docs/README.md](docs/README.md) |
| Engineering contract: Definition of Done, commits, decisions | [CONTRIBUTING.md](CONTRIBUTING.md) |
| UI copy in EN and UK | [docs/design-system/voice-and-tone.md](docs/design-system/voice-and-tone.md) |
| Team handbook (Linear, private): Start here, How we work, Accounts & access, Support & moderation | Linear team Chaku → Documents (read with the Linear connector) |

## Rules

- **The spec and ADRs are the source of truth.** If a task conflicts with them, stop and say so; never diverge silently. A new architectural decision gets a new ADR (`/new-adr`). When amending an ADR, add an inline note to the changed paragraph (D45).
- **Library versions are newer than your training data** (ADR-0011). Look up current docs with Context7 before writing code against a library. Known traps:
  - Drizzle **1.0 RC**: new migration folder format and relational query API, not 0.x
  - shadcn/ui on **Base UI**, not Radix
  - Tailwind **4**: CSS-first config, no `tailwind.config.js`
  - **oRPC**, not tRPC. **No Server Actions.** Server Components call oRPC procedures in-process (D50)
  - Zod 4, next-intl 4, ESLint 10 flat config, Vitest 5, Storybook 10, Playwright 1.63
  - `react-email` 6 (`@react-email/components` is deprecated), `@serwist/turbopack` (not `@serwist/next`), `@better-auth/passkey` is a separate package
  - TypeScript 6 is `typescript` for tools; TypeScript 7 does the type check
- **Module boundaries** (ADR-0003, ADR-0007): import another module only through its public entry point. No joins across module schemas. Side effects are jobs added in the same transaction (ADR-0008). Every module storing Member data handles `member.erasure_requested`.
- **Security** (D9, ADR-0013): never log or put Message or Comment bodies into analytics, errors or job payloads. Never connect to production data; only local or preview databases with seed data. The repo is public: no secrets, real people or real emails anywhere in git.
- **Tests:** every acceptance criterion in a ticket is covered by a test. Module tests run against real Postgres, never database mocks (D19).
- **Where docs go:** in the repo if code, agents or the public depend on it, or it changes with code. In Linear (team documents) if it's about people, process or operations. Never put secrets, Member content or Report details in either.
- **Words:** say Member, Participant, Chat, Message, Game Challenge, and so on, as defined in CONTEXT.md. Never "user", "conversation", "room", "DM" in code or copy.

## Commands

None yet. Foundation adds `pnpm dev`, `pnpm stack`, `pnpm db:reset`, `pnpm test`, `pnpm lint`, `pnpm typecheck`; list them here when they exist.

## Layout

Planned in spec §5.6: `apps/{web,realtime,worker,games/*}`, `packages/{modules/*,content,game-sdk,ui,config}`, `docs/`.
