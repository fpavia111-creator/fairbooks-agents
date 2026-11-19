#!/usr/bin/env node
// Real public bank files, in their published formats, through Fairbooks Bank Reconciliation's statement
// readers. Nothing private is used. Downloads go to _realdata/ (git-ignored); only this script and the
// results (docs/realdata-<date>.json and .md) are committed.
//
//   node scripts/realdata.mjs --download     fetch the public files (needs the network)
//   node scripts/realdata.mjs                run recon_read_statement on each file and re-count it
//
// Sources
//   1. PostFinance (Switzerland), "Sample files for business customers": camt.053 account statements
//      in the 2009, 2013 and 2019 ISO 20022 versions, published as reference material for software tests.
//   2. ofxparse (github.com/jseutter/ofxparse, MIT licence): OFX bank and card statements that users of
//      the library contributed with identifying details removed.
//   3. bai2 (github.com/ministryofjustice/bai2, MIT licence): BAI2 test files in the layouts of Citi,
//      NatWest and Silicon Valley Bank, plus one with a blank account trailer amount.
// Each file is read by the agent (recon_read_statement) and, separately, by the small re-count below,
// which only sums the transaction amounts and reads the balances the file states.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime } from '../packages/fairbooks-core/src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = join(ROOT, '_realdata'); const RAW = join(RD, 'raw');
const DATE = '2026-11-19';
const UA = { 'User-Agent': 'fairbooks-agents real-data test (open source)' };
const PF = 'https://www.postfinance.ch/content/dam/pfch/doc/musterfile/';
const SOURCES = {
  camt053: { name: 'PostFinance sample files for business customers (camt.053)', page: 'https://www.postfinance.ch/en/support/documents/sample-files-for-business-customers.html', licence: 'Published by PostFinance as sample files for software tests (no licence stated)', files: ['camt053_P_CH2909000000250094239_1110092698_0_2020062503071366_v2009.xml', 'camt053_P_CH2909000000250094239_1110092698_0_2020112503071366_v2019.xml', 'camt053_P_CH2909000000250094239_1110092698_0_2024012503071366_v2013.xml', 'camt053_P_CH2909000000250094239_1110092698_0_2024012503071366_v2019.xml'].map((f) => [f, PF + f]) },
  ofx: { name: 'ofxparse test files (OFX bank and card statements)', page: 'https://github.com/jseutter/ofxparse/tree/master/tests/fixtures', licence: 'MIT (ofxparse)', files: ['checking.ofx', 'bank_medium.ofx', 'bank_small.ofx', 'anzcc.ofx', 'suncorp.ofx', 'multiple_accounts.ofx', 'account_listing_aggregation.ofx', 'ofx-v102-empty-tags.ofx'].map((f) => [f, `https://raw.githubusercontent.com/jseutter/ofxparse/master/tests/fixtures/${f}`]) },
  bai2: { name: 'bai2 test files (BAI2 layouts of Citi, NatWest, SVB)', page: 'https://github.com/ministryofjustice/bai2/tree/main/tests/data', licence: 'MIT (bai2)', files: ['citi_example.bai2', 'nwb_example.bai2', 'svb_us_example.bai2', 'account_trailer_amount_blank_example.bai2'].map((f) => [f, `https://raw.githubusercontent.com/ministryofjustice/bai2/main/tests/data/${f}`]) },
};

async function get(url) {
  for (let i = 1; i <= 3; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === 3) throw new Error(`${url}: ${e.message}`); }
  }
}
if (process.argv.includes('--download')) {
  for (const [fmt, s] of Object.entries(SOURCES)) { mkdirSync(join(RAW, fmt), { recursive: true }); for (const [f, url] of s.files) writeFileSync(join(RAW, fmt, f), await get(url)); }
  writeFileSync(join(RAW, 'downloaded.json'), JSON.stringify({ date: new Date().toISOString(), sources: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, s.files.map(([, u]) => u)])) }, null, 2));
  console.log(`Downloaded to ${RAW}`);
}
if (!existsSync(join(RAW, 'downloaded.json'))) { console.error('Run with --download first.'); process.exit(1); }

