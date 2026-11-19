# Fairbooks ver 1: review

Fairbooks is one of the original Fair families: 30 agents and `fairbooks-core` (0.2.0), built 14 to 16 November 2026 as the
Mythos agents and renamed on 18 November. Its build history, per-agent tools, tests and evals and the earlier decisions are
in [UPGRADE-0.2.0.md](UPGRADE-0.2.0.md); this file did not exist before the final pass. The product page
(`fairbooks.html`) sells four engagements: Access review, Dispute packs, Migration readiness and Month-end.

## Final pass (19 Nov 2026)

Run when the main session asked for it (`FINAL-PASS-REQUEST.md`): the eight-point "Final pass" checklist in `BUILD-BRIEF.md`,
Kurt's five review questions answered with numbers, real public data, and the lessons from the families that finished
first. Everything ran on Windows 10, Node 24.20.0, from a fresh clone of this folder (`git -c core.autocrlf=true clone`)
with npm pointed at an address that does not answer, so nothing used the network. Nothing was pushed, published,
uploaded or sent.

### Final numbers

| Check | Before this pass (this machine) | After |
|---|---|---|
| `npm install` in the fresh clone, registry unreachable | not run | passes in 15 s with no network (31 workspace links; no outside dependencies) |
| Line endings in the fresh clone | `* -text` already kept every file byte-for-byte | 1,150 files LF, 17 CRLF (the international, bank-format and e-mail fixtures, as committed), 5 binary; 0 files differ from the committed bytes |
| `try_it` demo (`fairbooks-bank-reconciliation ... demo`) | runs | runs in about 1 s with no setup; the audit log is now in .fairbooks/ |
| `npm test` | 743 pass | 752 pass: core 122; agents 14 to 39 each; 9 new regression tests from this pass |
| Evals (`npm run evals`, new root script) | 441/441 | 441/441; 12 to 22 per agent |
| Eight languages (`npm run intl`, new) | did not exist | 172 cases with spreadsheet inputs in 8 languages: every case that passes in English passes in every language (274 of 340 column names translated) |
| Accuracy (`npm run accuracy`, new; `docs/accuracy-2026-11-19.md`) | not measured | 7 of 30 agents measured: 44/44 planted problems found, 0 unplanned findings, 0 findings on 82 clean rows, 18/18 one-edit mutations caught |
| What reaches the model (`npm run model-view`, new; `docs/model-view-2026-11-19.md`) | not measured | measured per agent; no general masking (below) |
| `npm run hostile` | 0 findings, 2,265 calls | 30 agents, 2,265 calls, 3,319 planted values, 0 findings |
| `npm run hostile:args` | 20,610 calls, 0 findings (Linux, 15 Nov) | 30 agents, 21,218 calls (all tools, broken and hostile arguments), 3,319 planted values, 0 findings (run as six processes of five agents) |
| `npm run bench` (1,000 and 10,000 rows) | 15 Nov record | 68 tool runs at 1,000 and 10,000 rows; median 0.5 s at 10,000 rows; 3 need attention (refund evidence pack 37 s, RFI ball-in-court 5.3 s, vendor duplicate search 10.8 s; see below); expense and grant reviews 1.2 s after the fixes below |
| `npm run release:check:offline` | passes | passes in the fresh clone: workspaces, metadata, clean tree, no .npmrc, secret scan of 1,172 files, honest copy in 94 files, one-click policy, tests 752, evals 441/441, hostile 0, pack 31 packages (1,001 KB, was 995 KB: the clean fixture sets are new), npm names skipped offline |
| Real public data (`npm run realdata`, new; `docs/realdata-2026-11-19.md`) | none | 16 bank files (camt.053, OFX, BAI2) and 5 SEC XBRL series through two agents; the agent and a separate re-count agree on all 21 |

### What changed in this pass

