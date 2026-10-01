---
status: accepted
date: 2026-09-30
amends: ADR-0003
---

# Background jobs and the outbox with Graphile Worker in a separate worker

All side effects and timed work run as jobs in Graphile Worker, stored in Postgres. Jobs are added with `graphile_worker.add_job(...)` inside the same transaction as the data change, so the job queue is our outbox: a job exists if and only if the change was saved. A separate `apps/worker` process runs the jobs from day one. _(Amended by D45: it is bundled with `tsdown` and built as its own target of the shared multi-stage Dockerfile, per ADR-0011, not as `apps/web`'s image with another entry point.)_

Jobs in v1:

| Kind | Examples |
|---|---|
| Module events | `member.erasure_requested`, `chat.participant_added`, `feed.comment_created` → Notifications |
| Delivery | Push sending with retries, transactional email |
| Processing | image re-encoding and resizing, Link Preview fetching |
| Timers | Invite expiry, Game Challenge expiry (15 min), abandoned Game Sessions, account erasure after 14 days |
| Cleanup (cron) | Report snapshots 90 days after resolution, expired sessions, pruning the Chat event log |

Handlers must be idempotent: a job can run more than once. Each module registers its own handlers through its public entry point; `apps/worker` only wires them up.

## Why

The spec needs many timed and retried tasks. Running them inside the Next.js process breaks with more than one replica, and loses work on every deploy restart. Graphile Worker adds no new infrastructure (it is Postgres), can be called from SQL inside our Drizzle transactions, picks up new jobs in milliseconds through `LISTEN/NOTIFY`, and has cron, retries with backoff and job keys for deduplication built in.

## Considered options

- **A hand-written outbox table and poller:** we would rebuild retries, scheduling and locking ourselves.
- **pg-boss:** similar and also good. Graphile Worker's SQL `add_job` fits enqueueing inside an existing transaction more simply.
- **Redis queues (BullMQ):** jobs would not share the data change's transaction, which is the point of an outbox.

## Consequences

- Railway runs one more service (`worker`).
- Realtime fan-out does not wait for a job: it is published right after commit (ADR-0009). Jobs carry the slower side effects.
- Job payloads carry IDs, never Message or Comment bodies, so erasure never has to rewrite queued jobs and logs stay content-free.
