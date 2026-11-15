# Changelog

## 0.2.0 (2026-11-15)

Added
- Input validation of every tool call against its `inputSchema` (JSON Schema subset, JSON-pointer errors), before approval or execution.
- Signed audit logs (opt-in): Ed25519 per line (`--signing-key`), `keygen`, `rotate-key` (signed rotation entry), `verify-log --pubkey`. Keys under `--root` are refused. Optional `--audit-mirror` second copy. Two writers (agent and approvals page) keep one chain.
- Approvals: request records with a non-sensitive argument preview, `reject`, expiry (`--approval-ttl`, default 24 h), a fresh cycle after use, refusal of non-human approver names, `approvals list`, a local approvals page (`approvals serve`, 127.0.0.1, CSP, CSRF token, Host/Origin checks), an HMAC-signed outbound webhook (`--approval-webhook`, `MYTHOS_WEBHOOK_SECRET`) and a signed `/callback`; rejected callbacks are audited.
- Caps persisted in `.mythos/usage.json` per session (`--session`) and per day (`--max-steps-per-day`, `--max-spend-per-day`), per-tool caps (`caps.perTool`), structured `cap` result, `usage` command, usage in `mythos_info`. Caps are frozen at start.
- `safePath` refuses symlink escapes (at any depth) and NUL bytes; `ctx.writeFile` goes through it.
- MCP: protocol `2025-11-25`, tool `title` and annotations, `prompts/list` and `prompts/get` from manifest `prompts`, pending approvals in `mythos_info`.
- Manifest `configSchemas` with `ctx.readJson(path, schema)` and the `validate-config` command.
- ctx helpers: `readText`, `readJson`, `exists`, `hashFile`, `validate`. A result's `output_sha256` is written into its audit line.
- Evals: `approve` case field; `matches`, `min`, `max`, `length`, `max_ms` expectations; per-case timing; `eval --report DIR [--baseline report.json]` writes an offline HTML + JSON report and fails on regressions.
- Shared helpers: `toIcs`/`validateIcs`, `toSarif`/`validateSarif`, `unifiedDiff`/`applyUnifiedDiff`, `htmlPage`/`escapeHtml`, `jaroWinkler`, `levenshtein`, `nameSimilarity`, `normalizeName`, `normalizeAddress`, `tokenSetSimilarity`, `shannonEntropy`, `maskValue`, `readZip`/`writeZip`/`docxText`, `sha256File`.

Unchanged
- One-click categories, fail-closed manifests, the kill switch and the default caps behave as in 0.1.0. Every 0.1.0 agent test passes unchanged against this version.

## 0.1.0

First release.
