# OutreachAI starter kit (free)

Two parts:

| Part | What it does | Runs where |
|---|---|---|
| `discovery/discover.py` | Finds brands for a product type, opens their own websites, pulls the published contact email (or form, creator program and social links), checks the MX record, ranks them, and writes a CSV | Your PC (Python) |
| `apps-script/Code.gs` | Turns a Google Sheet into the outreach tool: previews each email, sends only the rows you approve, daily cap with a slow ramp, one follow-up in the same thread, reply, bounce and opt-out detection, kill switch | Inside your Google account |

Cost: ₹0. Gemini free tier for brand search and classification, Gmail through Apps Script (no Google Cloud project, no OAuth app, no weekly reconnect).

---

## 1. Set up the Google Sheet (10 minutes)

1. Use a **separate Gmail for the channel** (for example `yourchannel.collabs@gmail.com`). Sign in with it.
2. Create a new Google Sheet and name it something like `OutreachAI`.
3. **Extensions > Apps Script**. Delete the sample code and paste in all of `apps-script/Code.gs`.
4. In the Apps Script editor, click **Project Settings** (gear icon), tick **Show "appsscript.json" manifest file in editor**, then open `appsscript.json` and replace it with `apps-script/appsscript.json`. This turns on the Gmail service used for follow-ups and sets the time zone to India.
5. Save, go back to the sheet and reload it. An **OutreachAI** menu appears.
6. **OutreachAI > 1. Set up sheets**. Google asks you to authorize. You will see "Google hasn't verified this app": it is your own script, so click **Advanced > Go to project**. Then run the menu item again.
7. Fill in the **Settings** tab: Your Name, Channel Name, Channel Link, Sample Video.
8. Read the **Template** tab and edit it to sound like you. Placeholders like `{{Brand}}` match any Brands column or Settings name. Every placeholder must have a value or that row will not preview, except `{{Hook}}`, which may be empty.

## 2. Find brands (Python)

```bash
cd discovery
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
crawl4ai-setup
```

`crawl4ai-setup` downloads a headless Chromium browser (a few hundred MB, one time).

Get a free Gemini API key at https://aistudio.google.com/apikey, then:

```bash
set GEMINI_API_KEY=your-key-here
python discover.py "mechanical keyboard" --max-brands 60
```

Useful options:

- `--seed my_brands.csv`: add brands you already know (columns `name,website`, see `seeds_example.csv`).
- `--no-llm`: no Gemini at all, just crawl the brands in `--seed`.
- `--include-tier-c`: keep marketplace and white-label sellers (hidden by default).
- `--llm-delay 7`: seconds between Gemini calls. Raise it if you hit rate limits.

The run takes a while (roughly 10–30 minutes for 60 brands), mostly because it spaces out Gemini calls to stay inside the free limits.

The output, for example `brands_mechanical_keyboard.csv`, is sorted best-first. Columns:

- **Email / Contact Source**: an address found on the brand's own site, and the page it was on. Nothing is guessed.
- **Email Check**: `MX ok` means the domain accepts mail. It does not prove the mailbox exists.
- **Other Channels**: contact forms, creator/affiliate program pages and socials. Rows without an email need you to act by hand.
- **Tier**: A = established, B = smaller or newer, C = marketplace or white-label.
- **Hook**: one sentence about the brand, written by the AI from its website. **Check every hook before approving.** Delete any that are wrong or bland.

## 3. Send

1. Open the CSV, select everything **except the header row**, copy, and paste into the **Brands** tab at cell A2. The first 12 columns line up.
2. Delete rows you don't want. Fill in any blank **Product Line** cells (needed by the template).
3. **OutreachAI > 2. Build previews**. Each row gets the exact subject and body that would be sent.
4. Read the previews. Tick **Approved** on the ones to send.
5. **OutreachAI > 3. Send approved batch now**. It shows the list and asks you to confirm.
6. Optional: **Turn on daily automation**. Every day at the Send Hour it checks replies, sends due follow-ups, then sends approved emails up to the daily cap. It also checks replies every 6 hours.

**Before real brands, test it:** add a row with your own personal email address, build a preview, approve it, send, reply from your personal account, then run **Check replies and bounces**.

## How the safety rules work

| Rule | How |
|---|---|
| Only approved text is sent | The script sends the stored preview. If the template or row changed, the row becomes `stale` and the approval is cleared. Build previews again and re-approve |
| Daily cap with slow ramp | 10/day in week 1, +5 each week, up to 30 (all in Settings). Follow-ups count toward the cap |
| One email per brand | No second first-email to the same website domain within 60 days |
| Opt-outs | Replies containing "unsubscribe", "remove me", "stop emailing" and similar add the brand's domain to **Suppression**. Add declines by hand |
| Bounces | Bounced addresses are suppressed. If bounces reach 5% of the last 20 sends, sending pauses |
| Kill switch | **Pause all sending** in the menu, or set `Paused` to TRUE in Settings |
| No duplicate sends | A row is marked `sending` before Gmail is called. If a row is ever stuck there, check your Sent folder and fix its Status by hand |
| Follow-ups | One follow-up after 7 days, in the same Gmail thread, only if they haven't replied. Rows close 14 days later |

## Status values in the Brands tab

`preview` → `sent` → `followed_up` → `closed`, or `replied` / `opted_out` / `bounced` at any point.
Rows that cannot be sent show `needs: …` (missing info), `blocked: suppressed`, `blocked: brand cooldown`, `stale` or `error: …`.

## Limits to know

- Apps Script runs for at most 6 minutes per run. The script stops at about 4.5 minutes and continues on the next run.
- Reply detection reads Gmail threads. Read the actual replies in Gmail, and set Status to `interested`, `declined` and so on by hand if you like.
- Opt-out detection is a keyword match. It can miss polite declines, so add those domains to **Suppression** yourself.
- Free Gemini limits change. Check them in Google AI Studio if runs start failing.
