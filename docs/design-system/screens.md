# Screen map

Status: **accepted** (CHK-35, CHK-37), reviewed 2026-10-03. The inventory below is checked against spec v0.4 (D1–D66) and the [data model](../architecture/data-model.md). Every [gap](#gaps) it found is decided: D59 to D66. Where this doc and the spec or an ADR disagree, the spec or ADR wins, and this doc is fixed.

Every screen and sheet v1 needs: what it shows and does, and where its data comes from. Feature tickets link the rows they build. A ticket that needs a screen missing here adds it in the same PR.

**Mockups:** [`screen-map.html`](screen-map.html) has 10 phone screens and a desktop layout in the [Warm direction](foundations.md), with a light and dark switch. Open it in a browser from a local checkout. GitHub shows the source, not the page. The mockups explore layout and fit. They are not pixel specs: components and exact values come from `packages/ui` and Storybook. Parts drawn with a dashed outline were gap proposals, now decided (D60–D66).

**Routes:** routes from the spec are kept. Routes marked * are suggestions, settled in the ticket that builds the screen.

## Screens

### Entry and signup

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Log in | `/login` | Google, email, passkey. Turnstile on the email step. Shows suspended (with end date) or banned instead of logging in. | `identity.sessions`, `members.banned / ban_expires` | covered |
| Email code | `/login/code`* | 6-digit code, resend, wrong-code limit (5), expired-code message. | `identity.verifications` | covered |
| Email link | `/login/link`* | A page with a 'Log in' button so email scanners can't use up the link (D32). | `identity.verifications` | covered |
| Invite landing | `/i/[code]`* | Inviter's name and avatar, expiry, used, expired or cancelled states. | `identity.invites`, members | covered |
| Age and terms | `/welcome`* | Confirm 16+, accept terms and privacy policy (D37). | `members.age_confirmed_at`, `terms_*` | covered |
| Username | `/welcome`* | Live availability check, rules, reserved words. | `members.username` | covered |
| Name and avatar | `/welcome`* | Display Name 1–50, optional avatar upload. | `members.display_name`, `media.uploads` | covered |
| Install the app | `/welcome`* | Install prompt with iPhone steps (D7). Then lands in the Direct Chat with the inviter. | client only | covered |
| Passkey offer | sheet | Offered strongly after first login (D32). 'Not now' remembered per device. | `identity.passkeys` | covered |
| Please update your browser | static | Older browsers (D7). | none | covered |
| Deletion cancelled | banner | Logging in during the 14-day grace period cancels deletion. Say so (D5). | `members.status` | covered |

### App shell

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Navigation | layout | Phone: bottom tabs (Chats, Feed, Games, Notifications, Me). Desktop: side rail. Bell shows the unread Notification count. | sync check | covered |
| Search | sheet / /search * | One box, grouped results: people, chats (filtered in the browser), Posts (D17). | identity trigram, `feed.search_vector` | covered |
| Offline banner, toasts | layout | No offline sending (D7). Toasts for Challenges and Notifications. | realtime | covered |
| Game shell and Mini Player | layout | Stays mounted across navigation (D31). Floating window on desktop, bottom bar on phones. | session storage | covered |
| Theme | `/settings`* | Light, dark or system, stored per device in a cookie so the first paint is right (D59, ADR-0015). | cookie, `packages/ui tokens` | covered |

### Chats

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Chat list | `/chats`* | Order by activity, Unread bold with a count (99+), last Message, typing, Presence dot, Mute icon, device drafts, 'Seen' tick, filter. | `chat.participants + chats`, `identity.getProfiles` | covered |
| Mention badge in the list | chat list | An '@' when an unread mention Notification points into this Chat; it clears when you read past the Message. | `notifications.context_seq`, `notifications_context_unread_idx` | covered (D62) |
| System lines | chat list, Chat | 'Anya added Sasha', 'renamed the group', 'left', in the timeline and as the chat list's last line. Group Chats only; not Unread. | `chat.messages` (`kind = 'system'`) | covered (D60) |
| Hide a Direct Chat | chat list | 'Hide chat' in Direct Chat info. Gone from the list until a new Message arrives or you open it; history stays. | `chat.participants.hidden_until_seq` | covered (D66) |
| New chat | `/chats/new`* | People search, then open or create the Direct Chat. 'New group' entry. | identity search, `chats_direct_pair_key` | covered |
| New group | `/chats/new`* | Pick up to 49 people (Blocks apply), name 1–64, optional avatar. | `chat.chats`, participants | covered |
| Chat | `/chats/[id]`* | About 200 Messages around the first unread, day separators, 'new messages' divider, bubbles with images, Link Preview or Post Card, Message Reply quote, Reactions, edited, [deleted], [removed by admin], collapsed blocked Messages, Seen / Seen by, typing. | `chat.messages`, `message_images`, reactions, `participants.read_seq` | covered |
| Composer | Chat | Plain textarea with formatting, image upload with progress (Send waits), Link Preview with dismiss, reply bar, mention autocomplete (Participants only), drafts. Blocked state and Deleted user state: can't send. | `media.uploads`, `chat.link_previews` | covered |
| Message actions | sheet / menu | Reply, React (6 quick + 24), Copy, Edit, Delete (confirm), Report, Info (Seen by). | — | covered |
| Image viewer | overlay | Full screen, swipe between the images of one Message (D26). | `/media/{id}/{size}` | covered |
| Who reacted | popover | Long-press or hover a Reaction pill. | `chat.message_reactions` | covered |
| Direct Chat info | sheet | Person, link to profile, Mute, Block, Report. | `participants.muted_until` | covered |
| Group info | sheet | Name, avatar, Participants with roles, add people, promote or demote Group Admin, remove, rename, leave. | `participants.role` | covered |
| Transfer ownership | Group info | 'Make owner' on a Participant, for the Owner only, with a confirm. The old Owner becomes a Group Admin. | `participant_role_changed` | covered (D65) |
| Mute | dialog | 1 hour, 8 hours, 1 week, until I turn it back on. | `participants.muted_until` | covered |
| Leave group | dialog | Confirm. Ownership passes on (D3). | participants | covered |

### People

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Profile | `/@username` | Avatar, Display Name, Username, Presence (reciprocal, Blocks), Message, copy Profile Link, Block, Report. | `identity.members` | covered |
| Game stats on profile | `/@username` | Played, wins, draws and best score per Game. | `results.member_stats` | covered (D64) |
| Posts on profile | `/@username` | The Member's Posts, newest first, paged. Blocks collapse them. No bio in v1. | `feed.posts_author_created_idx` | covered (D64) |
| Block | dialog | Explains what Block does. Silent for the other person (D11). | `identity.blocks` | covered |
| Report | dialog | Reason (8 codes), details up to 1,000 characters. Message Reports snapshot about 10 earlier Messages. | `moderation.reports` | covered |

### Notifications

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Bell list | `/notifications`* | Mentions, Message Replies in Group Chats, Game Challenges (Join / Decline, expiry), Comments on your Post or Comment, added to a Group Chat. Mark all read. | `notifications.notifications` | covered |
| Read when you read the Chat | Bell, chat list | Reading the Chat past a mention or Message Reply marks its Notification read. | `notifications.context_seq` | covered (D62) |
| Moderation notices | Bell, email | The author learns content was removed and why; the reporter learns the outcome. Logged-out reporters and banned Members get email (EU DSA). | `notifications.type`, `moderation.audit_log.reason` | covered (D63) |
| Push | system | Only when there's no active tab (D29). Text only if 'Show message text' is on (off by default). | `push_subscriptions`, preferences | covered |

### Feed

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Feed | `/` | Hot / New / Top (today, week, all time), Topic chips, cards: first image, title, subtitle, Score, Reactions, comment count. | `feed.posts hot/new/top indexes` | covered |
| Topic | `/t/[slug]` | Same as the Feed, one Topic. | `posts_topic_* indexes` | covered |
| Post | `/posts/[id]-slug` | Title, subtitle, author, Topic, edited, images with alt text, body, Link Preview, Vote (counts on hover), Reactions, share, edit, delete, report. | `feed.posts`, `post_images`, `link_previews` | covered |
| Comments | Post | Best / Newest, 4–5 levels then 'continue thread', collapse, live updates, mentions, Votes, Reactions, edit, delete, Blocks collapsed. | `feed.comments best/new/root indexes` | covered |
| Continue thread | `/posts/[id]-slug/c/[commentId]`* | One deep branch on its own page. | `comments_root_idx` | covered |
| New / edit Post | `/posts/new`* | Topic (not archived), title 120, subtitle 200, body 10,000 with formatting, up to 10 images with order and alt text. | `feed.posts`, `media.uploads` | covered |
| Share to a Chat | sheet | Copy link, or pick a Chat to send a Post Card. | `chat.messages.post_card_post_id` | covered |
| Logged-out Post | `/posts/[id]-slug` | Same page, no live Comments, no voting, no profiles. 'Chaku is invite-only' note. Report link. | canView | covered |
| Logged-out report form | dialog | Email, reason, details, Turnstile (D37, D44). | `moderation.reports.reporter_email` | covered |

### Games

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Game Catalog | `/games` | Listed Game Manifests: image, name (EN/UK), players. | `games.manifests` | covered |
| Game shell | layout | Full, split or chat-only, resizable, sizes saved per Game. Phones: top/bottom split. | client (sizes per Game) | covered |
| People picker | sheet | Opened by the Game's requestInvite. Our own picker, Blocks applied, shows people with a pending Challenge. | identity, `games.challenges` | covered |
| Waiting for players | Game shell | Who was challenged, time left (15 min), cancel. | `games.sessions`, challenges | covered |
| Incoming Challenge | toast, Push, bell | Join or Decline. Expired state. | `games.challenges` | covered |
| Mini Player | layout | Floating on desktop, bottom bar on phones. Keeps the heartbeat going (D43). | `sessions.last_heartbeat_at` | covered |

### Settings

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Profile | `/settings`* | Display Name, avatar, Username with the next allowed change date (30 days). | `members.username_changed_at` | covered |
| Account | `/settings/account`* | Email (change with a code), Google connection, passkeys (add, rename, remove). | accounts, passkeys | covered |
| Sessions and devices | `/settings/sessions`* | Device label, method, last active, log out remotely. | sessions, `login_devices` | covered |
| Privacy | `/settings/privacy`* | Share read receipts, share online status (both reciprocal), block list. | `members.share_*`, blocks | covered |
| Notifications | `/settings/notifications`* | Turn on Push on this device, pause all Push, show message text. | `notifications.preferences` | covered |
| Language | `/settings`* | Auto, English, Ukrainian. | `members.locale` | covered |
| Invites | `/settings/invites`* | Invites left, create with an optional note, copy link (again any time), cancel, who joined. | `identity.invites` (`code`, `note`, CHK-21) | covered (D61) |
| Your data | `/settings/data`* | Request a data export. Delete account (14 days, serious tone). | `export_requests`, `members.status` | covered |
| Feedback, legal, log out | `/settings`* | Feedback button to Linear triage, privacy policy, terms. | none | covered |

### Admin (passkey session only)

| Screen | Route | Shows and does | Data | Status |
|---|---|---|---|---|
| Report queue | `/admin/reports`* | Open Reports, oldest first: target kind, reason, count. | `moderation.reports_queue_idx` | covered |
| Report detail | `/admin/reports/[id]`* | Snapshot (each view logged), earlier Reports about the person. Remove, suspend, ban (each with a reason code), dismiss. | `report_snapshot_items`, sanctions, `audit_log.reason` | covered (D63) |
| Member | `/admin/members/[id]`* | Profile, sanctions history, Reports, invite tree position, top up Invites, cancel Invites, remove all content. | identity, moderation | covered |
| Invite tree | `/admin/invites/tree`* | Who invited whom, level by level. | `members_invited_by_idx` | covered |
| Multi-use Invites | `/admin/invites`* | Create with a use limit, expiry and note; copy link any time. | `identity.invites` | covered (D61) |
| Topics | `/admin/topics`* | Create, names in EN and UK, order, archive, default. | `feed.topics` | covered |
| Games | `/admin/games`* | Register a Manifest, list, hide, retire, rotate the service credential (shown once). | `games.manifests`, `service_credentials` | covered |
| Audit log | `/admin/audit`* | Every Admin action, newest first, kept 2 years. | `moderation.audit_log` | covered |
| Export requests | `/admin/exports`* | Open requests to deliver within 30 days. | `export_requests_open_idx` | covered |

## Gaps

What the screens needed that the spec or the data model didn't cover. All were decided on 2026-10-03 with the recommended option: the decisions are D60–D66 in the spec, and the tables are in the [data model](../architecture/data-model.md#screen-map-decisions).

### G1. System lines in Chats

**Status:** decided, D60 (CHK-37). **Changes:** data model.

**Problem.** Messengers show 'Anya added Sasha', 'renamed the group to …' and 'Oleh left' in the timeline and as the last line in the chat list. Today those exist only as chat.events, which are pruned after 30 days, and the Message window reads chat.messages only.

**Proposal.** Store them as Messages with a kind. They already take a Chat Sequence number, so ordering and catch-up come for free. They don't count as Unread.

```
chat.messages
  kind          text  'user' | 'system'  default 'user'
  system_event  text null  created | participant_added | participant_left
                | participant_removed | owner_changed | admin_changed
                | renamed | avatar_changed
  system_member_id uuid null  ID → identity.members.id
  -- author_id = who did it; body null
```

**Decided:** System lines in Group Chats, stored as Messages of kind `system` (D60).

### G2. Invite links can be copied again, and labelled

**Status:** decided, D61 (CHK-37). **Changes:** data model.

**Problem.** identity.invites stores only code_hash, so the link exists once, at creation. The Invites screen can't offer 'Copy link' later. With 5 open Invites there's also no way to tell which one is for whom.

**Proposal.** Store the code itself. An Invite is low-risk: single-use, 7 days, and the new person still has to log in. Add an optional note that only the creator sees.

```
identity.invites
  code  text  unique   -- replaces code_hash
  note  text null  1–50, creator only ("For Sasha")
```

**Decided:** store the code, plus an optional note (D61). The migration ships in CHK-21.

### G3. Reading a Chat clears its Notifications

**Status:** decided, D62 (CHK-37). **Changes:** data model.

**Problem.** A mention creates both an Unread count and a bell Notification. After you read the Message in the Chat, the bell still shows it as unread. Nothing links a Notification to a place in the Chat. The '@' badge in the chat list needs the same link.

**Proposal.** Keep the Chat Sequence of the Message on chat Notifications. When a Read Position moves, chat adds a job, and notifications marks read everything in that Chat up to that number.

```
notifications.notifications
  context_seq bigint null   -- Message's seq, chat types only
  index (recipient_id, context_id) where read_at is null

job chat.read_position_moved { chat_id, member_id, read_seq }
```

**Decided:** reading a Chat marks its mention and reply Notifications read, and the chat list shows "@" (D62).

### G4. Moderation notices to the author and the reporter

**Status:** decided, D63 (CHK-37). **Changes:** data model.

**Problem.** Admins can remove content and ban people, but nobody is told. The EU Digital Services Act asks hosting services to confirm a report, tell the reporter the decision, and give the affected person a statement of reasons. That likely applies to Chaku's public Feed even at beta size. Removal also stores no reason.

**Proposal.** Two Notification types, plus email for logged-out reporters (transactional, which D6 allows). Store a reason code with each Admin action.

```
notifications.type += content_removed, report_resolved
moderation.audit_log
  reason text null   -- same codes as reports.reason
-- ban/suspension: shown on the login screen from members.ban_reason
```

**Decided:** both notices, emails for logged-out reporters and banned or suspended Members, and a reason code on every removal, ban and suspension (D63). Wording with the legal pages (CHK-33).

### G5. What a profile shows

**Status:** decided, D64 (CHK-37). **Changes:** one index.

**Problem.** The spec defines /@username but not what's on it. results.member_stats is stored and never shown anywhere. Feed authors have no list of their Posts.

**Proposal.** Show Game stats (no change). Optionally a Posts list (needs one index) and a short bio (new column, not in the spec).

```
feed.posts_author_new_idx (author_id, created_at desc, id desc)
  where deleted_at is null and removed_at is null
identity.members.bio text null  -- up to 160, optional
```

**Decided:** Game stats and Posts; no bio in v1 (D64).

### G6. Group Owner can hand over ownership

**Status:** decided, D65 (CHK-37). **Changes:** spec only.

**Problem.** D3 passes ownership on only when the Owner leaves. An Owner who wants to stay but stop managing the group can't.

**Proposal.** A 'Make owner' action for the Owner, on a Participant in Group info. The data already supports it (participant roles, participant_role_changed event).

No table change.

**Decided:** add "Make owner"; the old Owner becomes a Group Admin (D65).

### G7. Hiding a Direct Chat

**Status:** decided, D66 (CHK-37). **Changes:** data model.

**Problem.** Anyone can message anyone (D3) and there's no 'delete for me' (D5). A stranger's or spammer's Direct Chat stays in your list forever, even after you Block them.

**Proposal.** 'Hide chat' removes it from your list until a new Message arrives. History stays for both people.

```
chat.participants
  hidden_until_seq bigint null  -- hidden while last_message_seq <= this
```

**Decided:** "Hide chat" for Direct Chats, until a new Message arrives or the Member opens it (D66).

### G8. Theme setting

**Status:** decided (D59, ADR-0015).

**Problem.** Foundations defines a dark theme, but no screen or setting chooses it.

**Proposal.** Light / dark / system in Settings, stored per device in a cookie so the first paint is right. No database change.

No table change.

## Design notes on the Warm direction

What laying out real screens showed about the [foundations](foundations.md). The mockups have a switch to compare notes 1 and 2.

1. **White bubbles barely separate from the cream background.** White on `#FFF7EF` is about 1.05:1. Proposed: a slightly deeper `chat-background` for the Message list (`#F6EBDF`); muted text on it is still 4.9:1.
2. **Own bubbles in dark mode are very loud.** A Chat full of `#FF8A5C` bubbles is a wall of bright coral at night. Proposed: a deeper `bubble-own` in dark mode only (`#A8472A` with `#FFF4EC` text, 5.4:1), keeping the bright coral for buttons and badges.
3. **Sun yellow works as the Game Challenge signal. Keep it for that.** Warnings use a separate semantic colour (`warning`, ADR-0015).
4. **Coral does a lot of jobs on chat screens:** own bubbles, Send, unread badges, links, the selected tab. It reads clearly today. If it gets noisy, unread badges move to ink first.
5. **The shapes make it Chaku.** Cream with coral is a common palette. Nunito's rounded letters, the bubble tail, pill controls and soft group avatars set it apart, so lean on those rather than adding colour.
6. **Check the phone tab bar in Ukrainian.** "Сповіщення" is the longest of five labels at 360px. Options: a shorter UK label, or an icon-only bell with a screen-reader label. Decide in the Storybook check of both languages. (The mockups say "Alerts" to fit, but voice-and-tone says Notification.)

All six are inputs to the tokens ticket (CHK-36). None of them changes a token yet.
