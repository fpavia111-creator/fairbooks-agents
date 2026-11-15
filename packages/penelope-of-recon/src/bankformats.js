// Small, zero-dependency readers for bank statement files: ISO 20022 CAMT.053 (XML),
// BAI2 and OFX (1.x SGML or 2.x XML). Each returns rows with date, description,
// reference, amount (deposits positive) plus opening/closing balances when the file has them.
// They read the common fields only; they are not full implementations of these standards.

import { extname } from 'node:path';
import { round2 } from 'mythos-agent-core';

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : XML_ENT[e] ?? m)).trim();
const tagRe = (t, flags = '') => new RegExp(`<(?:[\\w.-]+:)?${t}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${t}>`, flags);
const blocks = (xml, t) => [...xml.matchAll(tagRe(t, 'g'))].map((m) => m[1]);
const first = (xml, ...path) => { let cur = xml; for (const t of path) { const m = tagRe(t).exec(cur); if (!m) return ''; cur = m[1]; } return unxml(cur); };

/** ISO 20022 camt.053 bank-to-customer statement. Reads Stmt/Bal (OPBD, CLBD) and Stmt/Ntry. */
export function parseCamt053(xml) {
  if (!/BkToCstmrStmt/.test(xml)) throw new Error('not a camt.053 file (no BkToCstmrStmt element)');
  const stmts = blocks(xml, 'Stmt'); if (!stmts.length) throw new Error('camt.053: no Stmt element');
  const rows = []; let opening = null, closing = null, currency = '', account = '';
  for (const st of stmts) {
    account = account || first(st, 'Acct', 'IBAN') || first(st, 'Acct', 'Othr', 'Id');
    for (const b of blocks(st, 'Bal')) {
      const code = first(b, 'Tp', 'CdOrPrtry', 'Cd'); const amt = Number(first(b, 'Amt')); const sign = first(b, 'CdtDbtInd') === 'DBIT' ? -1 : 1;
      if (code === 'OPBD' && opening === null) opening = round2(sign * amt);
      if (code === 'CLBD') closing = round2(sign * amt);
    }
    for (const n of blocks(st, 'Ntry')) {
      const amtM = /<(?:[\w.-]+:)?Amt\b[^>]*?(?:Ccy="([A-Z]{3})")?[^>]*>([^<]*)</.exec(n);
      if (!amtM) throw new Error('camt.053: an Ntry has no Amt');
      currency = currency || amtM[1] || '';
      const sign = first(n, 'CdtDbtInd') === 'DBIT' ? -1 : 1;
      const date = first(n, 'BookgDt', 'Dt') || first(n, 'BookgDt', 'DtTm').slice(0, 10) || first(n, 'ValDt', 'Dt');
      const reference = first(n, 'NtryRef') || first(n, 'NtryDtls', 'TxDtls', 'Refs', 'EndToEndId').replace(/^NOTPROVIDED$/, '');
      const description = first(n, 'AddtlNtryInf') || first(n, 'NtryDtls', 'TxDtls', 'RmtInf', 'Ustrd');
      rows.push({ date, description, reference, amount: round2(sign * Number(unxml(amtM[2]))) });
    }
  }
  return { format: 'camt.053', account_hint: mask(account), currency, opening_balance: opening, closing_balance: closing, rows };
}

