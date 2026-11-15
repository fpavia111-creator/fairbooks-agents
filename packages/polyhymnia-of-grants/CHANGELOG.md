# Changelog

## 0.2.0 (2026-11-15)

Added
- `polyhymnia_variance`: budget-vs-actual variance by line (full budget for final reports or after the period ends, otherwise the share expected by now), `variance_pct` / `variance_amount` thresholds, `[EXPLAIN VARIANCE]` markers, optional `explanation` column carried through but still marked for review, and a spend-down projection (`projected_underspend`, `projected_overspend`).
- Funder template mapping: `funder_template` config schema (`validate-config funder_template <file>`), `polyhymnia_template_check`, and `template` on `polyhymnia_build_packet` (sections in template order, word limits, funder guidance, required attachments, template variance threshold; missing sections and attachments flagged).
- `polyhymnia_calendar`: `grant-deadlines.ics` (core `toIcs`, validated) with report deadlines and grant period ends, reminders 30/14/7/1 days or `reminder_days`; `output_sha256` in the audit line.
- `polyhymnia_evidence_pack` (ask, Auto-eligible): zip of the draft packet, cited evidence, `variance.csv` and a SHA-256 `manifest.json`; `output_sha256` in the audit line.
- Draft packets include a "Budget vs actual variance" section and a checklist item per line that needs an explanation.
- MCP prompt `polyhymnia_report_cycle`. Tighter input schemas.

Unchanged
- `polyhymnia_review` open items and every 0.1.0 test and eval. Submitting stays one-click; `funder_portal_submit` stays blocked.

## 0.1.0

First release.
