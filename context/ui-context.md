# UI context

Two surfaces: the **tracker dashboard** (web, server-rendered with Jinja2 + HTMX) and the **`outreach` CLI** on the PC. The dashboard is a private tool for one person, so it favours clarity and density over decoration.

## Design style

- Quiet, tool-like, information-dense. Think of a well-made admin table, not a marketing site.
- Evidence and uncertainty are always visible: every email shows where it was found and how sure we are.
- Destructive or outward actions (approve, send, clear pause, delete) look different from ordinary actions and always say exactly what will happen.
- No external fonts, CDNs or trackers. Everything is served by the tracker (it works offline over WireGuard).

## Colors

CSS custom properties on `:root`, with a dark set under `prefers-color-scheme: dark` and a manual `[data-theme]` override.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f7f7f5` | `#161615` | Page background |
| `--surface` | `#ffffff` | `#1f1f1d` | Cards, tables |
| `--text` | `#1d1d1b` | `#ecebe6` | Body text |
| `--muted` | `#6b6b66` | `#9b9a94` | Secondary text |
| `--line` | `#e4e3de` | `#33322f` | Borders |
| `--accent` | `#2f6fde` | `#7aa7ff` | Links, primary buttons, focus ring |
| `--ok` | `#1f8a4c` | `#5cc88a` | sent, replied, verified |
| `--warn` | `#b26b00` | `#e3a54a` | needs info, due, unconfirmed |
| `--danger` | `#b3261e` | `#f08a82` | bounced, opted out, paused, errors |
| `--chip` | `#f0efea` | `#2a2a27` | Pills, hover rows |

Status colour is never the only signal: every status pill also has its text label.

## Typography

- System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Monospace: `ui-monospace, Consolas, monospace` for emails, Message-IDs and domains.
- Base 14 px / line-height 1.5. Page title 22 px semibold; section 17 px semibold; table headers 12 px uppercase, muted, letter-spacing 0.03em.
- Email previews use the body font at 13 px with `white-space: pre-wrap`, exactly as sent (plain text).

## Spacing

4 px base scale: 4, 8, 12, 16, 24, 32. Card padding 16. Table cell padding 9 × 12. Gap between cards 12–16. Border radius 10 for cards, 8 for inner boxes, 999 for pills.

## Page layouts

| Page | Route | Layout |
|---|---|---|
| Login | `/login` | Centred card |
| Overview | `/` | Health banner (if any), stat tiles (sent today / cap, replies, due follow-ups, bounces), recent activity, campaigns list |
| Campaign brands | `/campaigns/{id}` | Filter bar + sortable table (score, brand, tier, channel, status) + detail panel on the right (evidence, channels, notes) |
| Template | `/campaigns/{id}/template` | Editor (subject, body, follow-up) on the left, live preview for a selected brand on the right, version history |
| Review and approve | `/campaigns/{id}/review` | One draft at a time or a list; exact rendered email; approve / skip / edit; batch summary at the end |
| Conversations | `/inbox` | Messages with replies, bounces and opt-outs; classification pill (editable); link to open in the mail app |
| Follow-ups | `/follow-ups` | Due list with approve, snooze and cancel |
| Suppression | `/suppression` | Table with add and remove (remove needs confirmation) |
| Settings | `/settings` | Caps, delays, cooldown, profile fields (name, channel link, sample video), pause switch |
| Health | `/health` | Watcher heartbeat, last IMAP sync, backups, API tokens |

Max content width 1180 px; detail panels use a two-column grid that collapses to one column below 860 px.

## Components

- **Data table**: sticky header, sortable columns, row click opens the detail panel, checkbox column for bulk actions, 50 rows per page with HTMX "load more".
- **Status pill**: `preview`, `approved`, `sent`, `replied`, `due`, `needs: …`, `bounced`, `opted out`, `paused`, `manual action`.
- **Evidence block**: source URL (link), excerpt, fetched date, verification label.
- **Email preview**: subject line, plain-text body, recipient, content hash (short) so approval is unambiguous.
- **Confirm dialog** for outward actions: states the count and names ("Approve 8 emails to: …"). Bulk approval requires typing the number.
- **Health banner**: full-width, `--danger` border, shown on every page while a problem lasts.
- **Toast**: HTMX `HX-Trigger` messages for small confirmations; auto-hide after 5 s; also announced to screen readers.

## Navigation

Left sidebar on desktop: Overview, Campaigns, Review, Inbox, Follow-ups, Suppression, Settings, Health. Due follow-ups and new replies show count badges. Top bar shows the pause state and a **Pause all sending** button.

## Responsive behavior

- At 860 px or less, the sidebar becomes a top menu button; detail panels stack under tables.
- At 600 px or less (phone over WireGuard), tables switch to stacked cards showing brand, status and the primary action. The inbox and follow-ups must be fully usable on a phone. Template editing may be desktop-only.
- Gutters 16 px on phone; no horizontal page scroll.

## Accessibility

- WCAG 2.2 AA contrast for text and pills in both themes.
- Every control reachable by keyboard; visible `--accent` focus ring; keyboard shortcuts on the review page (`a` approve, `s` skip, `e` edit, `j`/`k` next/previous) listed on the page.
- Semantic HTML: real `<table>`, `<button>`, `<label>`; HTMX swaps keep focus and use `aria-live="polite"` regions for updates.
- No information by colour alone; icons have text labels.

## Loading and error states

- HTMX requests show an inline spinner on the triggering element and disable it until done (prevents double submits).
- Empty states explain the next step, for example "No brands yet. Run `outreach discover \"gaming monitor\"` on your PC."
- Form validation errors appear next to the field, with a summary at the top for long forms.
- Server errors show a short message and an error ID that matches the log entry; never a stack trace.
- Stale data: pages show "updated N min ago" for watcher-driven lists.

## CLI output (PC)

- Plain text with optional colour (disabled when not a TTY or with `NO_COLOR`).
- Progress per stage: `[3/7] classify  42/60 brands`.
- Every command ends with a one-line summary and the next suggested command.
- `outreach handoff` prints each check as `✓` / `✗` with the fix for failures, and only then "Safe to shut down".
