# Changelog

## 0.2.0 (2026-11-15)

- Lot and serial tracking: counts, on-hand and movements are matched per `lot` (or `serial`); variance per lot; `lot_mixup` when per-lot variances at one item and location net to zero; `serial_qty_over_one` when a serial is counted more than once (always investigate).
- Unit-of-measure table (`uom_table`): counts in another unit are converted with the stated factor (`uom_converted`), and case-vs-each errors are explained with your factor and the arithmetic. A mismatch with no factor stays `uom_mismatch`.
- New `hesperides_count_plan`: ABC classes by value and a count schedule so A items are counted most often; blind count sheets (`count-plan.csv`), `abc-classes.csv` and `count-plan.ics`.
- New `hesperides_accuracy`: record and value accuracy overall and by location, counter and ABC class (class tolerances), with change since a previous count.
- `hesperides_write_report` also writes `recount-sheet.csv` (blind, no system quantities).
- Config schemas `uom_table` and `count_policy` (`validate-config <schema> <file>`).
- New MCP prompt `cycle_count_review`.
- Changed: `variances.csv`, `adjustments-draft.csv` and `post-requests.csv` have a new `lot` column; reason codes for lot lines are keyed `SKU@LOCATION#LOT`; the `reasons` argument must map to strings. Results for the 0.1.0 fixtures are unchanged.
- Unchanged: posting (`move_money`) is one human click even in Auto; writing to an ERP stays blocked.
