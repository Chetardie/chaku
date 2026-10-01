---
status: accepted
date: 2026-09-30
---

# Railway and Docker instead of Vercel

Everything that runs code or holds data (web app, realtime gateway, outbox worker, Game servers, Postgres, Redis) runs on Railway in its EU region, built from our own Dockerfiles. Each PR gets a Railway preview environment with fresh databases, migrations and seed data. Files live in Cloudflare R2 (EU jurisdiction): a private bucket with signed URLs for chat images, and a public bucket for feed images. Cloudflare handles DNS for the app domain and the separate games domain. Resend (EU region) sends email. GitHub Actions runs CI.

Vercel is the usual host for Next.js, but it can't run our long-lived WebSocket gateway or outbox worker. Pairing it with other providers would mean four or more vendors and preview environments wired across all of them. Railway runs persistent processes and databases together with native PR environments, in one EU region, at beta-scale cost. Our own Dockerfiles keep us portable to Fly.io, a VPS or Kubernetes without code changes.

## Consequences

- Next.js runs as a Node server, not on an edge network; no edge middleware or Vercel-specific features.
- Scaling out later means more Railway replicas; the realtime gateway already relies on Redis pub/sub for that.
- Railway's Postgres is a container with a volume, not a managed database with point-in-time recovery. We turn on Railway's scheduled backups and also run a nightly encrypted `pg_dump` to an R2 bucket (EU) that deletes files after 30 days. A restore is tested before beta wave 1 and then every quarter. Moving to a managed Postgres later is a configuration change.
- Migrations run as Railway's pre-deploy command, from one Drizzle migration history that covers every module schema. Breaking changes are split in two: add the new form, deploy, then remove the old one.
- Preview environments get fresh databases with migrations and seed data (not branches of production), and log in as described in ADR-0010.
