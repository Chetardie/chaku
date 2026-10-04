# Design system foundations

Code-first in `packages/ui` (tokens as CSS variables, Tailwind 4, shadcn/ui on Base UI), mirrored to a Figma library (ADR-0011). This doc sets the direction. The full token scales are defined in code and documented in Storybook.

## Theming

Warm is the first theme, not a fixed look. Every colour, font and shape reaches a component through a semantic token (ADR-0015, D59):

| Layer | Example | Who uses it |
|---|---|---|
| Primitive | `coral-600 = #C8461B` | theme files only |
| Semantic role | `bubble-own = coral-600` (light), `bubble-own = coral-700` (dark) | components, through Tailwind utilities |
| Utility | `bg-bubble-own` | components |

- **Change the look:** edit `packages/ui/src/tokens/themes/warm.ts`, or add a new theme file and make it the default. No component changes.
- **Never in components:** hex or `oklch()` values, Tailwind palette classes (`bg-orange-500`, which don't exist in our build), or `dark:` classes. Lint rejects all three.
- **Need a colour no role describes?** Add a semantic role, then map it in every theme.
- **Contrast** is tested for every theme and mode, so a theme change that breaks AA fails CI.

The values below are the seeds of the Warm theme.

## Brand direction: Warm

Chosen 2026-10-02 (CHK-10).

**Personality:** a place to hang out with friends. Warm, friendly and a bit playful, but calm enough to read long Chats in. Games should feel at home without the app looking like a game.

| Do | Don't |
|---|---|
| Warm neutrals (cream, brown-black), never cold greys | Pure white page backgrounds, blue-grey neutrals |
| One strong accent (coral), one supporting color (sun yellow), used sparingly | Coral everywhere; rainbow screens |
| Generous rounding, soft shapes | Sharp corners, heavy borders |
| Personality in small moments: Reactions, Game Challenges, empty states, onboarding | Decoration in the core reading surfaces (Message list, Post body) |

## Color

Seed values. Full 50–950 scales are generated from these in the tokens ticket, and every text and background pair is checked for WCAG 2.2 AA (4.5:1 for text, 3:1 for large text and UI parts).

### Light

| Role | Value | Use | Checked contrast |
|---|---|---|---|
| `bg` | `#FFF7EF` cream | page background | |
| `surface` | `#FFFFFF` | cards, Messages from others, inputs | |
| `text` | `#2B1D14` warm ink | body text | 15.4:1 on `bg` |
| `text-muted` | `#7A604F` | secondary text, timestamps, placeholders | 5.5:1 on `bg`, 5.8:1 on `surface` |
| `accent` | `#C8461B` coral | own Messages, primary buttons, links | white text on it 4.8:1 |
| `accent-text` | `#C2410C` | coral text on light surfaces | 5.2:1 on white |
| `accent-soft` | `#FFE4D3` | Reaction pills, selected states | `#9A3412` text on it 6.0:1 |
| `sun` | `#FFE08A` | Game Challenges, highlights, celebrations | `#3F2D00` text on it 10.3:1 |
| `violet` | `#7C3AED` | one of the Participant name colors | |

### Dark

Warm dark, not black-grey.

| Role | Value | Checked contrast |
|---|---|---|
| `bg` | `#1C1512` | |
| `surface` | `#2A201B` | `#F5EDE6` text on it 13.7:1 |
| `text` | `#F5EDE6` | 15.6:1 on `bg` |
| `text-muted` | `#B8A598` | 7.6:1 on `bg` |
| `accent` | `#FF8A5C` (lighter coral, dark text on it) | `#1C1512` on it 7.8:1 |

### Decided in the tokens work (CHK-36)

The full 50–950 scales, and every semantic role's value in both modes, are in [`packages/ui/src/tokens`](../../packages/ui/src/tokens) and on Storybook's Foundations → Tokens page. The seeds above keep their exact values in the scales, with one merge: dark `surface` (`#2A201B`) became `ink-900` (`#2B1D14`), the light text colour, so one step serves both.

- **Chat background (screen map, design note 1):** light `chat-background` is `#F6EBDF` (`cream-100`), deeper than the page, so white bubbles stand out. Dark mode uses the page background.
- **Own bubbles in dark mode (design note 2):** `bubble-own` is `#A8472A` (`coral-700`) with `#FFF4EC` text, 5.4:1. Bright coral stays on `primary`, unread badges and focus rings.
- **Foreground partners:** every fill that carries text has a `-foreground` role: `unread-foreground`, `mention-foreground`, and one per status colour. `radius-pill` joins the shape roles.

### Participant name colors

Group Chats color each Participant's name from a fixed set of 8 hues, picked by Member ID. Each hue is at least 4.5:1 on `chat-background`, `card` and `background` in its mode. Warm and cool hues alternate, and their lightness varies, so neighbours differ for people with red-green or blue-yellow colour blindness too; 8 hues can't all be told apart that way, which is why a name never relies on colour alone. None of them is a status colour.

| Role | Light | Lowest contrast | Dark | Lowest contrast |
|---|---|---|---|---|
| `participant-1` rose | `#882A34` | 7.4:1 | `#FFC3C4` | 10.8:1 |
| `participant-2` teal | `#007374` | 4.8:1 | `#A2E8E7` | 11.8:1 |
| `participant-3` amber | `#793E00` | 7.1:1 | `#F8B477` | 9.1:1 |
| `participant-4` blue | `#18518A` | 6.9:1 | `#8FC9FF` | 9.3:1 |
| `participant-5` green | `#175F2A` | 6.6:1 | `#92D89B` | 9.7:1 |
| `participant-6` plum | `#924273` | 5.5:1 | `#F8A7D4` | 8.9:1 |
| `participant-7` olive | `#6C6606` | 5.0:1 | `#E0DDA1` | 11.7:1 |
| `participant-8` violet | `#563D8D` | 7.3:1 | `#B59AFE` | 7.0:1 |

The violet seed `#7C3AED` is brighter than every other hue at the same lightness, so the set uses a calmer violet.

### Status colors

`success`, `warning`, `danger` and `info` work as text on `background` and `card` (form errors, "Saved"), and as fills under their `-foreground` (white in light mode, `ink-950` in dark). Warning is amber, not sun: sun yellow means a Game Challenge. `destructive` (shadcn's name) is `danger`.

| Role | Light | As text, lowest | Dark | As text, lowest |
|---|---|---|---|---|
| `success` | `#247638` | 4.8:1 | `#74C381` | 7.7:1 |
| `warning` | `#935000` | 5.3:1 | `#E59B56` | 7.1:1 |
| `danger` | `#A43944` | 5.5:1 | `#FB868C` | 6.9:1 |
| `info` | `#2565A7` | 5.1:1 | `#72B2F9` | 7.3:1 |

Success and danger have the same lightness, so status always comes with an icon or a word, never colour alone.

## Typography

- **UI and content:** Nunito (variable font), with Latin, Latin Extended and Cyrillic for the Ukrainian UI.
- **Code** (inline code and code blocks in Messages): JetBrains Mono, which also has Cyrillic.
- **Loading:** fonts are self-hosted through `next/font`, so browsers never contact Google at runtime. That matters under GDPR and the strict CSP (D35).
- **Weights:**
  - 400 for body text
  - 600 for names and labels
  - 800 for titles only
- **Body size:** 15–16px on phones, line height about 1.5.

## Shape and depth

- **Corners:**
  - Message bubbles: 20px, with the corner nearest the author at 6px (the bubble "tail")
  - cards: 16px
  - buttons and inputs: fully rounded (pill)
  - Reaction pills: pill
- **Depth:** flat surfaces separated by color, not shadows. One soft shadow level, only for floating things: menus, toasts, the Mini Player.
- **Motion:** short and soft (150–250 ms, ease-out). Respect `prefers-reduced-motion` (D18).

## Icons

`lucide-react` with a 1.75px stroke and round caps, which suits the rounded type. Icons sit next to a text label unless their meaning is universal (send, close, search).

## Still to define

The tokens work (CHK-36) defined the color scales, every semantic role in both modes, the two screen-map colour tweaks, the spacing scale (4px base), the type scale (12–30px, body 16px so iOS doesn't zoom into inputs) and the z-index layers. Still open:
- one shadow level for floating things (menus, toasts, the Mini Player) as a token
- logo and app icon (PWA icons, Open Graph image)
- illustrations for empty states and onboarding
- the Figma library, generated from the tokens
