# Spec 03: Send-and-track vertical slice (M2)

**Status:** Not started · **Milestone:** M2 · **Depends on:** specs 01 and 02

## Feature purpose

Prove the core loop end to end, on a small scale: the **PC sends** one approved email over SMTP using a `Message-ID` issued by the tracker, and the **tracker detects the reply** over IMAP with the PC switched off and alerts the owner. Discovery, follow-ups and bulk review come later; here brands and drafts are added by hand.

## Requirements

1. **Manual brand and draft** (dashboard): add a brand (name, website, email, evidence URL); pick the campaign's template version; render a draft; show the exact email with its short content hash.
2. **Approval** (dashboard, owner only): approve a draft, which stores `approved_hash = content_hash`. Editing the draft or template afterwards clears the approval automatically.
3. **Reservation** `POST /api/v1/messages:reserve` (token): in one transaction checks the approval hash, suppression (email and domain), cooldown, prior reply or opt-out, daily cap, pause flag and existing open reservation. On success it creates a `messages` row (`reserved`) with a new `rfc_message_id` and returns it. On failure it returns the error codes from [code-standards.md](../code-standards.md#api-conventions).
4. **Sender** (`outreach send`): fetch approved drafts → reserve → build a plain-text MIME message with the reserved `Message-ID`, `From`, `To`, `Subject`, `Date` and `List-Unsubscribe: <mailto:…?subject=unsubscribe>` → `markSending` → SMTP submit (STARTTLS 587) → `markSent` or `markFailed`. On a timeout, mark `unknown` and stop. Delay between sends per settings. Fail closed if the tracker is unreachable.
5. **SMTP credential** stored with `keyring` on the PC (`outreach config set-smtp`). Never in files or logs.
6. **Inbox watcher** (tracker, `outreach-tracker watch` or inside `serve`): IMAPClient login with the tracker's app password; select INBOX read-only; IDLE renewed every 10 min; UID sync every 15 min with the stored `uidvalidity` and last UID; reconnect with backoff.
7. **Matching**: strong match when `In-Reply-To` or `References` contains a stored `rfc_message_id`. Store an `inbound_events` row (dedupe by the inbound `Message-ID`), set the message state to `replied`, keep a 500-character snippet with quoted history stripped (email-reply-parser).
8. **Auto-reply guard**: messages with `Auto-Submitted` other than `no`, `X-Autoreply`, or `Precedence: auto_reply` are stored as `auto_reply` and **do not** change the message to `replied`.
9. **Heartbeat** row `watcher` updated after each successful sync. Overview shows a red banner if it is older than 30 minutes.
10. **Alert**: on a matched reply, publish to the configured ntfy topic: "{Brand} replied". If ntfy isn't configured, skip silently but log it.
11. **Conversations page** lists sent messages with state, sent time, reply snippet and time.

## User flow

1. Owner adds a test brand with **their own second email address** and evidence URL `manual`.
2. Owner renders and approves the draft on the dashboard.
3. On the PC: `outreach send` → "Sent 1 email (1 approved, cap 10)".
4. Owner turns the PC off.
5. From the second address, owner replies to the email.
6. Within 15 minutes: the phone gets "Test Brand replied"; the dashboard shows `replied` with the snippet.

## UI behavior

- Draft view: recipient, subject, body exactly as sent, short hash (first 8 hex characters), **Approve** button. After approval the button changes to "Approved ✓ (hash 1a2b3c4d)".
- Editing an approved draft shows "Editing will remove the approval" before saving.
- Conversations: table of brand, state pill, sent at, last event; the row opens a panel with the full snippet and headers summary.
- Overview tiles: "Sent today N / cap", "Replies", "Watcher: last sync N min ago".
- CLI `outreach send` prints each recipient with `✓ sent`, `✗ blocked: <reason>` or `? unknown`, then a summary line.

## Data changes

- Uses tables from spec 02. New migration only if fields are missing: `messages.idempotency_key` unique index, `inbound_events.rfc_message_id` unique index, `settings.imap_last_uid`, `settings.imap_uidvalidity`.
- New settings: `smtp_host`, `smtp_port`, `from_name`, `from_addr`, `imap_host`, `ntfy_url`, `ntfy_topic` (no secrets in settings).

## Permissions

| Action | Owner | PC token | Tracker jobs |
|---|---|---|---|
| Add brand, render, edit drafts | ✓ | render only | ✗ |
| Approve | ✓ | ✗ | ✗ |
| Reserve, mark sending, sent, failed or unknown | ✗ | ✓ | ✗ |
| Mark replied, store inbound events | override only | ✗ | ✓ |

## Edge cases

- Approval became stale between listing and reserving: reserve returns 409 `approval_stale`; the sender skips that draft.
- Recipient suppressed after approval: reserve returns `suppressed_recipient`; nothing is sent.
- Cap reached mid-run: reserve returns 429; the sender stops and reports how many are left.
- SMTP accepted but `markSent` failed (network drop): the message stays `sending`; the next `outreach start` or `send` reconciles it by searching Sent over IMAP for the `Message-ID` before doing anything else.
- SMTP timeout: `unknown`, same reconciliation; never blind-retry.
- Reply arrives from a different address at the brand: still a strong match via headers.
- Reply quoted without `In-Reply-To` (some clients): no strong match; stored as unmatched (weak matching is a later spec).
- `UIDVALIDITY` changed: resync the last 30 days, deduplicated by `Message-ID`.
- IMAP authentication fails: heartbeat status `auth_failed`, red banner, ntfy alert; `messages:reserve` returns 503 `tracker_unhealthy` so the PC fails closed.

## Acceptance criteria

- [ ] With the fake SMTP server, `outreach send` sends exactly the approved text with the reserved `Message-ID`.
- [ ] Each send-gate rule (approval hash, suppression email and domain, cooldown, cap, pause, prior reply, tracker unreachable) blocks sending in a test.
- [ ] Timeout and crash cases end in `unknown` and are reconciled, never duplicated.
- [ ] `.eml` fixtures: Gmail reply, Outlook reply, Apple Mail reply, out-of-office, and an unrelated email from the same domain are each handled correctly.
- [ ] Live check (owner-approved): send to the owner's second address, reply with the PC off, alert within 15 minutes, dashboard shows `replied`.
- [ ] No secret appears in logs, the database or the repository.
- [ ] Progress tracker records the live check result and date.

## Test plan

| Test | Level |
|---|---|
| MIME builder: headers, UTF-8 subject, plain text, `List-Unsubscribe`, one recipient | unit |
| `content_hash` and approval invalidation on edit | unit |
| Reservation transaction: every rule, concurrency (two reserves for one draft) | integration |
| Sender against `aiosmtpd` fake server: success, 4xx retry, 5xx failed, timeout → unknown | integration |
| Watcher against saved `.eml` fixtures through a fake IMAP layer | integration |
| Matching: `In-Reply-To`, `References` chain, auto-reply headers, unrelated same-domain mail | unit |
| Reconciliation of `sending` and `unknown` messages | integration |
| Live end-to-end with the owner's own two addresses | manual, owner-approved, recorded |
