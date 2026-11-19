// Fixes found by reading published bank files (final pass, 19 Nov 2026). Small fictional snippets in the same shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentRuntime } from 'fairbooks-core';
import { manifest, parseBai2 } from '../src/index.js';

test('BAI2 with two days for one account: opening is the first day\'s, closing the last day\'s', () => {
  const text = ['01,111,222,260201,0700,1,,,2/', '02,111,222,1,260201,,USD,2/', '03,9999,USD,010,100000,,,015,150000,,,/', '16,142,50000,,REF1,,Deposit/', '49,300000,3/',
    '02,111,222,1,260202,,USD,2/', '03,9999,USD,010,150000,,,015,170000,,,/', '16,142,20000,,REF2,,Deposit/', '49,340000,3/', '98,640000,2,8/', '99,640000,1,10/'].join('\n');
  const p = parseBai2(text);
  assert.equal(p.opening_balance, 1000); assert.equal(p.closing_balance, 1700); assert.equal(p.rows.length, 2);
});

test('camt.053: when the gap is a line value-dated after the closing balance date, the check says so', async () => {
  const ntry = (amt, val) => `<Ntry><Amt Ccy="CHF">${amt}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-11-24</Dt></BookgDt><ValDt><Dt>${val}</Dt></ValDt></Ntry>`;
  const bal = (cd, amt, dt) => `<Bal><Tp><CdOrPrtry><Cd>${cd}</Cd></CdOrPrtry></Tp><Amt Ccy="CHF">${amt}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${dt}</Dt></Dt></Bal>`;
  const xml = `<Document><BkToCstmrStmt><Stmt><Acct><Id><IBAN>CH0000000000000000000</IBAN></Id></Acct>${bal('OPBD', '1000.00', '2026-11-23')}${bal('CLBD', '1100.00', '2026-11-24')}${ntry('100.00', '2026-11-24')}${ntry('50.00', '2026-11-25')}</Stmt></BkToCstmrStmt></Document>`;
  const root = mkdtempSync(join(tmpdir(), 'camt-val-')); writeFileSync(join(root, 's.xml'), xml);
  const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call('recon_read_statement', { bank: 's.xml', bank_format: 'camt053' });
  assert.equal(r.status, 'executed'); assert.equal(r.result.balance_check.ties, false);
  assert.match(r.result.balance_check.explained, /value-dated after the closing balance date 2026-11-24/);
});
