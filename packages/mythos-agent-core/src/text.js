// Shared text matching helpers: Jaro-Winkler, Levenshtein, token-set similarity,
// name/address normalisation and Shannon entropy. Deterministic, no dependencies.

export function levenshtein(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(s1, s2, { prefixScale = 0.1 } = {}) {
  s1 = String(s1 ?? ''); s2 = String(s2 ?? '');
  if (s1 === s2) return s1.length ? 1 : 1;
  if (!s1.length || !s2.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const m1 = new Array(s1.length).fill(false), m2 = new Array(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(s2.length, i + range + 1); j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  const jaro = (matches / s1.length + matches / s2.length + (matches - t / 2) / matches) / 3;
  let p = 0; while (p < 4 && p < s1.length && p < s2.length && s1[p] === s2[p]) p++;
  return jaro + p * prefixScale * (1 - jaro);
}

const STOP = new Set(['the', 'and', 'of', '&']);
const ENTITY = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|sarl|bv|nv|pty|lp|llp|pc)\b\.?/g;

/** Lowercase, strip accents, punctuation and legal suffixes (Inc, LLC, Ltd…). */
export function normalizeName(s, { stripEntity = true } = {}) {
  let t = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ');
  t = t.replace(/[^a-z0-9\s.]/g, ' ');
  if (stripEntity) t = t.replace(ENTITY, ' ');
  return t.replace(/\./g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).join(' ');
}

const ADDR = [[/\bstreet\b/g, 'st'], [/\bavenue\b/g, 'ave'], [/\broad\b/g, 'rd'], [/\bboulevard\b/g, 'blvd'], [/\bdrive\b/g, 'dr'], [/\blane\b/g, 'ln'], [/\bsuite\b/g, 'ste'], [/\bapartment\b/g, 'apt'], [/\bnorth\b/g, 'n'], [/\bsouth\b/g, 's'], [/\beast\b/g, 'e'], [/\bwest\b/g, 'w'], [/\bplace\b/g, 'pl'], [/\bcourt\b/g, 'ct'], [/\bhighway\b/g, 'hwy'], [/\bparkway\b/g, 'pkwy'], [/#/g, ' ste ']];

/** Normalise a postal address (USPS-style abbreviations, punctuation removed). */
export function normalizeAddress(s) {
  let t = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [re, rep] of ADDR) t = t.replace(re, rep);
  return t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Token-set similarity (Jaccard on words) in [0, 1]. */
export function tokenSetSimilarity(a, b) {
  const A = new Set(String(a ?? '').split(/\s+/).filter(Boolean)), B = new Set(String(b ?? '').split(/\s+/).filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Best-of similarity for business names: Jaro-Winkler on normalised strings and on sorted tokens. */
export function nameSimilarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  const sorted = (s) => s.split(' ').sort().join(' ');
  return Math.max(jaroWinkler(na, nb), jaroWinkler(sorted(na), sorted(nb)), tokenSetSimilarity(na, nb));
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(s) {
  s = String(s ?? ''); if (!s) return 0;
  const f = new Map(); for (const c of s) f.set(c, (f.get(c) || 0) + 1);
  let h = 0; for (const n of f.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

/** Mask all but the last `keep` characters of a secret-ish value. */
export function maskValue(v, keep = 4) {
  const s = String(v ?? '');
  if (s.length <= keep) return '•'.repeat(s.length);
  return '•'.repeat(Math.min(8, s.length - keep)) + s.slice(-keep);
}

// ---------------------------------------------------------------------------
// Text in data that reads like instructions to an AI
// ---------------------------------------------------------------------------

const INJECTION_SIGNALS = [
  ['override_instructions', /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.\n]{0,30}\b(instructions?|prompts?|rules|guidelines|directions)\b/i],
  ['role_change', /\byou are now\b|\bact as (an? |the )?(system|admin|administrator|developer)\b|\bnew instructions?\s*:/i],
  ['system_prompt', /\b(system prompt|developer message)\b/i],
  ['hide_from_person', /\b(do not|don't|never) (tell|inform|alert|notify|show|mention (this |it )?to) the (user|human|operator|reviewer|person)\b/i],
  ['chat_markup', /<\/?(system|assistant|tool_result|function_calls|antml:[a-z_]+)\b|<\|im_(start|end)\|>|\[\/?INST\]/i],
  ['tool_steering', /\b(call|invoke|run|use) (the )?(tool|function) [a-z_]{3,}|\bapprove (this|the) (request|payment|refund|transfer|change)\b[^.\n]{0,20}\b(automatically|without (asking|review|approval))/i],
  ['hidden_characters', /[‪-‮⁦-⁩​]|[\u{E0000}-\u{E007F}]/u],
];

/**
 * Names of the signals found in a string: phrases that try to redirect an AI
 * model ("ignore previous instructions", fake chat markup, "do not tell the
 * user"), and invisible or direction-flipping characters used to hide them.
 * A heuristic with a short, high-precision list: it catches the common shapes
 * and misses others, so it is a warning light, not a filter.
 */
export function injectionSignals(text) {
  const s = String(text ?? '');
  return INJECTION_SIGNALS.filter(([, re]) => re.test(s)).map(([name]) => name);
}
