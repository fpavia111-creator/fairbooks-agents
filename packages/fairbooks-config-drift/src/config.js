// Config schemas, SARIF output and MCP prompts for Fairbooks Config Drift.
import { toSarif } from 'fairbooks-core';

export const APPROVED_DRIFT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['version', 'approvals'],
  properties: {
    version: { const: 1 },
    note: { type: 'string' },
    approvals: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['key', 'after_fp', 'approved_at'],
      properties: {
        key: { type: 'string', minLength: 1 },
        after_fp: { type: 'string', pattern: '^[0-9a-f]{16}$', description: 'Fingerprint of the approved value (the value itself is never stored)' },
        change: { enum: ['added', 'removed', 'changed'] },
        risk: { enum: ['high', 'medium', 'low'] },
        reason: { type: 'string' },
        approved_at: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    } },
  },
};

const RULES = [
  { id: 'drift/high-risk-drift', name: 'HighRiskDrift', description: 'High-risk drift (security control, exposure, secret, destructive schema change)', severity: 'high', help: 'Confirm the change was intended; approve it as the new baseline or revert it through your change process.' },
  { id: 'drift/medium-risk-drift', name: 'MediumRiskDrift', description: 'Operational drift (ports, hosts, versions, replicas, removed settings)', severity: 'medium' },
  { id: 'drift/low-risk-drift', name: 'LowRiskDrift', description: 'Low-risk drift (added settings, cosmetic changes)', severity: 'low' },
];

/** Best-effort line number: first line in the file that names the key's last segment. */
function lineOf(text, key) {
  if (!text) return null;
  const seg = String(key).split(/[.[\]]/).filter(Boolean).pop(); if (!seg) return null;
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.includes(`"${seg}"`) || new RegExp(`(^|\\s|-\\s)${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:=]`).test(l));
  return i >= 0 ? i + 1 : null;
}

/** SARIF 2.1.0 for CI code scanning. Messages carry keys and reasons, never values. */
export function driftSarif(d, { afterPath, afterText, version }) {
  return toSarif({
    tool: 'fairbooks-config-drift', version, informationUri: 'https://github.com/fpavia111-creator/fairbooks-agents/tree/main/packages/fairbooks-config-drift', rules: RULES,
    findings: d.items.map((c) => ({ ruleId: `drift/${c.risk}-risk-drift`, severity: c.risk, message: `${c.key} ${c.change}: ${c.why}`, file: afterPath, line: c.change === 'removed' ? null : lineOf(afterText, c.key), fingerprint: `${c.key}|${c.after_fp}` })),
  });
}

export const PROMPTS = [
  {
    name: 'drift_review',
    title: 'Config, Terraform or Kubernetes drift review, end to end',
    description: 'Walks a host model through comparing snapshots, explaining risk, approving expected drift, writing the report/SARIF and a revert patch. Production changes stay a human click.',
    arguments: [
      { name: 'before', description: 'Earlier snapshot under --root (JSON, .env, schema CSV, .tfstate or Kubernetes YAML)', required: true },
      { name: 'after', description: 'Later snapshot of the same kind', required: true },
      { name: 'approved', description: 'Approved-drift baseline JSON (leave blank if none yet)', required: false },
    ],
    text: `You are helping an engineer review drift between two snapshots with the fairbooks-config-drift tools. Before: {{before}}. After: {{after}}. Approved baseline: {{approved}} (ignore it if blank or shown in brackets).

1. Call drift_diff with before and after (and approved if given). Ask the engineer which noisy keys to ignore (timestamps, build ids) and re-run with ignore if needed.
2. Explain the high-risk items first in plain words: what changed, why it matters. Secret values are masked; never ask for them or try to recover them.
3. For drift the engineer says was intended, call drift_approve_baseline with the keys and a reason. It needs their yes. Approved items stop alerting until their value changes again.
4. Call drift_write_report (drift-report.md, drift.json, revert-plan.json and drift.sarif for CI). Quote output_sha256.
5. For JSON or .env snapshots, call drift_write_revert_patch for the keys the engineer wants reverted. Say whether it applies to the original file or to the 2-space formatted form, and list manual_steps (secrets are never put in a patch).
6. If the engineer wants the fix applied, call drift_apply_fix with environment, keys and reason. It returns needs_approval: a named person must approve it (mythos-approve <id> --as "Name" or the approvals page), then repeat the same call. It only records the request. Never call production_push_config; it is blocked.

Risk levels come from key names and values, not knowledge of the system; say so.`,
  },
];
