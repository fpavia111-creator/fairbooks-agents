# Changelog

## 0.2.0 — 2026-11-15

### Added
- Better matching: word-by-word Jaro-Winkler (Monge-Elkan) on normalized names, with each word weighted by how rare it is in the file; normalized tax ids / UPCs; normalized postal addresses (same house number required); phone and email-domain support. Each pair now carries explainable `signals`.
- Clusters never contain two different tax ids, even through a record with none (`kept_apart` lists the links that were refused). A similar name with a different address and a different phone is not merged on its own.
- Blocking for files over 400 rows (`compared_pairs`, `blocking` in the result).
- Seeded 1,000-row precision/recall test (generated in the test with a fixed seed; fictional names, `.example` domains, 555-01xx phones, `00-` tax ids): precision 0.986, recall 1.0 at the default threshold; several other seeds ≥ 0.95.
- `augeas_merge_preview`: field-level winners, which record each came from, the rule used, conflicts, and the golden record. Bank and payment columns are never changed.
- `augeas_apply_merge` gains `fill_survivor` (write the previewed winners into the survivor row) and `rules`, and appends every merge to `<copy>.undo.jsonl`. The written copy's hash is logged as `output_sha256`.
- `augeas_undo_merge`: restores the copy byte-for-byte to its state before the last merge (hash-checked; refuses if the copy was edited).
- `augeas-rules` config schema (survivor order, per-field rules, protected fields); `validate-config augeas-rules <file>`.
- `merge-proposals.html`: a self-contained review page (no scripts, no network).
- MCP prompt `augeas_dedupe_master`; `title` on tools; stricter input schemas.

### Changed
- Default `threshold` is now 0.92 on the new name score (was 0.88 on character-bigram Dice). The `dice` and `normName` exports are kept.
- Suggested survivor order can be set in the rules file.
- All existing tests and evals pass unchanged.
