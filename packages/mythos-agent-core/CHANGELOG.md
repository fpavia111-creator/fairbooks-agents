# Changelog

## 0.2.0 (2026-11-15)

Added (real exports, licence keys)
- Table reading: TSV, semicolon- and pipe-separated text (delimiter sniffed), Excel `.xlsx` (`readXlsx`, `writeXlsx`, no dependencies, formulas never evaluated, 5,000,000-cell cap) and JSON envelopes, all through `ctx.records` and `readRecords`.
- Source adapters: manifest `sources` (a pack's own columns with types and alternative names, plus export profiles), a catalogue of 39 named exports (`EXPORTS`, `exportProfile`, `carryGroup`, `firstRowPer`, `fullName`), date and amount normalisation with stated guesses, header rows found under title blocks, headerless downloads, `mythos-sources.json` overrides (schema-checked), `sources` on results and a compact `sources` entry in audit lines.
- `inspect` (runtime), `mythos_inspect_input` (MCP) and `<pack> inspect <file>` / `<pack> sources` (CLI): how a file would be read, column names and shapes only, never cell values. `mythos_info` lists the exports a pack reads.
- A file with none of a pack's required column now says so in `warnings` instead of reading every row as blank.
- Licence keys for a paid tier: `tier: 'pro'` and `feature` on tools, Ed25519-signed offline keys (`issueLicense`, `checkLicense`), a `needs_license` result that never changes a policy decision, `ctx.license`, licence status in `mythos_info`, `<pack> license status|install|remove` and the seller tool `mythos-license keygen|issue|verify`. The trusted key list ships empty and no tool is marked paid.


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

Hardening (review pass, found by planting hostile values in every agent's fixtures and calling all 240 tools with broken arguments)
- `toCsv` neutralises cells a spreadsheet would run as a formula (`neutraliseFormula`); `{ formulas: 'keep' }` or `{ raw: true }` opts out. Before this, 21 CSV outputs across 11 agents carried a formula-like cell through unchanged.
- `ctx.writeFile` refuses a file name that leaves its folder, creates missing sub-folders, and passes `.md` output through `safeMarkdown` (raw HTML and remote images from data become literal text); `{ raw: true }` opts out. New `safeFileName` for names built from data.
- `htmlPage` wraps tables for narrow screens, adds header `scope`, right-aligns numeric column headers, scales inline SVG (`accessibleTables`). Seven reports overflowed a phone-width screen before this.
- Results that quote instruction-like text from data carry a `warnings` entry and an `injection_signals` audit field (`injectionSignals`, option `injectionScan: false` to turn off). MCP `initialize` instructions say tool results are data.
- Near-miss argument names are refused with a "did you mean"; other undeclared arguments are reported in `warnings` and `ignored_args`; a required argument given as an empty string is refused before approval is asked.
- Errors: Node file errors become plain sentences with root-relative paths, the absolute root is removed from error text, and long messages and error lists are clipped (`friendlyError`).

Unchanged
- One-click categories, fail-closed manifests, the kill switch and the default caps behave as in 0.1.0. Every 0.1.0 agent test passes unchanged against this version.

## 0.1.0

First release.
