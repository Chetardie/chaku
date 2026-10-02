# Chaku: Product Spec v0.4

Status: product decisions complete (see §9 Decisions log, D1–D55). v0.3 added the spec review fixes (D24–D38) and the application libraries (D39). v0.4 adds the fixes from the second review (D40–D54): sync check, media access, Game Session presence, bot checks, moderation and operations gaps, and the public repository. Not yet designed: data model, realtime protocol, `game-sdk` contract details.
Goal: a real product. The first iteration is an invite-only beta, released to friends in waves, to see how it feels.
Glossary: [`/CONTEXT.md`](../CONTEXT.md). Architecture decisions: [`docs/adr/`](adr/).

## 1. What it is

A web-only messenger (installable as a PWA) with Direct and Group Chats, a platform for Games played beside your Chats, and a public feed of Posts organized in Topics. One account works across everything. The interface is in English and Ukrainian.

## 2. v1 scope

**In**
- Invite-only signup with minimum age and terms; Google login, email login (code or link), passkeys; username, display name, avatar; Profile Links
- Direct and Group Chats: formatted text, up to 4 images with an image viewer, Link Previews and Post Cards, Message Replies, mentions, Reactions, edit and delete, Read Positions, jump to first unread, drafts, Presence, typing, Mute, Blocks
- Notifications (bell), in-app toasts, Push
- Games platform: Game Catalog, Game Manifests, Game Sessions, Game Challenges, identity tokens, Game Results, resizable split and full layout, Mini Player, and the Reference Game, playable by beta Members as "Four in a Row"
- Feed: Admin-created Topics; Posts with body and up to 10 images; Votes and Reactions; threaded live Comments; public Post page with link preview; share into a Chat
- Search: people, chat list filter, Posts
- Moderation: Reports (including from logged-out visitors on public Posts), Admin removal (including reported Messages), bans, invite tree, Admin audit log
- Account deletion and data export (GDPR), rate limits, bot checks, the security baseline, backups, Sentry, PostHog, feedback button, privacy policy and terms, English and Ukrainian UI

**Out until after the beta**
- Search inside Message text, files/voice/video in Chats, GIF search, forwarding and pinning Messages, more product Games (Four in a Row is the only one), game relay
- Gated visibility, Topic following, DM acceptance, edit history, Moderator role, grouped reaction notifications, notification emails and digests
- End-to-end encryption (never planned; ADR-0001), native mobile apps, AI features, billing, staging environment

## 3. Requirements

### 3.1 Identity and people
- **Roles:** Member and Admin only (D2).
- **Invites:** each Member has 5, single-use, expiring after 7 days. Admins have unlimited Invites and can create multi-use ones. Invites record who invited whom (D12).
- **Signup:** Invite → Google or email → confirm age 16+ and accept the terms and privacy policy → username → display name and avatar → install prompt → automatic Direct Chat with the inviter (D12, D37).
- **Usernames:** 3–20 characters, `a-z 0-9 _`, not case-sensitive, unique, reserved words blocked; changeable once every 30 days (D12).
- **Finding people:** username search and Profile Links (`/@username`, for logged-in Members only) (D12, D17, D37).
- **Login:** no passwords. Google; email with a 6-digit code or a link; passkeys offered strongly after first login. 30-day sessions, a sessions page with remote log-out, alerts on new-device logins (D21, D32).
- **Email:** Google and email logins with the same verified address are one account. Changing the email needs a code sent to the new address, and the old address gets an alert (D37).
- **Account deletion:** 14-day grace period, then a full wipe that turns content into "[deleted]" placeholders and shows the person as "Deleted user" (D5).
- **Data export:** a Member can request a copy of their data from Settings; delivered within 30 days (manual in the beta) (D37).

### 3.2 Chat
- **Direct Chat:** exactly 2 Participants, one per pair. Anyone can message anyone; Blocks and rate limits protect people (D3).
- **Group Chat:** up to 50 Participants. Roles are Group Owner and Group Admin. Any Participant can add people. New Participants see the full history. Ownership passes on when the Owner leaves (D3).
- **Message:** light formatting, any emoji in text, up to 4 images, Post Cards for our own Posts, Link Previews for outside links (D4).
- **Message Reply:** a Message can quote one earlier Message in the same Chat; tapping the quote jumps to it (D26).
- **Reading:** an image viewer for Message images; "jump to first unread" when opening a Chat; an unsent draft is kept per Chat on the device (D26).
- **Images:** uploaded as soon as they are picked; the Message is sent when uploads finish and shows placeholders until processing is done (D46). Every image is shown through a stable `/media` link (D42).
- **Edit and delete:** authors can edit and delete their own Messages with no time limit. Deleting applies for everyone and leaves a "[deleted]" placeholder (D5).
- **Reactions:** emoji only on Messages, from the fixed Reaction set (D14).
- **Mentions:** in a Group Chat only Participants can be mentioned. A mention creates a Notification unless Blocks apply (D11). Mentions are stored by Member ID (D34).
- **Read state and Presence:** "Seen" and "Seen by", a green dot and rough last seen, typing indicators, reciprocal privacy switches (D10).
- **Blocks:** one-way and silent; blocked Members' Messages are collapsed in shared Group Chats (D11).
- **Mute:** per Chat, for a time or indefinitely (D6).

### 3.3 Notifications
- Unread counts for Messages. Notifications for mentions, Message Replies to you in Group Chats, Game Challenges, Comments on your Post or Comment, and being added to a Group Chat (D6, D26).
- In-app real time, plus Push when the Member has no active tab (defined in D29). Email is transactional only. Reactions and Votes never notify (D6).
- Setting: "Show message text in notifications" (D9).

