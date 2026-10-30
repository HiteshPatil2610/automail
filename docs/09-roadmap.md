# 9. Roadmap

## Where the project is now (v0)

| Part | State | Open-source status |
|---|---|---|
| `apps-script/Code.gs` | Working code. Logic tested in Node; **not yet run in Google** | Our code is open, but it runs only on Google's proprietary Apps Script and Sheets |
| `discovery/discover.py` | Tested on 15 real keyboard brands with `--no-llm` (10 emails found, about 2 min). Gemini path untested | Crawl4AI is open; the default brand search uses Gemini (proprietary) |
| LICENSE | **Missing** | Not legally open source yet |
| Crawl4AI attribution | **Missing** | Required by Crawl4AI's license |

v0 stays useful as a **quick start** while v1 is built. Its code moves to `legacy/` when v1 reaches M4.

## Milestones (vertical slices)

| Milestone | Delivers | Done when |
|---|---|---|
| **M0. Open-source hygiene** | Apache-2.0 LICENSE, NOTICE with the Crawl4AI attribution, CONTRIBUTING, CODE_OF_CONDUCT, issue templates; CI with lint, tests and a license check | GitHub shows the license; CI is green |
| **M1. Tracker skeleton** | `outreach-tracker`: FastAPI + SQLite schema + Alembic, health endpoint, API token auth, minimal dashboard (login, brands table) | It runs on your PC and on an ARM VM from the same image |
| **M2. Email slice** | `outreach send` over SMTP with reservation and `Message-ID`; tracker IMAP watcher with IDLE + UID sync; reply matching by headers; ntfy alert | You send to your own second address, reply from it, and the dashboard shows "replied" with the PC **off** |
| **M3. Deploy online** | Tracker on Oracle A1 or a home device; WireGuard for PC, tracker and phone; backups; `outreach start` / `outreach handoff` | Shut down the PC, reply from a test inbox, get a phone alert within 15 min |
| **M4. Open discovery** | SearXNG + Ollama replace Gemini; checkpoints; Wikidata and CSV collectors; port v0's contact crawler; push to the tracker | A keyboard run with no proprietary service reaches 80% recall on the 15-brand test list |
| **M5. Safety completeness** | Bounces (flufl.bounce), auto-replies, opt-outs, `List-Unsubscribe`, suppression, cooldown, caps and ramp, bounce-rate pause, kill switch; restore drill | Every invariant in [Goals](01-goals-and-principles.md#safety-invariants) has a passing test |
| **M6. Follow-ups and review UX** | Due flags on the tracker, approval in the dashboard, in-thread sends from the PC; bulk review with keyboard shortcuts | A full campaign runs end to end on test inboxes |
| **M7. Second category** | Run "gaming monitor" with no code changes | Generality confirmed |
| **M8. Release 1.0** | Docs site, install guide for Windows + ARM tracker, demo video | Someone else installs it from the README alone |

A rough estimate is 6–9 weekends of part-time work. That's a planning figure, not a promise.

## Before writing more code (do these first)

1. Send 20–30 emails by hand or with the v0 kit to see whether brands reply at all.
2. Record one or two sample review videos and make a one-page media kit. These affect reply rates more than any feature.
3. Decide where the tracker runs: home device or Oracle.

## Open questions

| Question | Options | Decide by |
|---|---|---|
| Tracker host | Home device vs Oracle A1 vs AMD micro | M3 |
| Home-tracker networking | Port-forward WireGuard vs tracker dials out to PC | M3 |
| Project license | Apache-2.0 (recommended) vs AGPL-3.0 | M0 |
| Keep v0 Apps Script as an optional "Google adapter"? | Keep in `legacy/` vs delete | M4 |
| Reply classifier | Rules only vs a small local model on the tracker | M5 |
| App-password retirement risk | Add an XOAUTH2 adapter now vs when Google announces it | M2 |
| Wikidata usefulness for small brands | Measure recall gain in M4 | M4 |
| Multi-mailbox support | Not in v1 (no rotation to avoid limits) | — |
