# Progress tracker

## Current goal

Finish **M0: open-source foundation** ([specs/01-open-source-foundation.md](specs/01-open-source-foundation.md)). The license part is done; the Python project skeleton and CI remain. Then start **M1: tracker service and auth** ([specs/02-tracker-service-and-auth.md](specs/02-tracker-service-and-auth.md)).

In parallel (owner, outside the code): send 20–30 emails with the v0 kit to measure real reply rates, and record one or two sample review videos.

## Completed work

| Date | Work | Verified how |
|---|---|---|
| 2026-10-30 | Reviewed the v1.1 implementation spec PDF; recommended a simpler, free approach | Review only |
| 2026-10-30 | v0 `apps-script/Code.gs` + `appsscript.json`: previews, approval, caps and ramp, cooldown, in-thread follow-up, reply, bounce and opt-out detection, suppression, kill switch | `node --check` syntax pass; helper logic unit-tested in Node (render, cap ramp, domains, opt-out regex, reply trimming). **Not run inside Google yet** |
| 2026-10-30 | v0 `discovery/discover.py`: Gemini brand search, Crawl4AI contact crawl, MX check, scoring, CSV | `--no-llm` run on 3, then 15 real keyboard brands: 10 published emails found in about 2 min. **Gemini path not tested** (no key) |
| 2026-10-30 | Discovery fixes: newsletter forms no longer counted as contact forms; duplicate and query-string links merged; product, blog, press and homepage links excluded from program links | Re-ran on the same 15 brands and inspected the output |
| 2026-10-30 | Pushed v0 kit to GitHub (`b76d201`) and the link-filter fix (`44e7a07`) | `git push` succeeded |
| 2026-10-31 | Design docs `docs/01`–`09` for the fully open-source v1 (two-node: PC + tracker) with web research | Cross-links checked by script |
| 2026-10-31 | `context/` folder: main context files and specs 01–03 | Cross-links checked by script |
| 2026-10-31 | Apache-2.0 `LICENSE` (official text), `NOTICE` with the Crawl4AI attribution, README license badge, Credits and License sections (spec 01, requirements 1–3) | LICENSE downloaded from apache.org, SHA-256 `cfc7749b…3d30` matches the standard text; attribution wording compared with Crawl4AI's LICENSE |

## In progress

| Item | State |
|---|---|
| Nothing in progress | — |

## Blockers

| Blocker | Impact | Owner action |
|---|---|---|
| Tracker host not chosen | Blocks M3 (deploy online) | Decide: spare home device vs Oracle Always Free |
| No real-world reply data | Unknown whether brands reply at all | Run the v0 kit on 20–30 brands |

## Decisions

| Date | Decision | Where |
|---|---|---|
| 2026-10-31 | Two nodes: PC does discovery, AI and sending; tracker only tracks and never sends | [docs/02](../docs/02-architecture.md) |
| 2026-10-31 | Tracker SQLite is the single source of truth; PC uses the API over WireGuard; fail closed | [docs/04](../docs/04-data-model-and-sync.md) |
| 2026-10-31 | IMAP/SMTP with app passwords instead of the Gmail API | [docs/03 D6](../docs/03-technology-choices.md) |
| 2026-10-31 | Replies matched by `Message-ID` / `In-Reply-To`, not Gmail thread IDs | [docs/05](../docs/05-email-sending-and-tracking.md) |
| 2026-10-31 | SearXNG runs on the PC (home IP), not the server | [docs/03 D3](../docs/03-technology-choices.md) |
| 2026-10-31 | Ollama + Qwen3 8B replaces Gemini as the default | [docs/03 D5](../docs/03-technology-choices.md) |
| 2026-10-31 | n8n, NocoDB, Docker Desktop excluded (not OSI open source) | [docs/03](../docs/03-technology-choices.md) |
| 2026-10-31 | Project license: Apache-2.0, confirmed by owner | [docs/08](../docs/08-licensing-and-compliance.md) |

## Testing results

| Date | Test | Result |
|---|---|---|
| 2026-10-30 | Apps Script syntax (`node --check`) | Pass |
| 2026-10-30 | Apps Script helper logic in Node (14 assertions) | Pass |
| 2026-10-30 | `discover.py --no-llm` on 15 keyboard brands | 15 crawled, 10 published emails (all MX ok), 3 no email (manual channels found), 2 sites didn't load |
| — | Apps Script inside Google (send, reply check, follow-up thread) | **Not run** |
| — | `discover.py` with Gemini | **Not run** |

## Next steps

1. Finish spec 01: `pyproject.toml` + `uv`, package skeleton, CI with lint, types, tests, import rules and license check, CONTRIBUTING / CODE_OF_CONDUCT / SECURITY, `.gitattributes`.
2. Confirm the copyright holder name in `NOTICE` ("Hitesh Patil and contributors").
3. Spec 02: tracker skeleton with database, API token and dashboard login.
4. Spec 03: first send-and-track slice using a fake SMTP server and `.eml` fixtures, then one live test to the owner's own second address.
5. Owner: run the v0 kit on a small real batch and record reply rates here.

## Dated session notes

### 2026-10-30
- Reviewed the OutreachAI v1.1 PDF. Recommended a simpler free stack (Sheets + Apps Script + Python discovery) and validating reply rates before building.
- Researched existing open-source tools (Google mail-merge sample, outreach-os, Crawl4AI, n8n templates).
- Built and pushed the v0 kit. Ran discovery locally on 15 keyboard brands; built a local preview page (kept outside the repo, in `../demo/`).
- Project moved to `E:\E\Projects\OutreachAI`; the `automail` repo was reconnected to GitHub there.

### 2026-10-31
- Owner asked for a fully open-source design with local heavy work and online tracking. Researched licenses, free hosting, Gmail access, IMAP tooling and local models; wrote `docs/` (10 files).
- Created this `context/` folder with real specs for M0–M2. No application code changed.
- Owner chose Apache-2.0. Added `LICENSE`, `NOTICE` and README credits; updated docs 03, 08 and 09 and spec 01 to match.
