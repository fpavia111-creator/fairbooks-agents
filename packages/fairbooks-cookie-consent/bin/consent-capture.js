#!/usr/bin/env node
// Optional helper: records the HAR captures Fairbooks Cookie Consent reads, with a headless browser.
// Needs Playwright, which you install yourself; it is not a dependency of this package.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureHars } from '../src/capture.js';

const argv = process.argv.slice(2); const flags = { page: [], 'after-page': [], map: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]; if (!a.startsWith('--')) continue; const k = a.slice(2);
  if (['offline', 'allow-network', 'no-gpc', 'no-redact', 'headed', 'help'].includes(k)) { flags[k] = true; continue; }
  const v = argv[++i]; if (Array.isArray(flags[k])) flags[k].push(v); else flags[k] = v;
}
if (flags.help || !flags.url || !flags.out) {
  process.stdout.write(`consent-capture --url https://www.example.com/ --out captures [options]

Records first-visit.har, plus after-reject.har / after-accept.har when you give the banner's
button selector, plus gpc-visit.har (sent with Sec-GPC: 1) unless --no-gpc. Cookie values are
redacted. Offline by default: every request not mapped with --map or stubbed with --stubs
gets an empty 204, so nothing reaches the network. Pass --allow-network to let the headless
browser visit the real site and its third parties. Needs Playwright (install it yourself; it is optional).

  --page /order.html          extra page to visit (repeatable)
  --after-page /order.html    page(s) to visit after the Reject/Accept click (default: --page list, or the start URL)
  --reject "#reject-all"      selector of the banner's Reject button
  --accept "#accept-all"      selector of the banner's Accept button
  --no-gpc                    skip the Global Privacy Control capture
  --map https://www.example.com=http://127.0.0.1:8080   serve an origin from a local server
  --stubs stubs.json          canned responses for third-party URL prefixes
  --allow-network             opt in: let unmapped requests go to the real network (off by default)
  --offline                   the default; kept so older scripts still work
  --wait 300                  extra milliseconds to wait after each page settles
  --no-redact                 keep cookie values (not recommended)

Then: fairbooks-cookie-consent call consent_inventory '{"base_url":"...","har_first_visit":"captures/first-visit.har",...}'
A technical capture, not legal advice.
`);
  process.exit(flags.help ? 0 : 2);
}
const originMap = Object.fromEntries(flags.map.map((m) => { const i = m.indexOf('='); return [m.slice(0, i), m.slice(i + 1)]; }));
if (!flags['allow-network'] && !flags.map.length) process.stderr.write('consent-capture: offline (the default) and no --map given, so the site itself gets an empty 204. Use --map to a local copy, or --allow-network to visit the real site.\n');
try {
  const r = await captureHars({ url: flags.url, outDir: resolve(flags.out), pages: flags.page, afterChoicePages: flags['after-page'].length ? flags['after-page'] : null, rejectSelector: flags.reject || null, acceptSelector: flags.accept || null, gpc: !flags['no-gpc'], originMap, stubs: flags.stubs ? JSON.parse(readFileSync(flags.stubs, 'utf8')) : null, allowNetwork: !!flags['allow-network'] && !flags.offline, waitMs: flags.wait ? Number(flags.wait) : 300, redact: !flags['no-redact'], headless: !flags.headed });
  for (const [k, f] of Object.entries(r.files)) process.stdout.write(`${k.padEnd(13)} ${r.entries[k]} request(s)  ${f}\n`);
} catch (e) { process.stderr.write(`consent-capture: ${e.message}\n`); process.exit(1); }
