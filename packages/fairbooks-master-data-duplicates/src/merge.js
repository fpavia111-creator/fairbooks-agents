import { sha256, foldText } from 'fairbooks-core';
import { prepare, pickSurvivor } from './dedupe.js';

export const FIELD_RULES = ['survivor_fill_blank', 'survivor', 'most_complete', 'longest', 'most_common', 'most_recent', 'never'];
// Bank and payment fields are never filled or changed by a merge.
const BANK = /(bank|iban|swift|bic|routing|aba|account ?(no|number)|acct|sort ?code|payment ?method|remit)/i;
// Columns whose values are shown to the model only by their last four characters (final pass, 19 Nov 2026):
// tax ids and bank or account numbers. The merged copy and the undo log on disk keep the real values.
export const SENSITIVE = /(^|[^a-z])(tax ?id|taxid|tin|ein|ssn|vat|rfc|cnpj|cpf|abn|iban|account ?(no|number)|acct|routing|aba|sort ?code|card)([^a-z]|$)/i;
export const maskTail = (v) => { const s = String(v ?? ''); const t = s.replace(/[^0-9A-Za-z]/g, ''); return !s.trim() ? s : t.length <= 4 ? '•••' : `•••${t.slice(-4)}`; };
/** The preview as the model sees it: sensitive columns masked; everything else as computed. */
export function maskPreview(p) {
  const sens = (f) => SENSITIVE.test(String(f)) || BANK.test(String(f)) && !/method|remit|bank ?name/i.test(String(f));
  const mv = (f, v) => (sens(f) ? maskTail(v) : v);
  return { ...p,
    fields: p.fields.map((x) => (sens(x.field) ? { ...x, survivor_value: mv(x.field, x.survivor_value), winner: mv(x.field, x.winner), values: x.values.map((v) => ({ ...v, value: mv(x.field, v.value) })), masked: true } : x)),
    changes: p.changes.map((x) => ({ ...x, from: mv(x.field, x.from), to: mv(x.field, x.to) })),
    conflicts: p.conflicts.map((x) => ({ ...x, values: x.values.map((v) => ({ ...v, value: mv(x.field, v.value) })), kept: mv(x.field, x.kept) })),
    golden_record: Object.fromEntries(Object.entries(p.golden_record).map(([k, v]) => [k, mv(k, v)])),
  };
}
const SYSTEM = /^(merged_into|internalid|id|externalid|entityid|vendorid|itemid|sku)$/i;

/** Survivorship rules file (dupes-rules). Unknown keys fail, so typos are caught. */
export const RULES_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['default_rule'],
  properties: {
    $schema: { type: 'string' },
    default_rule: { enum: FIELD_RULES, description: 'Rule for fields not listed in "fields"' },
    fields: { type: 'object', additionalProperties: { enum: FIELD_RULES }, description: 'Per-column rule, e.g. {"email": "most_recent"}' },
    date_column: { type: 'string', minLength: 1, description: 'Column holding a last-modified date, for most_recent' },
    survivor: {
      type: 'object', additionalProperties: false,
      properties: { prefer_active: { type: 'boolean' }, order: { enum: ['most_complete', 'most_recent', 'lowest_id'] } },
    },
    protected_fields: { type: 'array', items: { type: 'string', minLength: 1 }, description: 'Columns a merge never changes (bank columns are always protected)' },
  },
};

const blank = (v) => !String(v ?? '').trim();

/**
 * Field-level merge preview. For every column: the survivor's value, every record's
 * value, the winner, which record it came from, the rule used, and whether there is a conflict.
 */
