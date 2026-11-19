# Fairbooks Machine domain agents

Thirty small MCP agents. Each one owns **one business process** (an access review, a bank reconciliation, an ERP migration check, a refund dispute) and cannot act outside it. They read the files you already export, write reports on your machine, and wait for a named person before anything that matters happens.

MIT licence · Node 20 or newer · local files only · no credentials · no dependencies

Also in: [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (translated by Claude; native review pending)

## Try one

```bash
npx -y fairbooks-access-review demo        # access review on fictional data
npx -y fairbooks-erp-migration demo   # ERP migration readiness on fictional data
```

Every agent has a `demo` that runs on fictional files and an MCP server (`npx -y <agent> mcp`) for Claude Desktop, Claude Code, Cursor and other MCP hosts. See each agent's README for its tools.

## The agents

**Finance and accounting**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairbooks-erp-migration`](packages/fairbooks-erp-migration) | Compares old-system and new-system exports (missing records, totals, trial balances by subsidiary and currency, field rules) and writes a readiness report | Approving go-live (it never does) |
| [`fairbooks-bank-reconciliation`](packages/fairbooks-bank-reconciliation) | Bank-to-GL reconciliation from CSV, Excel, CAMT.053, MT940, BAI2 or OFX: proposed matches, reconciling items, tie-out, month-end roll-forward | Posting an adjusting entry |
| [`fairbooks-three-way-match`](packages/fairbooks-three-way-match) | AP three-way match of POs, receipts and invoices, with an exceptions worklist | Posting or paying (never) |
| [`fairbooks-expense-policy`](packages/fairbooks-expense-policy) | Expense reports and receipt text checked against your written policy, with cited findings | Reimbursing; paying is blocked |
| [`fairbooks-vendor-tax-forms`](packages/fairbooks-vendor-tax-forms) | Vendor W-9 readiness, masked TINs, duplicate vendors and request drafts | Sending a request; never files with the IRS |
| [`fairbooks-cycle-counts`](packages/fairbooks-cycle-counts) | Cycle-count variances with timing, unit-of-measure and recount checks, ranked by value | Posting adjustments |
| [`fairbooks-board-pack`](packages/fairbooks-board-pack) | Board pack from locked figures, with cited commentary and a claims check | Sign-off and distribution |
| [`fairbooks-grant-reporting`](packages/fairbooks-grant-reporting) | Grant deadlines, budget pace, outcomes and evidence in a draft report packet | Submitting |

**Access, security and IT**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairbooks-access-review`](packages/fairbooks-access-review) | Access recertification for people, agents and service accounts: leavers, stale and privileged accounts, SoD conflicts, reviewers, due dates, evidence pack | Revoking access (it never does) |
| [`fairbooks-saas-seats`](packages/fairbooks-saas-seats) | Unused, idle, duplicate and over-tiered SaaS seats with estimated savings and a renewal calendar | Revoking a seat |
| [`fairbooks-onboarding-checklists`](packages/fairbooks-onboarding-checklists) | Onboarding checklists for employees, contractors and customers, with access request drafts | Granting or removing access |
| [`fairbooks-config-drift`](packages/fairbooks-config-drift) | Config and schema drift over time, explained with risk levels | Applying a fix to production |
| [`fairbooks-certificate-expiry`](packages/fairbooks-certificate-expiry) | TLS, domain, licence and vendor insurance (COI) expiry tracking with chase drafts | Paid renewals, production changes and sends |
| [`fairbooks-email-domain-audit`](packages/fairbooks-email-domain-audit) | SPF, DKIM, DMARC, MX, MTA-STS and TLS-RPT audit with read-only DNS-over-HTTPS lookups | Changing DNS (it never does) |
| [`fairbooks-mcp-server-review`](packages/fairbooks-mcp-server-review) | Static review of an MCP or Code Mode server, or an MCP config, for risky patterns | Running it (never) |

**Customers, vendors and operations**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairbooks-refunds-and-chargebacks`](packages/fairbooks-refunds-and-chargebacks) | Refund and chargeback triage against your policy, with draft evidence packs | Moving money (never) |
| [`fairbooks-master-data-duplicates`](packages/fairbooks-master-data-duplicates) | Duplicate vendors and items, merge previews field by field, one approved merge at a time on a copy | Each merge; paying a vendor is one click |
| [`fairbooks-crm-hygiene`](packages/fairbooks-crm-hygiene) | Contact-list hygiene: bounces, role addresses, duplicates, stale records, consent | Bulk deletes |
| [`fairbooks-outreach-email-gate`](packages/fairbooks-outreach-email-gate) | Draft-only outreach gate: suppression list, footer fields, send window, length limits | Sending (never) |
| [`fairbooks-rfi-and-submittals`](packages/fairbooks-rfi-and-submittals) | Construction RFI and submittal logs against your drawing and spec index, with RFI drafts that cite your documents | Sending |
| [`fairbooks-automation-audit`](packages/fairbooks-automation-audit) | n8n, Zapier and Make flow audit for broken and risky flows | Enabling or changing production flows |

**Privacy, web and legal**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairbooks-data-erasure-requests`](packages/fairbooks-data-erasure-requests) | Erasure requests: where personal data lives and a checklist | Deleting (it never deletes itself) |
| [`fairbooks-cookie-consent`](packages/fairbooks-cookie-consent) | Cookie and third-party inventory from exported HTML and HAR captures, compared with your stated policy and banner | Publishing; it is not a consent manager and makes no GDPR or CCPA compliance claim |
| [`fairbooks-web-page-audit`](packages/fairbooks-web-page-audit) | Broken links, SEO basics and automatable WCAG checks on exported HTML, with a fix list | Publishing; not a legal opinion |
| [`fairbooks-contract-clauses`](packages/fairbooks-contract-clauses) | Contract clauses checked against your own playbook, with citations and an issues list for counsel | A binding send; e-signing is blocked; not legal advice |
| [`fairbooks-open-source-licenses`](packages/fairbooks-open-source-licenses) | Your written licence policy applied to npm dependencies, with a report, CycloneDX SBOM and SARIF | A release; not legal advice |
| [`fairbooks-audit-evidence`](packages/fairbooks-audit-evidence) | Evidence folder from agent audit logs; evidence, not certification | Sending it to an auditor |

