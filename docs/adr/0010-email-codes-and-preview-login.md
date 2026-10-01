---
status: accepted
date: 2026-09-30
amends: ADR-0004, ADR-0006
---

# Email codes next to magic links, and how previews log in

**Email login sends a code and a link.** The email contains a 6-digit code and a link. Typing the code works in any browser or installed app. The link is a convenience and opens a page with a "Log in" button, rather than logging in on load. This uses Better Auth's email OTP plugin. Codes expire after 10 minutes, are single-use, and are rate-limited per address and per IP. After first login, a passkey is offered strongly, as the main way back in.

**Previews log in with email codes only.** Each Railway preview runs its own Mailpit, with its web UI behind basic auth, and the preview sends all email there. Google login is not available in previews. Playwright reads codes through the Mailpit API, so end-to-end tests log in the real way and need no dev login switcher, including against production builds. Every origin (app, realtime, games) comes from environment variables, so previews get correct CSP, CORS, passkey domain and Game token audiences.

## Why

On iPhone, a link in Mail always opens Safari, not the installed app, and the installed app keeps its own storage separate from Safari. A magic link alone would log in the wrong place. Email security scanners also open links in emails, which can use up a single-use link before the person taps it; a button page and a typed code avoid both problems.

Google doesn't accept wildcard redirect addresses, so each preview URL cannot be registered. Previews hold only seed data, so reading their email in Mailpit exposes nothing real.

## Considered options

- **Better Auth's OAuth proxy for previews:** Google login would work in previews, but production would take part in every preview login and share a secret with it.
- **Real email in previews through Resend:** needs an allowlist, and sends real emails for throwaway environments.
- **The dev login switcher in previews:** previews are production builds, and ADR-0006 keeps the switcher out of those.

## Consequences

- Google login is checked locally (optional dev OAuth client) and by a production smoke test after each deploy, not in previews.
- Foundation must check that Railway's generated preview hostnames count as separate sites (they need to be on the Public Suffix List), so the Game stays isolated from the app in previews too.