1. **Names.** The 18 Nov rename changed "Mythos" with a capital only. Fairbooks still exposed lowercase `mythos` names that
   every other family names after itself: the info tools `mythos_info` and `mythos_inspect_input`, the `.mythos/` state and
   `mythos-out/` output folders, `mythos-sources.json`, the core's `mythos-approve`, `-verify-log`, `-new-agent` and
   `-license` commands, `MYTHOS_*` environment variables, the `x-mythos-signature` webhook header and `MYTHOS1` licence
   keys. All are now `fairbooks` (266 files). One tool kept a Greek name because a digit followed its prefix
   (`auxo_1099_readiness`, now `taxforms_1099_readiness`); the core described its policy as "Talos-style"; the audit-evidence
   demo printed "an Olympus log". History (CHANGELOGs, the UPGRADE report), fixture data and the readers of files written by
   the 0.2.0 npm packages (docs-drift accepts `mythos_info`; two old format ids are still read) are kept.
2. **Eight-language check** (`scripts/intl-check.mjs`, ported from the newer families). It found two core bugs, both fixed
   the way the newer cores fixed them, with tests: a short GBK header that is valid UTF-8 by accident (a Chinese RFI log lost
   its status column) and a number column that cannot tell its decimal mark (a German key size of "1.024" was read as 1.024).
   The newer cores also convert kg/lb, km/mi and cm/in; fairbooks-core does not, so the check rewrites no units here.
3. **What reaches the model, measured.** Fairbooks has no general masking of names and e-mail addresses (the newer families
   do). The measurement found one leak against the agents' own intent: master-data-duplicates' merge preview showed full tax
   ids (vendor-tax-forms masks the same values); it now shows tax ids and bank or account numbers by their last four
   characters, with a test. The READMEs in nine languages now say plainly that results reach the model unmasked otherwise.
4. **Accuracy measured** for the seven agents behind the four engagements (`scripts/accuracy.mjs`, `scripts/accuracy-specs.mjs`,
   `scripts/lib/findings.mjs`, `fixtures/clean/`). The agents' results differ in shape, so a finding collector reads their
   codes, checks and flags. No wrong finding showed up on the clean sets.
5. **Real data found two bugs in bank-reconciliation**, both fixed with tests: a BAI2 file holding several days for one account
   took the last day's opening balance (SVB's published layout did not tie; it does now), and a camt.053 statement whose
   booked closing balance leaves out a line value-dated the next day was only reported as "does not tie" (PostFinance's
   samples); it now says the difference is that line.
6. **The rename itself broke one script**, found by the fresh-clone run: the bench's copy filter skipped any path containing
   `fairbooks-out`, which is also the start of `fairbooks-outreach-email-gate`, so the bench crashed on that agent. The bench,
   accuracy and model-view filters now match whole path segments (`mythos-out` never matched an agent name).
7. **The Windows bench found two slow file checks** that the 15 Nov bench (Linux) did not show, the same on every commit back to
   15 Nov: expense-policy read each receipt file once per expense line (10,000 lines: about 40 s, now about 1.4 s) and
   grant-reporting checked each evidence path once per row (about 9 to 12 s, now about 1.1 s). Both now read each file once per
   run. Still slow here and left as they are: the refund evidence pack writes one HTML file per chargeback (10,000 disputes:
   about 53 s on Windows, 4.6 s on Linux), RFI ball-in-court grows faster than its input (about 4.8 s at 10,000 rows) and
   vendor-tax-forms' duplicate search takes about 12 s at 10,000 vendors (already marked on 15 Nov).

### The eight points

1. **Names.** Every package, bin, tool prefix, title, README and CHANGELOG is `fairbooks-<job>`; the leftovers above are fixed.
   A search for the 30 old Greek names finds only CHANGELOG history, the UPGRADE report, fictional fixture data (an audit
   log of old tool names, a user called `olympus-agent`) and the two old format ids kept for reading 0.2.0 files. "Talos"
   (agent-guard) and "Alethea" (decision records) remain where they name other tools whose files audit-evidence reads.
2. **Each agent read as a buyer.** Every agent README has "What it does", "Exports it reads" (the files and columns it needs),
   the tools with their arguments and "What it is not"; this pass changed what was wrong: the masking statement and the tool names. Fairbooks has no `sample-reports/` folder in the repo
   (the product page's sample report was made outside it).
3. **Honest copy.** No compliance, certification, savings or advice claims; the release check's claim scan passes (94
   README, package and manifest files). The new privacy line says what is not masked.
4. **Binding actions.** 248 tools: 44 are refused outright (posting, paying, refunding, deleting records, deploying, sending,
   filing) and 73 are one-click actions that wait for a named person in every mode (23 binding sends, 20 production deploys,
   15 money moves, 4 personal-data deletions, 4 access revocations, 3 go-lives, 4 memory changes). No one-click tool is set to
   allow (release check).
