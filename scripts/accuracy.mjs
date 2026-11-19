#!/usr/bin/env node
// Accuracy on the fictional fixtures, for the agents in scripts/accuracy-specs.mjs:
//   1. planted set: the eval case named in the spec, on the demo fixtures. Recall = planted finding codes
//      found / planted codes listed in the spec (taken from the fixture notes and the eval case). Any other
//      finding on that run is listed as unplanned.
//   2. clean set: the same files with every planted problem removed (written to fixtures/clean/ with
//      --write). Every finding there is a false positive.
//   3. mutation cases: one edit to the clean set that must raise one named finding.
// Findings are read with scripts/lib/findings.mjs (the agents' results differ in shape).
//
//   node scripts/accuracy.mjs --write [agent ...]   regenerate fixtures/clean/ from the specs, then measure
//   node scripts/accuracy.mjs [agent ...]           measure (exit 1 when a clean set is stale or a number is off)
//   node scripts/accuracy.mjs --record              also write docs/accuracy-<date>.json and .md
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime, parseCsvRows } from '../packages/fairbooks-core/src/index.js';
import { collectCodes, EXTRA, SKIP } from './lib/findings.mjs';
import { SPECS } from './accuracy-specs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PK = join(ROOT, 'packages');
const argv = process.argv.slice(2);
const write = argv.includes('--write'); const record = argv.includes('--record');
const only = argv.filter((a) => !a.startsWith('--'));
const DATE = '2026-11-19';

