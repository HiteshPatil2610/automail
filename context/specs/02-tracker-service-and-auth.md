# Spec 02: Tracker service and authentication (M1)

**Status:** Not started · **Milestone:** M1 · **Depends on:** spec 01

## Feature purpose

Stand up the always-on **tracker** as a running service with its database, health reporting, and the two ways in: an **API token** for the PC client and a **password login** for the owner's dashboard. Later features (sending, inbox watching, discovery uploads) plug into this.

## Requirements

1. `outreach-tracker serve` starts FastAPI with Uvicorn, bound to a configurable host (default `127.0.0.1`; in deployment the WireGuard address) and port 8000.
2. SQLite database at a configurable path, `journal_mode=WAL`, `foreign_keys=ON`, managed by Alembic. The first migration creates every table in [architecture.md](../architecture.md#database-models) (empty tables are fine).
3. `outreach-tracker init` creates the database, runs migrations, and creates the owner account by prompting for a username and password (input hidden; minimum 12 characters). Passwords are hashed with Argon2id (`argon2-cffi`, MIT).
4. Dashboard auth: `/login` and `/logout`; session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` when served over HTTPS); 7-day expiry; CSRF token on every POST form; lockout for 15 minutes after 10 failed logins.
5. API tokens:
   - `outreach-tracker token create --name pc` prints a random 256-bit token **once** and stores only its SHA-256 hash.
   - `outreach-tracker token list` and `token revoke <name>`.
   - API requests use `Authorization: Bearer <token>`; constant-time comparison.
6. Permission split (enforced by FastAPI dependencies):
   - `require_owner` (session) for dashboard routes and owner-only API actions (approve, clear pause, remove suppression).
   - `require_client` (token) for PC endpoints.
   - A token can never call owner-only actions.
7. `GET /api/v1/health` (token or session) returns `api_version`, database status, and the heartbeat table contents. An unauthenticated `GET /healthz` returns only `{"ok": true}` for uptime checks.
8. Dashboard shell following [ui-context.md](../ui-context.md): layout, sidebar, light/dark tokens, Overview page with placeholder tiles, Health page listing tokens and heartbeats.
9. Every login, logout, token create and token revoke writes an `audit_log` row.
10. PC side: `outreach config set tracker-url …` and `outreach config set-token` (stored with `keyring`), and `outreach status`, which calls `/api/v1/health` and prints the result.

## User flow

1. On the tracker: `outreach-tracker init` → set owner password → `outreach-tracker token create --name pc` → copy the token.
2. `outreach-tracker serve` (later as a systemd service).
3. On the PC: `outreach config set tracker-url http://10.8.0.1:8000` → `outreach config set-token` (paste) → `outreach status` shows "Tracker OK, API v1".
4. In a browser: open the tracker URL → login → Overview → Health shows the `pc` token and its last-used time.

## UI behavior

- Login page: centred card, username, password, submit; error "Wrong username or password" (never says which); lockout message shows minutes remaining.
- After login, redirect to the originally requested page.
- Health page: tokens table (name, created, last used, revoke button with confirm dialog), heartbeats table (empty for now with an explanatory empty state).
- Logout from the sidebar footer.
- Session expiry redirects to login with "Your session expired".

## Data changes

- Alembic migration `0001_initial`: all tables from the architecture model list, including `users` (username, password_hash, failed_attempts, locked_until) and `api_tokens` (name unique, token_hash, created_at, last_used_at, revoked_at).
- `settings` seeded with defaults: daily cap 10, step 5, ceiling 30, delay 45 s, cooldown 60 days, follow-up 7 days, close 14 days, bounce pause 5%, paused false.

## Permissions

| Action | Owner session | PC token | Unauthenticated |
|---|---|---|---|
| Dashboard pages | ✓ | ✗ | redirect to login |
| `/api/v1/health` | ✓ | ✓ | 401 |
| `/healthz` | ✓ | ✓ | ✓ (minimal body) |
| Create or revoke tokens | CLI on tracker only | ✗ | ✗ |
| Owner-only API actions | ✓ | 403 | 401 |

## Edge cases

- `init` run twice: refuses to overwrite the owner and suggests `outreach-tracker reset-password`.
- Revoked token in use: 401 with code `token_revoked`; `outreach status` explains how to set a new one.
- Database file missing or read-only: `serve` exits with a clear message instead of creating an empty database silently.
- Clock skew between PC and tracker: the server sets all timestamps; client times are ignored.
- Many concurrent requests: SQLite busy timeout 5 s; writes are short transactions.

## Acceptance criteria

- [ ] `outreach-tracker init` + `serve` work on Windows and on Linux arm64 (container or venv).
- [ ] Login, logout, lockout and CSRF behave as specified.
- [ ] Token create shows the token once; only the hash is in the database.
- [ ] A token request to an owner-only endpoint returns 403.
- [ ] `outreach status` on the PC prints tracker health using the stored token.
- [ ] Every auth event is in `audit_log`.
- [ ] Dashboard shell passes the checks in [ui-context.md](../ui-context.md#accessibility) at desktop and phone width, light and dark.
- [ ] Progress tracker updated with results.

## Test plan

| Test | Level |
|---|---|
| Password hashing and verification; minimum length | unit |
| Lockout after 10 failures, unlock after 15 min (clock faked) | unit |
| Token generation entropy and hash-only storage | unit |
| `require_owner` / `require_client` matrix for every route (parametrised) | integration (`TestClient`) |
| CSRF: POST without token is rejected | integration |
| Migration upgrade on an empty database; downgrade not supported (documented) | integration |
| `outreach status` against a test server | integration |
| Manual: run on an arm64 machine or emulator; check the dashboard on a phone | manual, recorded in progress tracker |
