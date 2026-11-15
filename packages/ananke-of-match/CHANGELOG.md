# Changelog

## 0.2.0 (2026-11-15)

- Partial receipts and several invoices per PO line: invoices are allocated to receipts first-in, first-out and each line lists the receipts it matched (`receipts`).
- Per-vendor tolerance profiles (`tolerance_profile`, config schema `tolerances`, `validate-config tolerances <file>`). Each line reports the tolerance used and its source.
- Near-duplicate invoice detection (`near_duplicate_invoice`): same vendor, PO line and amount with a number that differs only in punctuation or leading zeros, or by one character on the same date.
- New tool `ananke_po_status`: PO line status with a GRNI (received-not-billed) estimate and billed-not-received.
- New tool `ananke_write_report`: self-contained `ap-report.html` and `ap-po-status.csv`; `output_sha256` goes into the audit line. `ananke_write_worklist` also returns `output_sha256`.
- `ananke_match` returns a vendor scorecard (`by_vendor`).
- MCP prompt `ap_exception_review`; tool titles; stricter input schemas (tolerances must be numbers >= 0, posting fields non-empty).
- Unchanged: posting stays one-click (`move_money`) even in Auto; `erp_post_invoice` stays blocked. No ERP connector yet (needs the shared connector work).

## 0.1.0

- First release: three-way match, explanations, worklist, one-click posting request.
