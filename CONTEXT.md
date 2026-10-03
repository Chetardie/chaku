# Chaku

An invite-only web messenger where people chat, play games next to their chats, and post in a public feed organized by topics.

## Language

### Identity

**Member**:
A person with an account and the default site-wide role.
_Avoid_: User (in product copy), customer

**Admin**:
A site-wide role that manages topics, moderation, bans and Invites, but cannot read private chats except through a Report.
_Avoid_: Moderator, superuser, owner

**Deleted user**:
How a Member appears after their account is deleted and erased; everything they wrote becomes Deleted.
_Avoid_: Former member, ghost, anonymous

**Invite**:
A link that lets a new person create an account; single-use or multi-use, and always records who invited whom.
_Avoid_: Invitation, referral, signup code

**Username**:
A Member's unique, case-insensitive handle used in mentions, search and Profile Links.
_Avoid_: Handle, login, nickname

**Display Name**:
The free-form name shown next to a Member's avatar.
_Avoid_: Username, nickname, real name

**Profile Link**:
A shareable link to a Member's profile (`/@username`), used by existing Members to find each other.
_Avoid_: Invite link (that is for signup), contact link

### Chat

**Chat**:
A conversation between Participants; either a Direct Chat or a Group Chat.
_Avoid_: Conversation, thread, room, channel

**Direct Chat**:
A Chat with exactly two Participants; there is at most one per pair of Members.
_Avoid_: DM (in code), private chat

**Group Chat**:
A Chat with up to 50 Participants, a name, and group roles.
_Avoid_: Group (alone), room, channel

**Participant**:
A Member who belongs to a specific Chat.
_Avoid_: Member (inside a chat), chat member, user

**Group Owner**:
The single Participant who created a Group Chat or inherited it; can promote Group Admins.
_Avoid_: Creator, Admin

**Group Admin**:
A Participant promoted by the Group Owner to manage the Group Chat's name, avatar and Participants.
_Avoid_: Admin (that is the site-wide role), moderator

**Message**:
One entry in a Chat: formatted text with up to 4 images, and optionally a card.
_Avoid_: Post (that is the feed), chat post

**Message Reply**:
A Message that quotes one earlier Message in the same Chat; tapping the quote jumps to the original.
_Avoid_: Reply (alone), quote, thread (in a Chat)

**System line**:
A line in a Group Chat's timeline that records a change, such as someone being added or the group being renamed; stored as a Message of kind `system`, never written by a Participant.
_Avoid_: Service message, event (that is the Chat event log), notice

**Post Card**:
A card in a Chat that shows a feed Post, created by sharing the Post or pasting its link.
_Avoid_: Shared post, embed

**Link Preview**:
A card showing the title, description and image of an outside web page linked in a Message; captured once, and the sender can dismiss it before sending.
_Avoid_: Unfurl, embed, OG card

**Unread**:
The state of a Chat that has Messages the Participant hasn't seen, shown as a bold Chat and a count.
_Avoid_: New messages, notification (for plain Messages)

**Mute**:
A Participant's setting that stops push alerts for one Chat, for a set time or indefinitely; Unread counts still update.
_Avoid_: Silence, snooze, archive

**Read Position**:
The last Message a Participant has seen in a Chat, stored as a Chat Sequence number; "Seen", "Seen by" and Unread counts are derived from it.
_Avoid_: Read receipt (as a stored thing), seen status

**Chat Sequence**:
A Chat's counter that goes up by one for every change in that Chat (new, edited or deleted Message, Reaction, Participant change, rename); Read Positions don't take a number. Used for ordering, Unread counts and catch-up after reconnecting.
_Avoid_: Cursor, offset, message id (for ordering)

**Presence**:
Whether a Member is online now, or roughly how long ago they were ("recently", "today", "this week", "a long time ago").
_Avoid_: Status, last login, activity

### Notifications

**Notification**:
An item in a Member's bell list about something aimed at them: a mention, a Message Reply to them in a Group Chat, a Game Challenge, a Comment on their Post or Comment, or being added to a Group Chat.
_Avoid_: Alert, activity (and never for plain Messages or reactions)

**Push**:
A browser notification sent to a Member who has no active tab (no open page reported as visible in the last 60 seconds).
_Avoid_: Notification (when meaning the browser alert), alert

### Games

**Game**:
A separately built and deployed app that plugs into the platform through the game contract; single-player or multiplayer.
_Avoid_: Mini-app, plugin, widget

**Game Manifest**:
A Game's registration record: its name, image, player counts, address and supported contract version.
_Avoid_: Game config, game metadata

**Game Catalog**:
The page listing every registered Game a Member can open.
_Avoid_: Game store, arcade, lobby

