# Changelog

Renamed from `urania-of-flux` on 18 Nov 2026 (tool names were `urania_*`, now `board_*`).

## 0.2.1

- Version bump with the rest of the suite (Fair-Agents brand in the README; no behaviour change in this package).

## 0.2.0 — 2026-11-15

### Added
- `board_compare_prior` (read, allow): compares this pack's figures with the prior pack's. Flags prior-period values that no longer equal what was reported, same-period restatements, new and dropped metrics and changed figure ids, and lists every sentence citing an affected figure. Checks the prior figures against the prior `pack-manifest.json` hash when given.
- `board_charts` (report, allow): self-contained SVG charts (variance, variance %, actual against basis) drawn only from locked, unchanged figures. No scripts, no links, no external references. Each bar carries its figure id, field and value; `charts.json` lists every point.
- `board_assemble_pack` `html: true`: a self-contained `board-pack.html` (CSP `default-src 'none'`, no scripts) with the charts inline. Its hash is in `pack-manifest.json`, and sign-off is refused if it changed.
- Claims check: ratios and changes between two cited figures; hedges ("about", "roughly", "nearly", "~") widen the match to one unit of the last digit; a new `direction_mismatch` status when "up"/"down" wording contradicts the sign of the matched variance. `citations.csv` gains a `wrong_direction` column.
- `pack_manifest` config schema: `pack-manifest.json` is validated (JSON-pointer errors) whenever Urania reads it back; also `fairbooks-board-pack validate-config pack_manifest <file>`.
- MCP prompt `board_board_pack` for the end-to-end workflow.
- Assembly and sign-off results carry `output_sha256` (the pack hash), so the audit line records which pack was built and signed.
- Fixtures: `docs/cfo-notes.md`, `prior/figures-2026-09.csv`, `prior/pack-manifest-2026-09.json` (fictional).

### Changed
- A sentence that matched every number but states the wrong direction is now an issue (`direction_mismatch`); before 0.2.0 it passed. Existing fixtures and evals are unchanged.

### Hardening (review pass)

- Chart labels say "budget" in full and the value column is sized to its longest label, so large numbers cannot run into the bars. Board pack numbers are right-aligned. Chart file names use `safeFileName`. `pack_sha256` is the hash of the file as written.
- Inherited from `fairbooks-core`: CSV cells that a spreadsheet would run as a formula are neutralised; Markdown output has raw HTML and remote images from data turned into literal text; HTML report tables scroll on narrow screens and header cells carry `scope`; results that quote instruction-like text from data carry a warning; near-miss argument names are refused with the right name; file errors are plain and relative to `--root`.