5. **The full bar from a clean install.** All pass (table above).
6. **Fixtures.** Fictional people and companies; taxpayer ids are deliberately invalid placeholders; no real customer data.
   The public data lives only in the git-ignored `_realdata/`.
7. **site.json / pricing page / samples.** Fairbooks has no `sales/site.json` or pricing page in this repo; its product page is
   `fairbooks.html` on the site, which this pass did not touch.
8. **Pack.** No secrets, no `.fairbooks`, `.mythos`, `fairbooks-out` or `mythos-out` state, no stray files (release check).

### Kurt's five questions

**1. Accuracy.** Measured for 7 of 30 agents (bank-reconciliation, three-way-match, expense-policy, access-review,
refunds-and-chargebacks, erp-migration, master-data-duplicates): 44/44 planted problems found (recall 100% on fictional
data), 0 unplanned findings, 0 findings on 82 clean rows (false positives 0), 18/18 one-edit mutation cases caught; per agent
in `docs/accuracy-2026-11-19.md`. Access-review's `privileged_role` tag is counted as a review priority, not a finding (a clean
company still has admins). The clean sets were written by the same author as the rules. Vendor-tax-forms (also part of
Month-end) is not measured: a clean vendor needs a well-formed taxpayer id, and any well-formed id could be a real person's or
company's, so its fixtures use invalid placeholders on purpose. For all 30 agents the eval cases assert 596 expected markers
in 217 cases on the planted fixtures and 75 must-not-appear markers (near misses); all pass, but the other 23 agents have no
clean set or mutation cases yet. On public data: the agents and a separate re-count agree on 16 of 16 bank files and 5 of 5
SEC series.

**2. Security.** Per agent in `docs/model-view-2026-11-19.md` (from real runs on the fixtures). Fairbooks has no general
masking: names and e-mail addresses in your files reach the model in clear (access-review: users, owners, reviewers, managers;
crm-hygiene and saas-seats: names and e-mails; outreach-email-gate: recipient e-mails; expense-policy: employees; refunds: customers; vendor-tax-forms and
master-data-duplicates: vendor names, addresses, e-mails). Masked: taxpayer ids (vendor-tax-forms; master-data-duplicates'
merge preview since this pass), secrets (automation-audit, config-drift, mcp-server-review), card numbers in receipt text
(expense-policy) and the data subject in data-erasure-requests. Hostile data 30 agents, 2,265 calls, 3,319 planted values, 0 findings; hostile arguments 30 agents, 21,218 calls (all tools, broken and hostile arguments), 3,319 planted values, 0 findings (run as six processes of five agents).
Results go to whatever model the user's assistant uses; for staff, customer and vendor data use a local model or one covered
by the user's own agreements. No compliance claim of any kind is made.

**3. Compatibility.** 39 named exports: 2 checked against the vendor's published documentation on 15 Nov (Procore RFIs,
Ramp transactions) and 37 written from knowledge of the export (Okta, Entra ID, Microsoft 365, Google Workspace, Slack, GitHub,
AWS IAM, Atlassian, BambooHR, NetSuite, QuickBooks Online, Xero, Stripe, Shopify, HubSpot, Salesforce, Mailchimp, Expensify,
Chase, Bank of America, Wells Fargo, Capital One, Mercury, AWS ACM, crt.sh). None was tested on a real customer export. Bank
statement formats: camt.053, OFX and BAI2 were tested on public sample files in this pass; MT940 is read from knowledge of the
format (a fictional fixture only).

**4. Commercial traction.** None: no paying customers, and no checkout is live (the main session answers for the suite).

**5. Support.** Rules that change are settings or dated files; a result names what it used.