### 3.4 Feed
- **Topics:** created by Admins; the default Topic is General. Views: all Posts (`/`) and per Topic (`/t/[slug]`).
- **Post:** title, optional subtitle and body, 0–10 images with alt text, one Topic (D13). URLs don't depend on the Topic: `/posts/[id]-slug`. The public Post page has Open Graph metadata; its first image is the link preview.
- **Logged-out visitors** see the Post, its Comments (not live), and authors' display names and usernames. They can't vote, react, comment or open profiles. They can report a Post or Comment (D37).
- **Sharing:** copy the link, or send into a Chat as a Post Card.
- **Votes (like/dislike)** and **Reactions** on Posts and Comments; only the Score is shown (D13, D14).
- **Sorting:** Hot (the default), New, Top (D13). Formulas in D33.
- **Comments:** threaded (4–5 levels, then "continue thread"), collapsible, live-updating, with mentions (anyone can be mentioned), Votes and Reactions. Best first, with a newest toggle.
- **Edit and delete:** for Posts and Comments, with an "edited" marker and no edit history. Author deletes show "[deleted]"; Admin removals show "[removed by admin]" (D2).
- **Visibility:** every Post is public; checks go through one `canView` policy so it can be gated later.

### 3.5 Games
- **Catalog → open → invite:** open a Game from the Game Catalog. From inside the Game, invite people through the app's picker. Invitees get a toast, Push and Notification and click Join. Challenges expire after 15 minutes (D1, D15).
- **Single-player and multiplayer** Games (D15).
- **Layout:** the Game and Chats side by side (full, split or chat-only), resizable, sizes saved per Game. On phones the split is top/bottom. Mini Player: floating on desktop, a bottom bar on phones. The Game shell lives in the app layout so the Game survives navigation (D7, D15, D31).
- **Isolation:** separate domain, sandboxed iframe, contract-only communication, cookieless Games, gameplay networking handled by each Game, results only from Game servers (D16, D31, ADR-0002).
- **Reference Game:** "Four in a Row", single-player against a simple bot and 2-player. It proves the contract in tests and is the Game beta Members play (D15, D25).

### 3.6 Moderation and safety
- **Reports** on Messages, Posts, Comments and people. For a Message, the Report snapshots about 10 earlier messages. Admins work a report queue. Snapshots are deleted 90 days after the Report is resolved (D2, D9). Logged-out visitors can report public Posts and Comments (D37).
- **Admins** remove content (a Message only through its Report), ban and suspend people, and see the invite tree. They cannot browse Chats (D2, D47). Ban effects are in D37 and D47. Admin tools need a passkey login, and every Admin action is in the audit log (D47).
- **Security baseline** (D9) and **rate limits** on messages, Invites, login, email codes, Challenges, Reports and uploads, plus storage quotas (D46).
- **Bot checks:** Cloudflare Turnstile on the logged-out report form and email login (D44).

### 3.7 Search
- People, a chat list filter, and Posts (Postgres full-text). No search inside Message text (D17, D33).

## 4. Non-functional requirements
See D18, D19 and D36. Summary:
- **Scale:** 100 Members, 20 online at once; no redesign up to 10,000.
- **Speed (p95):** Message delivery under 300 ms; main page content under 2.5 s on 4G; checked with a load test before beta wave 1.
- **Accessibility:** WCAG 2.2 AA.
- **Languages:** EN and UK UI; right-to-left content supported.
- **Hosting:** one EU region.
- **Backups:** daily, encrypted, kept 30 days, restore tested before beta wave 1 and then quarterly.
- **Data loss and restore (beta):** up to 24 hours of data may be lost; restore best effort within 4 hours (D48).
- **Browsers:** last 2 versions of Chrome, Edge, Firefox and Safari, plus iOS Safari 16.4+.
- **Environments:** local, PR previews, production.
- **Tests:** acceptance criteria covered by tests.

## 5. Architecture

### 5.1 Deployable units (ADR-0003, ADR-0005, ADR-0008, ADR-0009)
1. `apps/web`: Next.js modular monolith (routes, pages, wiring); publishes realtime events right after commit
2. `apps/realtime`: Node WebSocket gateway that only relays (chat events, Presence, typing, Notification and Challenge pushes, live Comments and Reactions); Redis pub/sub
3. `apps/worker`: Graphile Worker running module event handlers, Push, email, image processing, Link Preview fetching, timers and cleanup
4. `apps/games/*`: one app per Game, on the games domain; the Reference Game comes first

### 5.2 Modules (`packages/modules/*`, ADR-0007)
| Module | Owns |
|---|---|
| identity | Members, profiles, sessions, Invites, Blocks, roles, Game token issuing, people search |
| chat | Chats (Direct and Group), Participants, Messages, Message Replies, Chat events and the Chat Sequence, Read Positions, Mute, Link Previews, Reactions and mentions on Messages |
| games | Game Manifests, Game Catalog, Game Sessions, Game Challenges |
| results | Game Results and per-Member stats |
| feed | Topics, Posts, Comments, images, Votes and Reactions on Posts and Comments, mentions in Posts and Comments, Post search |
| notifications | Notifications, Push subscriptions, delivery rules |
| moderation | Reports, snapshots, Admin actions, bans |
| search | no tables; groups results from identity and feed |

Each module has one public entry point and its own Postgres schema. Other modules refer to its data by ID only. Direct calls are for immediate answers; jobs added in the same transaction are for side effects (ADR-0003, ADR-0008). Screens that combine modules use batch lookups, and counters are stored with the item (ADR-0007). Every module that stores Member data handles `member.erasure_requested`.

Shared code with no data: `packages/content` holds the formatting parser, mention parsing and the Reaction set, used by both client and server.

### 5.3 Realtime model (ADR-0009), details in the realtime protocol doc
- **Writes over HTTP** into the owning module; the gateway never touches the database.
- **Chat Sequence:** every change in a Chat gets the next number and is logged in `chat.events` (references only, never content). Read Positions are not in it (D49).
- **Channels:** each connection listens on its own `member:{id}` and `session:{id}` channels; permissions are decided when publishing.
- **Catch-up:** on reconnect or a gap, the client asks for events after its last Chat Sequence and gets the current state of what they reference, including every Participant's Read Position.
- **Sync check:** on (re)connect, when the page becomes visible, and every 60 seconds while visible, one call returns the latest Chat Sequence per Chat, Notification state and pending Game Challenges. It finds new Chats, removed Chats and lost events (D40, ADR-0012).
- **Connecting:** 60-second single-use ticket from the web app; sockets close when their session is revoked or the Member is banned.
- **Send reliability:** client-generated IDs make sends idempotent.

