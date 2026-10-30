# Architecture

Details and reasons: [docs/02-architecture.md](../docs/02-architecture.md), [docs/03-technology-choices.md](../docs/03-technology-choices.md), [docs/04-data-model-and-sync.md](../docs/04-data-model-and-sync.md).

## Technology stack

| Area | Choice | License |
|---|---|---|
| Language | Python 3.12 | PSF |
| Packaging | `uv` with `pyproject.toml` and a lock file | MIT/Apache |
| CLI (PC) | Typer | MIT |
| Search (PC) | SearXNG, self-hosted in Podman, JSON format enabled, limiter off | AGPL-3.0 (run unmodified) |
| Crawler (PC) | Crawl4AI + Playwright Chromium | Apache-2.0 + attribution |
| LLM (PC) | Ollama, native on Windows; model Qwen3 8B Q4 (Granite 8B fallback) | MIT; Apache-2.0 |
| HTML / DNS | BeautifulSoup, tldextract, dnspython | MIT, BSD-3, ISC |
| Sending (PC) | `smtplib` + `email.message.EmailMessage` | PSF |
| Secrets (PC) | `keyring` (Windows Credential Manager) | MIT |
| API (tracker) | FastAPI + Uvicorn, Pydantic v2 | MIT, BSD-3 |
| Database (tracker) | SQLite in WAL mode, SQLAlchemy 2 (typed ORM), Alembic | Public domain, MIT |
| Dashboard (tracker) | Jinja2 templates + HTMX, served by FastAPI; no JS build step | BSD-3, 0BSD/BSD-2 |
| Jobs (tracker) | APScheduler | MIT |
| Inbox (tracker) | IMAPClient (IDLE + UID sync), flufl.bounce, email-reply-parser | BSD-3, Apache-2.0, MIT |
| Alerts | ntfy, self-hosted | Apache-2.0/GPL-2.0 |
| Network | WireGuard between PC, tracker and phone | GPL-2.0/MIT |
| Tests and quality | pytest, ruff, mypy (strict), pip-licenses in CI | MIT |

**Not allowed** as required dependencies: anything not OSI-licensed (n8n, NocoDB, Docker Desktop, Llama-licensed models). Proprietary services only as optional adapters, off by default.

## Folder structure

Target layout for v1. Folders marked *(planned)* don't exist yet.

```
automail/
├── LICENSE, NOTICE                 (planned, M0) Apache-2.0 + third-party credits
├── pyproject.toml, uv.lock         (planned, M0)
├── context/                        working brief (this folder)
├── docs/                           design documents
├── apps-script/                    v0 Google Sheets kit; moves to legacy/ at M4
├── discovery/                      v0 discovery script; ported into src/ at M4
├── src/outreach/                   (planned)
│   ├── core/                       shared: settings, ids, hashing, rendering, rules, schemas
│   ├── db/                         SQLAlchemy models, session, Alembic migrations
│   ├── cli/                        Typer app: start, discover, send, handoff, export
│   ├── discovery/                  queries, collectors, classify, crawl, score
│   ├── sender/                     reservation client, MIME builder, SMTP
│   ├── client/                     typed HTTP client for the tracker API + offline outbox
│   └── tracker/
│       ├── api/                    FastAPI routers (/api/v1/...)
│       ├── web/                    dashboard routes, templates/, static/
│       ├── watcher/                IMAP IDLE + sync, matching, classifiers
│       └── jobs/                   follow-up due, close stale, backups, heartbeat
├── tests/                          (planned) unit/, integration/, fixtures/emails/
└── deploy/                         (planned) Containerfile, systemd units, wireguard examples
```

## System boundaries

| Boundary | Rule |
|---|---|
| PC ↔ tracker | HTTPS/HTTP over WireGuard only, API token in `Authorization: Bearer`. The PC **never** opens the SQLite file |
| Tracker → mailbox | IMAP read-only use: never sends, never moves or flags mail |
| PC → mailbox | SMTP to send; IMAP only to reconcile `unknown` messages in Sent |
| PC → internet | SearXNG queries and brand website crawls; robots.txt respected |
| Tracker → internet | IMAP (993) and ntfy push only |
| Secrets | SMTP credential lives only on the PC; IMAP credential only on the tracker |
| AI | The LLM gets page or email text as data. It can't trigger actions; outputs are schema-validated suggestions |

