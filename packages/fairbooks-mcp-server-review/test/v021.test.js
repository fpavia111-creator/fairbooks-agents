import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairbooks-core';
import { manifest } from '../src/index.js';

// 0.2.1: no advisory snapshot ships with the package; advisories come only from a list you pass.
test('no bundled advisory snapshot: no NEM-CFG-ADVISORY without a list, found with one', async () => {
  assert.equal(existsSync(fileURLToPath(new URL('../src/data/advisories.json', import.meta.url))), false);
  const root = mkdtempSync(join(tmpdir(), 'mcpreview-v021-'));
  writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: { r: { command: 'npx', args: ['-y', 'mcp-remote@0.1.10', 'https://mcp.example.com/sse'] } } }));
  writeFileSync(join(root, 'adv.json'), JSON.stringify({ snapshot: '2026-11-15', advisories: [{ id: 'CVE-2025-6514', ecosystem: 'npm', package: 'mcp-remote', affected: '>=0.0.5 <0.1.16', fixed: '0.1.16', severity: 'high', summary: 'OS command injection.' }] }));
  const rt = new AgentRuntime(manifest, { root, mode: 'review' });
  const none = await rt.call('mcpreview_scan_config', { config: 'mcp.json' });
  assert.ok(!JSON.stringify(none).includes('CVE-2025-6514'));
  const hit = await rt.call('mcpreview_scan_config', { config: 'mcp.json', advisories: 'adv.json' });
  assert.ok(JSON.stringify(hit).includes('CVE-2025-6514'));
});