### 5.4 Game contract (`packages/game-sdk`), to be designed in detail
- **Manifest:** id, name, image, min/max players (min can be 1), URL, contract version, optional aspect ratio and minimum size. Manifests are stored in the `games` module and registered by an Admin; each Game gets its own service credential for results, which can be rotated.
- **Host → Game:** `init` (token, session, players, locale, theme), `layout`, `tokenRefresh`, `pause`, `playersChanged`.
- **Game → Host:** `ready`, `requestInvite`, `resizeHint`, `requestLeave`, `finished` (the result itself comes from the Game server).
- **Transport:** a MessageChannel port handed over in the launch handshake.
- **Identity:** 10-minute JWTs with the Game's origin as audience, verified against JWKS (ADR-0004). Games are cookieless: the token goes in a request header to the Game's server (ADR-0002).
- **Results:** Game server → `POST /api/games/results` with its service credential. The app checks the Game Session and its players and makes sure it isn't already finalized. Validated with Zod.
- **Session lifecycle:** waiting → active → finished / abandoned, owned by the platform. The host sends a heartbeat for each open Session; a timer job marks a Session abandoned when no player has sent one for 2 minutes (D43).
- **Embedding:** never remount the iframe. The Game shell lives in the signed-in app layout, not a parallel route (ADR-0002). `react-resizable-panels`; `pointer-events: none` while dragging; "full" layout in CSS, with the Fullscreen API only where supported.
- **Adding a Game:** build, deploy and register its Manifest. No main-app code change.

### 5.5 Stack and infrastructure
Libraries, versions and the rules for using them are in ADR-0011.
- **Code:** Node.js 24 LTS, Next.js 16 + React 19, TypeScript (6 for tools, 7 for type checking), pnpm 12 with catalogs + Turborepo, dependency-cruiser, ESLint + Prettier, Renovate
- **Browser ↔ server:** Server Components call the same oRPC procedures in-process for the first load and hydrate TanStack Query (D50); oRPC for every call from the browser; TanStack Query and Zustand on the client; Zod everywhere
- **Data:** PostgreSQL 18 + Drizzle 1.0 (one schema per module, one migration history), `pg`, Redis 8, `pg_trgm` and `unaccent`
- **Jobs:** Graphile Worker (ADR-0008)
- **Auth:** Better Auth with the email OTP, passkey and JWT plugins (ADR-0004, ADR-0010)
- **Realtime and Games:** `ws`; Game servers on Hono
- **Hosting:** Railway, EU region, Docker (ADR-0005); opt-in PR previews (label `preview`) with their own Mailpit (D51)
- **Files and images:** Cloudflare R2 (private and public buckets); uploads go straight to R2 with a pre-signed link, then `sharp` in the worker re-encodes, strips location data and makes the sizes we serve; SeaweedFS stands in for R2 locally; images are served through `/media/{id}/{size}` (D42)
- **PWA:** `@serwist/turbopack` for the service worker; `web-push` with VAPID keys
- **Email and DNS:** Resend with `react-email` templates, sent from a mail subdomain with SPF, DKIM and DMARC (D52); Cloudflare for DNS
- **Bot checks:** Cloudflare Turnstile behind an adapter (D44)
- **UI and text:** next-intl and date-fns; `packages/ui` (tokens as CSS variables, shadcn/ui on Base UI, Tailwind 4, Storybook) mirrored to Figma
- **Monitoring and CI:** Sentry (errors, tracing, uptime monitors and alerts) and PostHog (EU); `pino` structured logs; GitHub Actions; k6 for the realtime load test
- **Tests:** Vitest, Playwright with axe, MSW, `fast-check`, Storybook accessibility checks

### 5.6 Repo layout
```
apps/
  web/                 # Next.js modular monolith
  realtime/            # WebSocket gateway (relay only)
  worker/              # Graphile Worker jobs
  games/
    reference/         # Four in a Row (+ tiny server), own deploy on the games domain
packages/
  modules/             # identity, chat, games, results, feed, notifications, moderation, search
  content/             # formatting parser, mention parsing, Reaction set (no data)
  game-sdk/            # contract types, host and client helpers
  ui/                  # design tokens + components
  config/              # tsconfig, eslint, dependency-cruiser
docs/
  adr/
  design-system/
CONTEXT.md
CLAUDE.md
```

## 6. Build order and beta waves (D24)
1. **Foundation (local only, D55):** one-command local stack (D23), monorepo, CI, boundaries, DB and migrations, worker, auth (Google, email codes and links, passkeys), Invites, profiles, i18n, `ui` tokens, logs, and the Sentry adapter (no-op until production)
2. **Realtime gateway and Direct Chat** (the riskiest infrastructure first): starts with the one-day Centrifugo spike (ADR-0009); Chat Sequence and catch-up; images and Link Previews
3. **Group Chats, Message Replies, mentions, Reactions, Notifications, Push, Read Positions, Presence, Blocks, people search**
4. **Beta wave 1 readiness:** production setup first (D55): domains (D41), email sending (D52), Railway deploy with opt-in PR previews and backups (D36, D51), Sentry and PostHog accounts. Then Reports and Admin tools for Chats and people, bans, the Admin audit log, rate limits, bot checks, legal pages with age and terms at signup, a named data controller and signed processing agreements (D53), data export script, onboarding and install prompt, feedback button, restore test, realtime load test, accessibility check of the chat screens. **Then invite friends (wave 1).**
5. **Games platform:** `game-sdk` contract, Four in a Row, Catalog, Sessions, Challenges, layout, Mini Player. **Released to the beta behind a feature flag (wave 2).**
6. **Feed, Topics and Post search:** public Post page, logged-out reporting. **Released behind a feature flag (wave 3).**
7. **Beta hardening:** full accessibility audit, fixes from beta feedback.

