# Local development

The whole app runs on your machine with one command and no cloud accounts (D23, ADR-0006). Docker runs the services; Caddy serves every app over HTTPS on its own `.localhost` site, so cookies, CSP, service workers and passkeys behave as in production.

Logging in as a seed Member (CHK-20), `pnpm stack:prod` and `pnpm dev:tunnel` arrive with later Foundation tickets; this guide grows with them. The web app is described under [Web app](#web-app).

## What runs

| Service | For | You reach it at |
|---|---|---|
| Postgres 18 (`pg_trgm`, `unaccent` available) | the database | `127.0.0.1:5432`, user, password and database `chaku` |
| Redis 8 | Presence, rate limits, pub/sub | `127.0.0.1:6379` |
| SeaweedFS | S3 storage in place of Cloudflare R2 | <https://s3.chaku.localhost> for browsers, `127.0.0.1:8333` for server code |
| Mailpit | catches every email | <https://mail.chaku.localhost>, SMTP on `127.0.0.1:1025` (any login accepted) |
| Caddy | HTTPS for every site | ports 80 and 443 |

The apps themselves run on your machine with `pnpm dev`, and Caddy sends each site to its port:

| Site | App | Port |
|---|---|---|
| <https://chaku.localhost> | `apps/web` | 3000 |
| <https://rt.chaku.localhost> | `apps/realtime` | 3001 |
| <https://reference.chakugames.localhost> | `apps/games/reference` | 4100 |

Until an app exists or while it is stopped, its site answers 502 with a hint. The sites and ports are in [`stack/Caddyfile`](../../stack/Caddyfile).

## Before you start

- **Docker:** Docker Desktop on Windows and macOS, or Docker Engine with the Compose plugin on Linux.
- **Node.js 24 and pnpm 12:** see [CONTRIBUTING](../../CONTRIBUTING.md#setup), then run `pnpm install`.
- **Free ports:** 80 and 443 for Caddy, and 5432, 6379, 1025 and 8333 unless you move them (see [Troubleshooting](#troubleshooting)).

## Start, stop, reset

| Command | Does |
|---|---|
| `pnpm stack` | Starts everything and waits until every service is healthy. Then it creates the buckets with their CORS rules, writes Caddy's root certificate to `.data/caddy-root.crt` and prints the URLs. Safe to run again at any time. |
| `pnpm stack:down` | Stops the stack and keeps its data. |
| `pnpm stack:reset` | Stops the stack and deletes its data: the database and stored files. It keeps Caddy's certificate authority, so you don't have to trust it again. |
| `pnpm stack:check` | Checks the running stack: every service healthy, trusted HTTPS on every site, pre-signed uploads with CORS, Postgres extensions, and the email and storage adapters against Mailpit and SeaweedFS. CI runs it on a fresh machine for every PR. |

`pnpm stack` reads `.env` if you have one, and takes everything else from [`.env.example`](../../.env.example). You only need a `.env` to change something.

Use `pnpm stack` rather than `docker compose up`: compose alone starts the services but doesn't set up the buckets.

## Database

Every module keeps its tables in its own Postgres schema (ADR-0007), declared in `packages/modules/<name>/src/schema.ts`. All of them share one migration history in [`packages/db/migrations`](../../packages/db/migrations) (D36).

| Command | Does |
|---|---|
| `pnpm db:migrate` | Applies the migrations `DATABASE_URL` doesn't have yet. |
| `pnpm db:reset` | Drops every module schema, migrates from scratch and loads the fixed seed. Running it twice gives the same data. Local only. |
| `pnpm db:generate` | After you change a `schema.ts`: drizzle-kit writes the next migration. Read the SQL before you commit it. |

Run `pnpm db:reset` once after `pnpm stack` on a new machine, and whenever you want the seed back.

The seed has fake Members only, with `example.com` addresses, never real people or emails (ADR-0013):

| Member | Role | Invited by |
|---|---|---|
| `admin@example.com` | Admin | nobody (seeded) |
| `alice@example.com`, `bohdan@example.com` | Member | Admin |
| `chen@example.com` | Member | Alice |
| `daryna@example.com` | Member | Bohdan |

Daryna has one open Invite. Its code is `seed-open-invite`, for trying signup once Invites have a page (CHK-21).

### Tests

Module tests run against the stack's Postgres, never database mocks (D19), so start `pnpm stack` before `pnpm test`. The harness in `@chaku/db/testing` builds a template database from the migrations once, gives each test worker its own copy named `chaku_test_<package>_<worker>`, and empties every table before each test. It never touches the `chaku` database you use with `pnpm dev`. CI runs the same tests against a Postgres service with the same image.

## Web app

`apps/web` is the Next.js app at <https://chaku.localhost>. Start the stack first: the home page asks Postgres whether it is up.

| Command | Does |
|---|---|
| `pnpm dev` | Runs every app in development mode; the web app listens on port 3000. |
| `pnpm --filter @chaku/web build` | The production build: Next.js standalone output, the same server production runs. |
| `pnpm --filter @chaku/web start` | Starts that build on port 3000, with the environment from `.env` and `.env.example`. |
| `pnpm --filter @chaku/web test:e2e` | Playwright against the production build through Caddy: hydration, CSP, languages, accessibility. Run the build first. It starts the server unless one already runs on port 3000. The first time, run `pnpm --filter @chaku/web exec playwright install chromium`. |

The environment is checked with Zod when the server starts ([`apps/web/src/env.ts`](../../apps/web/src/env.ts)). A missing or wrong variable stops it with the variable's name. Locally the values come from `.env`, then `.env.example`; deployed, the platform sets them.

The interface language follows the `NEXT_LOCALE` cookie (`en` or `uk`), then the browser's languages, then English. URLs have no language prefix. The mode follows the `theme` cookie (`light` or `dark`), otherwise the system setting; to try dark mode before Settings has a switch, set the cookie in the browser's developer tools.

Email, storage, push, analytics, error reports and bot checks go through [`@chaku/adapters`](../../packages/adapters/README.md). Until phase 4 they are all local: email lands in Mailpit, files in SeaweedFS, and the rest is logged or does nothing (D55).

## Design tokens and Storybook

Colours, fonts, radii, spacing, the type scale and z-index layers live in [`packages/ui/src/tokens`](../../packages/ui/src/tokens) (ADR-0015). Components use them as Tailwind utilities (`bg-bubble-own`, `text-muted-foreground`, `rounded-bubble`, `z-dialog`); lint rejects colour literals and `dark:` classes anywhere else.

| Command | Does |
|---|---|
| `pnpm --filter @chaku/ui tokens` | Writes `packages/ui/tokens.css` from the token files. Run it after changing them and commit both; a test fails while the CSS is stale. |
| `pnpm --filter @chaku/ui storybook` | Storybook at <http://localhost:6006>. The toolbar switches theme and mode; Foundations → Tokens shows every role in light and dark. |
| `pnpm --filter @chaku/ui test:storybook` | Renders every story in Chromium with the accessibility checks, once in light and once in dark mode, as CI does. The first time, run `pnpm --filter @chaku/ui exec playwright install chromium`. |

The contrast test (part of `pnpm test`) checks every listed foreground and background pair in every mode of every theme. When a component puts one role on another, add the pair to [`contrast.ts`](../../packages/ui/src/tokens/contrast.ts).

## Worker

`apps/worker` runs the jobs (ADR-0008). `pnpm dev` starts it with the web app and restarts it when its files change. It needs Postgres from `pnpm stack`.

| Command | Does |
|---|---|
| `pnpm --filter @chaku/worker dev` | Runs only the worker, from TypeScript, restarting on changes. |
| `pnpm --filter @chaku/worker build` | Bundles it with tsdown into `apps/worker/dist/main.mjs`. |
| `pnpm --filter @chaku/worker start` | Runs that bundle with the environment from `.env` and `.env.example`. |

`WORKER_CONCURRENCY` (default 5) sets how many jobs run at once. Ctrl+C or `SIGTERM` stops taking jobs and waits for the running ones; a second signal stops at once. How to add a job: [architecture overview, Jobs](../architecture/overview.md#jobs).

## Trust the local certificate

Do this once per machine. Caddy signs every site's certificate with its own local root. Until your system trusts that root, browsers show a warning and passkeys and service workers don't work.

`pnpm stack` writes the root to `.data/caddy-root.crt`. Run the commands for your system from the repo root, then restart your browser.

### Windows

In PowerShell, without admin rights:

```powershell
certutil -user -addstore Root .data\caddy-root.crt
```

Confirm the security prompt. Chrome and Edge use this store straight away. Firefox reads it too if `security.enterprise_roots.enabled` is `true` in `about:config`; otherwise import the file as described under [Firefox](#firefox).

### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .data/caddy-root.crt
```

Safari and Chrome use the keychain. For Firefox, see [Firefox](#firefox).

### Linux

Add it to the system store. On Debian and Ubuntu:

```bash
sudo cp .data/caddy-root.crt /usr/local/share/ca-certificates/chaku-local.crt && sudo update-ca-certificates
```

On Fedora:

```bash
sudo trust anchor --store .data/caddy-root.crt
```

Chrome and Chromium on Linux use their own store. Add the certificate there too (`certutil` comes in `libnss3-tools`):

```bash
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Chaku local CA" -i .data/caddy-root.crt
```

### Firefox

On any system: Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import. Choose `.data/caddy-root.crt` and tick "Trust this CA to identify websites".

### Check it

Open <https://mail.chaku.localhost>. Mailpit loads with no warning.

### When to trust it again

Only if Caddy's root changes. That happens when its Docker volume (`chaku_caddy`) is deleted, for example by a Docker Desktop factory reset. `pnpm stack` tells you when the root is new. Remove the old "Caddy Local Authority" root from your store, then repeat the steps above.

## Storage

The buckets are `chaku-private` (Message images, Group Chat avatars, served through short-lived signed links) and `chaku-public` (feed images and Member avatars, readable by anyone). Their CORS rules live in [`stack/src/storage.ts`](../../stack/src/storage.ts). They allow uploads with a pre-signed PUT, and signed reads, from `https://chaku.localhost` only. The R2 setup in phase 4 applies the same rules with the production origin.

Server code talks to SeaweedFS on `S3_ENDPOINT` (`http://127.0.0.1:8333`). Pre-signed links must be signed for the host the browser uses, so sign them with `S3_PUBLIC_ENDPOINT` (`https://s3.chaku.localhost`). Use path-style bucket addresses (`forcePathStyle`).

## Server code and the `.localhost` sites

Browsers and curl send every `*.localhost` name to your own machine. Node.js on Windows can't resolve those names (`ENOTFOUND`). That's why `.env.example` gives server code `127.0.0.1` addresses for Postgres, Redis, SMTP and storage.

If server code does call one of the HTTPS sites, Node.js needs Caddy's root too: start it with `NODE_EXTRA_CA_CERTS=.data/caddy-root.crt`.

## Troubleshooting

**`pnpm stack` says a port is already allocated.** Another program uses it. For 80 or 443 that's often another local proxy, IIS or a VPN client; stop it. For the others, copy `.env.example` to `.env` and change both the port and its URL, for example `CHAKU_POSTGRES_PORT=5433` and `DATABASE_URL=postgres://chaku:chaku@127.0.0.1:5433/chaku`.

**`Could not run docker` or `failed to connect to the docker API`.** Docker isn't running. Start Docker Desktop and try again.

**The browser still warns after the trust step.** Restart the browser completely. Make sure you trusted the current `.data/caddy-root.crt`: after a new root, the old one in your store doesn't help. Firefox needs its own import (see [Firefox](#firefox)).

**curl on Windows fails with "the revocation status is unknown".** Windows curl tries to check whether the local root was revoked, and it can't. Add `--ssl-no-revoke`.

**A site answers "is not running. Start it with pnpm dev".** The stack is fine; the app behind that site isn't running. On Linux, also check that your firewall lets Docker reach ports 3000, 3001 and 4100 on the host.

**Tests fail with `ECONNREFUSED 127.0.0.1:5432`.** Postgres isn't running. Start it with `pnpm stack`.

**Something is in a strange state.** `pnpm stack:reset`, then `pnpm stack`. You start again with empty data, and the certificate stays trusted.
