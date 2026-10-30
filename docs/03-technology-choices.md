# 3. Technology choices

Each section lists the options considered, their licenses, and the decision. Licenses were checked on 30–31 October 2026. Some come from secondary sources, marked **verify**. Confirm against each project's LICENSE file before release.

## Summary

| Component | Decision | License | Runs on |
|---|---|---|---|
| Language | Python 3.12 | PSF | both |
| CLI | Typer | MIT | PC |
| Web search | SearXNG (self-hosted) | AGPL-3.0 | PC |
| Crawler | Crawl4AI + Playwright Chromium | Apache-2.0 **plus attribution clause** | PC |
| HTML parsing | BeautifulSoup | MIT | PC |
| Local LLM runtime | Ollama | MIT | PC |
| Local model | Qwen3 8B (Q4), fallback IBM Granite 8B | Apache-2.0 (verify per model card) | PC |
| Structured output | Ollama `format` = JSON schema from Pydantic | MIT (Pydantic) | PC |
| DNS / MX checks | dnspython | ISC | PC |
| Sending | Python `smtplib` over SMTP submission (port 587 STARTTLS / 465) | PSF | PC |
| Tracker API | FastAPI + Uvicorn | MIT / BSD-3 | tracker |
| Database | SQLite (WAL mode) via SQLAlchemy 2 + Alembic | Public domain / MIT | tracker |
| Dashboard | Jinja2 + HTMX | BSD-3 / BSD-2 (0BSD in newer releases, verify) | tracker |
| Scheduler | APScheduler | MIT | tracker |
| IMAP | IMAPClient | BSD-3 (verify) | tracker |
| Bounce parsing | flufl.bounce | Apache-2.0 (verify) | tracker |
| Reply text extraction | email-reply-parser (Zapier port) | MIT | tracker |
| Phone alerts | ntfy (self-hosted) | Apache-2.0 / GPL-2.0 dual (verify) | tracker |
| Private network | WireGuard | GPL-2.0 (kernel) / MIT (tools) | both + phone |
| Containers | Podman (or Docker Engine in WSL2) | Apache-2.0 | PC |

## Decision records

### D1. Tracker data store: SQLite behind a FastAPI service

| Option | License | For | Against |
|---|---|---|---|
| **SQLite + FastAPI (chosen)** | Public domain + MIT | One Python codebase you already know (Flask/FastAPI); tiny RAM; one-file backups | We write the API ourselves |
| PocketBase | MIT | Single binary with REST, auth, admin UI and realtime built in | Go/JS hooks, a second language; still pre-1.0 with no compatibility guarantee; single maintainer |
| PostgreSQL | PostgreSQL License | Robust and concurrent | Overkill for one user; more RAM and admin |
| Grist (grist-core) | Apache-2.0 | A real spreadsheet UI with an API, the closest thing to Google Sheets | Loads whole documents into RAM; heavier; logic split between sheet formulas and code |
| Baserow | MIT core (premium/enterprise directories under separate terms) | Airtable-like UI | Heavy stack (Postgres, Redis, Django) for a free VM |
| NocoDB | Sustainable Use License since 9 January 2026 | — | **Excluded**: no longer OSI open source |

Write volume is tiny (a few hundred rows a day), so SQLite in WAL mode is plenty. The schema and all safety checks live in our own code, where they can be tested.

### D2. Workflow automation: plain Python, no low-code platform

| Option | License | Verdict |
|---|---|---|
| **Python + APScheduler (chosen)** | MIT | Jobs are few and simple. Code is testable and versioned |
| n8n | Sustainable Use License | **Excluded**: not OSI open source |
| Activepieces | MIT core (`packages/ee` separate) | Possible later for extra integrations; not needed for the core |
| Windmill | AGPL source, Community Edition image; licensing reported inconsistently (verify) | Not needed |
| Huginn, Node-RED | MIT / Apache-2.0 | Not needed |

### D3. Brand search: SearXNG on the PC, not the server

SearXNG is a self-hosted metasearch engine (AGPL-3.0).