## 7. Open items
- **Domains:** the app domain (e.g. `chaku.app`) and a separate games domain (e.g. `chakugames.app`). Needed before the first production deploy in phase 4 (D55), because passkeys are bound to the app domain (D41).
- **Data controller:** the person or company named in the legal pages (D53).
- **License** for the public repository (ADR-0013).
- **Brand direction** for the design system.
- The exact list of about 24 Reactions.
- **Rate limit and storage quota values.**
- **Targets** for the beta metrics in D24.
- **Centrifugo spike outcome** (start of phase 2).

## 8. Next design docs
- Data model (Postgres schema per module, including Chat events and counters)
- Realtime protocol (event types, the Chat Sequence, catch-up limits, event log retention, Presence and active-tab rules)
- `game-sdk` contract in detail
- Design system foundations
- Web data flow: in-process oRPC, hydration, query keys, realtime cache updates (D50)

## 9. Decisions log
Decisions D1–D23 were made on 2026-09-30 while turning v0.1 into v0.2. D24–D38 were made the same day after the spec review, turning v0.2 into v0.3. D40–D54 were made on 2026-10-01 after the second review, turning v0.3 into v0.4. D55 was made on 2026-10-02. Terms are defined in `/CONTEXT.md`.
- D1: "Invite" is signup-only; a game request is a **Game Challenge**. A Game Challenge expires after 15 minutes if not accepted. (Revised by D15: Challenges no longer appear as cards in Chats.)
- D2: Site-wide roles are Member and Admin only (the role field should leave room for Moderator later). Admins manage topics, remove posts and comments ("[removed by admin]"), suspend or ban users, handle the report queue, and create unlimited Invites. Admins cannot browse private chats; a Report snapshots the reported message plus about 10 messages before it.
- D3: People in a chat are **Participants**. Group Chat: the creator is the Group Owner, who can promote Group Admins. Owners and Group Admins can rename, change the avatar and remove Participants. Any Participant can add people (blocks apply). Limit of 50 Participants. Anyone can leave; if the Owner leaves, ownership passes to the longest-serving Group Admin, else the longest-serving Participant. New Participants see the full history. A Direct Chat always has exactly 2 Participants and there is only one per pair; adding a third person creates a new Group Chat.
- D4: A Message contains text (any emoji; light formatting: bold, italic, inline code, code blocks, automatic link detection) and up to 4 images, using the same upload checks as the feed (type, size, location data stripped). No files, voice or video in v1; GIF search comes after the beta. Links to our own Posts render as a Post Card. Outside links get a Link Preview: fetched once on the server with protection against requests to internal systems, then stored; the sender can dismiss it before sending.
- D5: Authors can edit their own Messages with no time limit ("edited" marker, only the latest text kept). Authors can delete their own Messages for everyone at any time: the content is erased and a "[deleted]" placeholder stays. There is no "delete for me". Group Owners and Group Admins cannot delete others' Messages; they Report instead. Account deletion: the account is deactivated immediately and permanently erased after a 14-day grace period (logging in cancels it). Erasure wipes profile data and login connections; all Messages, Posts and Comments become "[deleted]"; reactions and votes are removed; the name shows as "Deleted user"; game results stay but become anonymous; the username becomes available again.
- D6: A new Message only affects Unread state (the Chat turns bold and shows a count). Notifications (the bell list) are for mentions, Game Challenges, replies to your Post or Comment, and being added to a Group Chat. Delivery happens in the app in real time, plus Push for Direct Chat messages, Group Chat messages, mentions, Game Challenges and replies, sent only when the Member has no active tab. Email is transactional only (Invite, login and verification, account deletion). Controls: Mute per Chat (for a time or indefinitely) and a global switch to pause Push. Reactions and votes never notify anyone in v1. (Revised by D26: Message Replies in Group Chats also notify.)
- D7: Phone-first responsive design with one codebase (works from 360px wide; on phones the chat list and the open Chat are separate screens, on desktop they sit side by side). Installable PWA: app icon, no browser bar, Push, cached app shell. No offline sending (show an "offline" banner). After signup, show an "Install the app" prompt with iPhone steps. Games on phones: top/bottom split; a minimized game becomes a bar pinned to the bottom. Browsers: last 2 versions of Chrome, Edge, Firefox and Safari, plus iOS Safari 16.4+; older browsers get a "please update" page.
- D8: No end-to-end encryption, and it is not a future option we design for. Chats are encrypted in transit and at rest; the server can read content, and the privacy policy says so. See ADR-0001.
- D9: Security baseline. Each item is an acceptance requirement.
  - **Data:** encryption at rest; TLS to the database; encrypted backups kept at most 30 days; no production data outside production.
  - **Access:** production database access limited to 1–2 people and logged; no admin screen shows chat content; coding agents and MCP servers connect only to local or preview databases with fake seed data.
  - **Logs:** never log Message or Comment bodies; scrub request data before it goes to Sentry; analytics events carry no content.
  - **Images:** chat images live in a private bucket with short-lived signed URLs and unguessable names; feed images may be public.
  - **Push:** payloads use the web push encryption standard; a user setting "Show message text in notifications".
  - **Reports:** snapshots visible to Admins only, every view logged, deleted 90 days after the Report is resolved.
  - **Authorization:** every read goes through one policy (`canView`, extended to Chats, Messages and images); every realtime event is checked when published (D29); automated tests try to read other people's Chats.
  - **XSS:** formatting is rendered from a parsed structure, never raw HTML; strict Content Security Policy; Link Preview images go through our own proxy. (Revised by D42: they are downloaded once and stored privately.)
  - **Accounts:** Google sign-in plus passkeys or email codes and links (no passwords); a "Your devices / sessions" page with remote log-out; an email alert on login from a new device; rate limits on login and Invites.
  - **Games:** separate origins in sandboxed frames; games never receive chat content; game tokens carry only id, name and avatar and are scoped to one game.
  - **Transport:** HTTPS with HSTS; WSS with authentication checked at connect.
  - **Not in v1:** app-level encryption of message content.
