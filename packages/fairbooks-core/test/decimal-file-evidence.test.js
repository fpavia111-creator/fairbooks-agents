// A number column that cannot tell its decimal mark follows the rest of the file (final pass, 19 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptRecords, decimalEvidence } from '../src/index.js';

// Headers under other names (as a translated export has them), so the reader adapts the file.
const DEF = { fields: { id: { aliases: ['ID'] }, key_bits: { type: 'number', aliases: ['Key Size'] }, renewal_cost: { type: 'money', aliases: ['Renewal Cost'] } } };
const read = (matrix) => adaptRecords({ format: 'csv', matrix }, DEF, { kind: 'certs', arg: 'certs', file: 'c.csv' }).rows;

test('decimalEvidence cannot tell "1.024" or "420" on their own', () => {
  assert.deepEqual(decimalEvidence(['1.024', '2.048', '420']), { comma: 0, dot: 0 });
  assert.ok(decimalEvidence(['180,00']).comma > 0);
});

test('a German file: key sizes 1.024 and 2.048 next to costs written 180,00 are read as 1024 and 2048', () => {
  const r = read([['ID', 'Key Size', 'Renewal Cost'], ['A', '1.024', '180,00'], ['B', '2.048', '0,00']]);
  assert.equal(Number(r[0].key_bits), 1024); assert.equal(Number(r[1].key_bits), 2048); assert.equal(Number(r[0].renewal_cost), 180);
});

test('an English file keeps decimal points: 1.5 and 180.00', () => {
  const r = read([['ID', 'Key Size', 'Renewal Cost'], ['A', '1.5', '180.00']]);
  assert.equal(Number(r[0].key_bits), 1.5); assert.equal(Number(r[0].renewal_cost), 180);
});
