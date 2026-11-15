# Changelog

## 0.2.0

- New `macaria_retention_check`: applies your own retention rules and legal holds (JSON) to the subject's matched rows; holds win; every row cites the rule or hold id (on_hold, retain_until, period_ended, date_missing, no_rule). Expired holds are listed and ignored.
- New `macaria_deadlines`: request deadline tracker over `requests.csv`. Due dates come from the configured response periods; overdue and due-soon requests are flagged and sorted first; logged targets that differ from the current rules are flagged; optional `.ics` with 7- and 2-day reminders.
- New `macaria_evidence_pack`: per-request JSON + self-contained HTML evidence (source file SHA-256, rows found and match kind, retention decisions, approved deletion requests, kept and open items). The JSON hash is written to the audit line as `output_sha256`.
- Subject search also matches hashed identifiers (SHA-256/MD5 email, SHA-256 phone forms) without printing raw values; `rows_matched_by_hash` added.
- `macaria_build_checklist` and `macaria_log_request` accept `rules`: checklist retention steps cite rule and hold ids; response targets use your configured periods.
- Config schema `retention_rules` (`validate-config retention_rules <file>`); rules files are validated with JSON-pointer errors.
- MCP prompt `erasure_request_workflow`.
- Deleting personal data is unchanged: one named human click, even in Auto; direct deletion stays blocked.