## Database models

Tracker SQLite. All IDs are UUIDv7 strings; times are UTC.

| Model | Key fields | Written by |
|---|---|---|
| `Campaign` | category, synonyms, review_topics, status | PC, owner |
| `Brand` | **domain (unique)**, name, website, country, brand_type, tier | PC, owner |
| `Candidate` | campaign_id, brand_id, scores, status, classification | PC, owner |
| `Channel` | brand_id, type (email/form/program/social), value, role, verification, is_primary | PC, owner |
| `Evidence` | channel_id, source_url, excerpt, fetched_at | PC |
| `TemplateVersion` | campaign_id, version, subject, body, follow_up_body (immutable) | owner |
| `Draft` | campaign_id, brand_id, channel_id, template_version_id, hook, subject, body, **content_hash** | PC renders, owner edits |
| `Approval` | draft_id, **approved_hash**, approved_at | owner |
| `Message` | draft_id, kind, **rfc_message_id (unique)**, to_addr, idempotency_key (unique), state, sent_at | PC (send states), tracker (tracking states) |
| `InboundEvent` | message_id, imap_uid, uidvalidity, rfc_message_id (unique), type, classification, snippet | tracker |
| `FollowUp` | message_id, due_at, state | tracker flags, owner approves, PC sends |
| `Suppression` | value, type (email/domain), reason | tracker, owner |
| `Setting` | key, value | owner, tracker (pause flag) |
| `AuditLog` | at, actor, action, entity, details (append-only) | all |
| `Heartbeat` | component, at, status | tracker |
| `ApiToken` | name, token_hash, created_at, revoked_at | owner |

Message states: `reserved → sending → sent | failed | unknown`, then `sent → replied | bounced | opted_out | closed`.

## Authentication and permissions

| Actor | How it authenticates | Allowed |
|---|---|---|
| Owner (dashboard) | Username + password (Argon2 hash), session cookie (HttpOnly, SameSite=Lax), CSRF token on every form | All dashboard actions; only the owner can create approvals and clear the pause flag |
| PC client | Bearer API token (random 256-bit, stored hashed, revocable) | `/api/v1/*` write endpoints for discovery, drafts and send states; **cannot** approve, clear pause, or remove suppressions |
| Tracker jobs | In-process | Tracking states, events, suppressions, follow-up flags, heartbeats |

All network access is inside WireGuard. The API binds to the WireGuard interface, not `0.0.0.0`.

## Integrations

| Integration | Protocol | Notes |
|---|---|---|
| Mailbox (Gmail by default) | SMTP 587 STARTTLS / 465; IMAP 993 | App passwords: one for the PC, one for the tracker; dedicated outreach account |
| SearXNG | HTTP JSON `GET /search?q=…&format=json` | Local container on the PC |
| Ollama | HTTP `POST /api/chat` with `format` = JSON schema | Native on the PC, `temperature 0` for classification |
| ntfy | HTTP publish to a private topic | On the tracker |
| Wikidata | SPARQL endpoint | Optional collector; IDs to confirm |
| Optional adapters | Gemini, Google Sheets | Off by default; never required |

## Core business rules

1. **Approval gate**: send only if `Approval.approved_hash == Draft.content_hash`. `content_hash = sha256(to_addr + "\n" + subject + "\n" + body)`.
2. **Reserve before send**: `POST /api/v1/messages:reserve` checks approval, suppression (email and domain), cooldown (60 days per brand domain), prior reply or opt-out, daily cap and pause flag in one transaction, and issues the `Message-ID`.
3. **Fail closed**: no tracker connection means no sending.
4. **One primary channel per brand per campaign.** One recipient per email, no CC or BCC.
5. **Daily cap** = min(start + step × weeks since first send, ceiling); defaults 10, +5, 30. Follow-ups count.
6. **Suppression**: a bounce suppresses the address; an opt-out suppresses the brand domain (or just the address for free-mail domains). Never auto-deleted.
7. **Bounce pause**: 5% or more of the last 20 sends sets the pause flag.
8. **Follow-ups**: at most one per message, due after 7 days with no reply, sent in-thread only after owner approval. Thread closes 14 days later.
9. **No guessed addresses**: every email channel has an `Evidence` row with the source URL.
10. **No invented facts** in templates or hooks; required placeholders must have stored values.
