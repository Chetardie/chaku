---
status: accepted
date: 2026-09-30
---

# Application libraries and versions

ADRs 0002–0010 fixed the platform: Next.js, Postgres with Drizzle, Redis, Better Auth, Graphile Worker, Railway, R2, Resend, Sentry and PostHog. This ADR fixes the libraries inside the apps and their major versions. Every choice was checked against npm and the projects' own docs on 2026-09-30. Exact versions live in the lockfile and in pnpm catalogs, not here.

## Rules

- **How the browser talks to the server:** Server Components load the first page by calling the same oRPC procedures in-process (a server-side router client) and hand the result to TanStack Query through hydration _(amended by D50; this replaced "Server Components call modules directly")_. Every call made from the browser, read or write, goes through **oRPC**. Route handlers are used only for callers outside our web client: Game servers posting results, the realtime ticket, Push subscriptions and Better Auth. Server Actions are not used.
- **Client state:** server data lives in **TanStack Query**, and realtime events update its cache. UI state (layout, game shell, composer) lives in **Zustand**. Nothing else holds server data on the client.
- **Message box:** a plain `textarea` with a small markdown-style syntax, formatting shortcuts, and `@` autocomplete. Mentions become Member IDs when the Message is sent (D34). The same box is used for Comments and Post bodies.
- **Formatting:** `packages/content` has a small hand-written parser that turns text into a tree (bold, italic, inline code, code blocks, links, mentions). React renders that tree; it never renders HTML. Links are detected with `linkifyjs`. The parser is property-tested with `fast-check`.
- **Long lists are not virtualized in v1.** The Message list keeps a limited number of Messages on the page (about 200). It loads pages as you scroll up or down and drops pages far out of view, keeping the scroll position steady by hand, with CSS `content-visibility: auto` for rendering cost. Comments work the same way. Phase 2 measures this with 5,000 seeded Messages on a mid-range phone.

## Versions and libraries

| Area | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24 LTS | Move to Node 26 after it becomes LTS (planned for October 2026). |
| Package manager and builds | pnpm 12 with catalogs, Turborepo 2 | `turbo prune` for Docker builds. pnpm 12 is pinned in `devEngines.packageManager` and switches itself to that version; no corepack, which Node 25+ no longer ships _(amended in CHK-12)_. |
| Language | TypeScript 6 as `typescript`, and TypeScript 7's native compiler for type checking | See "TypeScript" below. |
| Web framework | Next.js 16 (Turbopack, standalone output), React 19, React Compiler on | |
| Shared packages | Consumed as TypeScript source by Next.js (no build step); `apps/realtime`, `apps/worker` and Game servers are bundled with `tsdown` | |
| API between browser and server | oRPC 1 with its TanStack Query integration | v2 is in beta; upgrade when stable. Can publish an OpenAPI description later for native apps. |
| Client data and state | TanStack Query 5, Zustand 5 | |
| Validation and forms | Zod 4, React Hook Form 7 | Env variables validated with Zod at startup. |
| UI | Tailwind CSS 4, shadcn/ui on **Base UI 1**, `lucide-react`, Motion (respecting reduce motion), `react-resizable-panels` 4 | Base UI is shadcn's default since July 2026; Radix stays supported but is no longer the default. |
| Emoji | `frimousse` for the picker in message text, behind our own component; a custom picker for the Reaction set | `emoji-mart` hasn't been released since 2024. `frimousse` is pre-1.0 but actively maintained. |
| Translations and dates | next-intl 4 (display, plurals, relative time), date-fns 4 (date arithmetic) | No locale prefix in URLs. `next.config.ts` sets the `next-intl/config` alias itself rather than loading `next-intl/plugin`, which loads native addons (`@swc/core`, `@parcel/watcher`) for its message extractor; use the plugin if we adopt the extractor _(amended in CHK-19)_. |
| Database | PostgreSQL 18, Drizzle ORM **1.0 RC** (exact version pinned), `pg` 8 | Postgres 18 gives the built-in `uuidv7()` for time-ordered IDs. See "Drizzle" below. The `pg` driver is shared with Graphile Worker so jobs can be added inside Drizzle transactions. |
| Jobs | Graphile Worker 0.18 | ADR-0008. |
| Cache, pub/sub, rate limits | Redis 8, `rate-limiter-flexible` | |
| Auth | Better Auth 1.7 with the email OTP and JWT plugins, and `@better-auth/passkey` | The passkey plugin is now a separate package. |
| Realtime | `ws` 8 on the server; our own reconnect-and-catch-up client | The client is core logic (ADR-0009), so we own it. |
| Game servers | Hono 4 and `ws` | |
| Files and images | AWS SDK v3 S3 client against R2, `sharp` on a Debian-based image | `sharp` is more reliable on Debian than on Alpine. |
| Email | `react-email` 6 for templates, Resend in production, SMTP to Mailpit locally with Nodemailer 10 | Components now come from `react-email`; `@react-email/components` is deprecated. Every vendor sits behind `@chaku/adapters` _(amended in CHK-19: Nodemailer added as the SMTP client)_. |
| PWA and Push | `@serwist/turbopack` 9, `web-push` 3 | `@serwist/next` supports webpack only, and Next.js 16 builds with Turbopack. `web-push` sits behind the Push adapter; `@pushforge/builder` is the fallback if it stops being maintained. |
| Local storage emulator | SeaweedFS (Apache 2.0) behind Caddy | MinIO's free edition is archived and its images were removed from Docker Hub in September 2026. `pnpm stack` applies the same bucket CORS rules we set on R2, from `stack/src/storage.ts` _(amended in CHK-14: the stack sets up the buckets, not the seed script)_. |
| Logs and monitoring | `pino` 10, `@sentry/nextjs` 11, `posthog-js` / `posthog-node` | |
| Tests | Vitest 5, Playwright 1.63 with `@axe-core/playwright`, MSW 3, `fast-check` 4, Storybook 10 with the accessibility addon | |
| Lint and format | ESLint 10 (flat config) with typescript-eslint 8, `eslint-plugin-react-hooks` (includes React Compiler rules), `@next/eslint-plugin-next`, `eslint-plugin-jsx-a11y-x`; Prettier 3; dependency-cruiser | `eslint-plugin-jsx-a11y-x` is a fork with the same rules: the original has not been released since October 2024 and does not accept ESLint 10. Move back if it catches up _(amended in CHK-12)_. |
| Dependency updates | Renovate, grouped weekly, using the pnpm catalogs | |

