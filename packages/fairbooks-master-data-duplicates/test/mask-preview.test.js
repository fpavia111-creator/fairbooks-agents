// The merge preview the model sees shows tax ids and bank or account numbers by their last four characters only (final pass, 19 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairbooks-core';
import { manifest } from '../src/manifest.js';
import { maskTail, SENSITIVE } from '../src/merge.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

test('maskTail keeps the last four characters', () => {
  assert.equal(maskTail('12-3456789'), '•••6789'); assert.equal(maskTail('DE123456789'), '•••6789'); assert.equal(maskTail(''), ''); assert.equal(maskTail('12'), '•••');
  assert.ok(SENSITIVE.test('taxid') && SENSITIVE.test('Tax ID') && SENSITIVE.test('iban') && !SENSITIVE.test('companyname') && !SENSITIVE.test('email'));
});

test('dupes_merge_preview returns no full tax id; the names and the field winners are still there', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dupes-mask-')); cpSync(fixtures, root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call('dupes_merge_preview', { path: 'vendors.csv', survivor: 'V100', merge: ['V101'] });
  assert.equal(r.status, 'executed');
  const json = JSON.stringify(r.result);
  for (const tin of ['12-3456789', '123456789']) assert.ok(!json.includes(tin), `${tin} reached the model`);
  const tax = r.result.fields.find((f) => f.field === 'taxid');
  assert.equal(tax.masked, true); assert.equal(tax.survivor_value, '•••6789');
  assert.match(json, /Acme Industrial Supply/);
});
