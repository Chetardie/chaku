# Architecture overview

This page is the map. Each decision behind it is in an ADR or a spec decision (Dn), and those win if this page drifts.

## System context

```mermaid
flowchart LR
  member([Member<br/>browser or installed PWA])
  visitor([Logged-out visitor])
  admin([Admin])

  subgraph chaku[Chaku]
    app[App<br/>chaku domain]
    games[Games<br/>separate games domain]
  end

  google[Google login]
  resend[Resend<br/>email]
  push[Browser push services]
  cf[Cloudflare<br/>DNS, R2, Turnstile]
  obs[Sentry, PostHog]

  member --> app
  member --> games
  visitor -->|public Posts, reports| app
  admin --> app
  app --> google
  app --> resend
  app --> push
  app --> cf
  app --> obs
  games -->|Game Results| app
```

## Containers

All on Railway in one EU region, built from our own Dockerfiles (ADR-0005). Local development runs the same set in Docker Compose behind Caddy on `.localhost` names (ADR-0006).

```mermaid
flowchart TB
  browser([Browser / PWA])

  subgraph appdomain[App domain]
    web["apps/web<br/>Next.js modular monolith<br/>pages, oRPC, route handlers"]
    rt["apps/realtime<br/>WebSocket gateway, relay only"]
  end
  worker["apps/worker<br/>Graphile Worker jobs"]

  subgraph gamesdomain[Games domain, one subdomain per Game]
    gameui["Game UI<br/>sandboxed iframe"]
    gamesrv["Game server<br/>Hono + ws"]
  end

  pg[(PostgreSQL 18<br/>schema per module<br/>+ graphile_worker)]
  redis[(Redis 8<br/>pub/sub, Presence,<br/>tickets, rate limits)]
  r2[(Cloudflare R2<br/>private + public buckets)]

  browser -- "HTTPS: pages, oRPC, /media" --> web
  browser -- "WSS: events, typing, heartbeats" --> rt
  browser -- "MessageChannel (game-sdk)" --- gameui
  gameui -- "identity token in header" --> gamesrv
  gamesrv -- "POST /api/games/results" --> web
  gamesrv -. "verify tokens (JWKS)" .-> web

  web -- "write + add jobs, one transaction" --> pg
  web -- "publish after commit" --> redis
  rt -- "subscribe member:id, session:id" --> redis
  worker -- "run jobs" --> pg
  worker -- "publish" --> redis
  worker --> r2
  browser -- "pre-signed upload" --> r2
```

Rules that shape this picture:
- Writes go over HTTP into the owning module; the gateway never touches the database (ADR-0009).
- Jobs are added in the same transaction as the change; the job queue is the outbox (ADR-0008).
- Games are isolated: separate domain, sandboxed iframe, no cookies, results only from Game servers (ADR-0002).

## Modules

Each module is a package in `packages/modules/*` with one public entry point and its own Postgres schema (ADR-0003, ADR-0007). Arrows are direct calls through the public entry point; side effects go through jobs instead.

```mermaid
flowchart LR
  identity["identity<br/>Members, sessions, Invites,<br/>Blocks, roles, Game tokens"]
  chat["chat<br/>Chats, Messages, Chat events,<br/>Read Positions, Reactions"]
  feed["feed<br/>Topics, Posts, Comments,<br/>Votes, Reactions"]
  games["games<br/>Manifests, Sessions,<br/>Challenges"]
  results["results<br/>Game Results, stats"]
  notifications["notifications<br/>Notifications, Push"]
  moderation["moderation<br/>Reports, bans,<br/>audit log"]
  search["search<br/>no tables"]
  content["packages/content<br/>parser, mentions,<br/>Reaction set (no data)"]

  chat --> identity
  feed --> identity
  games --> identity
  results --> games
  notifications --> identity
  moderation --> identity
  moderation --> chat
  moderation --> feed
  search --> identity
  search --> feed
  chat --> content
  feed --> content
```

Each module's tables, keys, indexes and counters, and how each handles erasure, are in the [data model](data-model.md).

`apps/web` composes screens across modules with batch lookups (`identity.getProfiles`, `identity.getBlockRelations`) and composes the sync check from `chat`, `notifications` and `games` (ADR-0012). `packages/content` imports no module. Games import only `game-sdk` and `ui`.

## Key flows

How pages load data, and how realtime events, catch-up and the sync check keep the browser cache current: [web data flow](web-data-flow.md).

### Sending a Message

```mermaid
sequenceDiagram
  participant A as Sender browser
  participant W as apps/web (chat module)
  participant DB as Postgres
  participant R as Redis
  participant G as apps/realtime
  participant B as Recipient browser
  participant J as apps/worker

  A->>W: oRPC chat.send(clientId, chatId, text, uploadIds)
  W->>DB: BEGIN; bump Chat Sequence; insert Message + chat.events row; add jobs; COMMIT
  W->>R: publish to member:{id} of each Participant allowed to see it
  W-->>A: ok (seq)
  R->>G: event
  G->>B: event (seq)
  Note over B: gap in seq? run catch-up
  J->>DB: run jobs: Push if no active tab, Link Preview, image processing
```

`clientId` makes retries safe. Images are uploaded before Send and processed afterwards (D46).

### Reconnecting

```mermaid
sequenceDiagram
  participant C as Browser
  participant W as apps/web
  participant G as apps/realtime

  C->>W: POST /api/realtime/ticket
  W-->>C: 60-second single-use ticket
  C->>G: wss connect ?ticket=…
  C->>W: sync.check
  W-->>C: latest seq per Chat, Notification state, pending Challenges
  loop each Chat behind
    C->>W: chat.catchUp(chatId, afterSeq)
    W-->>C: events + current state + Read Positions
  end
  Note over C: repeat sync.check on focus and every 60 s while visible
```

### Opening a Game and challenging someone

```mermaid
sequenceDiagram
  participant H as App (Game shell)
  participant F as Game iframe
  participant S as Game server
  participant W as apps/web
  participant O as Other Member

  H->>W: games.openSession(gameId)
  W-->>H: Session + 10-minute identity token (audience = Game origin)
  H->>F: launch handshake, hand over MessagePort, init(token, session, players)
  F->>S: connect with token in header; server verifies via JWKS
  F->>H: requestInvite
  H->>H: app's own people picker
  H->>W: games.challenge(sessionId, memberIds)
  W-->>O: toast + Push + Notification
  O->>W: join
  loop every 30 s while open
    H->>W: session heartbeat (D43)
  end
  S->>W: POST /api/games/results (service credential)
```

## Environments

| | Local | PR preview | Production |
|---|---|---|---|
| How | `pnpm stack`, Docker Compose + Caddy | opt-in with the `preview` label (D51) | Railway, EU |
| Data | fixed seed | fresh database + seed | real |
| Email | Mailpit | its own Mailpit | Resend |
| Login | everything, plus dev switcher | email codes only | everything |
| Storage | SeaweedFS | R2 preview buckets | R2 |