- D10: Read state comes from each Participant's Read Position. Direct Chat shows "Seen"; Group Chat shows reader avatars and a "Seen by" list. Presence is a green dot when online, otherwise a rough last seen ("recently", "today", "this week", "a long time ago"; never exact). Typing indicators appear in all Chats, are not stored, and cannot be turned off. Settings "Share read receipts" and "Share online status" are on by default and reciprocal (hide yours and you can't see others'). Blocked people never see your Presence, read state or typing.
- D11: A Block is one-way and silent; the blocked person is only told "You can't message this person" when they try. Effects of Alice blocking Bob:
  - **Direct Chat:** history stays; Bob can't send. Bob can't start a Direct Chat with Alice, add her to Group Chats, or send her a Game Challenge.
  - **Mentions:** Bob's mentions of Alice render as plain text and don't notify her.
  - **Shared Group Chats:** both stay; Alice sees Bob's Messages collapsed ("Message from blocked member · Show").
  - **Feed:** Alice sees Bob's Posts and Comments collapsed. Bob can't comment on Alice's Posts or reply to her Comments.
  - **Search:** Alice is hidden from Bob's people search.
  - **Games:** games already running finish normally.
  - Block lists are unlimited and managed in Settings.
- D12: Invites and finding people.
  - **Finding people:** existing Members find each other through username search and Profile Links (`/@username`). An Invite is for new people only.
  - **Invite limits:** each Member has 5 Invites; Admins have unlimited and can top up a Member's count. A Member's Invites are single-use and expire after 7 days. Only Admins create multi-use Invites, which have a use limit and an expiry date.
  - **Invite tree:** Admins can see who invited whom. Banning someone can also cancel their unused Invites.
  - **Signup:** open the Invite → Google or email login → username (3–20 characters, `a-z 0-9 _`, not case-sensitive, reserved words blocked) → display name and optional avatar → install prompt → land in an automatic Direct Chat with the inviter. (Revised by D37: age and terms step after login.)
  - **Username change:** at most once every 30 days; old Profile Links don't redirect in v1.
- D13: Posts and feed order.
  - **Post fields:**
    - title: required, 120 characters max
    - subtitle: optional, 200 characters max, shown on feed cards
    - body: optional, 10,000 characters max, same formatting as Messages, links get Link Previews
    - images: 0–10, each up to 10 MB (JPEG/PNG/WebP/GIF), location data stripped, resized, optional alt text
    - Topic: exactly one, General by default
  - **Feed cards:** first image, title, subtitle, Score, reactions and comment count. The body appears only on the Post page.
  - **Sorting:** Hot (the default), New, and Top (today, week, all time).
  - **Score:** likes minus dislikes; separate counts on hover; emoji reactions don't count.
  - **Comments:** sorted best first, with a toggle for newest first.
- D14: Votes (like/dislike) apply only to Posts and Comments. Messages take emoji Reactions only. Reactions work on Messages, Posts and Comments: many different emoji per Member per item, each emoji once, shown as pills with counts, with who reacted on hover or long-press. The Reaction set is a fixed list of about 24 emoji with 6 quick picks (👍 ❤️ 😂 😮 😢 🔥), changeable through config. Message text can still contain any emoji.
- D15: Games are a platform. v1 builds the contract and a **Reference Game**, not product games.
  - **Flow:** the Game Catalog (`/games`) lists registered Games (from their Game Manifests). Opening a Game creates a Game Session, which waits for players, or is active immediately for single-player Games. From inside the Game, a player asks the app to invite people (`requestInvite`). The app shows its own people picker, so the Game never sees contacts, and sends Game Challenges as toast, Push and Notification. The invitee clicks Join and enters the same Session.
  - **Chat is independent of games:** the layout shows the Game and Chats side by side (full, split or chat-only, resizable), and neither knows about the other. Challenges are not Chat cards.
  - **Single-player Games** are supported: a Manifest can have 1 as the minimum player count, and Game Results support per-player outcome (win/lose/draw) and/or score.
  - **Left to each Game:** turn timers, concurrency rules, leaderboards and the choice of first product Game.
  - **Reference Game:** a minimal Game in the repo, hidden from Members, that exercises the whole contract (connecting, identity, invites, joining, layout, Mini Player, results) in single-player and 2-player modes. It is used in end-to-end tests. (Revised by D25: it is a real, visible game.)
  - **Contract decisions to settle:** isolation, identity token, who carries gameplay traffic, Session lifecycle, invites, results, layout, versioning.
- D16: Games are isolated apps (ADR-0002).
  - **Isolation:** sandboxed iframe on a separate domain, one subdomain per Game (this replaces the "own subdomain" in §3). Subdomains of the games domain are one site, so Games are not isolated from each other; fine for our own Games (ADR-0002).
  - **Networking and results:** each Game handles its own gameplay networking; the platform never relays moves. Game Results come only from the Game's server.
  - **Code:** a Game imports only `game-sdk` and `ui`. Each Game is its own build and deploy in the same repo and CI.
  - **Local development:** distinct `.localhost` host names over HTTPS (revised by D23; ports alone share cookies).
- D17: Search in v1 covers:
  - people, by username and display name, as you type, respecting Blocks
  - a chat list filter (by group or participant name, in the browser)
  - Posts, by title, subtitle and body, optionally within one Topic, using Postgres full-text search

  One search box shows grouped results. No search inside Message text in v1, and no separate search service. (Details in D33.)
