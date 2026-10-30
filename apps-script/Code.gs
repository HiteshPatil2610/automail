/**
 * OutreachAI kit: Google Sheets + Gmail outreach for brand review requests.
 *
 * Paste into Extensions > Apps Script of a Google Sheet (see README.md).
 * Nothing is sent unless the row's Approved box is ticked, and what is sent is
 * exactly the Preview Subject / Preview Body you saw.
 */

const SHEETS = {
  BRANDS: 'Brands',
  TEMPLATE: 'Template',
  SETTINGS: 'Settings',
  SUPPRESSION: 'Suppression',
  LOG: 'Log',
};

const BRAND_HEADERS = [
  // Filled by discover.py or by hand (same order as the CSV it writes)
  'Brand', 'Website', 'Email', 'Email Check', 'Contact Source', 'Other Channels',
  'Brand Type', 'Tier', 'Product Line', 'Hook', 'Score', 'Notes',
  // Managed by this script
  'Approved', 'Preview Subject', 'Preview Body', 'Status', 'Sent At', 'Thread Id',
  'Follow-up At', 'Replied At', 'Last Reply',
];

const DEFAULT_SETTINGS = [
  ['Your Name', '', 'Shown as {{Your Name}} and as the sender name'],
  ['Channel Name', '', ''],
  ['Channel Link', '', 'https://youtube.com/@...'],
  ['Sample Video', '', 'Link to your best review-style video'],
  ['Paused', 'FALSE', 'Kill switch. TRUE stops all sending'],
  ['Daily Cap Start', 10, 'Emails per day in week 1 (follow-ups count too)'],
  ['Daily Cap Step Per Week', 5, 'Added to the cap each week'],
  ['Daily Cap Ceiling', 30, 'The cap never goes above this'],
  ['Ramp Start Date', '', 'Filled in automatically on the first send'],
  ['Delay Seconds', 20, 'Pause between emails'],
  ['Send Hour', 10, 'Hour of day for the automatic daily run (0-23)'],
  ['Follow-up After Days', 7, 'One follow-up, in the same thread'],
  ['Close After Days', 14, 'Days after the follow-up before a row is closed'],
  ['Brand Cooldown Days', 60, 'No second first-email to the same brand domain inside this window'],
  ['Bounce Pause Percent', 5, 'Pause if bounces reach this % of the last 20 sends'],
];

const DEFAULT_TEMPLATE = [
  ['Subject', '{{Product Line}} review on {{Channel Name}}'],
  ['Body', [
    'Hello {{Brand}} team,',
    '',
    "I'm {{Your Name}}, and I run {{Channel Name}}, a YouTube gaming channel ({{Channel Link}}). " +
      "I'd like to review the {{Product Line}} in a dedicated video, covering real-world gaming and daily use, " +
      'with an honest look at its strengths and weaknesses.',
    '',
    '{{Hook}}',
    '',
    'Here is an example of my work: {{Sample Video}}',
    '',
    "I'm open to a loan for a test period, a review unit, or a discounted unit, whichever suits you. " +
      'Any product I receive will be clearly disclosed in the video. ' +
      "If someone else handles creator requests, I'd be grateful to be pointed to them.",
    '',
    "If you'd rather not receive messages like this, just reply and I won't contact you again.",
    '',
    'Best regards,',
    '{{Your Name}}',
    '{{Channel Link}}',
  ].join('\n')],
  ['Follow-up Body', [
    'Hi {{Brand}} team,',
    '',
    'Just a gentle follow-up on my note below about reviewing the {{Product Line}} on {{Channel Name}}. ' +
      "If it's not a fit right now, no problem at all, and I won't follow up again.",
    '',
    'Best regards,',
    '{{Your Name}}',
  ].join('\n')],
];

// Placeholders that may be empty; any other empty placeholder blocks the preview.
const OPTIONAL_FIELDS = ['Hook'];

const FREE_MAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'qq.com', '163.com', 'proton.me', 'protonmail.com', 'rediffmail.com'];

