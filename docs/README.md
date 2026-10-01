# Chaku docs

Docs live in this repo as Markdown and are read on GitHub; diagrams are Mermaid. Linear holds tickets and project briefs that link back here. When code and docs disagree, fix whichever is wrong in the same PR.

## Product

| Doc | Status |
|---|---|
| [Product spec](messenger-app-spec.md) | v0.4 |
| [Glossary (CONTEXT.md)](../CONTEXT.md) | current |

## Architecture

| Doc | Status |
|---|---|
| [Architecture overview](architecture/overview.md) | current |
| [ADRs](adr/) | 0001–0013 |
| Data model: Postgres schema per module, Chat events, counters, Hot constants | planned, before phase 1 migrations |
| Realtime protocol: event types, catch-up limits, sync check, log retention, Presence | planned, before phase 2 |
| `game-sdk` contract: messages, versioning, heartbeat, results | planned, before phase 5 |
| Web data flow: in-process oRPC, hydration, query keys, realtime cache updates (D50) | planned, before phase 1 UI work |
| Security and threat model: D9 as a checklist, authorization test matrix | planned, phase 1 |
| Design system foundations | planned, after brand direction |

## Guides

| Doc | Status |
|---|---|
| Local development: stack, certificates, seed logins, tunnel | planned, phase 1 |
| Testing: layers, fixtures, Playwright with Mailpit, the two-browser realtime test | planned, phase 1 |
| Conventions: IDs (`uuidv7`), errors, pagination, naming, i18n keys | planned, phase 1 |

## Process and operations

| Doc | Status |
|---|---|
| [Workflow: Linear → branch → PR → merge](process/workflow.md) | current |
| Runbooks: deploy, rollback, restore, incident, secret rotation | planned, before wave 1 |