- D18: Non-functional requirements.
  - **Scale:** beta up to 100 Members, about 20 online at once, on one app server, one realtime server, one worker, one Postgres and one Redis. No redesign should be needed up to about 10,000 Members.
  - **Speed (p95, same region):** Message delivery under 300 ms; main page content under 2.5 s on a mid-range phone on 4G; catching up after a reconnect under 1 s.
  - **Uptime:** best effort, with monitoring and alerts.
  - **Accessibility:** WCAG 2.2 AA (keyboard, screen readers, contrast, reduce motion), with automated checks in CI and Storybook.
  - **Languages:** the interface ships in **English and Ukrainian** in v1. All UI text goes through next-intl with ICU plural rules (Ukrainian has one/few/many forms). The default follows the browser language, with a setting to change it. Content can be in any language, with right-to-left text supported. Dates and times follow the viewer's locale and time zone.
  - **Region:** everything hosted in one EU region (GDPR, close to the beta users).
- D19: Environments, testing and monitoring.
  - **Environments:**
    - Local: one command runs Docker with Postgres, Redis, a storage emulator and Mailpit, plus seed data.
    - Preview per PR: its own URL, a fresh database with migrations and seed data, and its own Mailpit (ADR-0010).
    - Production.
    - No staging yet.
  - **Tests:**
    - Vitest unit and module tests against a real Postgres (no database mocks)
    - game-sdk contract tests against the Reference Game
    - Playwright end-to-end tests for signup through an Invite, two-browser realtime chat, reconnect catch-up (including edits, deletes and Reactions made while offline), the Reference Game from invite to result, and authorization tests that try to read other people's Chats
    - Storybook with automated accessibility checks
  - **Test policy:** no coverage percentage target; every ticket's acceptance criteria must be covered by tests, and CI blocks the merge until they pass.
  - **Monitoring:**
    - Sentry, EU region, with text scrubbed.
    - PostHog, EU cloud: cookieless, no content in events, session replay off, feature flags on.
    - The feedback button creates Linear triage issues.
- D20: Code organization (ADR-0003).
  - **Monorepo:** pnpm workspaces and Turborepo. Scaffolding is done by Claude project skills.
  - **Modules:** each module is its own package with a single public entry point and owns its own Postgres schema. Other modules refer to its data by ID only, with no joins across modules.
  - **Between modules:** direct calls for immediate answers; jobs added in the same transaction for side effects (ADR-0008).
  - **Boundaries:** dependency-cruiser in CI.
  - **`apps/web`** holds routes, pages and wiring only.
- D21: Authentication (ADR-0004).
  - **Library:** Better Auth, stored through Drizzle in the identity schema.
  - **Login:** Google and email magic link, with a passkey offered after first login. No passwords. (Revised by D32: email sends a code and a link.)
  - **Sessions:** 30 days, extended while in use; listing and remote log-out; email alert on login from a new device.
  - **Signup:** requires an Invite.
  - **Game tokens:** JWTs from the JWT plugin, valid 10 minutes, audience set to the Game's origin, claims limited to id, name, avatar and Game Session id; verified against the JWKS endpoint and refreshed through the game contract.
- D22: Hosting (ADR-0005). Railway EU region, running web, realtime, the worker, Game servers, Postgres and Redis from our own Dockerfiles, with PR preview environments. Cloudflare R2 for files (EU). Cloudflare DNS for the app and games domains. Resend for email (EU). GitHub Actions for CI.
- D23: Full local stack (ADR-0006). One command runs everything with no cloud accounts.
  - **Docker Compose:** Postgres, Redis, S3-compatible storage, Mailpit, and a Caddy reverse proxy serving HTTPS through a trusted local certificate authority on `chaku.localhost`, `rt.chaku.localhost` and `reference.chakugames.localhost`.
  - **Adapters:** every vendor (email, storage, push, analytics, errors) sits behind an adapter with a local or no-op implementation.
  - **Config and data:** validated env from `.env.example`; fixed seed data; `pnpm db:reset`.
  - **Dev login switcher:** development only; CI checks it is absent from production builds.
  - **Production parity and phones:** `pnpm stack:prod` runs the production Dockerfiles locally; `pnpm dev:tunnel` gives a temporary HTTPS URL for testing on real phones.
  - **Google login:** optional locally.
  - **Tests:** Link Preview tests use a local fixture server.
- D24: The beta is released in waves (§6). Friends are invited once Chats and Notifications work (wave 1, after phase 4). Games (wave 2) and the Feed (wave 3) reach the same people behind PostHog feature flags as they are finished.
  - **Beta question:** will a group of friends move some of their everyday conversation to Chaku, and do Games and the Feed make them come back?
  - **Metrics (PostHog, no content):** weekly active Members out of those invited; Messages sent per active Member per day; Chats with activity in the last 7 days; returning after 7 and 30 days; Game Sessions started and finished per week (wave 2+); Posts and Comments per week (wave 3+). Targets are an open item.
- D25: The Reference Game is "Four in a Row", a small real game shown in the Game Catalog to beta Members. Single-player plays against a simple bot on the Game server; 2-player uses Game Challenges. It still exercises the whole contract and runs in end-to-end tests. It replaces "hidden from Members" in D15.
- D26: Chat additions.
  - **Message Reply:** a Message can quote one earlier Message in the same Chat, shown above the new text; tapping it jumps to the original. If the original is deleted, the quote shows "[deleted]". In a Group Chat, a Message Reply to your Message creates a Notification, with the same Block rules as mentions.
  - **Image viewer:** full-screen viewing of Message images, with swipe between the images of one Message.
  - **Jump to first unread:** opening a Chat with Unread Messages scrolls to the first one and shows a "new messages" divider.
  - **Drafts:** an unsent draft is kept per Chat on the device (not synced).
  - **Out until after the beta:** forwarding and pinning Messages.
