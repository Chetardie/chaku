---
status: accepted
date: 2026-10-01
---

# Public repository

The Chaku monorepo is public on GitHub. Issues and planning live in Linear, which stays private. The spec, ADRs and architecture docs are public with the code.

Nothing in our security model depends on hiding the code. D9 protects data through access control, authorization tests and keeping production data out of development, not through obscurity. A public repo costs nothing and makes the architecture easy to show and share.

## Rules

- **No secrets in git.** Configuration comes from environment variables validated against a committed `.env.example` that holds placeholders only. `gitleaks` runs in CI and as a pre-commit hook, and GitHub secret scanning with push protection is on.
- **Untrusted pull requests.** CI for PRs from forks runs on `pull_request` with no secrets and no PR preview (D51). Workflows never check out untrusted code under `pull_request_target`.
- **Agents on GitHub act for collaborators only.** The Claude GitHub Action and any workflow that runs an agent with write access trigger only when the commenter or PR author is a repository collaborator. Text in issues and PRs from strangers is untrusted input.
- **Seed data is fake.** Fixtures, seeds and test data never contain real people, real emails or production exports (D9).
- **Vulnerability reports** go through GitHub's private vulnerability reporting, described in `SECURITY.md`.
- **Workflow permissions** default to `contents: read`; each job asks only for what it needs, and third-party actions are pinned to commit SHAs.

## Considered options

- **Private repository:** hides nothing that matters for security, and makes sharing the work harder.

## Consequences

- The code is licensed under the Functional Source License 1.1 with an Apache 2.0 future license (FSL-1.1-ALv2, `LICENSE.md`): anyone may use, change and share it for any purpose except a competing service, and each version becomes Apache 2.0 two years after it is published. Contributions are accepted under the same license.
- Renovate PRs and agent PRs come from branches in the main repo, so they get full CI with secrets; fork PRs get a reduced CI.
- Anything sensitive about operations (incident notes with personal data, abuse cases, Report contents) stays out of the repo and goes into Linear or private storage.
