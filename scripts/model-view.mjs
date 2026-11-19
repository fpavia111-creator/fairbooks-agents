#!/usr/bin/env node
// What reaches the AI model when an assistant calls a Fairbooks read tool. Every eval case that
// calls a read tool on spreadsheet fixtures is run, and every fixture value is looked for in the
// JSON result the model receives. Columns whose names say they hold people (names, e-mails, users,
// employees, customers, owners, phone numbers, addresses, tax ids) are reported as "in clear" when
// their values appear as written, or as "not in the result / masked" when they do not.
// Report and draft files written on disk are not counted: they stay on the machine.
//
//   node scripts/model-view.mjs            print the table and write docs/model-view-<date>.json and .md
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime, parseCsv } from '../packages/fairbooks-core/src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PK = join(ROOT, 'packages'); const DATE = '2026-11-19';
const PERSON = /(^|_|\b)(name|first|last|full|email|e-mail|mail|user|username|employee|staff|customer|client|contact|owner|manager|reviewer|approver|requester|requestor|holder|cardholder|payee|person|phone|mobile|address|street|tin|ssn|ein|tax_?id|iban|account_?number|card)(_|\b|$)/i;
const csvsOf = (args) => { const out = []; const walk = (v) => { if (typeof v === 'string') { if (/\.csv$/i.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(args); return out; };
const out = [];
for (const n of readdirSync(PK).filter((x) => x !== 'fairbooks-core' && existsSync(join(PK, x, 'src', 'manifest.js'))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'manifest.js')).href);
  const reads = new Set(manifest.tools.filter((t) => t.kind === 'read').map((t) => t.name));
  const data = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8'));
  const cases = (data.cases || data).filter((c) => reads.has(c.tool) && csvsOf(c.args).length);
  const clear = new Set(), absent = new Set(), clearOther = new Set(); let calls = 0;
  const root = mkdtempSync(join(tmpdir(), 'fb-mv-')); cpSync(join(PK, n), root, { recursive: true, filter: (p) => !/node_modules|fairbooks-out|mythos-out|[\\/]\.fairbooks|[\\/]\.mythos/.test(p) });
  try {
    for (const c of cases) {
      const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call(c.tool, c.args || {}); calls++;
      if (r.status !== 'executed') continue;
      const json = JSON.stringify(r.result);
      for (const f of csvsOf(c.args)) {
        const p = join(PK, n, f); if (!existsSync(p)) continue;
        let rows; try { rows = parseCsv(readFileSync(p, 'utf8')); } catch { continue; }
        const cols = new Map(); for (const row of rows) for (const [h, v] of Object.entries(row)) { const s = String(v ?? '').trim(); if (s.length < 3 || /^-?[\d.,]+$/.test(s) || /^\d{4}-\d\d-\d\d/.test(s)) continue; if (!cols.has(h)) cols.set(h, []); cols.get(h).push(s); }
        for (const [h, vals] of cols) {
          const seen = vals.some((s) => json.includes(JSON.stringify(s).slice(1, -1)));
          const person = PERSON.test(h) && !/(_date|_at|_on|_login|_active|_seen|_decision|_status|_days|_count|_type|_domain)$/i.test(h);
          if (person) (seen ? clear : absent).add(h); else if (seen) clearOther.add(h);
        }
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
  for (const h of clear) absent.delete(h);
  out.push({ agent: n, read_cases_run: calls, people_columns_in_clear: [...clear].sort(), people_columns_not_in_result: [...absent].sort(), other_text_in_clear: [...clearOther].sort().slice(0, 25) });
}
for (const o of out) console.log(`${o.agent} (${o.read_cases_run} calls)\n  people columns in clear: ${o.people_columns_in_clear.join(', ') || '-'}\n  not in the result or masked: ${o.people_columns_not_in_result.join(', ') || '-'}`);
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', `model-view-${DATE}.json`), JSON.stringify(out, null, 2) + '\n');
const L = [`# What reaches the AI model (${DATE})`, '', 'Made by `node scripts/model-view.mjs`: every eval case that calls a read tool on spreadsheet fixtures is run, and every fixture value is looked for in the JSON result the assistant\'s model receives. Columns whose names say they hold people (names, e-mails, users, employees, customers, owners, phone numbers, addresses, tax ids, card or account numbers) are listed as sent in clear when their values appear as written.', '',
  '**Fairbooks has no general masking of personal data.** Unlike the newer Fair families, its core does not replace names and e-mail addresses with tokens. What is masked is specific: taxpayer ids in Vendor Tax Forms (last four digits), secrets in Automation Audit, Config Drift and MCP Server Review, card and account numbers where an agent says so, and the data subject\'s identifiers in Data Erasure Requests. Everything else in a result, including people\'s names and e-mail addresses from your files, goes to whatever model the user\'s assistant uses. For staff, customer and vendor data, use a model covered by your own agreements or a local model. No compliance claim is made.', '',
  '| Agent | Read calls | People columns sent in clear | People columns not in the result (or masked) |', '|---|---|---|---|',
  ...out.map((o) => `| ${o.agent} | ${o.read_cases_run} | ${o.people_columns_in_clear.join(', ') || '-'} | ${o.people_columns_not_in_result.join(', ') || '-'} |`), '',
  'Agents with no spreadsheet read cases (they read lockfiles, HTML pages, HAR captures, DNS records, contracts, logs or scripts) are listed with 0 calls; what they return is the text of those files where a finding quotes it.', ''];
writeFileSync(join(ROOT, 'docs', `model-view-${DATE}.md`), L.join('\n'));
console.log(`Wrote docs/model-view-${DATE}.json and .md`);