export function mergePreview(rows, { survivor, merge, kind, id_column, rules = {} }) {
  const recs = prepare(rows, { kind, id_column });
  const byId = new Map(recs.map((r) => [r.id, r]));
  const S = byId.get(survivor);
  if (!S) throw new Error(`survivor ${survivor} not found`);
  if (!merge || !merge.length) throw new Error('merge must list at least one id');
  if (merge.includes(survivor)) throw new Error('survivor cannot also be merged');
  const M = merge.map((m) => { const r = byId.get(m); if (!r) throw new Error(`id ${m} not found`); return r; });
  const group = [S, ...M];
  const suggested = pickSurvivor(group, { ...(rules.survivor || {}), date_column: rules.date_column });
  const protectedSet = new Set((rules.protected_fields || []).map((f) => f.toLowerCase()));
  const dateOf = (r) => { const t = Date.parse(String(r.raw[rules.date_column] ?? '')); return Number.isFinite(t) ? t : -Infinity; };
  const columns = [...new Set(group.flatMap((r) => Object.keys(r.raw)))];
  const fields = [];
  for (const f of columns) {
    if (SYSTEM.test(f)) continue;
    const values = group.map((r) => ({ id: r.id, value: String(r.raw[f] ?? '') }));
    const filled = values.filter((v) => !blank(v.value));
    // Compared without case, accents, spaces or punctuation, in any script (CJK values used to
    // compare as empty, so a conflict between two Japanese addresses was never shown).
    const distinct = [...new Set(filled.map((v) => foldText(v.value).replace(/ /g, '')))];
    let rule = (rules.fields && rules.fields[f]) || rules.default_rule || 'survivor_fill_blank';
    if (BANK.test(f) || protectedSet.has(f.toLowerCase())) rule = 'never';
    if (rule === 'most_recent' && !rules.date_column) rule = 'survivor_fill_blank';
    let win = values[0];
    if (rule === 'survivor_fill_blank') win = blank(values[0].value) ? filled[0] || values[0] : values[0];
    else if (rule === 'most_complete' || rule === 'longest') win = [...filled].sort((a, b) => b.value.trim().length - a.value.trim().length)[0] || values[0];
    else if (rule === 'most_common') { const c = new Map(); for (const v of filled) { const k = v.value.trim().toLowerCase(); c.set(k, (c.get(k) || 0) + 1); } win = [...filled].sort((a, b) => c.get(b.value.trim().toLowerCase()) - c.get(a.value.trim().toLowerCase()))[0] || values[0]; }
    else if (rule === 'most_recent') { const order = group.map((r, i) => ({ r, i })).sort((a, b) => dateOf(b.r) - dateOf(a.r) || a.i - b.i); win = order.map((o) => values[o.i]).find((v) => !blank(v.value)) || values[0]; }
    // 'survivor' and 'never' keep the survivor's value.
    fields.push({ field: f, rule, survivor_value: values[0].value, values, winner: win.value, winner_from: win.id, changed: win.value !== values[0].value, conflict: distinct.length > 1 });
  }
  const changes = fields.filter((x) => x.changed);
  return {
    survivor, merge, suggested_survivor: suggested.id, survivor_matches_suggestion: suggested.id === survivor,
    fields, changes: changes.map((x) => ({ field: x.field, from: x.survivor_value, to: x.winner, winner_from: x.winner_from, rule: x.rule })),
    conflicts: fields.filter((x) => x.conflict).map((x) => ({ field: x.field, values: x.values.filter((v) => !blank(v.value)), kept: x.winner, rule: x.rule })),
    golden_record: Object.fromEntries([...Object.entries(S.raw)].map(([k, v]) => { const fl = fields.find((x) => x.field === k); return [k, fl ? fl.winner : v]; })),
    note: 'Preview only. Bank and payment columns are never changed. Nothing is written until dupes_apply_merge runs with fill_survivor.',
  };
}

// ---- Undo log --------------------------------------------------------------------
// One JSON line per applied merge: hashes before/after and the old text of each changed
// line (or the whole old text when the line count changed). Undo pops the last entry.

export function undoEntry(beforeText, afterText, meta) {
  const e = { ...meta, before_sha256: beforeText === null ? null : sha256(beforeText), after_sha256: sha256(afterText) };
  if (beforeText === null) return { ...e, before_absent: true };
  const a = beforeText.split('\n'), b = afterText.split('\n');
  if (a.length !== b.length) return { ...e, before_text: beforeText };
  const lines = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) lines.push([i, a[i]]);
  return { ...e, lines };
}

/** Reverse one entry. Refuses when the copy changed since the merge. Returns the restored text, or null when the copy did not exist before. */
export function applyUndo(currentText, entry) {
  if (sha256(currentText) !== entry.after_sha256) throw new Error('the merged copy has changed since this merge (hash mismatch); undo refused so nothing is lost');
  if (entry.before_absent) return null;
  let text;
  if (entry.before_text !== undefined) text = entry.before_text;
  else { const L = currentText.split('\n'); for (const [i, v] of entry.lines) L[i] = v; text = L.join('\n'); }
  if (sha256(text) !== entry.before_sha256) throw new Error('undo did not reproduce the earlier copy (hash mismatch)');
  return text;
}
