---
name: pick-up-ticket
description: Take a Linear ticket (CHK-n) from agent-ready to an open pull request - read the ticket and the docs it links, branch, plan, implement, cover every acceptance criterion with tests, open the PR and update Linear. Use when the user says "pick up CHK-123", "work on CHK-123" or "/pick-up-ticket".
---

# Pick up a ticket

Input: a Linear issue ID such as `CHK-123`.

## 1. Understand

1. Fetch the issue with the Linear MCP: description, acceptance criteria, labels, project, comments and linked issues.
2. Stop and report back instead of coding if any of these is true:
   - it lacks the `agent-ready` label
   - the acceptance criteria are missing or not testable
   - it is labelled `needs-decision` or `blocked`
3. Read what it links: spec decisions (Dn in `docs/messenger-app-spec.md` §9), ADRs, design docs. Read `CONTEXT.md` terms for the area.
4. If the ticket conflicts with the spec or an ADR, stop and describe the conflict. Do not pick a side silently.

## 2. Start

1. Move the issue to **In Progress** and assign it to the user.
2. Create a branch from up-to-date `main`: `chk-123-short-title` (lowercase, hyphens).

## 3. Plan

Write a short plan as a comment on the Linear issue:
- the modules and files to touch
- each acceptance criterion → the test that will prove it
- risks, and any library you need to look up

Look up current docs with Context7 for every library you touch. Versions are newer than your training data (see `CLAUDE.md`).

## 4. Build

- Respect module boundaries (ADR-0003, ADR-0007) and the security rules in `CLAUDE.md`.
- Use CONTEXT.md terms in names, copy and messages.
- Write the tests for each acceptance criterion; module tests use real Postgres.
- Run lint, type check and tests locally until green.
- If the change alters a decision, update the spec or ADR in the same branch.

## 5. Open the PR

1. Commit with Conventional Commits (`feat(chat): …`).
2. Push and open the PR with `gh pr create`:
   - title: `CHK-123: Short title`
   - body: the repo PR template, with each acceptance criterion ticked and the test that covers it
3. Move the issue to **In Review** and comment with the PR link.
4. Report back: the PR link, what was done, anything left open.

Never merge, force-push, or touch production. Never put secrets or real personal data in commits (the repo is public, ADR-0013).
