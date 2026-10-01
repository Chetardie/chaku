---
status: accepted
date: 2026-09-30
---

# No end-to-end encryption

Chats are encrypted in transit (TLS) and at rest, but not end-to-end. The server can read message content, and we say so plainly in the privacy policy. E2EE is not a goal of this product and we will not design the data model around it.

We are web-only. On the web the server delivers the client code on every load, so E2EE there only adds real protection with native apps holding the keys, code-verification tooling and multi-device key backup (the path WhatsApp and Messenger took, which cost years of specialist work). It would also break features we want: server-captured Report snapshots, server-fetched Link Previews, full history for new Group Chat Participants, search, and moving between devices. Telegram, the closest web-first comparison, keeps normal chats non-E2EE and has no E2EE at all on web.

## Consequences

- The server and database hold readable chat content. The security baseline in the spec (access control, log scrubbing, no production data in dev or agent tools, XSS hardening) is what protects it.
- Anyone who takes over an account can read that account's full history, so account security (sessions, login alerts, passkeys) matters more.
- Adding E2EE later would be a new product decision with a data migration, not a toggle.
