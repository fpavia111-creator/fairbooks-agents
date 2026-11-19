// Finding codes in a Fairbooks tool result, for the accuracy measure. The agents were built one by one,
// so their results differ; this collects the problem markers they use:
//   - objects with a "code", or a "check" next to a severity, decision or detail (finding records);
//   - lists named flags, issues, exceptions, codes, problems or reasons, keeping the entries that are
//     codes (no spaces; "stale_166_days", "duplicate_of_C1") and leaving the sentences out;
//   - a "problem" string (broken log lines);
//   - per-agent markers passed in as `extra` (unmatched reconciling items, duplicate clusters).
// Severity "info" and "ok" records are not problems and are left out.
const LISTS = new Set(['flags', 'issues', 'exceptions', 'codes', 'problems', 'reasons', 'exception_codes']);
const QUIET = new Set(['info', 'ok', 'pass', 'none']);
export function collectCodes(result, extra = null) {
  const out = [];
  const walk = (v, key) => {
    if (Array.isArray(v)) { for (const x of v) { if (LISTS.has(key) && typeof x === 'string') { if (!/\s/.test(x)) out.push(x); } else walk(x, key); } return; }
    if (!v || typeof v !== 'object') return;
    const quiet = QUIET.has(String(v.severity || '').toLowerCase());
    if (typeof v.code === 'string' && !quiet) out.push(v.code);
    else if (typeof v.check === 'string' && ('severity' in v || 'decision' in v || 'detail' in v) && !quiet) out.push(v.check);
    if (typeof v.problem === 'string') out.push(v.problem);
    for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object') walk(x, k);
  };
  walk(result, '');
  if (extra) out.push(...extra(result));
  return out;
}
/** Per-agent markers the generic walk does not see. */
export const EXTRA = {
  // Reconciling items: every bank-only or GL-only line is something a person posts or follows up.
  'fairbooks-bank-reconciliation': (r) => [...(r.bank_only || []), ...(r.gl_only || [])].map((x) => x.kind || 'unmatched').concat(r.balance && r.balance.ties === false ? ['balances_do_not_tie'] : []),
  // A proposed merge cluster is the finding; a weak pair is a lower-level one.
  'fairbooks-master-data-duplicates': (r) => [...(r.proposals || []).map(() => 'duplicate_cluster'), ...(r.weak_pairs || []).map(() => 'weak_pair')],
};
export const SKIP = {
  // The match reasons of a duplicate cluster are explanations, not separate findings.
  'fairbooks-master-data-duplicates': true,
};
