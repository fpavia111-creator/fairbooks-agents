# Changelog

## 0.2.0 — 2026-11-15

### Added
- Configurable send windows: `days`, `start_hour`, `end_hour`, `time_zone`, several `windows`, and `blackout_dates`. A draft's `time_zone` column checks the window in the recipient's zone. DST is handled by the time-zone database (tests cover Chicago and London, both directions). `nextWindow` searches up to 60 days.
- Spam-phrase check: built-in list plus `spam_words`; each hit is cited with field, position and snippet. Warnings by default, or holds with `spam_policy: "hold"`.
- Link checks: URL shorteners and raw IP links hold; with `link_allowlist`, links (including the unsubscribe link) outside the allowed domains hold; plain http and more than `max_links` links warn.
- Unfilled placeholder check (`{{first_name}}`, `{Company}`, `*|FNAME|*`, `%FNAME%`, `[First Name]`) holds the draft.
- `eucleia_import_suppression`: imports opt-outs and bounces from Mailchimp, HubSpot and Resend exports (format detected from the header); adds only. Ask, Auto-eligible.
- `eucleia_plan_schedule`: plans send slots inside each recipient's window with a daily cap and minimum gap; writes `schedule.csv` and `schedule.ics` (one all-day entry per sending day, no addresses). Its hash is logged as `output_sha256`.
- `eucleia_release_batch` logs the hash of `release.json` as `output_sha256`.
- `eucleia-config` config schema (`configSchemas`), loaded with JSON-pointer errors, plus checks for unknown time zones and inverted hours; `validate-config eucleia-config <file>`.
- MCP prompt `eucleia_outreach_batch`; `title` on the new tools.
- Fixtures: ESP exports (Mailchimp, HubSpot, Resend) for the same three fictional people; `drafts-checks.csv`; `eucleia.json` gained `link_allowlist`, `blackout_dates`, `max_per_day` and `min_gap_minutes` (existing results unchanged).

### Unchanged
- Releasing a batch is `binding_send`: one named human click, even in Auto. Sending stays blocked. All existing tests and evals pass unchanged.
