# Design system foundations

Code-first in `packages/ui` (tokens as CSS variables, Tailwind 4, shadcn/ui on Base UI), mirrored to a Figma library (ADR-0011). This doc sets the direction. The full token scales are defined in code and documented in Storybook.

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

### Participant name colors

Group Chats color each Participant's name from a fixed set of 6–8 hues, picked by Member ID. The tokens ticket defines this set so every hue passes AA in both themes.

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

These go in the tokens and Storybook work in the Design System project:
- full color scales and semantic tokens (success, warning, danger, info) in both themes
- spacing scale (4px base), type scale, z-index layers
- logo and app icon (PWA icons, Open Graph image)
- illustrations for empty states and onboarding
- the Figma library, generated from the tokens
