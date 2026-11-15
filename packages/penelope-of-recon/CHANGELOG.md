# Changelog

## 0.2.0 (2026-11-15)

- Bank file formats: CAMT.053 (XML), BAI2 and OFX/QFX through small built-in parsers (no dependencies). Format is detected from the extension, then the content, or set with `bank_format`. The file's closing balance is used for the tie-out when `bank_balance` is left out. Account numbers are masked to the last 4.
- New tool `penelope_read_statement`: show the parsed lines and check opening + lines = closing.
- Learned match rules: `penelope_suggest_rules` (read) proposes rules from accepted matches; `penelope_accept_rule` (ask) records an accepted rule in `match-rules.json` (config schema `match_rules`). Rules apply only when passed as `rules`.
- Month-end roll-forward: `penelope_roll_forward` carries last period's outstanding items in, clears them, ages what is left (stale flag) and ties out.
- Matching: one GL line can now match several bank lines (`group_bank`).
- Workpaper: new `reconciliation.html` with blank sign-off lines, per-file `file_sha256`, and `output_sha256` in the audit line. `reconciliation.csv` gains a `reference` column (after `description`) so the next month's roll-forward can clear checks by number.
- MCP prompt `month_end_bank_rec`; tool titles; stricter input schemas.
- Unchanged: adjusting entries stay one-click (`move_money`) even in Auto; `ledger_post_journal` stays blocked.

Hardening (review pass)

- Inherited from `mythos-agent-core`: CSV cells that a spreadsheet would run as a formula are neutralised; Markdown output has raw HTML and remote images from data turned into literal text; HTML report tables scroll on narrow screens and header cells carry `scope`; results that quote instruction-like text from data carry a warning; near-miss argument names are refused with the right name; file errors are plain and relative to `--root`.

## 0.1.0

- First release: proposed matches, reconciling items, tie-out, workpaper, accepted matches, one-click adjusting-entry request.
