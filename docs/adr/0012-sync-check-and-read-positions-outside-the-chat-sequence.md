---
status: accepted
date: 2026-10-01
amends: ADR-0009
---

# Sync check, and Read Positions outside the Chat Sequence

**Sync check.** On every (re)connect, when the page becomes visible, and every 60 seconds while it is visible, the client makes one oRPC call, `sync.check`. It returns:

- the latest Chat Sequence of every Chat the Member is a Participant in (`chat.heads(memberId)`)
- the unread Notification count and the newest Notification ID (`notifications`)
- pending Game Challenges (`games`)

The client compares this with what it holds. It runs catch-up (ADR-0009) for every Chat that is behind, loads Chats it didn't know about, drops Chats it is no longer in, and refetches Notifications and Challenges if they changed. Like `search`, the sync check owns no data: it calls each owning module and groups the answers (ADR-0007).

**Read Positions leave the Chat Sequence.** A Read Position only moves forward and is stored per Participant. Moving it updates that Participant's row, then publishes a `read_position` event to the Chat's Participants without taking a Chat Sequence number. Catch-up returns every Participant's current Read Position along with the events. Unread counts are unchanged: Messages with a higher Chat Sequence than my Read Position that I didn't write.

## Why

Catch-up in ADR-0009 only works for Chats the client already knows, and only once it notices a gap. Three cases slip through:

1. **New Chats.** Being added to a Group Chat, or someone starting a Direct Chat, while offline. The client has no Chat Sequence to compare.
2. **A lost last event.** If `apps/web` stops between commit and the Redis publish, or Redis drops the message, nothing reveals the gap until the next event in that Chat, which may never come.
3. **Events outside Chats.** Notifications and Game Challenges have no sequence.

A per-Member event log would cover all three, but it would be a table that every module writes to, which breaks module data ownership (ADR-0007). A sync check made of each module's own small answer covers the same cases, limits detection delay to 60 seconds, and adds no table.

Read Positions are the most frequent write in a Chat: every Participant moves theirs every time they read. In ADR-0009 each move locked the Chat's counter row and grew the event log. A Read Position needs no ordering against other events. Only its latest value matters, so it doesn't need a sequence number.

## Considered options

- **A per-Member event log (a "Member Sequence"):** precise and push-only, but crosses module boundaries, or needs one log per module and a merge in the client.
- **Polling only on reconnect:** misses the lost-last-event case while the connection stays up.
- **Keep Read Positions in the Chat Sequence:** simpler catch-up, but contention on the counter row and a log dominated by reads.

## Consequences

- `chat.heads(memberId)` must be one indexed query: the Chat's counter row holds its latest Chat Sequence.
- The 60-second interval is a protocol constant in the realtime protocol doc, together with event log retention. _(Amended by D58: event log retention is 30 days, set in the data model doc.)_
- "Seen" and "Seen by" may briefly show stale data after a dropped `read_position` event, until the next catch-up or sync check. That is acceptable.
- The Centrifugo spike (ADR-0009) keeps this design: Centrifugo's history recovery would replace catch-up within a connection, not the sync check.
