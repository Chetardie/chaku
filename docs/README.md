# Chaku docs

**New here?** Start with the team handbook in Linear: [Start here](https://linear.app/chetardie/document/handbook-start-here-1b96217e5cec) (team members only). It has an onboarding path for each role and links back to these docs.

## Where docs live

> A doc lives in this **repo** if code, agents or the public depend on it, or it changes together with code. Docs about people, process and operations live in **Linear** (team documents, private).

| Repo (this folder) | Linear |
|---|---|
| Spec and decisions, architecture, ADRs, guides, design system, voice and tone, data retention, runbooks, legal pages | [Start here](https://linear.app/chetardie/document/handbook-start-here-1b96217e5cec), [How we work](https://linear.app/chetardie/document/handbook-how-we-work-66a8d4a09c6d), [Accounts & access](https://linear.app/chetardie/document/handbook-accounts-and-access-23ccec26c517), [Support & moderation](https://linear.app/chetardie/document/handbook-support-and-moderation-f80b7ce5ba48), [Product overview](https://linear.app/chetardie/document/product-overview-e0e6e0d1947b), project briefs, incident log |

Docs change in the same PR as the behaviour, decision or process they describe. A stale doc is a bug.

## By role

| If you are… | Read first |
|---|---|
| Anyone | [Glossary (CONTEXT.md)](../CONTEXT.md), [Product spec](messenger-app-spec.md) §1–4 |
| Engineering | [CONTRIBUTING](../CONTRIBUTING.md), [Architecture overview](architecture/overview.md), [ADRs](adr/), [Workflow](process/workflow.md), [Conventions](guides/conventions.md), [Testing](guides/testing.md) |
| Design | [Design system foundations](design-system/foundations.md), [Screen map](design-system/screens.md), [Voice and tone](design-system/voice-and-tone.md) |
| Product | [Spec](messenger-app-spec.md) (§9 is every decision and why) |
| QA | [CONTRIBUTING → Definition of Done](../CONTRIBUTING.md#definition-of-done), [Testing](guides/testing.md), spec D7, D18, D19 |
| Support and moderation | spec §3.6, [Data retention](operations/data-retention.md) |

## All repo docs

### Product
| Doc | Status |
|---|---|
| [Product spec](messenger-app-spec.md), decisions D1–D59 | v0.4 |
| [Glossary (CONTEXT.md)](../CONTEXT.md) | current |

### Architecture
| Doc | Status |
|---|---|
| [Architecture overview](architecture/overview.md) | current |
| [ADRs](adr/) | 0001–0015 |
| [Data model](architecture/data-model.md): Postgres schema per module, Chat events, counters, Hot constants | accepted (CHK-15, D57, D58) |
| [Web data flow](architecture/web-data-flow.md): in-process oRPC, hydration, query keys, realtime cache updates (D50) | current (CHK-16) |
| Security: D9 as a checklist, authorization test matrix | Foundation |
| Realtime protocol: event types, catch-up limits, sync check, log retention, Presence | before phase 2 |
| `game-sdk` contract: messages, versioning, heartbeat, results | before phase 5 |

### Guides
| Doc | Status |
|---|---|
| [Local development](guides/local-development.md): stack, certificates, database and seed, troubleshooting | current; seed logins with CHK-20, tunnel later |
| [Conventions](guides/conventions.md): naming, IDs (`uuidv7`), modules, jobs, errors over oRPC, pagination, dates, logging and D9, env vars, vendors | current (CHK-28); lists what isn't decided yet |
| [Testing](guides/testing.md): layers and how to run each, Postgres per test worker, job tests, Playwright, fixtures, criteria to tests | current (CHK-28); Mailpit login with CHK-20 and CHK-41, the two-browser realtime test in phase 2 |
| i18n: adding strings, EN and UK, plurals, review | Foundation |
| Accessibility checklist | Foundation |
| Releases and feature flags | phase 4 |

### Design system
| Doc | Status |
|---|---|
| [Foundations](design-system/foundations.md): Warm direction, theming (ADR-0015) | Warm direction; token scales next |
| [Screen map](design-system/screens.md): every v1 screen, its data, open gaps; [mockups](design-system/screen-map.html) | draft; gaps G1–G7 to decide |
| [Voice and tone](design-system/voice-and-tone.md) | current |
| Design workflow: Figma structure, handoff, Code Connect | Design System project |

### Process and operations
| Doc | Status |
|---|---|
| [Workflow: Linear → branch → PR → merge](process/workflow.md) | current |
| [Data retention](operations/data-retention.md) | current; rows marked _to decide_ before wave 1 |
| Runbooks: deploy, rollback, restore, incident, secret rotation | phase 4 |

### Legal
| Doc | Status |
|---|---|
| Privacy policy, terms, sub-processors | phase 4 (D53) |
