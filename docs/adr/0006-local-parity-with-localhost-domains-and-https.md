---
status: accepted
date: 2026-09-30
---

# Full local stack with .localhost domains and HTTPS

The whole app runs locally with one command and no cloud accounts. Docker Compose provides Postgres, Redis, S3-compatible storage, Mailpit and a Caddy reverse proxy. Caddy serves every app over HTTPS on distinct `.localhost` host names: `chaku.localhost` (app), `rt.chaku.localhost` (realtime), `reference.chakugames.localhost` (Reference Game). Certificates come from Caddy's local certificate authority, which each developer trusts once. Every external vendor (email, storage, push, analytics, error reporting) sits behind an adapter with a local or no-op implementation. Configuration is schema-validated from a committed `.env.example`.

Browsers share cookies across ports on the same host, so the app and a Game on `localhost:3000` and `localhost:4100` are not isolated the way they are in production (ADR-0002). Distinct `.localhost` names count as separate sites, and HTTPS makes Secure cookies, HSTS, CSP, service workers and passkeys behave the same as production. Auth and iframe bugs hide in exactly those differences.

## Consequences

- Each developer runs a one-time step to trust Caddy's local root certificate, documented in the local development guide.
- A dev-only "log in as seeded Member" switcher exists for multi-user testing and Playwright. It is enabled only by an explicit development flag, and CI checks that it is absent from production builds.
- `pnpm stack:prod` runs the production Dockerfiles locally; `pnpm dev:tunnel` exposes a temporary HTTPS URL for testing the PWA on real phones.
- Google login locally needs a dev OAuth client and is optional; email codes and magic links (via Mailpit) and passkeys always work.
- Playwright logs in with email codes read from Mailpit (ADR-0010), so end-to-end tests don't depend on the switcher and can run against production builds.
