import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairbooks-core';
import { manifest } from '../src/index.js';

// 0.2.1: live DNS-over-HTTPS lookups are opt-in (allow_network: true). Without records or the flag, nothing is sent.
const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const tmpRoot = () => { const r = mkdtempSync(join(tmpdir(), 'maildomain-v021-')); cpSync(fixtures, r, { recursive: true }); return r; };
let fetchCalls = 0;
const urls = [];
globalThis.fetch = async (u) => { fetchCalls++; urls.push(String(u)); return new Response(JSON.stringify({ Status: 3, Answer: [] }), { headers: { 'content-type': 'application/dns-json' } }); };
const outcome = async (p) => { try { return { ok: await p }; } catch (e) { return { err: e }; } };
const text = (o) => JSON.stringify(o.ok ?? '') + String(o.err?.message ?? '');

test('offline by default: every DNS tool refuses without records or allow_network, and sends nothing', async () => {
  const rt = new AgentRuntime(manifest, { root: tmpRoot(), mode: 'auto', autoActions: ['maildomain_draft_records', 'maildomain_plan_dmarc_rollout'] });
  for (const name of ['maildomain_audit', 'maildomain_write_report', 'maildomain_draft_records', 'maildomain_plan_dmarc_rollout']) {
    const o = await outcome(rt.call(name, { domain: 'example.com', start_date: '2026-11-16' }));
    assert.match(text(o), /off by default/, name);
  }
  assert.equal(fetchCalls, 0);
});

test('allow_network: true opts in to live lookups; records stay offline', async () => {
  const rt = new AgentRuntime(manifest, { root: tmpRoot(), mode: 'review' });
  const off = await rt.call('maildomain_audit', { domain: 'example.com', records: 'records.json', selectors: ['s1'] });
  assert.equal(fetchCalls, 0); assert.match(JSON.stringify(off), /records file/);
  const on = await rt.call('maildomain_audit', { domain: 'example.com', allow_network: true, selectors: ['s1'] });
  assert.ok(fetchCalls > 0); assert.ok(urls.every((u) => u.startsWith('https://cloudflare-dns.com/')));
  assert.match(JSON.stringify(on), /opted in with allow_network/);
  assert.ok(manifest.tools.find((t) => t.name === 'maildomain_audit').inputSchema.properties.allow_network);
});
