# MeetMind Design System (MASTER)

Generated with **ui-ux-pro-max** (`--design-system -p MeetMind`) and then overridden to match the
product reference screenshot (dark, premium, "Unitask"-style meeting workspace).
Page-specific overrides live in `pages/<page>.md` and win over this file.

## Style

- **Base style:** Flat dark SaaS (from ui-ux-pro-max "Flat Design", dark mode). No gradients, no heavy shadows.
- **Elevation:** expressed with surface steps + 1px hairline borders, never drop shadows.
- **Mood:** dark, cinematic, technical, precise, premium productivity (skill typography mood for AI dashboards).
- **Radius:** `--radius-sm 8px`, `--radius-md 12px`, `--radius-lg 16px` (panels), pills for chips.
- **Motion:** 150–200ms ease-out for color/opacity/transform only. Honour `prefers-reduced-motion`.

## Color tokens (dark)

| Role | Hex | Token |
|---|---|---|
| App background (outer frame) | `#0A0A0B` | `--bg` |
| Panel / card | `#111113` | `--surface` |
| Raised surface (row header, inputs) | `#18181B` | `--surface-2` |
| Hover surface | `#1F1F23` | `--surface-3` |
| Hairline border | `#232327` | `--border` |
| Strong border | `#2E2E33` | `--border-strong` |
| Primary text | `#F4F4F5` | `--fg` |
| Secondary text (body copy) | `#A1A1AA` | `--fg-muted` (≥ 7:1 on surface) |
| Tertiary text (meta, breadcrumbs) | `#8B8B94` | `--fg-subtle` (≥ 4.5:1 on surface) |
| Primary CTA (inverted) | `#FFFFFF` on `#0A0A0B` text | `--cta` / `--cta-fg` |
| Accent (checks, links, focus) | `#5B7CFA` | `--accent` |
| Teal (media / recordings) | `#2DD4BF` | `--teal` |
| Amber chip | `#F5B544` on `#2A2213` | `--amber` |
| Orange chip | `#F97B4F` on `#2B1A14` | `--orange` |
| Success | `#34D399` | `--success` |
| Danger | `#F87171` | `--danger` |
| Recording dot | `#EF4444` | `--rec` |

Status chips always combine colour **and** a text label (never colour alone).

## Typography

- **Family:** `Google Sans Flex` → fallback `Plus Jakarta Sans` → system UI. Geometric humanist sans
  matching the screenshot. Tabular numerals for timestamps/durations (`font-variant-numeric: tabular-nums`).
- **Scale:** page title 28/34 semibold, section title 18/26 medium, body 15/24, meta 13/20, micro 12/16.
- Body copy never below 13px; line-height ≥ 1.5 for paragraphs.

## Layout

- Fixed 64px icon rail (left), 64px top bar with breadcrumbs, global search, notifications, white "Record a Meeting" CTA.
- Meeting detail: two panels — content (left, ~60%) and media + transcript (right, ~40%), each independently scrollable.
- Breakpoints: 375 / 768 / 1024 / 1440. Below 1024 the panels stack; the rail becomes a bottom-safe drawer.

## Interaction & accessibility (ui-ux-pro-max priorities 1–3)

- Visible focus ring: 2px `--accent` with 2px offset on every interactive element.
- Icon-only buttons require `aria-label`; min target 36px desktop / 44px touch.
- `cursor-pointer` on clickables; hover = surface step, pressed = scale(0.98).
- Skeletons for loads > 300ms; disable buttons + spinner during async work.
- Errors shown inline near the field; toasts for background job events.
- Skip-to-content link; heading hierarchy h1 → h2 → h3.

## Icons

Lucide (1.75 stroke), 18–20px. No emoji icons.

## Anti-patterns

- Light teal palette from the generic generator (rejected: does not match brand reference).
- Gray-on-gray text below 4.5:1, colour-only status, autoplaying media, layout shift on load.
