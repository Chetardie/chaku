---
status: accepted
date: 2026-09-30
amends: ADR-0003
---

# Module data ownership and read composition

Every table has exactly one owning module, and a module owns data only for its own bounded context. There are no "shared" modules that own data across contexts. Code that several modules need (the formatting parser, mention parsing, the Reaction set) lives in `packages/content`, a plain library that owns no tables and imports no module.

This replaces the `reactions` and `mentions` modules from ADR-0003:

| Data | Owner |
|---|---|
| Reactions on Messages, mentions in Messages, Message Replies | `chat` |
| Votes and Reactions on Posts and Comments, mentions in Posts and Comments | `feed` |
| Blocks, profiles, Invites | `identity` |
| Post full-text index | `feed` |
| People search index | `identity` |

`search` owns no tables: it calls `identity.searchPeople` and `feed.searchPosts` and groups the results.

Screens that need data from several modules are composed with two rules:

1. **Batch lookups, not joins.** Owning modules expose batch functions such as `identity.getProfiles(ids)` and `identity.getBlockRelations(viewerId)`. Callers collect IDs, make one call per module, and cache the result for the request. A list screen makes a fixed number of queries, never one per row.
2. **Counters live with the item.** Score, vote counts, reaction counts, comment counts and a Chat's last Message are stored on the owning module's own rows, updated in the same transaction as the change. Sorting (Hot, Top, the chat list) then needs no other module.

Account erasure crosses every module. `identity` emits `member.erasure_requested` (ADR-0008); every module that stores Member data must handle it, and a test fails if a module with Member-referencing tables has no handler.

## Why

With shared `reactions` and `mentions` modules, Hot and Top sorting would need the Score from another schema, which ADR-0003 forbids joining. Chat catch-up would miss reaction changes, because they would not be in the Chat's own sequence (ADR-0009). Authorization for reacting to a Message belongs to `chat`, which knows who can see it. Owning data per context keeps each of these a single-module query.

## Considered options

- **Keep shared modules and add read models:** more events and more lag for the most common screens.
- **Allow read-only joins across schemas:** fast to write, but it couples schemas silently, and it is exactly the erosion ADR-0003 exists to stop.

## Consequences

- Two small Reaction implementations (chat and feed) share validation and the Reaction set through `packages/content`.
- `identity.getBlockRelations` sits on almost every read path, so it must be cheap: one indexed query per request, cached for the request.
- dependency-cruiser forbids `packages/content` from importing any module.