// ---------------------------------------------------------------- files ----
const readTable = (text) => { const rows = parseCsvRows(text).filter((r) => r.some((c) => String(c).trim() !== '')); const head = rows[0]; return { head, rows: rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))) }; };
const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const tableText = (t) => [t.head.map(cell).join(','), ...t.rows.map((r) => t.head.map((h) => cell(r[h])).join(','))].join('\n') + '\n';
const hits = (r, where) => Object.entries(where).every(([k, v]) => String(r[k] ?? '').trim() === String(v));
// files: { relPath: text }. Ops: CSV ['set'|'drop'|'dropLast'|'add', file, ...] as in the other families,
// and ['text', file, from, to] for any text file (JSON, notes, receipts).
function apply(files, op, label) {
  const [kind, file] = op;
  if (!(file in files)) throw new Error(`${label}: no file ${file}`);
  if (kind === 'text') { const [, , from, to] = op; if (!files[file].includes(from)) throw new Error(`${label}: "${from}" not in ${file}`); files[file] = files[file].split(from).join(to); return; }
  const t = readTable(files[file]);
  if (kind === 'add') t.rows.push(Object.fromEntries(t.head.map((h) => [h, op[2][h] ?? ''])));
  else {
    const idx = t.rows.map((r, i) => (hits(r, op[2]) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) throw new Error(`${label}: ${JSON.stringify(op[2])} matches no row of ${file}`);
    if (kind === 'drop') t.rows = t.rows.filter((_, i) => !idx.includes(i));
    else if (kind === 'dropLast') t.rows.splice(idx.at(-1), 1);
    else if (kind === 'set') for (const i of idx) for (const [k, v] of Object.entries(op[3])) { if (!t.head.includes(k)) throw new Error(`${label}: ${file} has no column ${k}`); t.rows[i][k] = v; }
    else throw new Error(`${label}: unknown edit ${kind}`);
  }
  files[file] = tableText(t);
}

async function runCase(n, manifest, c, files, ignore = []) {
  const root = mkdtempSync(join(tmpdir(), 'fb-acc-'));
  try {
    // Whole path segments only: "fairbooks-out" is also the start of "fairbooks-outreach-email-gate".
    cpSync(join(PK, n), root, { recursive: true, filter: (p) => !/[\\/](node_modules|\.fairbooks|fairbooks-out|\.mythos|mythos-out)([\\/]|$)|[\\/]fixtures[\\/]clean([\\/]|$)/.test(p) });
    for (const [f, text] of Object.entries(files || {})) writeFileSync(join(root, f), text);
    const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call(c.tool, c.args || {});
    if (r.status !== 'executed') throw new Error(`${n} ${c.tool}: ${r.status} ${r.error || r.reason || ''}`);
    const codes = SKIP[n] ? EXTRA[n](r.result) : collectCodes(r.result, EXTRA[n]);
    return codes.filter((x) => !ignore.includes(x)); // informational tags the spec names (e.g. an admin role is a review priority, not a problem)
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const tally = (codes) => { const m = new Map(); for (const c of codes) m.set(c, (m.get(c) || 0) + 1); return m; };

const results = []; let problems = 0;
const agents = readdirSync(PK).filter((n) => n !== 'fairbooks-core' && existsSync(join(PK, n, 'src', 'manifest.js')) && (!only.length || only.includes(n))).sort();
for (const n of agents) {
  const spec = SPECS[n];
  if (!spec) { results.push({ agent: n, measured: false }); continue; }
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'manifest.js')).href);
  const data = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8'));
  const found = (data.cases || data).find((x) => x.id === spec.case);
  if (!found) throw new Error(`${n}: no eval case ${spec.case}`);
  const c = spec.args ? { ...found, args: { ...found.args, ...spec.args } } : found; // e.g. closing balances of the clean month
  const r = { agent: n, measured: true, case: spec.case, tool: c.tool, planted_total: 0, planted_found: 0, missed: [], unplanned: [], clean_rows: null, clean_findings: null, mutation_cases: spec.mutations.length, mutation_caught: 0, mutation_missed: [], note: spec.note || null };

  // 1. planted set
  const got = tally(await runCase(n, manifest, found, null, spec.ignore)); // the published case as it is
  const want = tally(spec.planted);
  for (const [code, k] of want) { r.planted_total += k; const f = Math.min(k, got.get(code) || 0); r.planted_found += f; if (f < k) r.missed.push(`${code} (${f}/${k})`); }
  for (const [code, k] of got) { const extraN = k - (want.get(code) || 0); if (extraN > 0) r.unplanned.push(`${code}${extraN > 1 ? ` x${extraN}` : ''}`); }

  // 2. clean set
  const touched = [...new Set([...spec.clean, ...spec.mutations.map((m) => m.op)].map((o) => o[1]))];
  const base = Object.fromEntries(touched.map((f) => [f, readFileSync(join(PK, n, f), 'utf8').replace(/\r\n/g, '\n')]));
  const clean = { ...base }; for (const op of spec.clean) apply(clean, op, `${n} clean`);
  const changed = Object.keys(clean).filter((f) => clean[f] !== base[f]);
  for (const f of changed) {
    const p = join(PK, n, 'fixtures', 'clean', f.replace(/^fixtures\//, ''));
    if (write) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, clean[f]); }
    else if (!existsSync(p) || readFileSync(p, 'utf8').replace(/\r\n/g, '\n') !== clean[f]) { console.log(`${n}: fixtures/clean/${f.replace(/^fixtures\//, '')} is out of date (run with --write)`); problems++; }
  }
  if (write && changed.length) writeFileSync(join(PK, n, 'fixtures', 'clean', 'README.md'), `# Clean set\n\nThe demo files with every planted problem removed and nothing else changed, made by \`scripts/accuracy.mjs\` from \`scripts/accuracy-specs.mjs\` in the repository (eval case \`${spec.case}\`, files: ${changed.map((f) => `\`${f}\``).join(', ')}). The check must report no findings on these files. Fictional data.\n`);
  r.clean_rows = changed.reduce((t, f) => t + (/\.csv$/i.test(f) ? readTable(clean[f]).rows.length : 0), 0);
  r.clean_findings = await runCase(n, manifest, c, clean, spec.ignore);

  // 3. mutations on the clean set
  for (const m of spec.mutations) {
    const files = { ...clean }; apply(files, m.op, `${n} mutation ${m.id}`);
    const codes = await runCase(n, manifest, c, files, spec.ignore);
    if (codes.includes(m.expect)) r.mutation_caught++; else r.mutation_missed.push(`${m.id}: expected ${m.expect}, got ${[...new Set(codes)].join(', ') || 'nothing'}`);
  }
  const ok = r.planted_found === r.planted_total && !r.unplanned.length && !r.clean_findings.length && r.mutation_caught === r.mutation_cases;
  if (!ok) problems++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}: planted ${r.planted_found}/${r.planted_total}, unplanned ${r.unplanned.length}, clean ${r.clean_findings.length} finding(s) on ${r.clean_rows} rows, mutations ${r.mutation_caught}/${r.mutation_cases}`);
  for (const x of r.missed) console.log(`       missed      ${x}`);
  for (const x of r.unplanned) console.log(`       unplanned   ${x}`);
  for (const x of [...new Set(r.clean_findings)]) console.log(`       clean FP    ${x}`);
  for (const x of r.mutation_missed) console.log(`       not caught  ${x}`);
  results.push(r);
}