const OPT_OUT_PATTERN = /\b(unsubscribe|remove me|stop (emailing|contacting|sending)|do not (contact|email)|don't (contact|email)|opt[ -]?out)\b/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_RUN_MS = 270 * 1000; // stay well under Apps Script's 6-minute limit

// ---------------------------------------------------------------- Menu

function onOpen() {
  SpreadsheetApp.getUi().createMenu('OutreachAI')
    .addItem('1. Set up sheets', 'setupSheets')
    .addItem('2. Build previews', 'buildPreviews')
    .addItem('3. Send approved batch now', 'sendBatchFromMenu')
    .addSeparator()
    .addItem('Check replies and bounces', 'checkReplies')
    .addItem('Send due follow-ups', 'sendFollowUps')
    .addSeparator()
    .addItem('Turn on daily automation', 'installTriggers')
    .addItem('Turn off daily automation', 'removeTriggers')
    .addSeparator()
    .addItem('Pause all sending (kill switch)', 'pauseSending')
    .addItem('Resume sending', 'resumeSending')
    .addToUi();
}

// ---------------------------------------------------------------- Setup

function setupSheets() {
  const ss = SpreadsheetApp.getActive();

  const brands = ensureSheet_(SHEETS.BRANDS, BRAND_HEADERS);
  const approvedCol = BRAND_HEADERS.indexOf('Approved') + 1;
  brands.getRange(2, approvedCol, brands.getMaxRows() - 1, 1).insertCheckboxes();
  brands.setFrozenRows(1);
  brands.setFrozenColumns(1);
  brands.getRange(1, 1, 1, BRAND_HEADERS.length).setFontWeight('bold');
  ['Preview Body', 'Last Reply', 'Hook', 'Notes'].forEach(h => {
    brands.setColumnWidth(BRAND_HEADERS.indexOf(h) + 1, 320);
  });

  const settings = ensureSheet_(SHEETS.SETTINGS, ['Setting', 'Value', 'Notes']);
  const haveSettings = settings.getDataRange().getValues().map(r => r[0]);
  DEFAULT_SETTINGS.forEach(r => { if (haveSettings.indexOf(r[0]) === -1) settings.appendRow(r); });

  const template = ensureSheet_(SHEETS.TEMPLATE, ['Part', 'Text']);
  const haveTemplate = template.getDataRange().getValues().map(r => r[0]);
  DEFAULT_TEMPLATE.forEach(r => { if (haveTemplate.indexOf(r[0]) === -1) template.appendRow(r); });
  template.setColumnWidth(2, 700);
  template.getRange('B:B').setWrap(true);

  ensureSheet_(SHEETS.SUPPRESSION, ['Value', 'Type', 'Reason', 'Added At']);
  ensureSheet_(SHEETS.LOG, ['Time', 'Action', 'Message']);

  ss.setActiveSheet(settings);
  toast_('Sheets ready. Fill in Settings, then paste brands into the Brands tab.');
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ---------------------------------------------------------------- Previews

/** Renders the template for every row with an email that has not been sent yet. */
function buildPreviews() {
  withLock_(() => {
    const settings = readSettings_();
    const tpl = readTemplate_();
    const ctx = readBrands_();
    const supp = readSuppression_();
    let built = 0, changed = 0, blocked = 0;

    ctx.rows.forEach(row => {
      const status = String(row['Status'] || '');
      if (!(status === '' || status === 'preview' || status === 'stale' || status.indexOf('needs') === 0 ||
            status.indexOf('blocked') === 0)) return;
      const email = norm_(row['Email']);
      if (!email) return;

      if (!EMAIL_PATTERN.test(email)) {
        setCell_(ctx, row, 'Status', 'needs: valid email');
        blocked++;
        return;
      }
      if (isSuppressed_(row, supp)) {
        setCell_(ctx, row, 'Status', 'blocked: suppressed');
        setCell_(ctx, row, 'Approved', false);
        blocked++;
        return;
      }

      const draft = renderRow_(tpl, settings, row);
      if (draft.missing.length) {
        setCell_(ctx, row, 'Status', 'needs: ' + draft.missing.join(', '));
        setCell_(ctx, row, 'Approved', false);
        blocked++;
        return;
      }
      if (draft.subject !== row['Preview Subject'] || draft.body !== row['Preview Body']) {
        // Any change to the text withdraws the approval for that row.
        if (row['Approved'] === true) changed++;
        setCell_(ctx, row, 'Preview Subject', draft.subject);
        setCell_(ctx, row, 'Preview Body', draft.body);
        setCell_(ctx, row, 'Approved', false);
      }
      setCell_(ctx, row, 'Status', 'preview');
      built++;
    });

    const msg = built + ' previews ready, ' + blocked + ' rows need attention' +
      (changed ? ', ' + changed + ' approvals cleared because the text changed' : '') +
      '. Read the previews and tick Approved on the ones to send.';
    log_('previews', msg);
    toast_(msg);
  });
}

function renderRow_(tpl, settings, row) {
  const values = Object.assign({}, settings, row);
  const subject = render_(tpl['Subject'], values);
  const body = render_(tpl['Body'], values);
  return {
    subject: subject.text,
    body: body.text,
    missing: unique_(subject.missing.concat(body.missing)),
  };
}

function render_(text, values) {
  const missing = [];
  let out = String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key) => {
    const v = values[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      if (OPTIONAL_FIELDS.indexOf(key) === -1) missing.push(key);
      return '';
    }
    return String(v).trim();
  });
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: out, missing: missing };
}

