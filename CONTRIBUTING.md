# Contributing to Chaku

Thanks for looking. Chaku is built by a small team with coding agents. This page is the engineering contract: how code gets from an idea to `main`. The team handbook in Linear covers the rest (onboarding, rituals, communication).

## Before you start

- **License:** the code is under [FSL-1.1-ALv2](LICENSE.md). By contributing you agree your contribution is licensed the same way.
- **Read:**
  - [CONTEXT.md](CONTEXT.md): the words we use
  - the [architecture overview](docs/architecture/overview.md)
  - the ADRs that touch your area, in [docs/adr/](docs/adr/)
- **Work is tracked in Linear** (team CHK). GitHub Issues are turned off.
  - If you're not on the team, open a draft PR describing the change before investing a lot of time.
  - Security issues go through [SECURITY.md](SECURITY.md), never a public PR.

## Setup

You need:

- Node.js 24 (see `.nvmrc`)
- pnpm 12. Install it with its [standalone script](https://pnpm.io/installation) or `npx get-pnpm`; corepack isn't used.
- [gitleaks](https://github.com/gitleaks/gitleaks#installing): `winget install Gitleaks.Gitleaks`, `brew install gitleaks`, or a release binary. `pnpm install` sets up a pre-commit hook that scans your staged changes with it and stops the commit if gitleaks is missing or finds a secret (ADR-0013).

Then, from the repo root:

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries
```

The commands are listed in [CLAUDE.md](CLAUDE.md#commands). To run the app locally, start the stack (databases, mail, storage, HTTPS) with `pnpm stack`. The [local development guide](docs/guides/local-development.md) covers the one-time certificate step.

## The loop

The full flow, Linear ticket included, is in [docs/process/workflow.md](docs/process/workflow.md). In short:

1. **Ticket:** start from a Linear ticket labelled `agent-ready`, or one assigned to you.
2. **Branch:** `chk-123-short-title`, from up-to-date `main`.
3. **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), scoped by module or area: `feat(chat): …`, `fix(identity): …`, `docs(adr): …`.
4. **PR:**
   - title `CHK-123: Short title`; Linear links it and moves the ticket for you
   - fill in the PR template: every acceptance criterion with the test that covers it
5. **Checks:** CI must pass (the required check is `ci`); add the `preview` label if you need a preview (once production exists, D55).
6. **Review:** at least the code owner reviews. A Claude review runs too (CHK-25).
7. **Merge:** squash merge. Linear moves the ticket to Done.

## Definition of Done

A change is done when:

- [ ] every acceptance criterion is covered by an automated test, and CI is green
- [ ] module boundaries hold (ADR-0003, ADR-0007); dependency-cruiser passes
- [ ] UI text is in both EN and UK and follows [voice and tone](docs/design-system/voice-and-tone.md)
- [ ] UI works with keyboard and screen reader basics, at 360px wide, in light and dark (D7, D18)
- [ ] no Message or Comment bodies in logs, errors, analytics or job payloads (D9)
- [ ] no secrets, real people or real emails in the diff (ADR-0013)
- [ ] docs changed in the same PR if behaviour, a decision or a process changed (see "Where docs live" below)

## Decisions

| Kind of decision | Where it's recorded |
|---|---|
| Product behaviour (what the app does) | a numbered decision in the [spec](docs/messenger-app-spec.md) §9 |
| Architecture (structure, technology, data ownership, protocols, security) | an [ADR](docs/adr/) (`/new-adr` skill) |
| Anything smaller | the ticket and PR |

Never change behaviour that contradicts the spec or an ADR without updating them first.

## Where docs live

> A doc lives in the **repo** if code, agents or the public depend on it, or it changes together with code. Docs about people, process and operations live in **Linear**.

| Repo (`docs/`) | Linear (team documents) |
|---|---|
| Spec, ADRs, architecture, guides, design system, voice and tone, data retention, runbooks, legal pages | Handbook (start here, how we work), product overview, project briefs, moderation and support playbooks, accounts and access, incident log, meeting notes |

## Working with agents

Coding agents follow [CLAUDE.md](CLAUDE.md) and the project skills in `.claude/skills/`.

- **Humans review everything an agent writes**, the same as code from a person.
- **Agents never connect to production data** (D9). They use the local stack and seed data only.

## Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
