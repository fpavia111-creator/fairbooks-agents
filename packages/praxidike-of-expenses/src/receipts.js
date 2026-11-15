import { sha256, round2 } from 'mythos-agent-core';

// Receipt text normalisation for text you already have (from your scanner, card
// feed or OCR tool). Praxidike does no OCR itself and never returns receipt text:
// only the merchant line, totals, dates, currency and a content hash.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const AMT = String.raw`(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})`;
// Label → priority. Higher wins when picking "the" total. "(?<![a-z])" keeps "Subtotal" out.
const LABELS = [
  ['grand\\s+total', 4], ['total\\s+due', 3], ['amount\\s+due', 3], ['balance\\s+due', 3], ['total\\s+to\\s+pay', 3],
  ['amount\\s+paid', 1], ['total', 2], ['gesamt(?:betrag)?', 2], ['summe', 2], ['montant', 2], ['balance', 1], ['paid', 1], ['amount', 1],
];
const TOTAL_RE = new RegExp(`(?<![a-z])(${LABELS.map(([l]) => l).join('|')})(?![a-z])[^\\d\\n]{0,20}?${AMT}`, 'gi');
const prio = (label) => { const l = label.toLowerCase(); for (const [re, p] of LABELS) if (new RegExp(`^${re}$`).test(l)) return p; return 0; };
const labelled = (re, t) => { const m = new RegExp(`(?<![a-z])(?:${re})(?![a-z])[^\\d\\n]{0,20}?${AMT}`, 'i').exec(t); return m ? parseAmount(m[1]) : null; };

/** Parse 1,234.50 / 1.234,50 / 45,90 / 45.90 into a number (2 decimals). */
export function parseAmount(s) {
  let t = String(s ?? '').replace(/[^\d.,-]/g, '');
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(t) || /^\d+,\d{2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return t && Number.isFinite(n) ? round2(n) : null;
}

const utc = (y, m, d) => { const t = Date.UTC(y, m - 1, d); const x = new Date(t); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? t : null; };
/** All dates in the text, in order of appearance: ISO, US m/d/yyyy, European d.m.yyyy, "Nov 3, 2026", "3 Nov 2026". */
export function findDates(text) {
  const t = String(text); const out = [];
  const add = (idx, ms) => { if (ms !== null) out.push({ idx, ms }); };
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(m.index, utc(+m[1], +m[2], +m[3]));
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) add(m.index, utc(+m[3], +m[1], +m[2]));
  for (const m of t.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)) add(m.index, utc(+m[3], +m[2], +m[1]));
  for (const m of t.matchAll(new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'))) add(m.index, utc(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]));
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+${MON}\\.?,?\\s+(\\d{4})\\b`, 'gi'))) add(m.index, utc(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]));
  return out.sort((a, b) => a.idx - b.idx).map((x) => x.ms);
}

function currencyOf(t) {
  if (/\bEUR\b|€/.test(t)) return 'EUR';
  if (/\bGBP\b|£/.test(t)) return 'GBP';
  if (/\bCAD\b|C\$/.test(t)) return 'CAD';
  if (/\bUSD\b|US\$|\$/.test(t)) return 'USD';
  return null;
}

/** Mask anything that looks like a card or account number (12–19 digits). */
const mask = (s) => String(s || '').replace(/\b\d(?:[ -]?\d){11,18}\b/g, (m) => `•••• ${m.replace(/\D/g, '').slice(-4)}`);

function merchantOf(t) {
  for (const raw of String(t).split(/\r?\n/)) {
    const line = raw.trim();
    if ((line.match(/[A-Za-z]/g) || []).length < 2) continue;
    if (/^(date|receipt|invoice|order|tel|phone)\b/i.test(line)) continue;
    const m = line.split(/\s[(\-–|]\s?|\(/)[0].replace(/\b(tax\s+invoice|invoice|receipt|e-ticket)\b.*$/i, '').trim();
    if (m) return mask(m).slice(0, 60);
  }
  return '';
}

const iso = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Normalise receipt text into { merchant, total, date, currency, tax, tip, subtotal,
 * amounts (every total-like amount), dates (ms), content_sha256 }. The text is not returned.
 */
export function normalizeReceipt(text) {
  const t = String(text ?? '');
  const hits = [...t.matchAll(TOTAL_RE)].map((m) => ({ p: prio(m[1]), n: parseAmount(m[2]) })).filter((x) => x.n !== null);
  const best = hits.reduce((b, x) => (!b || x.p >= b.p ? x : b), null);
  const dates = findDates(t);
  const dl = /(?:^|\n)\s*(?:date|datum|fecha)\s*:?\s*([^\n]+)/i.exec(t);
  const labelledDate = dl ? findDates(dl[1])[0] : undefined;
  const date = labelledDate ?? dates[0] ?? null;
  return {
    merchant: merchantOf(t), total: best ? best.n : null, date: date === null ? null : iso(date), currency: currencyOf(t),
    subtotal: labelled('sub\\s*-?total', t), tax: labelled('tax|vat|gst|hst|mwst|tva', t), tip: labelled('tip|gratuity', t),
    amounts: hits.map((x) => x.n), dates, content_sha256: sha256(t.toLowerCase().replace(/\s+/g, ' ').trim()),
  };
}

/** Back-compatible reader used by the review: total-like amounts and dates only. */
export function readReceipt(text) { const r = normalizeReceipt(text); return { amounts: r.amounts, dates: r.dates }; }

/** Public view of a normalised receipt (no raw text, dates as YYYY-MM-DD). */
export function receiptView(file, r) {
  return { file, merchant: r.merchant, total: r.total, date: r.date, currency: r.currency, subtotal: r.subtotal, tax: r.tax, tip: r.tip, candidate_totals: r.amounts, dates: r.dates.map(iso), content_sha256: r.content_sha256 };
}