- D27: Module data ownership (ADR-0007). Every table has one owning module. Message Reactions and mentions belong to `chat`; Votes, Reactions and mentions on Posts and Comments belong to `feed`; the shared `reactions` and `mentions` modules are removed. `packages/content` holds the shared parsing and the Reaction set, with no data. Screens that combine modules use batch lookups (`identity.getProfiles`, `identity.getBlockRelations`) and counters stored with the item. Account erasure is the `member.erasure_requested` event, handled by every module that stores Member data.
- D28: Chat Sequence and catch-up (ADR-0009). Every change in a Chat gets the next number in that Chat's Chat Sequence and is recorded in the Chat event log (references only, never content). Catch-up after reconnect, or after a detected gap, returns events after the client's last number and the current state of what they reference. Unread counts come from the Chat Sequence and the Read Position. Replaces "messages since cursor". (Revised by D49: Read Positions don’t take a Chat Sequence number; D40 adds the sync check.)
- D29: Realtime gateway (ADR-0009). Writes go over HTTP; the gateway only relays. Each connection listens on its own Member and session channels; permissions are decided by the module when publishing. Connecting uses a 60-second single-use ticket. Sockets close on log-out, session revocation and ban. A Member "has an active tab" when a connection reported a visible page in the last 60 seconds; Push is sent only otherwise. Phase 2 starts with a one-day Centrifugo spike that may replace our gateway.
- D30: Background jobs (ADR-0008). Graphile Worker in a separate `apps/worker` from day one; jobs are added in the same transaction as the change and are idempotent. They cover module events, Push, email, image processing, Link Preview fetching, expiry timers (Invites, Challenges, abandoned Sessions, account erasure) and cleanup (Report snapshots, sessions, the Chat event log).
- D31: Games in the browser (ADR-0002).
  - **Game shell:** lives in the signed-in app layout, not a parallel route, so navigating and reloading don't restart the Game; the open Game Session is restored from session storage.
  - **Cookieless Games:** Games send the identity token in a request header to their own server; they never rely on cookies.
  - **Full layout:** done with CSS; the Fullscreen API only where the browser supports it on elements.
  - **Manifests:** stored in `games`, registered by an Admin; each Game has its own rotatable service credential for results.
