import { toCsv, jaroWinkler, normalizeAddress, tokenSetSimilarity } from 'mythos-agent-core';

const SUFFIX = /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|sas|bv|pty|the|and|&)\b/g;
export function normName(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const domain = (e) => { const m = String(e ?? '').toLowerCase().match(/@([a-z0-9.-]+)$/); return m && !/^(gmail|yahoo|outlook|hotmail|icloud|aol)\./.test(m[1]) ? m[1] : ''; };

function bigrams(s) { const t = s.replace(/ /g, ''); const out = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); } return out; }
/** Sørensen–Dice similarity on character bigrams, 0..1. */
export function dice(a, b) {
  if (!a || !b) return 0; if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b); let inter = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v; for (const v of B.values()) nb += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
  return na + nb ? (2 * inter) / (na + nb) : 0;
}
const tokenSort = (s) => s.split(' ').sort().join(' ');

function col(row, names) {
  const keys = Object.keys(row);
  for (const want of names) { const k = keys.find((x) => x.toLowerCase().replace(/[^a-z]/g, '') === want); if (k) return row[k]; }
  return '';
}

const FIELDS = {
  vendor: { id: ['internalid', 'id', 'vendorid', 'entityid', 'externalid'], name: ['companyname', 'vendorname', 'name', 'legalname', 'entityid'], tax: ['taxid', 'ein', 'vatnumber', 'tin', 'vat'], email: ['email'], phone: ['phone', 'telephone'], addr: ['address', 'address1', 'billaddress', 'street'] },
  item: { id: ['internalid', 'id', 'itemid', 'sku', 'externalid'], name: ['displayname', 'name', 'itemname', 'description', 'salesdescription'], tax: ['upc', 'upccode', 'gtin', 'ean', 'mpn', 'manufacturerpartnumber'], email: [], phone: [], addr: [] },
};
export const DEFAULT_THRESHOLD = 0.92;

