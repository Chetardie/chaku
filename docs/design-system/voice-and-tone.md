# Voice and tone

How Chaku talks, in English and Ukrainian. It goes with the [Warm brand direction](foundations.md). Everyone who writes UI text follows it, people and agents alike.

## Voice

Chaku sounds like a friend who's good with technology: warm, plain and brief. It helps, then gets out of the way.

| We are | We are not |
|---|---|
| Warm: "Say hi to Anya" | Cute or childish: "Yay!! Time to chat 🎉🎉" |
| Plain: "Couldn't send. Check your connection." | Technical: "WebSocket error 1006" |
| Brief: one short sentence where possible | Chatty: a paragraph where a label will do |
| Direct: "You" and the action | Passive or corporate: "Your request has been processed" |
| Calm when things go wrong | Alarming or blaming: "You entered an invalid code!" |

Tone shifts with the moment:
- **More playful:** onboarding, empty states, Game Challenges, celebrations
- **Neutral:** everyday UI
- **Serious and careful:** login, account deletion, Reports, Blocks, bans, privacy. Never joke here.

## Rules for every string

- **Sentence case** everywhere: "Create group chat", not "Create Group Chat".
- **Buttons say what happens:** "Send", "Join game", "Delete message". Avoid "OK", "Submit" and "Yes".
- **Errors say what happened and what to do next:** "That code has expired. We've sent a new one."
- **Confirmations for destructive actions name the thing and the consequence:** "Delete this message for everyone? This can't be undone."
- **Few exclamation marks:** at most one, for real celebrations only.
- **Emoji in UI text:** rarely, and never as the only carrier of meaning (screen readers, D18).
- **Numbers, dates and times** always go through next-intl and date-fns for the viewer's locale (D18). Never build "3 messages" by hand; use ICU plurals.
- **No content in notifications** when "Show message text in notifications" is off (D9).
- **Every string lives in the message catalogs** (next-intl), in both EN and UK, in the same PR.

## Words

[CONTEXT.md](../../CONTEXT.md) is the source of truth for terms in code and docs. In the UI, use the plain-word form below, in sentence case.

| Term (CONTEXT.md) | English UI | Ukrainian UI |
|---|---|---|
| Chat | chat | чат |
| Direct Chat | chat (with a person's name) | чат |
| Group Chat | group chat, group | груповий чат, група |
| Message | message | повідомлення |
| Message Reply | reply | відповідь |
| Reaction | reaction | реакція |
| Mute | mute | вимкнути сповіщення |
| Block | block | заблокувати |
| Report | report | поскаржитися |
| Invite | invite | запрошення |
| Member | person, people; "member" only in Admin tools | людина, люди; «учасник» лише в інструментах адміністрування |
| Game Challenge | challenge | виклик |
| Game Session | game | гра |
| Post | post | допис |
| Comment | comment | коментар |
| Topic | topic | тема |
| Feed | feed | стрічка |
| Vote (like / dislike) | like, dislike | вподобати, не вподобати |
| Deleted / Removed | "[deleted]" / "[removed by admin]" | «[видалено]» / «[видалено адміністратором]» |

Never in UI copy: "user", "DM", "conversation", "room", "channel", "server", "subreddit".

## Ukrainian

- **Write Ukrainian copy natively, don't translate word for word.** If a sentence sounds translated, rewrite it.
- **Address:** informal «ти». This is a default chosen to match the Warm, friends-first direction; revisit it if the product opens beyond friends.
- **Plurals:** Ukrainian has one, few and many forms (1 повідомлення, 2 повідомлення, 5 повідомлень). Always use ICU plural rules (D18).
- **Gender:** we don't collect gender, and Ukrainian past-tense verbs are gendered ("Анна надіслала", "Олег надіслав"). Never put a Member as the subject of a past-tense verb. Use constructions without gender:
  - «Нове повідомлення від Анни», not «Анна надіслала повідомлення»
  - «Анна: запрошення до гри», not «Анна запросила тебе»
- **Length:** Ukrainian text often runs 20–30% longer than English. Layouts must handle it: no fixed-width buttons, and check both languages in Storybook.
- **Quotes and typography:** «ялинки» for quotes in Ukrainian, the apostrophe ’ (U+2019), and a non-breaking space before units and after one-letter words where it helps reading.

## Examples

| Situation | English | Ukrainian |
|---|---|---|
| Empty chat list | No chats yet. Say hi to someone. | Ще немає чатів. Привітайся з кимось. |
| Send failed | Couldn't send. Tap to try again. | Не вдалося надіслати. Натисни, щоб спробувати ще раз. |
| Game Challenge toast | Anya challenged you to Four in a Row | Виклик від Анни: «Чотири в ряд» |
| Blocked person tries to message | You can't message this person. | Ти не можеш написати цій людині. |
| Delete account | Your account will be deleted in 14 days. Log in before then to cancel. | Твій акаунт буде видалено через 14 днів. Увійди до того часу, щоб скасувати. |
