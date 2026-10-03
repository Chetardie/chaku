# Data retention

How long Chaku keeps each kind of data, gathered from the decisions in the [spec](../messenger-app-spec.md) and the ADRs in one place. The privacy policy (phase 4, D53) publishes this table, and the cleanup jobs (ADR-0008) implement it. When a period changes, change it here, in the spec decision, and in the job, all in the same PR.

**Rows marked _to decide_ must be settled before wave 1.** Each has a suggested default in the last column.

## Member content

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Messages, Posts, Comments | until the author deletes them, or the account is erased | D5 | Deleting erases the content at once; a "[deleted]" placeholder keeps its place. Admin removals show "[removed by admin]". |
| Earlier versions of edited content | not kept | D5, D13 | Only the latest text is stored. |
| Message and feed images | as long as their Message or Post | D42, D46 | |
| Uploads never attached to a Message or Post | 24 hours | D46 | Cleanup job. |
| Reactions and Votes | until removed, or the account is erased | D5 | |
| Link Previews and their images | _to decide_ | D4, D42 | Suggested: deleted with their Message. |
| Message drafts | on the device only, never sent to us | D26 | |
| Typing indicators | never stored | D10 | |

## Account and identity

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Account after a deletion request | 14 days (grace period), then erased | D5 | Logging in during the grace period cancels the deletion. |
| What erasure does | profile and login connections wiped; content becomes "[deleted]"; Reactions and Votes removed; Game Results kept without the name; username freed | D5 | Every module handles `member.erasure_requested` (ADR-0007). |
| Sessions | 30 days, extended while in use; expired ones cleaned up | D21, ADR-0008 | |
| Email login codes | 10 minutes, single use | D32 | |
| Realtime connection tickets | 60 seconds, single use | ADR-0009 | |
| Game identity tokens | 10 minutes | D21 | |
| Unused Invites | 7 days (Member Invites); Admin multi-use Invites until their own expiry date | D12 | |
| Presence ("last seen") | _to decide_ | D10, ADR-0009 | Online state lives in Redis with a short time-to-live. Suggested: store only the last-seen day, overwritten each time. |
| Push subscriptions | _to decide_ | D6 | Suggested: until the browser reports it expired, the Member logs out on that device, or 90 days unused. |
| Data export files | _to decide_ | D37 | Suggested: deleted 7 days after delivery. |

## Games

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Game Challenges | expire after 15 minutes | D1 | _To decide:_ when expired Challenges are deleted. Suggested: 7 days. |
| Abandoned Game Sessions | marked abandoned after 2 minutes with no heartbeat | D43 | _To decide:_ how long Session records are kept. Suggested: as long as their Game Results. |
| Game Results | kept; anonymous after erasure | D5 | |

## Notifications

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Notifications (the bell list) | _to decide_ | D6 | Suggested: 90 days. |

## Moderation and safety

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Report snapshots | 90 days after the Report is resolved | D9 | Admins only; every view logged. |
| Reports themselves | _to decide_ | D2 | Suggested: 2 years, like the audit log, so repeat abuse can be seen. |
| Email addresses of logged-out reporters | _to decide_ | D37 | Suggested: 90 days after the Report is resolved, with the snapshot. |
| Admin audit log | 2 years | D47 | |
| Bans | while in force | D37 | |

## Operations

| Data | Kept for | Source | Notes |
|---|---|---|---|
| Database backups | 30 days, encrypted | D36 | Railway backups plus a nightly `pg_dump` to R2 with a 30-day expiry. |
| Chat event log (`chat.events`) | _to decide in the realtime protocol doc_ | ADR-0009 | References only, never content. Suggested: 30 days ([data model](../architecture/data-model.md#chatevents), Q3). |
| Background jobs | removed when finished | ADR-0008 | Payloads hold IDs only. |
| Application logs (`pino`) | _to decide_ | D36 | Never contain Message or Comment bodies. Suggested: 14 days. |
| Error reports (Sentry) | _to decide_ | D19 | Content scrubbed. Suggested: 30 days. |
| Product analytics (PostHog) | _to decide_ | D19 | No content, cookieless. Suggested: 1 year. |
| Email bounce and complaint suppression list | _to decide_ | D52 | Suggested: until the Member changes their email. |
