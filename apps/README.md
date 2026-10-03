# apps

Deployable units (spec §5.1): `web` (Next.js modular monolith), `realtime` (WebSocket gateway), `worker` (Graphile Worker jobs) and `games/*` (each Game with its own server). Each arrives with its Foundation or Games ticket.

So far: `web` (CHK-19). Running it: [local development guide](../docs/guides/local-development.md#web-app). How it loads and caches data: [web data flow](../docs/architecture/web-data-flow.md).
