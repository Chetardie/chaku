# modules

One package per module (spec §5.2, ADR-0007): identity, chat, games, results, feed, notifications, moderation, media (ADR-0014), search. Each owns its Postgres schema and is imported only through its public entry point.