| Rule | Where | Default or version | Source and date | How a customer updates it |
|---|---|---|---|---|
| 1099 threshold | vendor-tax-forms `defaultThreshold` (src/vendors.js), `threshold` argument | 600 before 2026, 2,000 in 2026, later years marked "confirm" | the July 2025 tax law; inflation-indexed after 2026 | pass `threshold` |
| Taxpayer id patterns | vendor-tax-forms src/vendors.js | EIN prefixes never assigned; SSN and ITIN ranges | IRS EIN prefix list, SSA and IRS ITIN rules, as of Nov 2026 | support updates the list |
| Cookie and tracker vendor list | cookie-consent src/vendors.json | 2026.11.0 (about 135 hosts, 90 cookie patterns) | public vendor documentation, 15 Nov 2026 | your own vendor list file overrides; support refreshes the bundle |
| MCP package advisories | mcp-server-review src/data/advisories.json | snapshot 2026-11-15 (named public CVEs) | public advisories | support refreshes it, or it is dropped (an open decision from the UPGRADE report) |
| License text fingerprints | open-source-licenses src/license-fingerprints.json | 2026.11.0 (Apache-2.0, MPL-2.0) | official license texts | support |
| Certificate strength | certificate-expiry src/certs.js | RSA under 2048, EC under 256 bits, SHA-1/MD5 signatures flagged | common CA/Browser Forum and NIST practice | settings for expiry windows; support for the rule |
| Expense, refund, tolerance, retention and access policies | each agent's policy or config JSON (schemas validated) | the customer's own; fixtures hold examples | the customer's policy | edit the JSON file |

### Real data

| File | Source and URL | Date | Licence | What ran and what it found | Wrong findings |
|---|---|---|---|---|---|
| 4 camt.053 statements (2009, 2013, 2019 versions) | PostFinance, https://www.postfinance.ch/en/support/documents/sample-files-for-business-customers.html | 2026-11-19 | Published as sample files for software tests (no licence stated) | bank-reconciliation read all 4 (lines, totals, balances equal a re-count); 2 tie; in the other 2 the booked closing balance leaves out a 1,537.00 credit value-dated the next day, which the agent now explains | none; the "does not tie" was right and is now explained |
| 8 OFX statements | ofxparse test files, https://github.com/jseutter/ofxparse | 2026-11-19 | MIT | all 8 read; lines, totals and ledger balances equal a re-count (OFX gives no opening balance) | none |
| 4 BAI2 files (Citi, NatWest, SVB layouts, a blank trailer) | bai2, https://github.com/ministryofjustice/bai2 | 2026-11-19 | MIT | all 4 read and equal a re-count; NatWest ties; SVB did not tie because the reader took the last day's opening balance (fixed; ties now); Citi's own balances do not add up (100.00 + 0.01 vs 100.00), which the agent reports | one bug, fixed |
| SEC EDGAR XBRL net income and revenue (Apple, Microsoft, Walmart, Alphabet) | https://data.sec.gov/api/xbrl/companyconcept/ | 2026-11-19 | U.S. government data, public domain | erp-migration compared each period's first-filed value with its last-filed value: 448 periods, 26 reported differently later (for example Apple's fiscal 2008 net income, 4,834 then 6,119 million); the agent and a re-count list the same periods in all five series | none |

Nothing public fits the other agents' main inputs (access exports, expense reports, refund queues, inventory counts, contracts,
seat lists are private), so they stay tested on fictional data only.

### What it lacks next to the newer families

- General masking of names and e-mails in results (the newer cores mask every column marked personal).
- Unit conversion (kg/lb, km/mi) in the core reader.
- Accuracy specs for 23 of 30 agents, a `sales/site.json`, a pricing page and a `sample-reports/` folder in the repo.
- Generated README sections ("What it needs" lists) and a README check script.
- 18 of 30 agents have 12 to 14 eval cases, under the newer families' bar of 15 (all 441 pass).

### Decisions for Kurt

- **Masking.** Fairbooks sends names and e-mails to the model; the newer families do not. Porting the newer masking is a
  ver 2 change across all 30 agents. Until then the READMEs say so.
- **Formats.** 37 of 39 named layouts are unchecked; one real export per system from a design partner, or a documentation
  check, would change the label.
- **Vendor-tax-forms fixtures** still use invalid placeholder taxpayer ids, so its demo shows no "ready" vendor and its
  accuracy cannot be measured on a clean set (decision 1 in the UPGRADE report, still open).
- **The MCP advisory snapshot** names real public CVEs and needs an owner to refresh it (decision 3 in the UPGRADE report).
- **Email Domain Audit** still does live DNS lookups when no records file is given (decision 2 in the UPGRADE report).
