# Changelog

## 0.2.0 — 2026-11-15

### Added
- `ladon_campaign_status`: reads a filled recertification sheet and reports decided / open / overdue lines, incomplete sign-offs, self-reviews, lines signed by someone other than the assigned or delegated reviewer, a per-reviewer chase list and the lines marked revoke.
- `ladon_access_diff`: compares a previous and a current access export (added, removed, role changes, privilege gained, reactivated, deactivated, new agents/service accounts, owner changes) with a review-first list.
- `ladon_evidence_pack`: writes `recertification-evidence.json` and a self-contained HTML page with the sheet's sha256; the record hash is written to the audit line as `output_sha256`.
- Reviewer assignment, delegation and due dates in the sheet (`assigned_reviewer`, `delegated_to`, `due_date`; high-risk lines are due in half the time).
- Non-human identity checks: agents and service accounts without a credential rotation date, or rotated longer ago than `rotation_max_days` (only when the export has a rotation column).
- Segregation-of-duties rules (`sod_rules`) across systems.
- `ladon-policy` config schema (`configSchemas`), loaded with JSON-pointer errors; `validate-config ladon-policy <file>` works from the CLI.
- MCP prompt `ladon_recertification_campaign`.
- Plain-language `reasons` for every flag; `title` on every tool; stricter input schemas (`as_of` must be a date, day counts must be positive integers, unknown arguments are refused on the read/report tools).
- Fixtures: previous-quarter export, review policy, a filled sheet; the current export gained a `last_rotated` column and one NetSuite row (Casey Wong, A/P Clerk) to show a segregation-of-duties conflict.

### Changed
- `recertification.csv` has four more columns (`last_rotated`, `assigned_reviewer`, `delegated_to`, `due_date`). The reviewer columns are still blank.
- Eval `finds-leaver` now expects 10 accounts (was 9) because the fixture export gained one row.
- Column matching now keeps digits, so a `2FA` header is recognised.

### Not done
- Okta and Entra connectors (read-only) wait for the shared connector work (A3).
- Revocation is unchanged: it stays `revoke_access`, one named human click, even in Auto.
