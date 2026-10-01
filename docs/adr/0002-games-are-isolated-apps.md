---
status: accepted
date: 2026-09-30
---

# Games are isolated apps

Games run in sandboxed iframes on a separate domain from the app, one subdomain per Game (for example `reference.chakugames.app`, while the app is at `chaku.app`). They talk to the app only through the `game-sdk` contract: messaging in the browser, a short-lived identity token checked against the app's public keys, and Game Results sent from the Game's own server. Each Game handles its own gameplay networking; the platform never relays moves. Games never import app code, only `packages/game-sdk` and `packages/ui`. Each Game is its own build and deploy, in the same repo and CI.

We chose this because chat content is readable on our servers (ADR-0001), so any code running in our origin could read Chats. A same-origin iframe with `allow-scripts allow-same-origin` can remove its own sandbox, and subdomains of one domain share cookies and count as the same site, so only a separate domain gives real isolation. Taking results only from Game servers means players can't fake a win from the browser.

## Considered options

- **Loading games into the app page** (component, web component, module federation): rejected, no isolation.
- **Popup or new tab:** isolated, but breaks the side-by-side game and chat layout.
- **Platform relay for gameplay messages:** rejected for now. It makes our realtime gateway carry game load, and it has no authority over results, so games would still need a server. It can be added later as an optional service without changing the contract.

## Consequences

- Every multiplayer Game, and every Game that reports a score, needs a server; a single serverless function is enough.
- Local development uses distinct `.localhost` host names over HTTPS (ADR-0006), because separate ports on one host share cookies and would not be isolated.
- The boundary checker in CI must fail any import from `apps/games/*` into app code.
- Games are cookieless. In a cross-site iframe, browsers partition or block cookies (Safari blocks them outright), so a Game authenticates to its own server only with the identity token, sent in a request header.
- The Game shell lives in the signed-in app layout, not in a parallel route. Layouts don't remount on client navigation, so the iframe survives moving around the app. A parallel route would show its fallback page after a reload or hard navigation and restart the Game. The open Game Session is kept in client state and restored from session storage after a reload.
- The "full" layout is done with CSS. The Fullscreen API is used only where the browser supports it on elements (iPhone Safari has historically allowed it only for video).
- Subdomains of the games domain count as one site, so Games are isolated from the app but not from each other. That is fine for our own Games. Hosting third-party Games would need a domain per Game or a Public Suffix List entry.