// ---------------------------------------------------------------- Sending

function sendBatchFromMenu() {
  const ctx = readBrands_();
  const ready = ctx.rows.filter(r => r['Approved'] === true && r['Status'] === 'preview');
  const settings = readSettings_();
  const left = Math.max(0, currentCap_(settings) - sentToday_(ctx.rows));
  const n = Math.min(ready.length, left);
  const ui = SpreadsheetApp.getUi();
  if (n === 0) {
    ui.alert(ready.length ? 'Daily cap reached. The rest will go out on a later day.' : 'No approved previews to send.');
    return;
  }
  const names = ready.sort(byScore_).slice(0, n).map(r => r['Brand'] + ' <' + r['Email'] + '>').join('\n');
  const answer = ui.alert('Send ' + n + ' email(s) now?', names, ui.ButtonSet.YES_NO);
  if (answer === ui.Button.YES) withLock_(sendBatch_);
}

function sendBatch() { withLock_(sendBatch_); }

function sendBatch_() {
  const started = Date.now();
  let settings = readSettings_();
  if (isPaused_(settings)) return log_('send', 'Skipped: sending is paused.');

  const tpl = readTemplate_();
  const ctx = readBrands_();
  const supp = readSuppression_();
  let remaining = currentCap_(settings) - sentToday_(ctx.rows);
  const delayMs = Math.max(0, Number(settings['Delay Seconds']) || 0) * 1000;
  const stuck = ctx.rows.filter(r => r['Status'] === 'sending');
  if (stuck.length) {
    log_('send', stuck.length + ' row(s) are stuck in "sending". Check your Gmail Sent folder and set their Status by hand.');
  }

  const queue = ctx.rows.filter(r => r['Approved'] === true && r['Status'] === 'preview').sort(byScore_);
  let sent = 0;

  for (let i = 0; i < queue.length; i++) {
    const row = queue[i];
    if (remaining <= 0) break;
    if (Date.now() - started > MAX_RUN_MS) break;
    settings = readSettings_();
    if (isPaused_(settings)) break;

    const email = norm_(row['Email']);
    if (isSuppressed_(row, supp)) {
      setCell_(ctx, row, 'Status', 'blocked: suppressed');
      continue;
    }
    if (inCooldown_(ctx.rows, row, Number(settings['Brand Cooldown Days']) || 0)) {
      setCell_(ctx, row, 'Status', 'blocked: brand cooldown');
      continue;
    }
    // Send only what was approved: the stored preview must still match the template.
    const fresh = renderRow_(tpl, settings, row);
    if (fresh.subject !== row['Preview Subject'] || fresh.body !== row['Preview Body']) {
      setCell_(ctx, row, 'Status', 'stale');
      setCell_(ctx, row, 'Approved', false);
      continue;
    }

    if (sent > 0 && delayMs) Utilities.sleep(delayMs);
    setCell_(ctx, row, 'Status', 'sending');
    SpreadsheetApp.flush();
    try {
      const options = settings['Your Name'] ? { name: String(settings['Your Name']) } : {};
      const message = GmailApp.createDraft(email, row['Preview Subject'], row['Preview Body'], options).send();
      setCell_(ctx, row, 'Sent At', new Date());
      setCell_(ctx, row, 'Thread Id', message.getThread().getId());
      setCell_(ctx, row, 'Status', 'sent');
      SpreadsheetApp.flush();
      sent++;
      remaining--;
      if (!(settings['Ramp Start Date'] instanceof Date)) setSetting_('Ramp Start Date', new Date());
    } catch (e) {
      setCell_(ctx, row, 'Status', 'error: ' + e.message);
      log_('send', 'Error for ' + email + ': ' + e.message);
      if (/limit|quota|rate|too many|authoriz/i.test(e.message)) {
        setSetting_('Paused', 'TRUE');
        log_('send', 'Paused sending after a Gmail limit or authorization error.');
        break;
      }
    }
  }

  const left = queue.filter(r => r['Status'] === 'preview' && r['Approved'] === true).length;
  const msg = 'Sent ' + sent + ' email(s). ' + left + ' approved email(s) still waiting.';
  log_('send', msg);
  toast_(msg);
}