**Building and testing agents**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairbooks-core`](packages/fairbooks-core) | The shared runtime: manifest, allow/ask/block policy, input validation, Review/Assist/Auto modes, caps, kill switch, signed audit log, approvals page, domain memory, file readers, MCP server | (the rules below) |
| [`fairbooks-process-evals`](packages/fairbooks-process-evals) | Private evals for one process on one pinned model, with regression compare; calls no model | Publishing results |
| [`fairbooks-docs-drift`](packages/fairbooks-docs-drift) | Docs drift: README and SKILL.md checked against the tool list, schemas and package.json, with mechanical fixes as copies | Publishing docs |
| [`fairbooks-suitescript-inventory`](packages/fairbooks-suitescript-inventory) | NetSuite SuiteScript inventory and 2.1 migration risk ranking | Deploying (never) |

## Files and languages

The agents read CSV, TSV, semicolon- and pipe-separated text, Excel `.xlsx`, JSON and JSONL. Twelve of them recognise 39 named exports by their columns: Okta, Microsoft Entra ID, Google Workspace, Slack, GitHub, AWS, NetSuite, QuickBooks Online, Xero, Stripe, Shopify, HubSpot, Salesforce, Mailchimp, Procore, Ramp, Expensify, BambooHR, five US banks and more. Two of those layouts were checked against vendor documentation; the others were written from knowledge of the exports, and none has been tested against a live account. `<agent> inspect <file>` shows how a file would be read without printing any cell value.

Files from the largest software markets read as they come out of local systems: German, French, Spanish, Brazilian Portuguese, Italian, Japanese, Chinese and Korean column names; Shift_JIS, GB18030, Big5, EUC-KR, Windows-1252 and UTF-16 files; amounts such as `1.234,56`, `R$ 1.234,56`, `1,200円` and `△300`; dates such as `14. November 2026`, `2026年11月14日`, `令和8年` and `2026년 11월 14일`; names with legal forms such as GmbH, SARL, S.L., S.A. de C.V., Ltda., S.r.l., 株式会社, 有限公司 and 주식회사. `--lang de|fr|es|pt|it|ja|zh|ko` writes the approvals page, the Fairbooks ERP Migration readiness report and the Fairbooks Access Review recertification summary and evidence page in that language; results, codes and CSV files stay in English. These translations were written by Claude and have not been reviewed by native speakers yet.

## The rules every agent follows

- Unknown tools are blocked. The default decision is block.
- **Auto** is off by default and opt-in per action, with step and spend caps and a kill switch.
- Go-live, revoking access, deleting personal data, moving money, legally binding sends and production deploys always need a named person's click, even in Auto. So does changing what an agent remembers.
- Agents with memory (Fairbooks ERP Migration and Fairbooks Access Review) use only facts a named person accepted, say which facts each result used, and cannot learn anything that loosens a check.
- Every decision goes to a hash-chained JSONL audit log, signed if you give it a key.
- Text from your files is treated as data. Spreadsheet formulas, raw HTML and `../` in ids are neutralised on the way out, and a result that quotes text aimed at an AI model ("ignore previous instructions") is flagged. The flag is a heuristic, not a filter.

## What they are not

- Not live integrations: they read exported files and never log in to your systems.
- Not legal, tax, accounting or audit advice, and not a certification of anything.
- Not fully autonomous: the steps above wait for a person, every time.
- Not a privacy filter: what a tool returns goes to whatever AI model your assistant uses, including names and e-mail addresses from your files. Only tax ids (Vendor Tax Forms, and the merge preview in Master Data Duplicates), secrets and the data subject in Data Erasure Requests are masked. For staff, customer and vendor data, use a model covered by your own agreements or a local model.
- No claim about any country's laws, tax rules or filing formats.

## Develop

```bash
npm install             # links the workspaces
npm test                # node --test in every package
npm run hostile         # plant hostile values in every agent's fixtures, run every eval case, inspect the output
npm run release:check   # pre-publish dry run (never publishes)
npm run bench           # every read and report tool on generated 1,000- and 10,000-row files
npm run evals           # every agent's eval cases
npm run intl            # the eval cases again on German, French, Spanish, Brazilian, Italian, Japanese, Chinese and Korean exports
npm run accuracy        # planted problems, a clean set and one-edit mutations for the engagement agents
npm run model-view      # what reaches the AI model, per agent
npm run realdata -- --download   # public bank files and SEC data (needs the network once)
node scripts/sources-doc.mjs   # regenerate the "Exports it reads" README sections
```

To build a new agent, read [docs/build-an-agent.md](docs/build-an-agent.md). What changed in 0.2.0 is in [UPGRADE-0.2.0.md](UPGRADE-0.2.0.md); the 15 Nov 2026 speed results are in [docs/bench-2026-11-15.md](docs/bench-2026-11-15.md).

MIT © 2026 Kurt Francisco · <https://mythosmachines.com>
