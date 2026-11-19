# What reaches the AI model (2026-11-19)

Made by `node scripts/model-view.mjs`: every eval case that calls a read tool on spreadsheet fixtures is run, and every fixture value is looked for in the JSON result the assistant's model receives. Columns whose names say they hold people (names, e-mails, users, employees, customers, owners, phone numbers, addresses, tax ids, card or account numbers) are listed as sent in clear when their values appear as written.

**Fairbooks has no general masking of personal data.** Unlike the newer Fair families, its core does not replace names and e-mail addresses with tokens. What is masked is specific: taxpayer ids in Vendor Tax Forms (last four digits), secrets in Automation Audit, Config Drift and MCP Server Review, card and account numbers where an agent says so, and the data subject's identifiers in Data Erasure Requests. Everything else in a result, including people's names and e-mail addresses from your files, goes to whatever model the user's assistant uses. For staff, customer and vendor data, use a model covered by your own agreements or a local model. No compliance claim is made.

| Agent | Read calls | People columns sent in clear | People columns not in the result (or masked) |
|---|---|---|---|
| fairbooks-access-review | 8 | assigned_reviewer, email, last_login, manager, name, owner, reviewer_name, user | - |
| fairbooks-audit-evidence | 0 | - | - |
| fairbooks-automation-audit | 1 | - | - |
| fairbooks-bank-reconciliation | 10 | - | - |
| fairbooks-board-pack | 5 | - | - |
| fairbooks-certificate-expiry | 6 | holder, name, owner | - |
| fairbooks-config-drift | 1 | - | - |
| fairbooks-contract-clauses | 0 | - | - |
| fairbooks-cookie-consent | 0 | - | - |
| fairbooks-crm-hygiene | 5 | email, name | - |
| fairbooks-cycle-counts | 7 | - | - |
| fairbooks-data-erasure-requests | 0 | - | - |
| fairbooks-docs-drift | 0 | - | - |
| fairbooks-email-domain-audit | 0 | - | - |
| fairbooks-erp-migration | 11 | - | customer, name |
| fairbooks-expense-policy | 8 | employee | - |
| fairbooks-grant-reporting | 7 | - | - |
| fairbooks-master-data-duplicates | 10 | address, email, phone | taxid |
| fairbooks-mcp-server-review | 0 | - | - |
| fairbooks-onboarding-checklists | 6 | manager, name | email |
| fairbooks-open-source-licenses | 0 | - | - |
| fairbooks-outreach-email-gate | 3 | - | - |
| fairbooks-process-evals | 0 | - | - |
| fairbooks-refunds-and-chargebacks | 5 | customer | - |
| fairbooks-rfi-and-submittals | 3 | - | - |
| fairbooks-saas-seats | 5 | email, last_active, name, user | manager_email |
| fairbooks-suitescript-inventory | 1 | - | - |
| fairbooks-three-way-match | 8 | - | - |
| fairbooks-vendor-tax-forms | 6 | address, email, legal_name, name | tin |
| fairbooks-web-page-audit | 0 | - | - |

Agents with no spreadsheet read cases (they read lockfiles, HTML pages, HAR captures, DNS records, contracts, logs or scripts) are listed with 0 calls; what they return is the text of those files where a finding quotes it.
