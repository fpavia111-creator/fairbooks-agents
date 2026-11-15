// License text identification by comparison with SPDX license texts. Short permissive
// licenses are compared word by word (Sørensen-Dice on word pairs after normalising
// case, punctuation and copyright lines). Long licenses (Apache, GPL family, MPL) are
// recognised from their titles and structure only, so they are always low confidence.
// A low-confidence or unidentified text is never treated as allowed.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DISCLAIMER_MIT = 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
const DISCLAIMER_ISC = 'THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.';
const BSD_COND = 'Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.';
const BSD_DISC = 'THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.';

export const TEMPLATES = {
  MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. ${DISCLAIMER_MIT}`,
  ISC: `Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. ${DISCLAIMER_ISC}`,
  '0BSD': `Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted. ${DISCLAIMER_ISC}`,
  'BSD-2-Clause': `${BSD_COND} ${BSD_DISC}`,
  'BSD-3-Clause': `${BSD_COND} 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission. ${BSD_DISC}`,
  Unlicense: 'This is free and unencumbered software released into the public domain. Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means. In jurisdictions that recognize copyright laws, the author or authors of this software dedicate any and all copyright interest in the software to the public domain. We make this dedication for the benefit of the public at large and to the detriment of our heirs and successors. We intend this dedication to be an overt act of relinquishment in perpetuity of all present and future rights to this software under copyright law. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. For more information, please refer to <https://unlicense.org>',
};
// Long licenses: recognised by title (and "terms and conditions" structure). Order matters: AGPL/LGPL before GPL.
export const MARKERS = [
  ['Apache-2.0', /apache license version 2 0/],
  ['AGPL-3.0-only', /gnu affero general public license version 3/],
  ['LGPL-3.0-only', /gnu lesser general public license version 3/],
  ['LGPL-2.1-only', /gnu lesser general public license version 2 1/],
  ['GPL-3.0-only', /gnu general public license version 3/],
  ['GPL-2.0-only', /gnu general public license version 2/],
  ['MPL-2.0', /mozilla public license version 2 0/],
];
export const HIGH = 0.95; export const LOW = 0.8; const MARKER_CONFIDENCE = 0.85;

export function normalize(text) {
  return String(text || '').split(/\r?\n/).filter((l) => !/^\s*(copyright\b|\(c\)|©|all rights reserved)/i.test(l)).join(' ')
    .toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(\d+)\s*$/g, '$1').trim().replace(/\s+/g, ' ');
}
const pairs = (s) => { const w = s.split(' ').filter(Boolean); const set = new Set(); for (let i = 0; i < w.length - 1; i++) set.add(`${w[i]} ${w[i + 1]}`); return set; };
export function dice(a, b) { const x = pairs(a); const y = pairs(b); if (!x.size || !y.size) return 0; let n = 0; for (const p of x) if (y.has(p)) n++; return (2 * n) / (x.size + y.size); }
const TPL = Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, normalize(v)]));

/**
 * Identify a license text. Returns { id, confidence, method, level: 'high'|'low'|'none', runner_up }.
 * level 'low' means a person should confirm it; 'none' means it was not identified.
 */
export function identifyLicense(text) {
  const n = normalize(text);
  if (n.split(' ').length < 8) return { id: null, confidence: 0, method: 'too short', level: 'none', runner_up: null };
  const scores = Object.entries(TPL).map(([id, t]) => ({ id, s: dice(n, t) })).sort((a, b) => b.s - a.s);
  const [best, second] = scores; const rounded = (x) => Math.round(x * 1000) / 1000;
  if (best.s >= LOW) {
    const close = second && best.s - second.s < 0.03;
    const level = best.s >= HIGH && !close ? 'high' : 'low';
    return { id: best.id, confidence: rounded(best.s), method: 'text comparison', level, runner_up: second ? { id: second.id, confidence: rounded(second.s) } : null, ...(close ? { note: `${second.id} is almost as close` } : {}) };
  }
  for (const [id, re] of MARKERS) if (re.test(n)) return { id, confidence: MARKER_CONFIDENCE, method: 'title match (not compared word by word)', level: 'low', runner_up: null, ...(/GPL/.test(id) ? { note: 'The license text alone does not say "only" or "or later"; check the package\'s notices.' } : {}) };
  return { id: null, confidence: rounded(best.s), method: 'text comparison', level: 'none', runner_up: { id: best.id, confidence: rounded(best.s) } };
}

const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)([-._].*)?$/i;
/** License files in a package directory (and a Python dist-info's licenses/ folder). */
export function licenseFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = readdirSync(dir).filter((f) => LICENSE_FILE.test(f) && statSync(join(dir, f)).isFile()).sort().map((f) => join(dir, f));
  if (existsSync(join(dir, 'licenses')) && statSync(join(dir, 'licenses')).isDirectory()) for (const f of readdirSync(join(dir, 'licenses')).sort()) out.push(join(dir, 'licenses', f));
  return out;
}
export const readText = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
