// Shared output formats for agents: iCalendar, SARIF 2.1.0, unified diff and a
// self-contained HTML report page. No dependencies, no network.

import { sha256 } from './util.js';

// ---- iCalendar (RFC 5545) ------------------------------------------------------

const icsEsc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
function fold(line) {
  // Fold at 75 octets (approximated by UTF-16 units, safe for ASCII-heavy text).
  const out = []; let s = line;
  while (s.length > 75) { out.push(s.slice(0, 75)); s = ' ' + s.slice(75); }
  out.push(s);
  return out.join('\r\n');
}
const icsDate = (d) => String(d).replace(/-/g, '').slice(0, 8);

/**
 * events: [{ uid?, date: 'YYYY-MM-DD', summary, description?, reminders?: [daysBefore, ...], categories? }]
 * All-day events with VALARM reminders. Deterministic: same input, same bytes
 * (DTSTAMP comes from opts.stamp, default 19700101T000000Z).
 */
export function toIcs(events, { prodId = '-//Mythos Machine//mythos-agent-core//EN', calName = 'Mythos', stamp = '19700101T000000Z' } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEsc(calName)}`];
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(e.date || ''))) throw new Error(`event "${e.summary}" needs date YYYY-MM-DD`);
    const start = icsDate(e.date);
    const next = new Date(Date.UTC(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8) + 1)).toISOString().slice(0, 10);
    const uid = e.uid || `${sha256(`${e.date}|${e.summary}`).slice(0, 24)}@mythos.local`;
    L.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${icsDate(next)}`, `SUMMARY:${icsEsc(e.summary)}`);
    if (e.description) L.push(`DESCRIPTION:${icsEsc(e.description)}`);
    if (e.categories) L.push(`CATEGORIES:${[].concat(e.categories).map(icsEsc).join(',')}`);
    for (const d of e.reminders || []) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.summary)}`, `TRIGGER:-P${Number(d)}D`, 'END:VALARM');
    }
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/** Light structural validation of an .ics string. Returns { ok, events, errors }. */
export function validateIcs(text) {
  const errors = []; const lines = String(text).split('\r\n');
  if (lines[0] !== 'BEGIN:VCALENDAR') errors.push('must start with BEGIN:VCALENDAR');
  if (!lines.includes('VERSION:2.0')) errors.push('VERSION:2.0 missing');
  if (!lines.some((l) => l.startsWith('PRODID:'))) errors.push('PRODID missing');
  let depth = 0; let events = 0; const stack = [];
  for (const l of lines) {
    if (l.length > 75 && !l.startsWith(' ')) errors.push(`line longer than 75 octets: ${l.slice(0, 20)}…`);
    if (l.startsWith('BEGIN:')) { stack.push(l.slice(6)); depth++; if (l === 'BEGIN:VEVENT') events++; }
    if (l.startsWith('END:')) { if (stack.pop() !== l.slice(4)) errors.push(`mismatched ${l}`); depth--; }
  }
  if (depth !== 0) errors.push('unbalanced BEGIN/END');
  return { ok: errors.length === 0, events, errors };
}

// ---- SARIF 2.1.0 ----------------------------------------------------------------

const SARIF_LEVEL = { critical: 'error', high: 'error', error: 'error', medium: 'warning', warning: 'warning', low: 'note', info: 'note', note: 'note' };

/**
 * findings: [{ ruleId, message, severity, file?, line?, column?, help?, fingerprint? }]
 * rules: [{ id, name?, description, help?, severity? }]
 */
export function toSarif({ tool, version, informationUri, rules = [], findings = [] }) {
  const ruleIds = [...new Set([...rules.map((r) => r.id), ...findings.map((f) => f.ruleId)])];
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: {
        name: tool, version: String(version || '0.0.0'), ...(informationUri ? { informationUri } : {}),
        rules: ruleIds.map((id) => { const r = ruleById.get(id) || {}; return {
          id, name: r.name || id, shortDescription: { text: r.description || id },
          ...(r.help ? { help: { text: r.help } } : {}),
          defaultConfiguration: { level: SARIF_LEVEL[String(r.severity || 'warning').toLowerCase()] || 'warning' },
        }; }),
      } },
      results: findings.map((f) => ({
        ruleId: f.ruleId, ruleIndex: ruleIds.indexOf(f.ruleId),
        level: SARIF_LEVEL[String(f.severity || (ruleById.get(f.ruleId) || {}).severity || 'warning').toLowerCase()] || 'warning',
        message: { text: String(f.message) },
        ...(f.file ? { locations: [{ physicalLocation: { artifactLocation: { uri: String(f.file).replace(/\\/g, '/') }, ...(f.line ? { region: { startLine: Number(f.line), ...(f.column ? { startColumn: Number(f.column) } : {}) } } : {}) } }] } : {}),
        partialFingerprints: { primaryLocationLineHash: f.fingerprint || sha256(`${f.ruleId}|${f.file || ''}|${f.message}`).slice(0, 32) },
      })),
    }],
  };
}

/** Structural SARIF 2.1.0 check (the fields GitHub code scanning requires). */
export function validateSarif(doc) {
  const errors = [];
  if (!doc || doc.version !== '2.1.0') errors.push('/version must be "2.1.0"');
  if (!Array.isArray(doc && doc.runs) || !doc.runs.length) errors.push('/runs must be a non-empty array');
  (doc && doc.runs || []).forEach((run, i) => {
    if (!run.tool || !run.tool.driver || !run.tool.driver.name) errors.push(`/runs/${i}/tool/driver/name is required`);
    const ids = new Set((run.tool && run.tool.driver && run.tool.driver.rules || []).map((r) => r.id));
    (run.results || []).forEach((r, j) => {
      if (!r.message || typeof r.message.text !== 'string') errors.push(`/runs/${i}/results/${j}/message/text is required`);
      if (!['none', 'note', 'warning', 'error'].includes(r.level)) errors.push(`/runs/${i}/results/${j}/level is invalid`);
      if (r.ruleId && !ids.has(r.ruleId)) errors.push(`/runs/${i}/results/${j}/ruleId ${r.ruleId} has no rule`);
      for (const loc of r.locations || []) {
        const reg = loc.physicalLocation && loc.physicalLocation.region;
        if (reg && !(Number.isInteger(reg.startLine) && reg.startLine >= 1)) errors.push(`/runs/${i}/results/${j} startLine must be >= 1`);
      }
    });
  });
  return { ok: errors.length === 0, errors };
}

// ---- Unified diff (Myers via LCS, line-based) ------------------------------------

function lcsOps(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 25e6) throw new Error('files too large to diff in memory');
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', a[i]]); i++; }
    else { ops.push(['+', b[j]]); j++; }
  }
  while (i < n) ops.push(['-', a[i++]]);
  while (j < m) ops.push(['+', b[j++]]);
  return ops;
}

/** Unified diff of two texts ('' when equal). Paths default to a/file b/file. */
export function unifiedDiff(oldText, newText, { oldPath = 'a/file', newPath = 'b/file', context = 3 } = {}) {
  if (oldText === newText) return '';
  const split = (t) => { const s = String(t).split('\n'); if (s[s.length - 1] === '') s.pop(); return s; };
  const a = split(oldText), b = split(newText);
  const ops = lcsOps(a, b);
  // Line numbers before each op.
  const pos = []; let oi = 1, ni = 1;
  for (const op of ops) { pos.push([oi, ni]); if (op[0] !== '+') oi++; if (op[0] !== '-') ni++; }
  const changes = ops.map((op, i) => (op[0] !== ' ' ? i : -1)).filter((i) => i >= 0);
  if (!changes.length) return '';
  const groups = []; let g = [changes[0], changes[0]];
  for (const c of changes.slice(1)) { if (c - g[1] <= context * 2 + 1) g[1] = c; else { groups.push(g); g = [c, c]; } }
  groups.push(g);
  const out = [`--- ${oldPath}`, `+++ ${newPath}`];
  for (const [first, last] of groups) {
    const s0 = Math.max(0, first - context), e0 = Math.min(ops.length - 1, last + context);
    const slice = ops.slice(s0, e0 + 1);
    const ol = slice.filter((o) => o[0] !== '+').length, nl = slice.filter((o) => o[0] !== '-').length;
    const [os, ns] = pos[s0];
    out.push(`@@ -${ol ? os : os - 1},${ol} +${nl ? ns : ns - 1},${nl} @@`, ...slice.map((o) => o[0] + o[1]));
  }
  return out.join('\n') + '\n';
}

/** Apply a unified diff produced by unifiedDiff (strict: context must match). */
export function applyUnifiedDiff(text, patch) {
  if (!patch) return text;
  const src = String(text).split('\n'); const hadNl = src[src.length - 1] === ''; if (hadNl) src.pop();
  const lines = patch.split('\n'); const out = []; let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
    if (!m) continue;
    let start = Number(m[1]) - 1; if (Number(m[2] ?? 1) === 0) start += 1;
    while (pos < start) out.push(src[pos++]);
    for (i++; i < lines.length && !lines[i].startsWith('@@'); i++) {
      const l = lines[i]; if (l === '') continue;
      const tag = l[0], body = l.slice(1);
      if (tag === ' ' || tag === '-') { if (src[pos] !== body) throw new Error(`patch does not apply at line ${pos + 1}`); pos++; if (tag === ' ') out.push(body); }
      else if (tag === '+') out.push(body);
    }
    i--;
  }
  while (pos < src.length) out.push(src[pos++]);
  return out.length ? out.join('\n') + (hadNl || !src.length ? '\n' : '') : '';
}

// ---- HTML report page -------------------------------------------------------------

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * A self-contained HTML page: inline CSS only, no scripts, no fonts, no network.
 * CSP: default-src 'none'; style-src 'unsafe-inline'. bodyHtml must already be escaped.
 */
export function htmlPage({ title, bodyHtml, footer = '' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1c1a;--mut:#6b6760;--line:#e4e0d8;--ok:#1f7a4d;--bad:#b42318;--warn:#a15c07;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161514;--fg:#ecebe8;--mut:#a29d94;--line:#34312d;--ok:#4ade80;--bad:#f87171;--warn:#fbbf24;--card:#1f1e1c}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.mut{color:var(--mut)}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
table{border-collapse:collapse;width:100%;background:var(--card);font-size:14px}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{font-weight:600}td.num{text-align:right;font-variant-numeric:tabular-nums}
.tiles{display:flex;gap:12px;flex-wrap:wrap}.tile{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;min-width:120px}
.tile b{display:block;font-size:22px}code{font-size:13px}
.wrap{overflow-x:auto}
</style></head><body><main>
${bodyHtml}
<p class="mut" style="margin-top:32px">${escapeHtml(footer)}</p>
</main></body></html>
`;
}