// ------------------------------------------------- independent re-count ----
const r2 = (x) => Math.round(x * 100) / 100;
const tagAll = (x, t) => [...x.matchAll(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'g'))].map((m) => m[1]);
const tag = (x, t) => (tagAll(x, t)[0] || '').trim();
function recountCamt(x) {
  const stmt = tagAll(x, 'Stmt')[0] || x;
  const entries = tagAll(stmt, 'Ntry');
  const sum = entries.reduce((t, e) => { const a = Number(tag(e, 'Amt')) || 0; return t + (tag(e, 'CdtDbtInd') === 'DBIT' ? -a : a); }, 0);
  const bal = (code) => { const b = tagAll(stmt, 'Bal').find((y) => new RegExp(`<Cd>${code}</Cd>`).test(y)); if (!b) return null; const a = Number(tag(b, 'Amt')); return tag(b, 'CdtDbtInd') === 'DBIT' ? -a : a; };
  return { lines: entries.length, total: r2(sum), opening: bal('OPBD') ?? bal('PRCD'), closing: bal('CLBD') };
}
function recountOfx(x) {
  const trns = [...x.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi)].map((m) => m[1]);
  const amt = (b) => Number(((/<TRNAMT>\s*([^<\r\n]+)/i.exec(b) || [])[1] || '0').trim().replace(',', '.'));
  const ledger = /<LEDGERBAL>[\s\S]*?<BALAMT>\s*([^<\r\n]+)/i.exec(x);
  return { lines: trns.length, total: r2(trns.reduce((t, b) => t + amt(b), 0)), opening: null, closing: ledger ? Number(ledger[1].trim()) : null };
}
function recountBai2(x) {
  // 16 records: type codes 100-399 are credits, 400-699 debits (BAI2 detail type code ranges); amounts in cents.
  const recs = x.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let lines = 0, sum = 0;
  for (const l of recs) { if (!l.startsWith('16,')) continue; const p = l.replace(/\/$/, '').split(','); const code = Number(p[1]); const cents = Number(p[2] || 0); if (!Number.isFinite(cents)) continue; lines++; sum += (code >= 400 && code < 700 ? -1 : 1) * cents / 100; }
  return { lines, total: r2(sum), opening: null, closing: null };
}
const RECOUNT = { camt053: recountCamt, ofx: recountOfx, bai2: recountBai2 };

// ------------------------------------------------------------------ run ----
const PKG = join(ROOT, 'packages', 'fairbooks-bank-reconciliation');
const { manifest } = await import(pathToFileURL(join(PKG, 'src', 'manifest.js')).href);
const results = { date: DATE, sources: [] };
for (const [fmt, s] of Object.entries(SOURCES)) {
  const per = [];
  for (const [f] of s.files) {
    const root = mkdtempSync(join(tmpdir(), 'fb-rd-'));
    try {
      cpSync(join(RAW, fmt, f), join(root, f));
      const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call('recon_read_statement', { bank: f, bank_format: fmt });
      const text = readFileSync(join(RAW, fmt, f), 'latin1');
      const want = RECOUNT[fmt](text);
      if (r.status !== 'executed') { per.push({ file: f, status: r.status, error: String(r.error || r.reason || '').slice(0, 200), recount: want }); continue; }
      const res = r.result; const lines = (res.lines || res.rows || []).length ?? null;
      const agentTotal = res.balance_check ? res.balance_check.lines_total : r2((res.lines || res.rows || []).reduce((t, x) => t + (x.amount || 0), 0));
      per.push({ file: f, status: 'executed', agent: { lines: res.line_count ?? lines, total: agentTotal, opening: res.opening_balance ?? (res.balance_check && res.balance_check.opening) ?? null, closing: res.closing_balance ?? (res.balance_check && res.balance_check.closing) ?? null, ties: res.balance_check ? res.balance_check.ties : null, explained: res.balance_check && res.balance_check.explained || null }, recount: want, summary: String(res.summary || '').slice(0, 220), warnings: (res.warnings || []).slice(0, 5) });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  for (const p of per) if (p.agent) p.agree = p.agent.lines === p.recount.lines && Math.abs((p.agent.total ?? 0) - p.recount.total) < 0.01 && (p.recount.closing === null || p.agent.closing === null || Math.abs(p.agent.closing - p.recount.closing) < 0.01);
  results.sources.push({ format: fmt, name: s.name, url: s.page, licence: s.licence, files: per.length, read: per.filter((p) => p.status === 'executed').length, agree: per.filter((p) => p.agree).length, ties: per.filter((p) => p.agent && p.agent.ties === true).length, per });
}
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', `realdata-${DATE}.json`), JSON.stringify(results, null, 2) + '\n');
for (const s of results.sources) { console.log(`\n## ${s.format}: ${s.read}/${s.files} read, ${s.agree} agree with the re-count, ${s.ties} tie opening + lines = closing`); for (const p of s.per) console.log(`  ${p.file}: ${p.status} ${p.agent ? JSON.stringify(p.agent) : p.error} | recount ${JSON.stringify(p.recount)}${p.agree === false ? '  <-- DIFFERS' : ''}`); }
const md = [`# Real public bank files through Fairbooks Bank Reconciliation (${DATE})`, '', 'Made by `node scripts/realdata.mjs` (downloads with `--download` into the git-ignored `_realdata/`). Each file is read by `recon_read_statement` and, separately, by a small re-count in the script that sums the transaction amounts and reads the balances the file states. Details per file: `realdata-' + DATE + '.json`.', '', '| Source | Licence | Files | Read | Agree with re-count | Opening + lines = closing |', '|---|---|---|---|---|---|', ...results.sources.map((s) => `| [${s.name}](${s.url}) | ${s.licence} | ${s.files} | ${s.read} | ${s.agree} | ${s.ties} |`), ''];
writeFileSync(join(ROOT, 'docs', `realdata-${DATE}.md`), md.join('\n'));
console.log(`\nWrote docs/realdata-${DATE}.json and .md`);