**Game Session**:
One play-through of a Game, from opening it to a result; it starts out waiting for players, or goes straight to active for a single-player Game.
_Avoid_: Match, room, lobby, game instance

**Game Challenge**:
A request from a player in a Game Session to another Member to join that Session, delivered as a toast, Push and Notification (not in a Chat).
_Avoid_: Game invitation, game invite

**Game Result**:
The outcome of a finished Game Session for each player, reported by the Game's server.
_Avoid_: Score (that is feed Votes), match result

**Mini Player**:
A running Game Session minimized while the Member uses the rest of the app: a floating window on desktop and a bottom bar on phones.
_Avoid_: Floating window, PiP, minimized game

**Reference Game**:
The small Game in our repo that exercises the whole game contract in tests; shipped to beta Members as "Four in a Row".
_Avoid_: Demo game, sample game, dummy game

### Feed

**Topic**:
An Admin-created category that every Post belongs to; "General" is the default.
_Avoid_: Subreddit, channel, community, category

**Post**:
A public feed entry with a title, optional subtitle, body and images, in exactly one Topic.
_Avoid_: Message (that is chat), article, story

**Comment**:
A reply to a Post or to another Comment, forming a threaded discussion.
_Avoid_: Reply (as a separate thing; "reply" is fine in UI copy), Message Reply (that is chat), message

**Vote**:
A Member's like or dislike on a Post or Comment; at most one per Member per item.
_Avoid_: Reaction (that is emoji), upvote/downvote

**Score**:
Likes minus dislikes on a Post or Comment.
_Avoid_: Karma, points, rating

**Reaction**:
An emoji from the fixed Reaction set that a Member adds to a Message, Post or Comment; each emoji at most once per Member per item.
_Avoid_: Vote, like (on Messages), emote

### Moderation

**Block**:
A one-way, silent choice by a Member to stop another Member from contacting them or appearing in their view.
_Avoid_: Ban (that is an Admin action), mute (that is per-Chat alerts), ignore

**Report**:
A flag on a Message, Post, Comment or person, carrying a snapshot of the surrounding context taken at report time; made by a Member, or by a logged-out visitor on a public Post or Comment.
_Avoid_: Flag, complaint

**Deleted**:
Content its author took down for everyone; the content is erased, and a "[deleted]" placeholder keeps its place in the thread.
_Avoid_: Removed (when the author did it)

**Removed**:
Content an Admin took down; shown as "[removed by admin]".
_Avoid_: Deleted (when an Admin did it), hidden

## Relationships

- An **Invite** is created by one **Member** and can be redeemed by one (single-use) or many (multi-use) new people
- A **Message Reply** quotes exactly one earlier **Message** in the same **Chat**
- A **System line** shares the **Chat Sequence** number of the change it records; it doesn't count as **Unread**
- A **Direct Chat** has exactly 2 **Participants**; adding a third person creates a new **Group Chat** instead
- A **Group Chat** has exactly one **Group Owner**, zero or more **Group Admins**, and up to 50 **Participants** in total; if the Owner leaves, ownership passes to the longest-serving Group Admin, else the longest-serving Participant; the Owner can also hand it to any Participant
- A **Block** never removes anyone from a shared **Group Chat**; the blocked person's Messages are collapsed for the blocker instead
- **Posts** and **Comments** take both **Votes** and **Reactions**; **Messages** take **Reactions** only
- An **Admin** sees private chat content only through a **Report**, which snapshots the reported message and about 10 messages before it
- A piece of content is either **Deleted** (by its author) or **Removed** (by an **Admin**), never both
- Opening a **Game** from the **Game Catalog** creates a **Game Session**; players in it send **Game Challenges** to bring others in
- A **Game Challenge** belongs to exactly one **Game Session** and, if not accepted in time, becomes **Expired**
- **Games** and **Chats** don't know about each other; the app layout simply shows them side by side

## Flagged ambiguities

- "member" was used for both the site-wide role and belonging to a chat — resolved: **Member** is site-wide; chat membership is **Participant**.
- "admin" risks meaning both site and group roles — resolved: **Admin** is site-wide only; in a Group Chat say **Group Admin**.
- "conversation" and "chat" were used interchangeably — resolved: **Chat** is canonical.
- "invite links" was used for both signup and finding existing people — resolved: **Invite** is for new people; existing Members share a **Profile Link**.
- "invite/invitation" was used for both signup and games — resolved: **Invite** is for signup only; games use **Game Challenge**.
- "reply" was used for both answering in the feed and quoting in a Chat — resolved: in a Chat it is a **Message Reply**; in the feed an answer is a **Comment**.
