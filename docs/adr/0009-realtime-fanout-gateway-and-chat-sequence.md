---
status: accepted
date: 2026-09-30
amended-by: ADR-0012
---

# Realtime: a fan-out-only gateway, per-Member channels and the Chat Sequence

**Writes go over HTTP.** Sending, editing, deleting, reacting and moving a Read Position are HTTP calls into the owning module through oRPC procedures _(amended by D45: ADR-0011 uses no Server Actions)_. The module saves the change, records a Chat event (except for Read Positions, see ADR-0012) and adds any jobs in one transaction.

**Every change to a Chat gets a number.** Each Chat has a Chat Sequence: a counter that goes up by one for every change in that Chat (new, edited or deleted Message, Reaction added or removed, Participant added or removed, rename). _(Amended by ADR-0012: Read Positions no longer take a Chat Sequence number.)_ The change is written to an append-only `chat.events` table as `(chat_id, seq, type, ids)`. Events carry references only, never content, so deleting or erasing content never rewrites events. A Message stores the Chat Sequence at which it was created, which gives the order and the unread count: Messages with a higher Chat Sequence than my Read Position, not written by me.

**The gateway only relays.** Right after commit, `apps/web` publishes the event to Redis on the channel `member:{id}` of every Participant who may see it. Permissions are decided at that moment, by the module. `apps/realtime` subscribes each connection only to its own Member's channel and its session's channel, and forwards what arrives. It holds no business logic and never reads the database.

**Catch-up uses the Chat Sequence.** The client keeps the last Chat Sequence it has seen for each Chat. On reconnect, or when an event arrives with a gap, it asks `chat` for events after that number. The server returns the current state of everything those events reference. If the gap is too large, or the log has been pruned past it, the client reloads the Chat's recent window. Redis pub/sub can drop messages; the Chat Sequence makes that harmless. _(Amended by ADR-0012: a periodic sync check also catches a lost last event, and Chats the client did not know about.)_

**Connecting.** The client gets a 60-second, single-use connection ticket from `POST /api/realtime/ticket` and opens `wss://rt.<app-domain>/?ticket=…`. The gateway redeems it in Redis and binds the connection to a Member and session. Revoking a session, logging out or banning publishes on `session:{id}` or `member:{id}`, and the gateway closes those connections.

**Presence, typing and "active tab".** Clients send a heartbeat and their page visibility. The gateway keeps Presence in Redis with a time-to-live. A Member "has an active tab" when at least one connection reported a visible page in the last 60 seconds; the worker checks this before sending Push. Typing events are relayed and never stored.

## Why

Keeping the gateway to relaying means one place holds business rules and authorization (the modules), and the gateway stays small, stateless and easy to scale behind Redis. Per-Member channels remove the problem of revoking subscriptions: when someone is removed from a Group Chat or blocked, the next event simply isn't published to them. Group Chats are capped at 50 Participants, so publishing to each Participant costs little. "Messages since cursor" missed edits, deletions and reactions to older Messages; a per-Chat event log catches up on everything.

## Considered options

- **Writes over the WebSocket:** saves a round trip, but puts validation, authorization and database access into the gateway.
- **Per-Chat channels:** every subscription needs checking and revoking, the risk D9 calls out.
- **Centrifugo instead of our own gateway:** it has history recovery, Presence and token-based connections. Phase 2 starts with a one-day spike. If it fits, it replaces `apps/realtime` without changing anything else in this ADR.

## Consequences

- Changes within one Chat are serialized by updating that Chat's counter row. That is fine at 50 Participants and far beyond our message rates.
- The event log is pruned by a cron job (ADR-0008). The retention period is set in the realtime protocol doc.
- The 300 ms delivery target covers commit, Redis publish and gateway forward. A k6 load test checks it before beta wave 1.