function currentCap_(s) {
  const start = Number(s['Daily Cap Start']) || 10;
  const step = Number(s['Daily Cap Step Per Week']) || 0;
  const ceiling = Number(s['Daily Cap Ceiling']) || start;
  const rampStart = s['Ramp Start Date'];
  if (!(rampStart instanceof Date)) return Math.min(start, ceiling);
  const weeks = Math.floor((Date.now() - rampStart.getTime()) / (7 * 86400000));
  return Math.min(start + weeks * step, ceiling);
}

function sentToday_(rows) {
  return rows.filter(r => isToday_(r['Sent At'])).length +
    rows.filter(r => isToday_(r['Follow-up At'])).length;
}

/** One first-email per brand domain inside the cooldown window. */
function inCooldown_(rows, row, days) {
  if (!days) return false;
  const key = brandKey_(row);
  const cutoff = Date.now() - days * 86400000;
  return rows.some(r => r !== row && r['Sent At'] instanceof Date &&
    r['Sent At'].getTime() > cutoff && brandKey_(r) === key);
}

// ---------------------------------------------------------------- Replies and bounces

function checkReplies() { withLock_(checkReplies_); }

function checkReplies_() {
  const ctx = readBrands_();
  const supp = readSuppression_();
  const mine = [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(norm_);
  let replies = 0, bounces = 0;

  const open = ctx.rows.filter(r => r['Thread Id'] && (r['Status'] === 'sent' || r['Status'] === 'followed_up'));
  open.forEach(row => {
    let thread;
    try { thread = GmailApp.getThreadById(String(row['Thread Id'])); } catch (e) { return; }
    if (!thread) return;
    const messages = thread.getMessages();
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const from = norm_(m.getFrom());
      const addr = (from.match(/<([^>]+)>/) || [null, from])[1];
      if (/mailer-daemon|postmaster/.test(from)) {
        markBounced_(ctx, row, supp);
        bounces++;
        return;
      }
      if (mine.indexOf(addr) === -1) {
        const text = firstLines_(m.getPlainBody());
        setCell_(ctx, row, 'Replied At', m.getDate());
        setCell_(ctx, row, 'Last Reply', text);
        if (OPT_OUT_PATTERN.test(text)) {
          setCell_(ctx, row, 'Status', 'opted_out');
          addSuppression_(supp, row, 'opted out by reply');
        } else {
          setCell_(ctx, row, 'Status', 'replied');
        }
        replies++;
        return;
      }
    }
  });

  // Bounces that arrive outside the original thread.
  const byEmail = {};
  ctx.rows.filter(r => r['Status'] === 'sent' || r['Status'] === 'followed_up')
    .forEach(r => { byEmail[norm_(r['Email'])] = r; });
  GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:14d', 0, 50).forEach(t => {
    t.getMessages().forEach(m => {
      const body = norm_(m.getPlainBody());
      Object.keys(byEmail).forEach(email => {
        const row = byEmail[email];
        if (body.indexOf(email) !== -1 && row['Status'] !== 'bounced') {
          markBounced_(ctx, row, supp);
          bounces++;
        }
      });
    });
  });

  closeStale_(ctx);
  checkBounceRate_(ctx.rows);
  const msg = replies + ' new reply(ies), ' + bounces + ' bounce(s).';
  log_('replies', msg);
  toast_(msg);
}

function markBounced_(ctx, row, supp) {
  setCell_(ctx, row, 'Status', 'bounced');
  addSuppression_(supp, row, 'bounced', true);
}

function closeStale_(ctx) {
  const days = Number(readSettings_()['Close After Days']) || 14;
  ctx.rows.forEach(r => {
    if (r['Status'] === 'followed_up' && r['Follow-up At'] instanceof Date &&
        Date.now() - r['Follow-up At'].getTime() > days * 86400000) {
      setCell_(ctx, r, 'Status', 'closed');
    }
  });
}

