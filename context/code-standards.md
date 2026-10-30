# Code standards

Applies to v1 code under `src/outreach/`. The v0 kit (`apps-script/`, `discovery/`) keeps its current style until it is replaced.

## Naming conventions

| Thing | Style | Example |
|---|---|---|
| Packages, modules | `snake_case` | `outreach.tracker.watcher` |
| Functions, variables | `snake_case`, verbs for functions | `reserve_message()`, `content_hash` |
| Classes, Pydantic models, enums | `PascalCase` | `DraftOut`, `MessageState` |
| Enum values | `snake_case` strings | `MessageState.opted_out = "opted_out"` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_DAILY_CAP` |
| DB tables | plural `snake_case` | `inbound_events` |
| API paths | plural nouns, kebab-case; actions as `:verb` | `/api/v1/follow-ups`, `/api/v1/messages:reserve` |
| CLI commands | short verbs | `outreach discover`, `outreach handoff` |
| Templates | `snake_case.html`, partials prefixed `_` | `_brand_row.html` |
| Tests | `test_<unit>_<behaviour>` | `test_reserve_rejects_suppressed_domain` |

Use the domain words from [architecture.md](architecture.md) consistently: brand, channel, evidence, draft, approval, message, inbound event, follow-up, suppression.

## Code organization

- One package, `outreach`, with two entry points: `outreach` (PC CLI) and `outreach-tracker` (server).
- `core/` holds pure logic with no I/O: rendering, hashing, cap maths, matching rules, classifiers. Most tests live here.
- I/O sits at the edges: `db/`, `client/`, `sender/`, `tracker/watcher/`, `discovery/` collectors.
- PC-only code must never import `tracker/`, and tracker code must never import `sender/` (enforced by an import-linter rule in CI).
- Configuration through one typed `Settings` object (pydantic-settings), read from env and an optional `outreach.toml`. No scattered `os.environ` lookups.
- Functions do one thing; keep modules under ~400 lines.

## Type safety

- Full type hints everywhere. `mypy --strict` must pass in CI.
- SQLAlchemy 2 typed models (`Mapped[...]`, `mapped_column`).
- Enums for every state and type field; never bare strings in logic.
- Use `datetime` with `tzinfo=UTC` only. Naive datetimes are a bug.
- No `Any` except at JSON boundaries, where it is validated immediately.

## Validation

- Every API request and response body is a Pydantic v2 model. Use `extra="forbid"` on inputs.
- Every LLM output is parsed into a Pydantic model; on failure, retry once with the validation error, then mark the item `needs review`. Never guess.
- Email addresses are normalised (strip, lowercase) before any comparison or storage. Domains are reduced to the registrable domain with `tldextract`.
- Templates are validated on save: unknown placeholders and missing required ones (`Your Name`, `Channel Link`, opt-out line) are errors.
- Web and email content is treated as untrusted. Strip control characters and cap lengths before storage or prompting.

## Error handling

- Raise specific exceptions from `outreach.core.errors` (for example `SuppressedRecipient`, `ApprovalStale`, `CapReached`, `TrackerUnavailable`). Don't raise bare `Exception`.
- Catch exceptions only where you can act on them: retry, mark state, or show the user something. Never silently `pass`.
- Network calls have timeouts and bounded retries with backoff. The sender **does not retry** an SMTP send whose result is unknown; it marks the message `unknown`.
- Logs are structured (JSON on the tracker) with an `event` name and IDs. Never log secrets, full email bodies or app passwords.
- Fail closed: if a safety check can't run, the action does not happen.

## API conventions

- Base path `/api/v1`. JSON only. UTF-8.
- `GET` lists support `?limit=&cursor=` and return `{ "items": [...], "next_cursor": "..." }`.
- Writes from the PC send an `Idempotency-Key` header; the server stores and replays the first result for 24 hours.
- Error shape: `{ "error": { "code": "suppressed_recipient", "message": "...", "id": "err_..." } }` with the right HTTP status (400 validation, 401/403 auth, 404, 409 conflict or stale, 423 paused, 429 cap reached, 503 tracker unhealthy).
- Times in ISO 8601 UTC with `Z`.
- Breaking changes need `/api/v2`; the CLI checks `/api/v1/health` for a compatible `api_version`.

## Database changes

- Every schema change is an **Alembic migration**. Never edit the database by hand and never change an applied migration.
- Migrations are forward-only in production. Each one is tested by upgrading a copy of a real backup.
- Enable `PRAGMA journal_mode=WAL` and `foreign_keys=ON` on every connection.
- Destructive migrations (drop or rename) need a spec entry and a backup step in the release notes.
- `Suppression` and `AuditLog` rows are never deleted by code paths other than the explicit owner "delete all data" command.

## Testing

| Level | Tool | What |
|---|---|---|
| Unit | pytest | `core/`: rendering, hashing, cap ramp, cooldown, matching, classifiers, normalisation |
| Integration | pytest + temp SQLite + FastAPI `TestClient` | API endpoints, reservation transaction, auth |
| Email | `aiosmtpd` (Apache-2.0) as a fake SMTP server; saved `.eml` fixtures for IMAP parsing (replies, DSNs, auto-replies, Gmail formats) | Sending and tracking without touching real mailboxes |
| Discovery | Recorded HTML fixtures | Contact extraction, Cloudflare email decoding, program and form detection |
| Safety | Dedicated test module `tests/safety/` | One or more tests per invariant in [docs/01](../docs/01-goals-and-principles.md#safety-invariants) |

- Tests never send real email and never call real search engines, websites or LLMs. Live checks are manual and recorded in [progress-tracker.md](progress-tracker.md).
- New behaviour comes with tests; bug fixes come with a test that failed before the fix.
- CI runs `ruff check`, `ruff format --check`, `mypy --strict`, `pytest`, and the license check on every push.
