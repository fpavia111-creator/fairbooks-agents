# Changelog

## 0.2.0

- Card-network reason-code mapping (Visa, Mastercard, Amex, Discover) to dispute categories, with a reason-text fallback and `reason_code_overrides` in the policy. New `soteria_reason_code` lookup tool.
- New `soteria_evidence_pack`: per-dispute evidence checklist that differs by category, items marked on file / missing / attach from your exports, an explained readiness score, earlier undisputed orders 120-365 days back for fraud disputes, a citation for every source row used, `evidence-index.json` (its SHA-256 is written to the audit line as `output_sha256`) and `dispute-deadlines.ics`.
- Triage items and `refund-queue.csv` carry `dispute_category` for chargebacks; requests exports may add `reason_code` and `network` columns.
- The policy file is validated against the `refund_policy` config schema (`validate-config refund_policy <file>`).
- MCP prompt `refund_and_dispute_workflow`.
- Unchanged: refund requests stay one named human click, even in Auto; issuing refunds and submitting disputes stay blocked.
- Not in this release: the Stripe read-only connector (needs the shared connector work).