function checkBounceRate_(rows) {
  const pct = Number(readSettings_()['Bounce Pause Percent']) || 5;
  const recent = rows.filter(r => r['Sent At'] instanceof Date)
    .sort((a, b) => b['Sent At'] - a['Sent At']).slice(0, 20);
  if (!recent.length) return;
  const bounced = recent.filter(r => r['Status'] === 'bounced').length;
  if (bounced && (bounced / recent.length) * 100 >= pct) {
    setSetting_('Paused', 'TRUE');
    log_('bounces', bounced + ' of the last ' + recent.length +
      ' sends bounced. Sending is paused. Check the addresses, then use Resume sending.');
  }
}

// ---------------------------------------------------------------- Follow-ups

function sendFollowUps() { withLock_(() => { checkReplies_(); sendFollowUps_(); }); }

function sendFollowUps_() {
  const started = Date.now();
  const settings = readSettings_();
  if (isPaused_(settings)) return log_('follow-up', 'Skipped: sending is paused.');
  const tpl = readTemplate_();
  if (!String(tpl['Follow-up Body'] || '').trim()) return;
  const ctx = readBrands_();
  const supp = readSuppression_();
  const afterMs = (Number(settings['Follow-up After Days']) || 7) * 86400000;
  const delayMs = Math.max(0, Number(settings['Delay Seconds']) || 0) * 1000;
  let remaining = currentCap_(settings) - sentToday_(ctx.rows);
  let sent = 0;

  const due = ctx.rows.filter(r => r['Status'] === 'sent' && r['Thread Id'] &&
    r['Sent At'] instanceof Date && Date.now() - r['Sent At'].getTime() >= afterMs);

  for (let i = 0; i < due.length; i++) {
    const row = due[i];
    if (remaining <= 0 || Date.now() - started > MAX_RUN_MS) break;
    if (isPaused_(readSettings_())) break;
    if (isSuppressed_(row, supp)) {
      setCell_(ctx, row, 'Status', 'blocked: suppressed');
      continue;
    }
    const body = render_(tpl['Follow-up Body'], Object.assign({}, settings, row));
    if (body.missing.length) {
      log_('follow-up', 'Skipped ' + row['Brand'] + ', missing: ' + body.missing.join(', '));
      continue;
    }
    if (sent > 0 && delayMs) Utilities.sleep(delayMs);
    try {
      sendInThread_(String(row['Thread Id']), norm_(row['Email']), String(row['Preview Subject']), body.text);
      setCell_(ctx, row, 'Follow-up At', new Date());
      setCell_(ctx, row, 'Status', 'followed_up');
      SpreadsheetApp.flush();
      sent++;
      remaining--;
    } catch (e) {
      log_('follow-up', 'Error for ' + row['Email'] + ': ' + e.message);
    }
  }
  const msg = 'Sent ' + sent + ' follow-up(s).';
  log_('follow-up', msg);
  toast_(msg);
}

/** Replies in the original thread, addressed to the brand (not to yourself). */
function sendInThread_(threadId, to, subject, body) {
  const first = GmailApp.getThreadById(threadId).getMessages()[0];
  const messageId = first.getHeader('Message-ID');
  const subj = /^re:/i.test(subject) ? subject : 'Re: ' + subject;
  const mime = [
    'To: ' + to,
    'Subject: =?UTF-8?B?' + Utilities.base64Encode(subj, Utilities.Charset.UTF_8) + '?=',
    'In-Reply-To: ' + messageId,
    'References: ' + messageId,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Utilities.base64Encode(body, Utilities.Charset.UTF_8).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
  Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(mime), threadId: threadId }, 'me');
}

// ---------------------------------------------------------------- Triggers and kill switch

function installTriggers() {
  removeTriggers();
  const hour = Math.min(23, Math.max(0, Number(readSettings_()['Send Hour']) || 10));
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(hour).create();
  ScriptApp.newTrigger('checkReplies').timeBased().everyHours(6).create();
  toast_('Daily automation on: sends around ' + hour + ':00, checks replies every 6 hours.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  toast_('Daily automation off.');
}

function dailyRun() {
  withLock_(() => {
    checkReplies_();
    sendFollowUps_();
    sendBatch_();
  });
}

function pauseSending() {
  setSetting_('Paused', 'TRUE');
  log_('kill switch', 'Sending paused.');
  toast_('All sending paused.');
}

function resumeSending() {
  setSetting_('Paused', 'FALSE');
  log_('kill switch', 'Sending resumed.');
  toast_('Sending resumed.');
}

// ---------------------------------------------------------------- Sheet helpers

function readBrands_() {
  const sh = sheet_(SHEETS.BRANDS);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });
  BRAND_HEADERS.forEach(h => {
    if (!(h in col)) throw new Error('Brands tab is missing the "' + h + '" column. Run OutreachAI > Set up sheets.');
  });
  const rows = values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j]; });
    return o;
  }).filter(o => String(o['Brand'] || o['Email'] || '').trim() !== '');
  return { sh: sh, col: col, rows: rows };
}

