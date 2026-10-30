# 8. Licensing and compliance

*Technical guidance, not legal advice.*

## Project license

**The repository has no LICENSE file yet. Until it has one, it is not legally open source**: by default nobody may reuse the code, even though it is public. Adding a license is the first item on the [roadmap](09-roadmap.md).

| License | Effect | Fit |
|---|---|---|
| **Apache-2.0 (recommended)** | Permissive; explicit patent grant; NOTICE file for attributions | Matches most dependencies, including Crawl4AI's base license, and has a natural place for its required attribution |
| MIT | Permissive and shortest | Fine, but no patent grant and no NOTICE convention |
| AGPL-3.0 | Anyone who runs a modified version as a network service must publish their changes | Choose this if you want to stop closed SaaS forks; it can put off some contributors |

Recommendation: **Apache-2.0** with a `NOTICE` file.

## Dependency licenses and duties

| Dependency | License | Duty for us |
|---|---|---|
| Crawl4AI | Apache-2.0 + attribution clause | **Must** show: "This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project" in the README or NOTICE, and ideally in `outreach --help`. **v0 does not do this yet** |
| SearXNG | AGPL-3.0 | We run it unmodified as a separate service, so no source-sharing duty arises. If we ever modify and expose it, we publish the changes |
| Ollama | MIT | Keep the notice if we bundle it (we don't) |
| Qwen3 / Granite models | Apache-2.0 (verify each model card) | Note the model and its license in the docs; we don't ship the weights |
| FastAPI, Typer, Pydantic, APScheduler, BeautifulSoup, Jinja2 | MIT / BSD | Notices in NOTICE or third-party file |
| IMAPClient, flufl.bounce, email-reply-parser, dnspython, tldextract | BSD / Apache / MIT / ISC (verify each) | Same |
| WireGuard, Podman, ntfy | GPL-2.0 / Apache-2.0 / dual | We don't distribute them; users install them |

Add an automated license check in CI, for example `pip-licenses` (MIT), and fail the build if a non-OSI license appears in required dependencies.

**Excluded because they are not OSI open source:** n8n (Sustainable Use License), NocoDB (since January 2026), Docker Desktop (proprietary; Docker Engine is fine), Llama-family models with community licenses. Gemini, Google Sheets and Apps Script may exist only as optional adapters.

## Outreach rules the software enforces

| Requirement | Where it is enforced |
|---|---|
| Collect only business contacts published by the brand, with the source recorded | Discovery stage 6; `evidence` table |
| Identify yourself and your channel in every email | Template validation: required placeholders `{{Your Name}}`, `{{Channel Link}}` |
| Clear opt-out in every email, honoured immediately and permanently | Template must contain an opt-out line; `List-Unsubscribe` header; opt-out → domain suppression |
| Low volume, individual messages | Caps, one recipient per message, approval per draft |
| No deceptive content | No invented facts (invariant 2); hooks grounded in stored page text |
| Disclosure of free or loaned products in videos | Template mentions disclosure; follow India's ASCI influencer guidelines and the rules where you publish |
| Data subject requests | Export and delete commands; suppression kept even after deletion |
| Audit trail | Append-only `audit_log` |

## Regional laws to be aware of

International outreach can touch the **GDPR** and **PECR** (EU and UK), **CAN-SPAM** (US), **CASL** (Canada) and India's **Digital Personal Data Protection Act, 2023** and its Rules. Individual, relevant, low-volume business-to-business emails with honest identity and a working opt-out are the lowest-risk pattern. Laws differ, though. CASL in particular is stricter about consent for commercial messages. Get advice before scaling beyond personal use.