## TypeScript

TypeScript 7.0, the native compiler, is released, but it has no programmatic API until 7.1. typescript-eslint, and Next.js's default type-checking path, need that API. Following Microsoft's guidance, we install TypeScript 6 as `typescript`, which tools load, and TypeScript 7 alongside it. Since `typescript@latest` is now 7, the catalog aliases the names: `typescript` is `npm:@typescript/typescript6` and `@typescript/native` is `npm:typescript@7`, so `tsc` is TypeScript 7 and `tsc6` is TypeScript 6 _(amended in CHK-12)_. CI and editors use TypeScript 7 for the fast type check. When 7.1 ships its API and typescript-eslint supports it, we drop TypeScript 6.

## Drizzle

The stable release is 0.45. The 1.0 release candidates (RC4 since June 2026) change the migration folder format and the relational query API. Starting on 0.45 would mean migrating both before the beta, on a codebase that doesn't exist yet. We pin the exact 1.0 RC and move to 1.0 stable when it ships. If the RC blocks us during Foundation, we fall back to 0.45 before writing real migrations.

## Considered options

- **Server Actions for writes and oRPC for reads:** two ways to do the same thing. oRPC alone gives one typed contract for every call from the browser.
- **tRPC:** mature, but oRPC also generates OpenAPI, which a native app or outside client could use later.
- **A rich editor (Tiptap, Lexical) for the message box:** far more code and more mobile and accessibility edge cases for bold, italic and code.
- **react-virtuoso:** the free version can reverse a list for chat, but its own docs call that approach convoluted. The chat-specific Message List component is commercial ($168 per developer per year). Virtualizing also breaks find-in-page, and it hides the rest of the chat from screen readers, which matters for WCAG 2.2 AA. If the phase 2 measurement fails, the Virtuoso Message List is the fallback.
- **Radix under shadcn:** still supported, but new shadcn work now defaults to Base UI.
- **Biome instead of ESLint and Prettier:** faster, but its React, React Compiler, Next.js and accessibility rules cover less.
- **RustFS or Garage as the storage emulator:** RustFS is young (it recently had a CORS security fix). Garage needs cluster setup scripts. SeaweedFS is mature and runs as one container.

## Consequences

- `packages/config` holds the shared tsconfig, ESLint, Prettier and dependency-cruiser setup, and the pnpm catalog is the single source of versions.
- Three follow-ups are tracked: Node 26 LTS, TypeScript 7.1, and Drizzle 1.0 stable.
- The TypeScript 6/7 side-by-side install and the Drizzle RC are the two temporary setups; both are removed as soon as their upstream releases land.
