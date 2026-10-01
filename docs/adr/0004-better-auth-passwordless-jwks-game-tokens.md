---
status: accepted
date: 2026-09-30
amended-by: ADR-0010
---

# Better Auth, passwordless login, JWKS game tokens

Authentication uses Better Auth, storing its data in our own Postgres through Drizzle, inside the `identity` module's schema. Members log in with Google or by email _(amended by ADR-0010: the email carries a 6-digit code and a link to a "Log in" button page)_, and are offered a passkey after their first login. There are no passwords. Sessions last 30 days and are extended while in use. Members can list and revoke their sessions, and logins from a new device trigger an email alert. Signup requires a valid Invite. Game identity tokens are short-lived (10 minutes) JWTs from Better Auth's JWT plugin. Each is scoped to one Game (the audience is that Game's origin) and carries only user id, name, avatar and Game Session id. Games verify them against our public JWKS endpoint, and tokens are refreshed through the game contract.

We chose Better Auth because it keeps user data in our database and covers, as plugins, what we need: Google, magic links, passkeys, session management, admin roles and bans, and a JWKS endpoint for Game tokens. Going passwordless removes password storage, resets and credential-stuffing risk, which matters more because chats are not end-to-end encrypted (ADR-0001).

## Considered options

- **Auth.js:** now maintained by the Better Auth team, who point new projects to Better Auth; weaker passkey support and no JWKS endpoint.
- **Hosted auth (Clerk, Auth0):** another vendor holding user data, and awkward to fit to invite-only signup and custom Game tokens.
- **Passwords as an option:** rejected; adds the storage, reset and breach burden for little benefit.

## Consequences

- Email delivery becomes critical for login (magic links, and email codes per ADR-0010), so the email provider needs monitoring.
- Signup is gated in Better Auth's user-creation hook: without a valid Invite carried through the Google or email flow, no account is created.
- Google and email logins with the same verified address are one account (Google counts as a trusted provider for account linking).
- Per-Game audiences and custom claims on the JWT plugin need a spike in phase 5. If the plugin can't set them per token, we sign with `jose` using the same keys and JWKS endpoint.
- A Member who loses access to both their Google account and their email can't log in; recovery is a manual Admin process in v1.
