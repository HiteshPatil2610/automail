# 1. Goals and principles

## Problem

A creator wants to ask many brands (keyboards, monitors, desks and so on) for review units. Doing it by hand means hours of searching for brands, digging for contact addresses, writing emails, and then remembering who replied, who bounced and who needs a follow-up.

## Goals

| Goal | Meaning |
|---|---|
| G1. Find brands for any product type | 30–150 genuine brands per category, ranked, each with the evidence behind it |
| G2. Find honest contact channels | Only addresses published on the brand's own pages, with the page recorded. Forms, creator programs and socials when there is no email |
| G3. Human-approved email | One master template, rendered per brand, and nothing is sent until you approve the exact text |
| G4. Heavy work on your own hardware | Crawling, AI and sending run on your PC (16 GB RAM, RTX 5060 8 GB) only when you choose |
| G5. Tracking without your PC | Replies, bounces, opt-outs and follow-up reminders keep updating when the PC is off |
| G6. Completely open source | See the definition below |
| G7. Free to run | No paid APIs or subscriptions. Free-tier hosting or a device you already own |

## Non-goals

- Multi-user SaaS, teams or billing.
- Fully autonomous outreach. A human always approves recipients and text.
- AI-written replies sent without review.
- Buying contact data, guessing addresses, or rotating accounts to get around limits.
- Open/click tracking pixels.
- Running your own mail server for sending. See [Email sending and tracking](05-email-sending-and-tracking.md#why-not-self-host-the-mail-server).

## What "completely open source" means here

Three layers, with different rules:

| Layer | Rule | Example |
|---|---|---|
| **Code we write** | Published under an OSI-approved license | This repository, under Apache-2.0 (see [Licensing](08-licensing-and-compliance.md)) |
| **Software we run** | Every required component is OSI-licensed. Source-available licenses (for example n8n's Sustainable Use License, or NocoDB since January 2026) do **not** count | SearXNG, Crawl4AI, Ollama, Qwen3, FastAPI, SQLite, IMAPClient, WireGuard |
| **Services we connect to** | Allowed only through **open standards**, so you can swap provider without code changes | Your mailbox over IMAP/SMTP (Gmail today, any provider tomorrow); a VM or home device for the tracker |

Proprietary services (Gemini, Google Sheets, Apps Script and so on) may exist as **optional adapters** that are off by default. The default install must work with none of them.

## Safety invariants

These rules hold in every version and every mode. Tests must cover each one.

1. **No send without approval.** A message goes out only if its recipient, exact rendered text (by hash), and batch have a stored approval. Any edit clears the approval.
2. **No invented facts.** Generated text uses only stored facts. It never claims subscriber counts, review experience, partnerships or brand policies that are not recorded.
3. **No guessed addresses.** Every email address has a source URL and an evidence excerpt from the brand's own site.
4. **Suppression wins.** Opt-outs, declines and bounces are checked immediately before every send. An opt-out from a brand suppresses its whole domain.
5. **Fail closed.** If the sender cannot reach the tracker to check suppression and reply state, it does not send.
6. **One brand, one contact, one campaign.** No emailing several people at one brand in a campaign. A cooldown blocks repeat first-emails to the same domain.
7. **Untrusted content is data.** Web pages and inbound emails are never treated as instructions to the AI or the system.
8. **Low volume.** Daily caps start at 10 and rise slowly. The system never rotates accounts to get around limits.
9. **Every send is auditable.** Who approved what, when, and exactly what was sent is kept in an append-only log.

## Success measures

- Discovery recall: at least 80% of a hand-made list of 15 known brands per category found automatically.
- Contact accuracy: at least 95% of reported emails appear on the cited page.
- Zero sends without approval, zero sends to suppressed addresses (enforced by tests).
- Tracking latency: a reply shows on the dashboard within 15 minutes while the PC is off.
- Running cost: ₹0 a month.