- JSON output is **off by default**. Add `json` to `search.formats` in `settings.yml` and restart.
- For a private instance used only by your scripts, set `limiter: false`.
- Search engines often block data-centre IPs. One hands-on test got zero usable Google results from a server IP. Running SearXNG **on your PC uses your home connection**, which is far less likely to be blocked at a few hundred queries per run.
- Enable only the engines that work from your connection (for example Bing, DuckDuckGo, Brave, Mojeek, Startpage), and keep the request rate low.

There's no truly open search index with good coverage of small brands, so SearXNG is supplemented with open data and your own lists (see [Discovery](06-discovery-pipeline.md)).

### D4. Crawler: Crawl4AI (keep from v0)

Apache-2.0 **with an added attribution requirement**. Every distribution or public use must credit it with this statement: *"This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project"*. The credit must be in a prominent place (NOTICE, README, credits page or CLI help). It's in the README and `NOTICE` (added 2026-10-31). v1 also adds it to `outreach --help`.

It renders JavaScript (many Shopify brand sites need this), honours `check_robots_txt`, and caches pages. Plain `httpx` is a lighter fallback for static sites.

### D5. Local LLM: Ollama + an Apache-2.0 model

- **Ollama** (MIT) runs natively on Windows with the GPU. **Structured outputs** take a JSON schema in the `format` field. Pydantic models generate the schema. Self-hosted Ollama enforces it with grammar-constrained decoding. (Ollama Cloud does not support structured outputs; we don't use it.)
- **Model:** **Qwen3 8B** at Q4 (about 5 GB VRAM, Apache-2.0) as the default. **IBM Granite 8B** (Apache-2.0, about 4.6 GB at Q4) as an alternative. One 2026 source lists a "Gemma 4 12B" under Apache-2.0; earlier Gemma releases used Google's own terms, so **verify** before using it.
- Avoid models with custom "community" licenses (for example Llama) if strict OSI compliance matters to you.
- Use temperature 0 for classification, validate with Pydantic, and retry once on failure.
- The LLM is used only for: requirement analysis, brand classification (type, tier, sells the category?), product line and hook extraction from page text, and optionally reply classification. Contact extraction is plain code.

### D6. Email access: SMTP and IMAP with an app password, not the Gmail API

| Option | For | Against |
|---|---|---|
| **IMAP/SMTP with app password (chosen)** | Open standards, works with any provider; no Google Cloud project; no OAuth consent screen | An app password gives full mailbox access, so use a dedicated outreach account; it needs 2-Step Verification, and Advanced Protection accounts cannot use it |
| Gmail API + OAuth | Narrow scopes (`gmail.send`, `gmail.readonly`) | Vendor-specific; in "Testing" status refresh tokens expire after 7 days; production status for Gmail scopes may need verification; unverified apps are capped at 100 users |
| IMAP/SMTP with OAuth2 (XOAUTH2) | Standards plus no stored password | Same Google Cloud and OAuth hassles as the Gmail API |

As of mid-2026, `smtp.gmail.com` (587/465) and IMAP still accept app passwords for personal accounts. Password-only "less secure apps" access ended on 30 September 2024. Keep an OAuth2 (XOAUTH2) adapter on the roadmap in case Google retires app passwords. Because every connection uses standard IMAP/SMTP, moving to another provider is a config change.

### D7. Tracker hosting

See [Deployment](07-deployment-and-security.md#where-the-tracker-runs). In short: an **Oracle Cloud Always Free ARM VM** (now 2 OCPU / 12 GB per Oracle's docs) **or a home device** (Raspberry Pi or old laptop). GitHub Actions cron was rejected: in public repos scheduled workflows are disabled after 60 days without repository activity, and it has no persistent state.

### D8. Private network: WireGuard

The tracker's API and dashboard are **never exposed to the public internet**. The PC, tracker and phone join a WireGuard network (open source, built into Linux, official Windows/Android/iOS clients). Tailscale is easier, but its coordination server is proprietary; Headscale (an open-source coordination server) is the fully open alternative if plain WireGuard is too fiddly.

### D9. Alerts: ntfy

Self-hosted ntfy on the tracker pushes "Keychron replied" to your phone. It has open-source Android and web clients. Email-to-self alerts were rejected: they would mix with the inbox being tracked.

### D10. Project license: Apache-2.0 (decided 2026-10-31)

See [Licensing](08-licensing-and-compliance.md#project-license).

## Sources

- SearXNG JSON and limiter: [LiteLLM SearXNG docs](https://docs.litellm.ai/docs/search/searxng), [Elestio guide](https://blog.elest.io/give-your-ai-agent-private-web-search-self-host-searxng/), [Serpent hands-on test](https://apiserpent.com/blog/searxng-self-hosted-serp-api-tested) (vendor), [SSD Nodes](https://www.ssdnodes.com/learn/searxng-self-hosted-search), [Railway template](https://railway.com/deploy/searxng-open-source-search-api-for-ai-agents--searxng-search-api)
- Crawl4AI license: [LICENSE file](https://raw.githubusercontent.com/unclecode/crawl4ai/main/LICENSE), [Crawl4AI docs](https://docs.crawl4ai.com/)
- Airtable-style tools and licenses: [Rework: NocoDB alternatives](https://resources.rework.com/tools/project-management/best-nocodb-alternatives), [Elestio: NocoDB vs Baserow](https://blog.elest.io/nocodb-vs-baserow-which-open-source-airtable-alternative-should-you-pick/), [Grist self-managed docs](https://support.getgrist.com/self-managed), [Grist RAM thread](https://community.getgrist.com/t/high-ram-usage-when-working-with-large-documents/14057)
- PocketBase: [dev.co](https://dev.co/databases/open-source/pocketbase), [Railway](https://railway.com/deploy/pocketbase-firebas-1), [opentechhub](https://www.opentechhub.io/pocketbase/), [toolfreebie](https://toolfreebie.com/?p=318)
- Workflow tools: [jacar.es comparison](https://jacar.es/en/activepieces-windmill-vs-n8n-comparison/), [Elestio n8n vs Activepieces](https://blog.elest.io/n8n-vs-activepieces-which-self-hosted-automation-platform-in-2026/), [automationatlas](https://automationatlas.io/answers/activepieces-vs-n8n-open-source-2026/)
- Local models: [fungies.io rankings](https://fungies.io/best-open-source-llms-2026-benchmarks-comparison/), [bestllmfor 8 GB](https://bestllmfor.com/meilleur-llm/8gb-vram/), [PromptQuorum](https://www.promptquorum.com/local-llms/top-open-source-models-ollama)
- Ollama structured outputs: [Ollama docs](https://docs.ollama.com/capabilities/structured-outputs), [Ollama blog](https://registry.ollama.ai/blog/structured-outputs), [Pydantic AI Ollama](https://pydantic.dev/docs/ai/models/ollama/index.md), [Glukhov: Qwen3 structured output](https://www.glukhov.org/llm-performance/ollama/llm-structured-output-with-ollama-in-python-and-go/)
- Gmail access: [Google Workspace updates: less secure apps](https://workspaceupdates.googleblog.com/2023/09/winding-down-google-sync-and-less-secure-apps-support.html), [Nylas app password guide](https://cli.nylas.com/guides/gmail-app-password-setup.md), [Prospeo SMTP setup 2026](https://prospeo.io/s/setup-smtp-gmail), [Mailbird on OAuth changes](https://www.getmailbird.com/gmail-oauth-changes-app-password-phase-out/), [TechRadar: POP ending](https://techradar.com/pro/google-set-to-end-pop3-support-heres-what-we-know)
- OAuth testing-mode expiry: [Google Ads API common errors](https://developers.google.com/google-ads/api/docs/get-started/common-errors), [Google Health API setup](https://developers.google.com/health/setup)
- GitHub Actions schedule limits: [GitHub docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows), [Julia TagBot notice](https://discourse.julialang.org/t/ann-required-updates-to-tagbot-yml/49249)