const m = results.filter((r) => r.measured);
const sum = (k) => m.reduce((t, r) => t + (r[k] || 0), 0);
const fam = { date: DATE, agents: results.length, measured_agents: m.length, planted_total: sum('planted_total'), planted_found: sum('planted_found'), unplanned: m.reduce((t, r) => t + r.unplanned.length, 0), clean_rows: sum('clean_rows'), clean_false_positives: m.reduce((t, r) => t + r.clean_findings.length, 0), mutation_cases: sum('mutation_cases'), mutation_caught: sum('mutation_caught'), not_measured: results.filter((r) => !r.measured).map((r) => r.agent) };
console.log(`\n${fam.measured_agents} of ${fam.agents} agent(s) measured: planted ${fam.planted_found}/${fam.planted_total} found, ${fam.unplanned} unplanned finding(s); clean set ${fam.clean_false_positives} false positive(s) on ${fam.clean_rows} rows; mutations ${fam.mutation_caught}/${fam.mutation_cases} caught. Not measured: ${fam.not_measured.length}.`);
if (record) {
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', `accuracy-${DATE}.json`), JSON.stringify({ family: fam, agents: results }, null, 2) + '\n');
  const L = [`# Accuracy on the fictional fixtures (${DATE})`, '', 'Made by `node scripts/accuracy.mjs --record`. For each measured agent: the planted problems are the ones its fixture notes and its main eval case name; the clean set is `fixtures/clean/` (the same files with those problems removed); a mutation case changes one field of the clean set and expects one named finding. The specs, clean sets and mutations were written by the same author as the rules, in the final pass. All data is fictional: these numbers say the rules do what they are written to do on data built to test them, not how they will do on a real company\'s exports (see `realdata-2026-11-19.md` for public files).', '',
    `**Measured:** ${fam.measured_agents} of ${fam.agents} agents (the agents behind the four engagements on the product page). ${fam.planted_found} of ${fam.planted_total} planted problems found, ${fam.unplanned} unplanned findings, ${fam.clean_false_positives} findings on ${fam.clean_rows} clean rows, ${fam.mutation_caught} of ${fam.mutation_cases} mutation cases caught.`, '',
    `**Not measured yet:** ${fam.not_measured.join(', ')}. Their planted problems are asserted by their eval cases (all pass), but they have no clean set or mutation cases yet.`, '',
    '| Agent | Eval case | Planted found | Unplanned | Clean rows | Findings on clean | Mutations caught |', '|---|---|---|---|---|---|---|',
    ...m.map((r) => `| ${r.agent} | \`${r.case}\` | ${r.planted_found}/${r.planted_total} | ${r.unplanned.length} | ${r.clean_rows} | ${r.clean_findings.length} | ${r.mutation_caught}/${r.mutation_cases} |`), ''];
  for (const r of m.filter((x) => x.note)) L.push(`- ${r.agent}: ${r.note}`);
  writeFileSync(join(ROOT, 'docs', `accuracy-${DATE}.md`), L.join('\n') + '\n');
  console.log(`Wrote docs/accuracy-${DATE}.json and .md`);
}
process.exit(problems ? 1 : 0);
