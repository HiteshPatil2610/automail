# Project overview

## Project description

**OutreachAI** is a free, fully open-source system that helps a YouTube creator ask product brands for review units. It finds brands for a product type, finds each brand's published contact channel, prepares a personalised email for each one, sends only the emails the creator approves, and tracks replies, bounces, opt-outs and follow-ups.

It runs on two machines:

- **The PC (local mode)** does the heavy work when the creator turns it on: discovery, AI, sending.
- **The tracker (online mode)** is a small always-on machine that only tracks the inbox and keeps the records, so tracking continues while the PC is off.

Full design: [docs/](../docs/) (index in the [README](../README.md#design-documents)).

## Goals

1. Find 30–150 genuine brands per product category, ranked, with evidence.
2. Use only contact addresses published on the brand's own site, never guessed ones.
3. Send nothing without the creator approving the exact text.
4. Keep heavy work on the creator's own hardware (16 GB RAM, RTX 5060 8 GB).
5. Keep tracking replies with the PC off.
6. Run every required component under an OSI-approved license.
7. Cost ₹0 a month to run.

## User roles

| Role | Who | Can do |
|---|---|---|
| **Owner** | The creator; the only human user | Everything: run discovery, edit templates, approve, send, manage suppression and settings |
| **PC client** | The `outreach` CLI on the creator's PC, using an API token | Write discovery results, drafts and send records; read approvals and suppression |
| **Tracker jobs** | Background jobs on the tracker | Write inbound events, suppression, follow-up and message tracking states |

There are no other users, teams or public sign-ups.

## User journeys

**J1. New category campaign**
`outreach start` → `outreach discover "gaming monitor"` → brands appear on the dashboard → owner filters, excludes, fixes product lines → edits the master template → reviews rendered drafts and approves → `outreach send` → `outreach handoff` → PC off.

**J2. A brand replies while the PC is off**
Tracker sees the reply over IMAP → matches it by `In-Reply-To` → marks it replied and cancels the follow-up → phone alert through ntfy → owner reads it in their mail app and answers by hand.

**J3. Follow-up day**
Tracker marks unanswered messages as follow-up **due** → owner opens the dashboard and approves → next `outreach send` sends them in the same thread.

**J4. Something goes wrong**
Bounce rate passes 5% → tracker sets the pause flag and alerts → owner reviews addresses on the dashboard → clears the pause.

## Features

| Feature | Runs on |
|---|---|
| Requirement analysis (category → synonyms, sub-types, review topics) | PC |
| Brand discovery: SearXNG, open data, owner CSV; dedupe by domain | PC |
| Brand classification and tiering with a local LLM | PC |
| Contact crawl with evidence and MX check | PC |
| Scoring and ranking | PC |
| Master template, versioned; per-brand rendered drafts with optional hook | PC renders, owner edits on dashboard |
| Approval by exact content hash | Dashboard |
| Sending over SMTP with caps, ramp, delay, cooldown, kill switch | PC, gated by the tracker |
| Inbox watcher: replies, bounces, auto-replies, opt-outs | Tracker |
| Suppression list (email and domain) | Tracker |
| Follow-up due flags; in-thread follow-up sending | Tracker flags, PC sends |
| Phone alerts | Tracker (ntfy) |
| Dashboard: brands, drafts, approvals, conversations, settings, health | Tracker |
| `outreach start` / `outreach handoff` checks | PC |
| Backups and export | Tracker, pulled to PC |

## In scope

- Single owner, one outreach mailbox, reached over IMAP/SMTP.
- Any product category, without code changes per category.
- India and international brands.
- The v0 starter kit (`apps-script/`, `discovery/`) as a quick start until v1 replaces it.

## Out of scope

- Multi-user, teams, SaaS hosting, billing.
- Autonomous sending or AI replies sent without approval.
- Guessed email addresses, bought contact lists, people-data enrichment.
- Several mailboxes or account rotation to get around limits.
- Open/click tracking pixels.
- Self-hosted mail server for sending.
- Proprietary services as required parts (they may exist only as optional adapters).

## Success criteria

- Discovery finds at least 80% of a hand-made 15-brand list per category.
- At least 95% of reported emails appear on the cited page.
- Zero sends without approval and zero sends to suppressed addresses, enforced by tests.
- With the PC off, a reply shows on the dashboard and as a phone alert within 15 minutes.
- Every required dependency passes the CI license check.
- Running cost ₹0 a month.
