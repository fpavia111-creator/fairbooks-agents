# Changelog

## 0.2.0 — 2026-11-15

Requires `mythos-agent-core` ^0.2.0.

### Added
- Configurable tolerance (`tolerance`, default 0.005; differences up to and including it tie) on compare, tie-out and the report.
- Trial-balance tie-out by subsidiary and currency: `subsidiary_column`, `currency_column`, `fx_rates` and `base_currency`. A currency with no rate is reported as unknown (`missing_fx_rates`), never guessed. Per-subsidiary summary in `by_subsidiary`.
- Per-subsidiary amount totals in `olympus_compare_exports` (`subsidiary_column`).
- `olympus_check_fields`: field rules (required, unique, number/integer/date, enum, pattern, min/max, max_length, severity) with spreadsheet row numbers.
- `olympus_compare_runs`: compare two `findings.json` files from successive trial loads.
- `migration_rules` config schema (`config` argument; `validate-config migration_rules <file>`).
- Readiness report now also writes `readiness-report.html` and `exceptions.csv`, includes a prioritised next-actions list, field-rule results, and an optional "change since previous run" section (`previous_findings`).
- Signed readiness report: the report returns `output_sha256` (hash of all written files), which the runtime records in the audit line; with `--signing-key` the line is Ed25519-signed.
- MCP prompt `olympus_go_live_readiness`.
- Tool titles for MCP hosts; accurate input schemas (validated before a tool runs).

### Changed
- Trial-balance lines where any row of the account has a blank or non-numeric balance are now reported as unknown instead of summing the remaining rows (stricter; never guesses a partial balance).
- `findings.json` gains `rules`, `field_rules`, `actions` and (optional) `change_since_previous` keys.

### Not done
- Saved-search (SuiteTalk) connector: depends on the shared connector work (A3); not started.

Go-live stays blocked in every mode.
