# Changelog

Renamed from `nemesis-of-servers` on 18 Nov 2026 (tool names were `nemesis_*`, now `mcpreview_*`).

## 0.2.1

- **No advisory snapshot is bundled any more (changed behaviour).** `src/data/advisories.json` (dated 2026-11-15) is removed: a dated list goes stale. `NEM-ADVISORY` / `NEM-CFG-ADVISORY` findings come only from the list you pass with `advisories` (or a policy's `advisories`). `advisory_snapshot` in the JSON report is the date in your list, or null.

## 0.2.0 (2026-11-15)

### Added
- Taint-style data-flow checks (one file at a time): environment or credential file to network (`NEM-FLOW-ENV-TO-NET`), incoming Authorization header to upstream call (`NEM-TOKEN-PASSTHROUGH`), tool input to exec/eval (`NEM-FLOW-INPUT-TO-EXEC`), to file paths (`NEM-FLOW-INPUT-TO-PATH`) and to network calls (`NEM-FLOW-INPUT-TO-NET`). Each finding carries the source-to-sink path with line numbers.
- New source rules: TLS checks disabled, binding to 0.0.0.0, CORS `*`, unsafe deserialization, SQL built from templates; more secret prefixes.
- Lockfile and supply-chain checks: missing lockfile, lockfile entries outside the npm registry or without integrity, unpinned `requirements.txt` lines, and an offline advisory list (bundled dated snapshot plus a user-supplied list).
- `mcpreview_scan_tools`: tool-poisoning, shadowing, collision, look-alike name, free-form exec parameter and annotation checks on a saved `tools/list` result.
- `mcpreview_pin_tools` and `mcpreview_check_pins`: pin reviewed tool definitions and detect later changes (rug pulls) with unified diffs.
- MCP client config: auto-approved tools (`alwaysAllow`, `autoApprove`, `trust`), permission-bypass flags, duplicate servers, advisory matches; findings carry config line numbers.
- Reviewer policy file (`nemesis-policy`): suppressions with reasons, severity overrides, egress allowlist, ignored paths, `fail_on`. Config schemas `nemesis-policy`, `nemesis-advisories`, `nemesis-tool-pins` (also `validate-config`).
- SARIF: every rule with help, CWE and OWASP MCP Top 10 tags, `security-severity`, content-based fingerprints, `codeFlows`, suppressions with justification, `uri_prefix`; deterministic output.
- Markdown report: "Fix first" list, data flows, tool diffs, OWASP MCP Top 10 view, suppressed findings. `fail_on` gate and `output_sha256` in the audit log.
- MCP prompt `mcpreview_review_server`.

### Changed
- `mcpreview_write_report` paths for source findings are now relative to `--root` (they were relative to the scanned folder), matching config and tool findings.
- The whole-file checks (`NEM-WRITE-NO-APPROVAL`, `NEM-EXEC-NO-ALLOWLIST`) no longer run on docs and JSON/YAML files, where they only matched prose.
- `NEM-EXEC-SHELL` no longer matches method calls such as `someRegex.exec(text)` or `db.exec(sql)`; it matches a bare `exec(...)`/`spawn(...)` and `child_process.exec(...)`.
- Files are walked in sorted order so output is the same on every platform.
- Tool input schemas reject unknown arguments.
- Findings now include `fix`, `owasp` and `cwe` fields.

### Hardening (review pass)

- Inherited from `fairbooks-core`: CSV cells that a spreadsheet would run as a formula are neutralised; Markdown output has raw HTML and remote images from data turned into literal text; HTML report tables scroll on narrow screens and header cells carry `scope`; results that quote instruction-like text from data carry a warning; near-miss argument names are refused with the right name; file errors are plain and relative to `--root`.

## 0.1.0

- First release.
