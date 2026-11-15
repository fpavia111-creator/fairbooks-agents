// Minimal RFC 4180 CSV parser/writer. No dependencies.
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const o = {};
    header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const PLAIN_NUMBER = /^[+-]?(\d[\d,]*)?(\.\d+)?(e[+-]?\d+)?%?$/i;
// A sign followed only by digits and phone punctuation: "+1 (555) 010-0100", "-12.50".
const SIGNED_DIGITS = /^[+-][\d\s().,\-]*%?$/;

/**
 * Stop a spreadsheet running a cell as a formula. Excel, Sheets and LibreOffice run
 * a cell that starts with = + - or @ as a formula, so text from an untrusted
 * source can call out to the network, start a program through DDE, or change
 * what the reader sees. Such a cell gets a leading apostrophe, which the
 * spreadsheet shows as plain text.
 *
 * Left alone, because they cannot call anything: plain numbers (-12.50, +3,
 * -1e5, -4%), phone-style values made only of a sign, digits and punctuation
 * (+1 555 010 0100), and @handles or @scope/package names with no "(", "|" or "!".
 */
export function neutraliseFormula(v) {
  if (typeof v !== 'string' || !v) return v;
  const c = v[0];
  if (c === '=' || c === '\t' || c === '\r') return "'" + v;
  if (c === '+' || c === '-') return PLAIN_NUMBER.test(v) || SIGNED_DIGITS.test(v) ? v : "'" + v;
  if (c === '@') return /[(|!]/.test(v) ? "'" + v : v;
  return v;
}

/**
 * Write CSV. Formula-looking cells are neutralised by default (see
 * neutraliseFormula); pass { formulas: 'keep' } (or { raw: true }) when the
 * file is read back by a program and must round-trip byte for byte.
 */
export function toCsv(rows, columns, { formulas = 'escape', raw = false } = {}) {
  const cols = columns || [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = raw || formulas === 'keep' ? esc : (v) => esc(typeof v === 'string' ? neutraliseFormula(v) : v);
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}
