# Changelog

## 0.2.0 (2026-11-15)

- New `praxidike_read_receipts`: normalises receipt text (US, European decimal comma, month-name dates, "amount due", "grand total") into merchant, total, date, currency, tax, tip and a content hash. Receipt text is still never returned. No OCR.
- Per diem by location and date (`per_diem.rates` with a `"*"` fallback, categories with `per_diem: "meals"` and `per: "day"`, a `days` and `location` column) and dated mileage rates (`mileage_rates`).
- New `praxidike_find_duplicates`: possible duplicates within the export and against earlier reports (`history`) by receipt file, receipt content hash, same merchant/total/date on two receipts, and fuzzy amount/date/merchant match. Scored with reasons.
- New `praxidike_audit_queue`: reports in review order with an explainable score; weights can be set in the policy (`risk_weights`).
- New `praxidike_write_evidence_pack`: self-contained HTML, `audit-queue.csv` and a hashed `evidence-manifest.json`; the manifest hash is recorded in the audit log as `output_sha256`.
- The policy file is validated against a JSON Schema (`validate-config policy <file>`); unknown keys, wrong types and a missing `source` fail with JSON pointers.
- New MCP prompt `review_expense_reports`.
- Receipt amount checks now also read decimal-comma and "amount due"/"grand total" receipts. Results for the 0.1.0 fixtures are unchanged.
- Line results carry two new fields, `days` and `location`.
- Unchanged: reimbursing (`move_money`) is one human click even in Auto; paying and ledger posting stay blocked.

Hardening (review pass)

- A misspelled argument such as `receipt` for `receipts` is now refused with the right name instead of running without receipt checks.
- Inherited from `mythos-agent-core`: CSV cells that a spreadsheet would run as a formula are neutralised; Markdown output has raw HTML and remote images from data turned into literal text; HTML report tables scroll on narrow screens and header cells carry `scope`; results that quote instruction-like text from data carry a warning; near-miss argument names are refused with the right name; file errors are plain and relative to `--root`.