function setCell_(ctx, row, header, value) {
  ctx.sh.getRange(row._row, ctx.col[header] + 1).setValue(value);
  row[header] = value;
}

function readSettings_() {
  const out = {};
  sheet_(SHEETS.SETTINGS).getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) out[String(r[0]).trim()] = r[1];
  });
  return out;
}

function setSetting_(key, value) {
  const sh = sheet_(SHEETS.SETTINGS);
  const keys = sh.getDataRange().getValues().map(r => String(r[0]).trim());
  const i = keys.indexOf(key);
  if (i === -1) sh.appendRow([key, value, '']);
  else sh.getRange(i + 1, 2).setValue(value);
}

function readTemplate_() {
  const out = {};
  sheet_(SHEETS.TEMPLATE).getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) out[String(r[0]).trim()] = String(r[1]);
  });
  return out;
}

function readSuppression_() {
  const sh = sheet_(SHEETS.SUPPRESSION);
  const emails = {}, domains = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const v = norm_(r[0]);
    if (!v) return;
    if (v.indexOf('@') !== -1) emails[v] = true;
    else domains[v.replace(/^www\./, '')] = true;
  });
  return { sh: sh, emails: emails, domains: domains };
}

function isSuppressed_(row, supp) {
  const email = norm_(row['Email']);
  const site = siteDomain_(row['Website']);
  return !!(supp.emails[email] || supp.domains[emailDomain_(email)] || (site && supp.domains[site]));
}

/** Adds the brand's domain (or just the address, for bounces and free-mail addresses). */
function addSuppression_(supp, row, reason, emailOnly) {
  const email = norm_(row['Email']);
  const domain = siteDomain_(row['Website']) || emailDomain_(email);
  if (!emailOnly && domain && FREE_MAIL_DOMAINS.indexOf(domain) === -1) {
    if (!supp.domains[domain]) supp.sh.appendRow([domain, 'domain', reason, new Date()]);
    supp.domains[domain] = true;
  } else if (email) {
    if (!supp.emails[email]) supp.sh.appendRow([email, 'email', reason, new Date()]);
    supp.emails[email] = true;
  }
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing "' + name + '" tab. Run OutreachAI > Set up sheets.');
  return sh;
}

function log_(action, message) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG);
  if (sh) sh.appendRow([new Date(), action, message]);
  console.log(action + ': ' + message);
}

function toast_(message) {
  try { SpreadsheetApp.getActive().toast(message, 'OutreachAI', 8); } catch (e) { /* no UI in triggers */ }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    toast_('Another OutreachAI run is in progress. Try again in a minute.');
    return;
  }
  try { fn(); } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- Small utilities

function norm_(s) { return String(s || '').trim().toLowerCase(); }

function emailDomain_(email) {
  const i = email.lastIndexOf('@');
  return i === -1 ? '' : email.slice(i + 1);
}

function siteDomain_(url) {
  const m = norm_(url).match(/^(?:https?:\/\/)?(?:www\.)?([^\/:?#\s]+)/);
  return m ? m[1] : '';
}

/** Identifies a brand for the cooldown: its website, else its email address. */
function brandKey_(row) {
  return siteDomain_(row['Website']) || norm_(row['Email']);
}

function isPaused_(settings) { return String(settings['Paused']).toUpperCase() === 'TRUE'; }

function isToday_(d) {
  if (!(d instanceof Date)) return false;
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd') === Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function byScore_(a, b) { return (Number(b['Score']) || 0) - (Number(a['Score']) || 0); }

function unique_(arr) { return arr.filter((v, i) => arr.indexOf(v) === i); }

/** The reply text above the quoted original, trimmed for the sheet. */
function firstLines_(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^>/.test(lines[i]) || /^On .+wrote:$/.test(lines[i].trim())) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim().slice(0, 500);
}
