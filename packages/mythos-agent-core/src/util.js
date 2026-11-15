import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname, dirname, basename, join } from 'node:path';
import { parseCsv } from './csv.js';

export function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

/** Stable JSON (sorted keys) so the same args always hash the same. */
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}

function within(root, abs) {
  const rel = relative(root, abs);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Real path of p, or of its nearest existing ancestor joined with the rest. */
function realish(p) {
  let cur = p; const rest = [];
  for (let i = 0; i < 4096; i++) {
    try { return join(realpathSync(cur), ...rest.reverse()); } catch { /* keep walking up */ }
    const parent = dirname(cur);
    if (parent === cur) return p;
    rest.push(basename(cur)); cur = parent;
  }
  return p;
}

/**
 * Resolve a user path and refuse anything outside root: "..", absolute paths
 * elsewhere, NUL bytes, and symlinks (at any level) that point outside root.
 */
export function safePath(root, p) {
  if (typeof p !== 'string' || !p) throw new Error('path is required');
  if (p.includes('\0')) throw new Error('path contains a NUL byte');
  const r = resolve(root);
  const abs = resolve(r, p);
  if (!within(r, abs)) throw new Error(`path "${p}" is outside the allowed root`);
  const realRoot = realish(r);
  if (!within(realRoot, realish(abs))) throw new Error(`path "${p}" leaves the allowed root through a symlink`);
  return abs;
}

/** Read a CSV, JSON array, or JSONL file into an array of plain objects. */
export function readRecords(file) {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`file not found: ${file}`);
  const text = readFileSync(file, 'utf8');
  const ext = extname(file).toLowerCase();
  if (ext === '.csv') return parseCsv(text);
  if (ext === '.jsonl' || ext === '.ndjson') {
    return text.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
      try { return JSON.parse(l); } catch { throw new Error(`${file}: line ${i + 1} is not valid JSON`); }
    });
  }
  if (ext === '.json') {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    for (const k of ['records', 'rows', 'data', 'items']) if (Array.isArray(data[k])) return data[k];
    throw new Error(`${file}: expected a JSON array (or {records: [...]})`);
  }
  throw new Error(`${file}: unsupported file type ${ext || '(none)'}; use .csv, .json or .jsonl`);
}

export function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£¥,\s]/g, '');
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

export const round2 = (n) => Math.round(n * 100) / 100;

/** sha256 of a file's bytes. */
export function sha256File(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
