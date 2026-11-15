# Changelog

## 0.2.0

- New `nausicaa_merge_plan`: for each duplicate group, a survivor chosen by stated rules (S1-S4) and a winner per field with the rule that picked it (F1-F6). Opt-outs and hard bounces always carry over. Writes `merge-plan.csv` with blank reviewer columns.
- New `nausicaa_consent_provenance`: flags opted-in or subscribed contacts with no consent source, no date, an unreadable or future date, or a source not on your allowed list. Exports may add a `consent_source` column.
- New `nausicaa_compare`: period-over-period comparison of two exports (health change, added/removed, newly flagged, resolved, action changes).
- New `nausicaa_check_mx` (opt-in, off by default): domain MX/A/null-MX check from a saved records file, or with `allow_network:true` via one allowlisted DNS-over-HTTPS resolver, sending domain names only. Needs a human yes or an Auto opt-in; blocked in review mode. Tests use an injected fake transport only.
- `nausicaa_audit` returns an explained list health score (0-100).
- Optional rules file (`rules`), validated against the `hygiene_rules` config schema: extra role, disposable and typo lists, allowed consent sources, stale and re-consent days.
- MCP prompt `list_hygiene_workflow`.
- Unchanged: bulk deletes stay one named human click, even in Auto; deleting in the CRM stays blocked.