/** Tax id / UPC key: digits only when there are enough digits, else lowercase letters and digits. */
export function normTax(v) {
  const s = String(v ?? '').trim();
  const d = s.replace(/\D/g, '');
  return d.length >= 5 ? d : s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Symmetric Monge-Elkan: each token's best Jaro-Winkler match on the other side, averaged both ways. */
export function mongeElkan(a, b) {
  const A = a.split(' ').filter(Boolean), B = b.split(' ').filter(Boolean);
  if (!A.length || !B.length) return 0;
  const one = (X, Y) => X.reduce((s, x) => s + Math.max(...Y.map((y) => jaroWinkler(x, y))), 0) / X.length;
  return Math.min(one(A, B), one(B, A));
}

/** Name similarity in [0, 1]: best of Jaro-Winkler on the normalized name, on sorted tokens, and token-level Monge-Elkan. */
export function nameScore(nnA, nnB) {
  if (!nnA || !nnB) return 0;
  if (nnA === nnB) return 1;
  return Math.max(jaroWinkler(nnA, nnB), jaroWinkler(tokenSort(nnA), tokenSort(nnB)), mongeElkan(nnA, nnB));
}

const houseNo = (a) => (a.match(/^\d+/) || [''])[0];
export function sameAddress(a, b) {
  if (!a || !b || a.length < 6 || b.length < 6) return false;
  if (a === b) return true;
  const ha = houseNo(a), hb = houseNo(b);
  if (ha && hb && ha !== hb) return false;
  return jaroWinkler(a, b) >= 0.93 || tokenSetSimilarity(a, b) >= 0.8;
}

export function prepare(rows, opts = {}) {
  const kind = opts.kind === 'item' ? 'item' : 'vendor';
  const F = FIELDS[kind];
  return rows.map((r, i) => {
    const id = String((opts.id_column ? r[opts.id_column] : col(r, F.id)) || `row-${i + 2}`).trim();
    const name = String((opts.name_column ? r[opts.name_column] : col(r, F.name)) || '').trim();
    const nn = normName(name);
    return { i, id, name, nn, ts: tokenSort(nn), tax: normTax(col(r, F.tax)), email: domain(col(r, F.email)), phone: digits(col(r, F.phone)).slice(-10), addr: normalizeAddress(col(r, F.addr)), inactive: /^(t|true|yes|1|inactive)$/i.test(String(col(r, ['isinactive', 'inactive']) || '')), raw: r };
  });
}

/**
 * Candidate pairs. Small files compare every pair. Larger files use blocking keys
 * (name-token prefixes, tax id, phone, house number + street, email domain); very
 * common name tokens are skipped as keys so blocks stay small. Deterministic.
 */
export function candidatePairs(recs, { full_compare_below = 400 } = {}) {
  const n = recs.length; const out = [];
  if (n <= full_compare_below) { for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push([a, b]); return { pairs: out, blocking: false }; }
  const blocks = new Map();
  const add = (k, i) => { if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push(i); };
  for (const r of recs) {
    for (const t of new Set(r.nn.split(' '))) if (t.length >= 3) { add('n:' + t.slice(0, 4), r.i); add('s:' + t.slice(-4), r.i); }
    if (r.nn) add('j:' + r.nn.replace(/ /g, '').slice(0, 6), r.i);
    if (r.tax && r.tax.length >= 5) add('t:' + r.tax, r.i);
    if (r.phone && r.phone.length >= 7) add('p:' + r.phone, r.i);
    const h = houseNo(r.addr); if (h) add('a:' + h + ':' + (r.addr.split(' ')[1] || ''), r.i);
    if (r.email) add('e:' + r.email, r.i);
  }
  const cap = Math.max(60, Math.ceil(n * 0.03));
  const seen = new Set();
  for (const [k, ids] of [...blocks.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (ids.length < 2) continue;
    if (ids.length > cap && !/^[tp]:/.test(k)) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const a = Math.min(ids[x], ids[y]), b = Math.max(ids[x], ids[y]); const key = a * n + b;
      if (!seen.has(key)) { seen.add(key); out.push([a, b]); }
    }
  }
  out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return { pairs: out, blocking: true };
}

/** Score one pair. Returns null when there is no reason to link them. */
export function scorePair(A, B, { kind = 'vendor', threshold = DEFAULT_THRESHOLD } = {}) {
  const reasons = []; let score = 0;
  const sim = nameScore(A.nn, B.nn);
  const sameName = !!A.nn && A.nn === B.nn;
  const sameTax = A.tax.length >= 5 && A.tax === B.tax;
  const diffTax = A.tax.length >= 5 && B.tax.length >= 5 && A.tax !== B.tax;
  const addr = sameAddress(A.addr, B.addr), phone = !!A.phone && A.phone.length >= 7 && A.phone === B.phone, email = !!A.email && A.email === B.email;
  const signals = { name: Math.round(sim * 100) / 100, tax: sameTax ? 'same' : diffTax ? 'different' : 'missing', address: A.addr && B.addr ? (addr ? 'same' : 'different') : 'missing', phone: A.phone && B.phone ? (phone ? 'same' : 'different') : 'missing', email_domain: A.email && B.email ? (email ? 'same' : 'different') : 'missing' };
  if (sameName) { reasons.push('same normalized name'); score = 0.95; }
  else if (sim >= threshold) { reasons.push(`similar name (${sim.toFixed(2)})`); score = Math.min(0.94, sim); }
  if (sameTax) { reasons.push(kind === 'vendor' ? 'same tax id' : 'same UPC/part number'); score = Math.max(score, 0.99); }
  const support = [];
  if (email) support.push('same email domain');
  if (phone) support.push('same phone');
  if (addr) support.push('same address');
  if (!reasons.length && sim >= 0.8 && (addr || phone)) { reasons.push(`name partly similar (${sim.toFixed(2)}) with same ${addr ? 'address' : 'phone'}`); score = 0.85; }
  if (!reasons.length && support.length >= 2 && sim >= 0.6) { reasons.push(`name partly similar (${sim.toFixed(2)})`); score = 0.8; }
  if (!reasons.length) return null;
  if (diffTax) { reasons.push('DIFFERENT tax ids — may be separate legal entities'); score = Math.min(score, 0.6); }
  else if (!sameTax && signals.address === 'different' && signals.phone === 'different') { reasons.push('different address and phone — may be a different business with a similar name'); score = Math.min(score, 0.7); }
  reasons.push(...support);
  score = Math.min(1, score + 0.02 * support.length);
  return { score: Math.round(score * 100) / 100, reasons, signals };
}

/** Find likely duplicate vendors or items. Returns clusters with reasons and a suggested survivor. */
export function findDuplicates(rows, opts = {}) {
  const kind = opts.kind === 'item' ? 'item' : 'vendor';
  const threshold = Number(opts.threshold ?? DEFAULT_THRESHOLD);
  const recs = prepare(rows, { ...opts, kind });
  const parent = recs.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const cand = candidatePairs(recs, opts);
  const pairs = [];
  for (const [a, b] of cand.pairs) {
    const A = recs[a], B = recs[b];
    const s = scorePair(A, B, { kind, threshold });
    if (!s) continue;
    pairs.push({ a: A.id, b: B.id, ...s });
    if (s.score >= 0.75) parent[find(a)] = find(b);
  }
  const groups = new Map();
  recs.forEach((r, i) => { const p = find(i); if (!groups.has(p)) groups.set(p, []); groups.get(p).push(r); });
  const order = opts.survivor_rules || {};
  const clusters = [...groups.values()].filter((g) => g.length > 1).map((g) => {
    const ids = new Set(g.map((x) => x.id));
    const ps = pairs.filter((p) => ids.has(p.a) && ids.has(p.b));
    const survivor = pickSurvivor(g, order);
    return {
      confidence: Math.min(...ps.filter((p) => p.score >= 0.75).map((p) => p.score)),
      survivor: survivor.id, merge: g.filter((x) => x !== survivor).map((x) => x.id),
      records: g.map((x) => ({ id: x.id, name: x.name, inactive: x.inactive })),
      reasons: [...new Set(ps.flatMap((p) => p.reasons))],
      pairs: ps.map((p) => ({ a: p.a, b: p.b, score: p.score, signals: p.signals })),
    };
  }).sort((x, y) => y.confidence - x.confidence || x.survivor.localeCompare(y.survivor)).map((c, n) => ({ cluster: `C${String(n + 1).padStart(3, '0')}`, ...c }));
  return {
    kind, threshold, records: recs.length, compared_pairs: cand.pairs.length, blocking: cand.blocking, clusters: clusters.length, records_in_clusters: clusters.reduce((s, c) => s + c.records.length, 0),
    proposals: clusters, weak_pairs: pairs.filter((p) => p.score < 0.75),
    note: 'Proposals only. Check open transactions, balances, bank details and 1099/tax status before merging anything in the ERP.',
  };
}

const filledCount = (r) => Object.values(r.raw).filter((v) => String(v ?? '').trim()).length;
/** Survivor: active first, then most complete (default), most recent (date_column) or lowest id; id breaks ties. */
export function pickSurvivor(group, rules = {}) {
  const preferActive = rules.prefer_active !== false;
  const by = rules.order || 'most_complete';
  const dateOf = (r) => { const t = Date.parse(String(r.raw[rules.date_column] ?? '')); return Number.isFinite(t) ? t : -Infinity; };
  return [...group].sort((x, y) => (preferActive ? x.inactive - y.inactive : 0)
    || (by === 'most_recent' && rules.date_column ? dateOf(y) - dateOf(x) : 0)
    || (by !== 'lowest_id' ? filledCount(y) - filledCount(x) : 0)
    || x.id.localeCompare(y.id))[0];
}

export function proposalsCsv(res) {
  return toCsv(res.proposals.map((c) => ({ cluster: c.cluster, confidence: c.confidence, survivor: c.survivor, merge_ids: c.merge.join(' '), names: c.records.map((r) => r.name).join(' | '), reasons: c.reasons.join('; '), reviewer_decision: '', reviewer_name: '', review_date: '' })),
    ['cluster', 'confidence', 'survivor', 'merge_ids', 'names', 'reasons', 'reviewer_decision', 'reviewer_name', 'review_date']);
}

/** Apply ONE merge to a copy of the rows: duplicates get merged_into = survivor. Input is never modified. */
export function applyMerge(rows, { id_column, survivor, merge, kind }) {
  const F = FIELDS[kind === 'item' ? 'item' : 'vendor'];
  const idOf = (r, i) => String((id_column ? r[id_column] : col(r, F.id)) || `row-${i + 2}`).trim();
  const ids = rows.map(idOf);
  if (!ids.includes(survivor)) throw new Error(`survivor ${survivor} not found`);
  const want = new Set(merge);
  if (!want.size) throw new Error('merge must list at least one id');
  if (want.has(survivor)) throw new Error('survivor cannot also be merged');
  for (const m of want) if (!ids.includes(m)) throw new Error(`id ${m} not found`);
  let changed = 0;
  const out = rows.map((r, i) => { const o = { ...r, merged_into: r.merged_into || '' }; if (want.has(ids[i])) { o.merged_into = survivor; changed++; } return o; });
  return { rows: out, changed };
}