const yymmdd = (s) => (/^\d{6}$/.test(s) ? `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}` : '');
/** BAI2 cash-management file. Amounts are in cents; type codes 100-399 are credits, 400-699 debits. */
export function parseBai2(text) {
  // Join 88 continuation records onto the record before, then split on record ends.
  const raw = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const recs = [];
  for (const l of raw) { if (l.startsWith('88,')) { if (!recs.length) throw new Error('BAI2: continuation record with nothing before it'); const prev = recs[recs.length - 1]; recs[recs.length - 1] = prev.replace(/\/$/, '') + (prev.startsWith('16,') ? ' ' : ',') + l.slice(3); } else recs.push(l); }
  if (!recs.length || !recs[0].startsWith('01,')) throw new Error('not a BAI2 file (first record is not 01)');
  const rows = []; let asOf = '', opening = null, closing = null, currency = '', account = '';
  for (const r of recs) {
    const code = r.slice(0, 2);
    if (code === '02') { const f = r.replace(/\/$/, '').split(','); asOf = yymmdd(f[4]); currency = currency || f[6] || ''; }
    else if (code === '03') {
      const f = r.replace(/\/$/, '').split(','); account = account || f[1]; currency = f[2] || currency;
      for (let i = 3; i + 1 < f.length; i += 4) { // type, amount, item count, funds type
        const tc = f[i], amt = f[i + 1];
        if (tc === '010' && amt !== '') opening = round2(Number(amt) / 100);
        if (tc === '015' && amt !== '') closing = round2(Number(amt) / 100);
        if (f[i + 3] === 'S') i += 3; else if (f[i + 3] === 'V') i += 2;
      }
    } else if (code === '16') {
      const body = r.replace(/\/$/, ''); const f = body.split(',');
      const tc = Number(f[1]); const cents = Number(f[2] || 0); let i = 4; let date = asOf;
      const funds = f[3];
      if (funds === 'S') i += 3; else if (funds === 'V') { date = yymmdd(f[4]) || asOf; i += 2; } else if (funds === 'D') { const n = Number(f[4] || 0); i += 1 + 2 * n; }
      const bankRef = f[i] || '', custRef = f[i + 1] || ''; const description = f.slice(i + 2).join(',').trim();
      if (!Number.isFinite(tc) || !Number.isFinite(cents)) throw new Error(`BAI2: bad 16 record "${r.slice(0, 40)}"`);
      const sign = tc >= 400 && tc < 700 ? -1 : 1;
      rows.push({ date, description, reference: custRef || '', bank_reference: bankRef, amount: round2(sign * cents / 100), type_code: String(f[1]) });
    }
  }
  return { format: 'bai2', account_hint: mask(account), currency, opening_balance: opening, closing_balance: closing, rows };
}

const ofxDate = (s) => (/^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '');
/** OFX 1.x (SGML, leaf tags may be unclosed) or 2.x (XML) bank statement. */
export function parseOfx(text) {
  if (!/<OFX>/i.test(text)) throw new Error('not an OFX file (no <OFX> element)');
  const leaf = (s, t) => { const m = new RegExp(`<${t}>([^<\\r\\n]*)`, 'i').exec(s); return m ? unxml(m[1]) : ''; };
  const rows = [];
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const t = m[1]; const amt = Number(leaf(t, 'TRNAMT'));
    if (!Number.isFinite(amt)) throw new Error('OFX: a STMTTRN has no TRNAMT');
    rows.push({ date: ofxDate(leaf(t, 'DTPOSTED')), description: leaf(t, 'NAME') || leaf(t, 'MEMO'), reference: leaf(t, 'CHECKNUM') || leaf(t, 'REFNUM'), amount: round2(amt), fitid: leaf(t, 'FITID') });
  }
  const lb = /<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i.exec(text);
  return { format: 'ofx', account_hint: mask(leaf(text, 'ACCTID')), currency: leaf(text, 'CURDEF'), opening_balance: null, closing_balance: lb && leaf(lb[1], 'BALAMT') !== '' ? round2(Number(leaf(lb[1], 'BALAMT'))) : null, rows };
}

/** Show only the last 4 characters of an account identifier. */
function mask(acct) { const s = String(acct || ''); return s ? (s.length > 4 ? '••••' + s.slice(-4) : '••••') : ''; }

export const BANK_FORMATS = ['csv', 'json', 'camt053', 'bai2', 'ofx'];
/** Pick a format from the extension, then from the content. */
export function detectFormat(file, text) {
  const ext = extname(file).toLowerCase();
  if (ext === '.ofx' || ext === '.qfx') return 'ofx';
  if (ext === '.bai' || ext === '.bai2') return 'bai2';
  if (ext === '.csv') return 'csv';
  if (ext === '.json' || ext === '.jsonl' || ext === '.ndjson') return 'json';
  const head = String(text || '').slice(0, 4096);
  if (/BkToCstmrStmt|camt\.053/.test(head)) return 'camt053';
  if (/<OFX>|OFXHEADER/i.test(head)) return 'ofx';
  if (/^\s*01,/.test(head)) return 'bai2';
  return null;
}
export function parseBankText(format, text) {
  if (format === 'camt053') return parseCamt053(text);
  if (format === 'bai2') return parseBai2(text);
  if (format === 'ofx') return parseOfx(text);
  throw new Error(`no text parser for ${format}`);
}