- D32: Login on phones and in previews (ADR-0010).
  - **Email login:** the email has a 6-digit code and a link. The link opens a page with a "Log in" button (so email scanners can't use it up). Codes last 10 minutes, are single-use and are rate-limited.
  - **Passkeys:** offered strongly after first login, as the main way back in.
  - **Previews:** email codes only, through the preview's own Mailpit; no Google login in previews. Playwright logs in the same way.
- D33: Search and ranking details.
  - **Post search:** Postgres full-text with the `simple` configuration and `unaccent` (Postgres has no built-in Ukrainian language configuration), ranked by relevance and then recency.
  - **People search:** `pg_trgm` similarity on username and display name, as you type.
  - **Hot:** Score with time decay, in the style of Reddit's hot ranking; exact constants go in the data model doc.
  - **Best (Comments):** lower bound of the Wilson score interval on likes and dislikes.
- D34: Mentions are stored as Member IDs in the parsed Message, Post or Comment, and rendered with the current username. Usernames change, and erased usernames are freed, so a stored `@name` could later point to someone else.
- D35: Content Security Policy uses a per-request nonce. In Next.js this renders every page per request, including public Post pages. At beta scale that is accepted.
- D36: Data and operations.
  - **Backups:** Railway scheduled backups plus a nightly encrypted `pg_dump` to an EU R2 bucket that deletes files after 30 days; a restore is tested before wave 1 and then quarterly (ADR-0005).
  - **Migrations:** one Drizzle migration history for all module schemas, run before each deploy; breaking changes in two steps (ADR-0005).
  - **Images:** uploaded straight to R2 with a pre-signed link, then re-encoded by `sharp` in the worker: location data removed, broken or malicious files rejected, sizes generated. We serve the generated sizes, not `next/image` resizing. iPhone photos (HEIC) are tested on real devices.
  - **Logs and alerts:** `pino` JSON logs with the same scrubbing as Sentry; Sentry uptime monitors and alerts for web, realtime and the worker.
  - **Load test:** a k6 script in the repo checks the 300 ms delivery target with 100 connections and 20 active chatters before wave 1.
- D37: Policies.
  - **Age and terms:** Members must be 16 or older (the highest EU age of digital consent, so no per-country rules). Signup asks them to confirm their age and accept the terms and privacy policy after login.
  - **Data export:** a Member can request a copy of their data (profile, Messages they sent, Posts, Comments, Reactions, Votes, Game Results) from Settings. In the beta an Admin runs a script and delivers it within 30 days.
  - **Logged-out visitors:** see public Posts, Comments and authors' names and usernames. Profile pages need login. Visitors can report a Post or Comment with an email address and a reason; these go to the same report queue (EU notice-and-action rules for hosted content). The legal pages give a contact address.
  - **Bans:** a banned Member can't log in; their sessions and sockets close; unused Invites can be cancelled. Their content stays, and an Admin can remove all of it in one action. Others see their existing Messages; nobody can start new Chats with them.
  - **Email addresses:** Google and email logins with the same verified address are one account. Changing email needs a code from the new address, and the old address gets an alert.
- D38: Documentation fixes from the review: "staging" references in D9 now say "preview"; previews have fresh databases, not branches (D19, ADR-0005); the outbox runs in the separate worker (ADR-0008); ADR-0003's module list updated (ADR-0007).
- D39: Application libraries (ADR-0011), checked against npm and project docs on 2026-09-30.
  - **Rules:** oRPC for every call from the browser (no Server Actions); TanStack Query for server data, Zustand for UI state; a plain textarea message box with a hand-written formatting parser in `packages/content`; no list virtualization in v1 (a limited window of about 200 Messages on the page, measured in phase 2).
  - **Changed by verification:** shadcn on Base UI instead of Radix (shadcn's default since July 2026); TypeScript 6 for tools next to TypeScript 7 for type checking (7.0 has no API for typescript-eslint yet); `@serwist/turbopack` instead of `@serwist/next`; SeaweedFS instead of MinIO for local storage (MinIO's free edition is gone); no react-virtuoso (its chat mode is commercial).
  - **Temporary:** Drizzle 1.0 RC pinned until 1.0 stable; Node 24 until Node 26 becomes LTS; the TypeScript 6/7 pair until 7.1.
- D40: Sync check (ADR-0012). On every (re)connect, when the page becomes visible, and every 60 seconds while it is visible, the client makes one sync check call. It returns the latest Chat Sequence of every Chat the Member is in, the unread Notification count and newest Notification ID, and pending Game Challenges. The client catches up on any Chat that is behind, adds Chats it didn't know (for example, added to a Group Chat while offline), drops Chats it has left, and refetches Notifications if they changed. A lost realtime event is noticed within 60 seconds even if nothing else happens in that Chat. The call is composed from the owning modules (`chat`, `notifications`, `games`); no module owns a cross-module log.
- D41: The app and games domains are bought and set up in Cloudflare before the first production deploy (revised by D55: that deploy moves to phase 4). Passkeys are bound to the app domain (the relying party ID is the apex app domain), so changing it later would invalidate every passkey.
- D42: Media access. Every image is shown through a stable app link, `/media/{id}/{size}`.
  - **Private images** (Message images, Group Chat avatars, Link Preview images): the route checks `canView` and redirects to a signed R2 link valid for 5 minutes; the redirect may be cached privately for 4 minutes. Clients and the service worker cache by the stable link, so expiring signatures never break an open Chat.
  - **Public images** (feed images, and Member avatars, which logged-out visitors see next to Posts): served from the public bucket.
  - **Link Preview images** are downloaded once when the preview is fetched, re-encoded like uploads and stored privately. This replaces the live image proxy in D9.
- D43: Game Session presence. While a Game Session is open in the Game shell (including the Mini Player), the host sends a heartbeat for it every 30 seconds. The timer job marks a waiting or active Session abandoned when no player has sent a heartbeat for 2 minutes. A Game server also ends a Session by reporting its Game Result. Exact values go in the `game-sdk` doc.
- D44: Bot checks. Cloudflare Turnstile (invisible) protects the logged-out report form and the email step of email login, on top of rate limits per address and per IP. It sits behind an adapter: no-op locally, Cloudflare's test keys in previews and end-to-end tests. The privacy policy lists Cloudflare.
- D45: ADR cleanup. ADR-0009 writes go through oRPC (ADR-0011 has no Server Actions); ADR-0008's worker is bundled with `tsdown` and built as its own target of the shared multi-stage Dockerfile; ADR-0003's outbox paragraph points to ADR-0008; ADR-0004's magic link points to ADR-0010. From now on, when an ADR is amended, the changed paragraph gets an inline note naming the amending ADR or decision, so agents and people never read stale text as current.
- D46: Images in Messages. The composer uploads each image as soon as it is picked (pre-signed upload, with progress) and enables Send when the uploads finish. The Message is created right away and references the uploads; recipients see a correctly sized placeholder (dimensions come from the client) until the worker finishes, which records an "images ready" Chat event. If processing rejects an image, it is dropped from the Message and the sender is told why. Uploads not attached to a Message or Post within 24 hours are deleted by a cleanup job. Each Member has a storage quota; its value is set with the rate limits.
- D47: Moderation additions.
  - **Removing a Message:** only from its Report, an Admin can remove the reported Message; it shows "[removed by admin]". Admins still cannot browse Chats.
  - **Bans and Group Chats:** a ban removes the Member from every Group Chat as if they had left (ownership passes as in D3). Their Direct Chats stay readable for the other person, who can no longer send. Their Messages stay unless an Admin removes them.
  - **Admin accounts:** Admin tools require a session that logged in with a passkey.
  - **Audit log:** every Admin action (removal, ban, suspension, Invite change, Report snapshot view, Topic change) is recorded with who, what, when and the target, kept for 2 years and visible to Admins.
- D48: Data loss and restore. In the beta, a database failure may lose up to 24 hours of data (nightly encrypted dump plus Railway backups), and restore is best effort within 4 hours. Before Chaku opens beyond friends, we choose between WAL archiving to R2 (for example `wal-g`) and a managed Postgres with point-in-time recovery.
- D49: Read Positions leave the Chat Sequence (ADR-0012). A Read Position only moves forward, is stored per Participant, and is published to the Chat's Participants without taking a Chat Sequence number. Catch-up returns every Participant's current Read Position. Unread counts are unchanged: Messages after my Read Position that I didn't write. This keeps the most frequent write, people reading, off the Chat's counter row. Revises D28.
- D50: One read path in the web app. Server Components load the first page by calling the same oRPC procedures in-process (a server-side router client) and hand the result to TanStack Query through hydration: one set of procedures, one authorization path, one query key scheme. Revises ADR-0011's "Server Components call modules directly". Details in the web data flow doc.
- D51: PR previews are opt-in. A preview is created for a PR with the `preview` label, sleeps when idle, and is removed when the PR closes. PRs from forks never get a preview or secrets (D54).
- D52: Email sending. Email goes out from a mail subdomain of the app domain with SPF, DKIM (through Resend) and DMARC, starting at `p=none` with reports and moving to `quarantine` after a clean first month. Resend bounce and complaint webhooks stop sending to that address and raise an alert. Failed login emails alert in Sentry.
- D53: Legal readiness before wave 1: a named data controller (person or company) and contact address in the privacy policy, the terms and the notice-and-action contact; a list of sub-processors (Railway, Cloudflare, Resend, Sentry, PostHog, Google) with signed data processing agreements. Who the data controller is remains open.
- D54: The repository is public on GitHub (ADR-0013). No secrets in git, secret scanning in CI, fork PRs run without secrets, and agent automation on GitHub responds only to collaborators.
- D55: Local first. Phases 1–3 are built and tested only locally and in CI; nothing is deployed until the app works end to end on the local stack (D23). Production setup moves to the start of phase 4, before wave 1: domains (D41), email sending (D52), Railway with opt-in PR previews and backups (D36, D51), and Sentry, PostHog and Resend accounts. Until then the vendor adapters run their local or no-op versions, and `pnpm stack:prod` (D23) runs the production Dockerfiles locally so deploy problems surface early. Things only production can check (Railway preview hostnames as separate sites, ADR-0010; Google login smoke test; email deliverability) are checked in phase 4. Revises D41 and the build order in §6.
