# Mythos agents 0.2.0: upgrade report

Date: 15 Nov 2026. Scope: `mythos-agent-core` and all 30 domain agents, 0.1.0 → 0.2.0. Nothing was published to npm, pushed to GitHub or deployed to the site.

## Verification

Run on Node 22.23.4 (three packages were also run on Node 24; Node 20 was not available in the build container, so the Node 20/22/24 matrix in `.github/workflows/test.yml` still has to run before release).

- `npm test` across all 31 workspaces: **551 pass, 0 fail** (was 249).
- `eval` for all 30 agents: **420 of 420 cases pass** (was 194).
- `demo` for all 30 agents exits 0.
- `npm pack --dry-run` for all 31 packages: no `node_modules`, `.mythos`, `mythos-out`, `.npmrc`, `.tgz` or test files.
- Policy check: every one of the 166 tools that existed in 0.1.0 has the same kind, category and allow/ask/block decision in 0.2.0. No write or action tool is `allow`. No one-click category is `allow`. 74 tools were added.
- Scans: no secrets (only the documented AWS example key in Nemesis fixtures), every "compliant / certified / fully autonomous / cleared for distribution" hit is a negation, fixture email domains are reserved example domains apart from two deliberate bad-address test cases in Nausicaa (`gmial.com`, `mailinator.com`).
- Echo of Docs run over every agent with its real tool list: 29 clean, 1 false positive (Polyhymnia's changelog names the `funder_template` config schema in backticks).

## Tools, tests and evals per agent

| Agent | Tools | Tests | Evals |
|---|---|---|---|
| aegle-of-certificates | 9 → 12 | 8 → 17 | 7 → 15 |
| aeolus-of-mail | 6 → 9 | 10 → 19 | 7 → 15 |
| agon-of-evals | 5 → 7 | 7 → 19 | 6 → 15 |
| ananke-of-match | 5 → 7 | 8 → 18 | 6 → 12 |
| arethusa-of-flows | 6 → 7 | 8 → 15 | 6 → 12 |
| augeas-of-masters | 4 → 6 | 7 → 18 | 7 → 14 |
| auxo-of-vendors | 6 → 8 | 8 → 16 | 6 → 12 |
| britomartis-of-consent | 6 → 7 | 9 → 18 | 7 → 13 |
| daphne-of-pages | 6 → 6 | 8 → 18 | 7 → 14 |
| echo-of-docs | 6 → 7 | 7 → 15 | 7 → 15 |
| eirene-of-controls | 4 → 7 | 7 → 20 | 5 → 14 |
| eos-of-onboarding | 8 → 12 | 7 → 15 | 6 → 13 |
| epeius-of-rfis | 6 → 10 | 7 → 14 | 6 → 14 |
| epimetheus-of-scripts | 4 → 7 | 7 → 19 | 6 → 14 |
| eucleia-of-outreach | 6 → 8 | 8 → 19 | 7 → 15 |
| helios-of-seats | 4 → 7 | 8 → 20 | 7 → 13 |
| hesperides-of-inventory | 5 → 7 | 8 → 15 | 6 → 12 |
| ladon-of-access | 3 → 6 | 7 → 16 | 6 → 13 |
| lycurgus-of-licenses | 6 → 8 | 8 → 21 | 8 → 17 |
| macaria-of-erasure | 6 → 9 | 7 → 14 | 7 → 13 |
| nausicaa-of-hygiene | 5 → 9 | 7 → 14 | 6 → 14 |
| nemesis-of-servers | 4 → 7 | 8 → 22 | 6 → 17 |
| olympus-of-migration | 4 → 6 | 8 → 19 | 7 → 14 |
| penelope-of-recon | 5 → 9 | 8 → 18 | 7 → 18 |
| polyhymnia-of-grants | 5 → 9 | 7 → 15 | 6 → 14 |
| praxidike-of-expenses | 6 → 10 | 8 → 17 | 7 → 14 |
| solon-of-clauses | 6 → 7 | 6 → 15 | 6 → 14 |
| soteria-of-refunds | 6 → 8 | 7 → 13 | 6 → 12 |
| tiresias-of-drift | 5 → 7 | 7 → 19 | 6 → 15 |
| urania-of-flux | 9 → 11 | 7 → 16 | 7 → 13 |
| **30 agents** | **166 → 240** | **227 → 514** | **194 → 420** |

Core tests went from 22 to 37.

## Core (`mythos-agent-core` 0.2.0)

Roadmap items A1, A2, A4, A5, A6, A8 and A10 are done. A3 (live connectors), A7 (shared fixture generator) and A9 (Pro licence hook) are not.

- **Input validation (A4, A10):** every call is checked against the tool's `inputSchema` before it runs or reaches a person; errors carry JSON-pointer paths. Manifests can declare `configSchemas`; `ctx.readJson(path, schema)` and `validate-config` use them.
- **Signed audit log (A2):** opt-in Ed25519 signature per line, `keygen`, signed `rotate-key`, `verify-log --pubkey`, optional mirror file. A re-chained log fails verification. Keys under `--root` are refused.
- **Approvals (A1):** local approvals page on 127.0.0.1 (strict CSP, no scripts, form token, Host and Origin checks), HMAC-signed outbound webhook and signed callback, reject, 24-hour expiry, a fresh cycle after use, non-human approver names refused.
- **Caps (A5):** persisted per session and per day, per-tool caps, structured cap result, `usage` command.
- **Hardening (A10):** `safePath` refuses symlink escapes and NUL bytes; CI matrix for Node 20/22/24 on Linux and Windows with eval and pack checks.
- **MCP:** protocol 2025-11-25, tool titles and annotations, prompts, pending approvals and usage in `mythos_info`.
- **Evals (A6):** offline HTML and JSON report, baseline comparison that fails on regressions, more expectation types.
- **Docs and scaffolder (A8):** `docs/build-an-agent.md`, `mythos-new-agent` scaffolder whose output passes tests untouched.
- **Shared helpers:** iCalendar, SARIF, unified diff and patch, HTML page, Jaro-Winkler and name/address normalisation, entropy, ZIP and DOCX reading.

## What each agent gained

Every agent also gained an MCP workflow prompt, a CHANGELOG and, where it reads a config file, a JSON Schema for it with typo tests. Reports that matter as evidence record their hash in the audit line.

- **Olympus of Migration:** tie-out by subsidiary and currency with user FX rates and tolerances; field rule checks with row numbers; trial-load to trial-load comparison; prioritised next actions; exceptions CSV; HTML report.
- **Epimetheus of Scripts:** a real tokenizer (comments and strings no longer counted), alias detection, per-file effort estimate with its breakdown, dependency graph with cycles and a stable conversion order, progress against an earlier inventory, SARIF.
- **Eirene of Controls:** verifies signed logs, maps evidence to your own control list with gaps and stale-evidence flags, period-to-period evidence diff, two starter templates, HTML index.
- **Ladon of Access:** reviewer delegation and due dates, campaign status with a chase list, non-human identity owners and rotation, segregation-of-duties rules, access diff between exports, evidence pack.
- **Augeas of Masters:** Jaro-Winkler matching weighted by word rarity, normalised tax ids and addresses, blocking for large files, field-level merge preview, byte-exact undo. Precision 0.986 and recall 1.0 on a seeded synthetic 1,000-row file.
- **Eucleia of Outreach:** configurable send windows, blackout dates and per-recipient time zones with DST tests, spam-phrase and link checks, unfilled-placeholder holds, Mailchimp/HubSpot/Resend suppression import, send schedule with caps.
- **Nemesis of Servers:** taint-style flows (secret to network, token passthrough, input to exec, path and URL), tool-description poisoning and shadowing checks, tool pinning for rug-pull detection, lockfile and advisory checks, OWASP MCP Top 10 and CWE mapping, SARIF with code flows, reviewer policy with justified suppressions.
- **Helios of Seats:** savings pro-rated to the next renewal you can still give notice for, renewal calendar, contract minimums, owner confirmation drafts, review-to-review comparison.
- **Agon of Evals:** rubric grading with cited criteria (it verifies recorded judgments, it calls no judge), bootstrap and exact-test regression statistics, repeated trials with flaky detection, CI gate files, tool-call checks, offline dashboard.
- **Ananke of Match:** partial receipts and several invoices per PO, per-vendor tolerances, received-not-invoiced view, near-duplicate invoice detection, vendor scorecard, HTML report.
- **Penelope of Recon:** CAMT.053, BAI2 and OFX parsers, match rules suggested from accepted matches and applied only after approval, month-end roll-forward with aging, one-to-many matching, sign-off page.
- **Tiresias of Drift:** Terraform state and Kubernetes manifests with secrets masked, approved-drift baseline, revert plan as a patch file, extra risk checks, SARIF.
- **Macaria of Erasure:** your own retention rules and legal holds with rule ids cited, matching on hashed identifiers, deadline tracker with calendar, per-request evidence pack.
- **Soteria of Refunds:** card-network reason-code mapping, per-category evidence checklists and HTML pack, prior undisputed order hints for fraud disputes, dispute deadline calendar.
- **Nausicaa of Hygiene:** merge plans with a winner per field and the rule that chose it, consent provenance check, export-to-export comparison, explained health score, opt-in MX check.
- **Aegle of Certificates:** opt-in live TLS expiry check, COI extraction from exported text (always marked for review), COI requirement profiles, inventory diff, validated calendar, HTML report.
- **Auxo of Vendors:** TIN rules per entity type (always masked), W-8 handling for foreign vendors, 1099 readiness summary, duplicate vendor detection including split payments.
- **Polyhymnia of Grants:** funder templates, budget-versus-actual variance with required explanations, spend-down projection, deadline calendar, zipped evidence pack with a hash manifest.
- **Urania of Flux:** percentage, ratio and direction claim checking against locked figures, SVG charts where every bar traces to a figure id, prior-pack comparison, self-contained HTML board pack.
- **Arethusa of Flows:** Power Automate and Workato exports, secret detection by known format and entropy (values never printed), cross-flow dependency map with a rotation plan, baseline, justified suppressions, SARIF.
- **Daphne of Pages:** contrast from static CSS, focus and ARIA checks with selectors, sitemap and robots consistency, fixes as an applicable diff, "do these first" list grouped by template, HTML report.
- **Praxidike of Expenses:** receipt text normalisation in five layouts, per-diem and mileage rules by date and location, duplicate receipts across reports, ranked audit queue with reasons, evidence pack.
- **Hesperides of Inventory:** lot and serial variance, unit-of-measure conversion with the arithmetic shown, ABC-ranked count plan with blind count sheets and calendar, accuracy by location, counter and class.
- **Eos of Onboarding:** per-role templates, offboarding mirror checklist with removal drafts, per-owner action list, day-one readiness report, calendar.
- **Epeius of RFIs:** drawing index from title-block text, ball-in-court aging with a chase list, transmittal drafts tied to the index, log-to-log diff, due-date calendar.
- **Britomartis of Consent:** vendor list grown from about 30 to about 135 hosts and versioned, Global Privacy Control check, scan-to-scan diff, HTML report, optional `britomartis-capture` helper that records the HARs with Playwright (not a dependency).
- **Lycurgus of Licenses:** pnpm, yarn, Poetry, uv, requirements.txt and Go lockfiles, licence text detection with confidence (low confidence always goes to review), NOTICE and attribution drafts, SBOM diff, metadata-versus-text mismatch flag.
- **Aeolus of Mail:** BIMI and ARC checks, DMARC aggregate report parser, staged none → quarantine → reject rollout plan with calendar, header analysis from a saved message, HTML report.
- **Echo of Docs:** GitHub Action and `ci` command with SARIF and baseline, OpenAPI drift, changelog-versus-version check.
- **Solon of Clauses:** DOCX input, defined-terms check, playbook version and hash cited in the memo, memo redline, draft-to-draft clause comparison.

## Not done

- **Live connectors (A3)** and every per-agent item that depends on them: NetSuite saved search, Okta/Entra, Google Workspace/Slack/GitHub seats, ERP, HRIS, Stripe read-only.
- **Shared fixture generator (A7)** and the 10k-row performance tests.
- **Pro licence hook (A9):** waits for a pricing decision.
- **Agon dashboard headless-Chrome zero-request check:** verified statically instead.
- **Competitor research was shallow:** searches returned result titles, not page contents, so feature choices rest on general knowledge of the named products rather than on pages read during this work.
- **The website** (cards, JSON-LD) was not touched; it is not in this repo.

## Decisions for the owner

1. **Auxo demo shows no "ready" vendor.** The new TIN rules correctly flag the fictional placeholder TINs. Either accept it or allow a small set of documented placeholder TINs to pass in fixtures.
2. **Aeolus does live DNS lookups by default** when no records file is given, including in review mode. This is unchanged from 0.1.0 but sits awkwardly with "network is opt-in". Recommend making it opt-in in 0.2.1.
3. **Nemesis ships a small advisory snapshot naming real public CVEs.** Someone must own refreshing it, or drop it.
4. **Stricter inputs are a behaviour change.** Several tools now reject unknown arguments and configs reject unknown keys. Hosts that passed extras get "invalid arguments".
5. **Default changes:** Augeas threshold is 0.92 on a new score (was 0.88 on a different one); Eirene with `public_keys` requires every log in the call to be signed; several CSV outputs gained columns (listed in each CHANGELOG under changed behaviour).
6. **Approvals that can go on Auto:** `tiresias_approve_baseline` and `penelope_accept_rule` are plain `ask`. Say if they should never be Auto.
7. **`britomartis-capture`** makes real requests unless run with `--offline`. Confirm it should ship.
8. **Lycurgus fixture** includes the full Apache-2.0 text; Echo's Action example points at `@main` and needs 0.2.0 published to work.

## Before release

Run the CI matrix on Node 20/22/24, re-run evals, `npm pack --dry-run`, a secret scan, then publish core first and agents after (they depend on `mythos-agent-core ^0.2.0`). Update the site cards after publish.
