# Fairbooks Email Domain Audit (`fairbooks-email-domain-audit`)

> Audits a sending domain's SPF, DKIM, DMARC, BIMI and MX records with read-only DNS-over-HTTPS lookups, reads saved DMARC reports and message headers offline, explains the gaps, pre-stages record changes and plans a staged DMARC rollout. Changing DNS is one human click; Fairbooks Email Domain Audit never edits DNS.

Part of [Fairbooks Machine](https://mythosmachines.com) domain agents: one agent, one process, nothing outside its lane. Built on [`fairbooks-core`](https://www.npmjs.com/package/fairbooks-core). MIT, Node ≥ 20, runs on your machine, no account or API key needed.

## What it does

Give Fairbooks Email Domain Audit a domain. It looks up the mail-authentication records through a public DNS-over-HTTPS resolver (Cloudflare by default, or Google), or reads a saved records file offline, and reports each gap with a severity, the record it is about, what it means and the RFC:
- **SPF**: missing or duplicate records, syntax, `+all` / `?all` / no `all`, `ptr`, and the **10-lookup limit counted through every include**, includes that point at nothing, void lookups and include loops. Pass `return_path` when your provider uses its own bounce subdomain, because SPF is checked there;
- **DMARC**: missing or duplicate records, syntax, `p=none` (monitoring only), partial `pct`, `sp=none`, no report address, and report addresses on another domain that has not authorised them. A subdomain with no record is shown inheriting the organisational domain's policy;
- **DKIM**: for the selectors you name (or a list of common ones), revoked keys, unreadable keys, keys under 1024 bits, 1024-bit keys, `t=y` testing. CNAME-delegated selectors are followed;
- **BIMI** (when a record exists at `default._bimi`, or the `bimi_selector` you name): syntax, an `https://` SVG logo URL, a `.pem` certificate (VMC/CMC) URL, and whether DMARC is enforced at `pct=100`, which BIMI needs. The logo and certificate files are not fetched;
- **MX**: missing MX, null MX, MX hosts that are IP addresses or do not resolve; and, for domains that receive mail, MTA-STS and TLS-RPT records.

Two offline readers fill in what DNS cannot show:
- **DMARC aggregate reports** (`maildomain_dmarc_reports`): saved `rua` reports as `.xml`, `.xml.gz`, `.gz` or `.zip`, or folders of them. Totals messages by sending source IP with pass/fail and SPF/DKIM alignment, counts a resent duplicate report once, and gives each failing source a reason and a fix (an unaligned Return-Path, DKIM signed by the service's own domain, or neither passing, which may be spoofing). It ends with a readiness verdict for the next DMARC stage (default: 98% passing).
- **Message headers** (`maildomain_check_headers`): a saved `.eml`. The SPF/DKIM/DMARC results the receiver wrote (optionally only from your own `trusted_authserv`), whether the Return-Path and DKIM `d=` align with From, `rsa-sha1` signatures, the DKIM selectors in use (feed them to `maildomain_audit`), and the structure of any **ARC** chain: instances 1..n, complete sets, `cv=none` then `cv=pass`, and `cv=fail`. It does not verify signatures.

It writes `mail-dns-audit.md`, a self-contained `mail-dns-audit.html` (no scripts, no network) and `findings.csv`, plus `dmarc-sources.csv` when you pass reports; the Markdown report's SHA-256 goes into the audit log. With approval it **pre-stages** record changes in `zone-change.md` and `proposed-records.json`: SPF from the senders you list, a merge of duplicate SPF records, a fixed `all` term, DMARC at `p=none` with reports, TLS-RPT. It never creates DKIM keys and never proposes an enforcing DMARC policy; those, and SPF over the lookup limit, are listed for a person.

With approval it also **plans a staged DMARC rollout** (`maildomain_plan_dmarc_rollout`): `none` → `quarantine` (25%, then 100%) → `reject` (25%, then 100%) by default, with earliest dates from a `start_date` you give, a `dmarc-rollout.ics` calendar with reminders, and `dmarc-next-stage.json`, a proposal for the **next stage only**. The plan never skips straight to `reject`, starts above any policy a subdomain already inherits, and the next enforcing stage carries a `[TO CONFIRM]` marker unless the DMARC reports you pass meet the readiness threshold, so the one-click request is refused until a person clears it. Stages and thresholds can come from a config file checked against the `dmarc_rollout` schema (`fairbooks-email-domain-audit validate-config dmarc_rollout rollout.json`).

## Install

```bash
npm install -g fairbooks-email-domain-audit
fairbooks-email-domain-audit demo        # runs on the bundled fictional sample data
```

### As an MCP server

**Claude Code**

```bash
claude mcp add fairbooks-email-domain-audit -- npx -y fairbooks-email-domain-audit@0.2.0 mcp --root /path/to/your/exports
```

**Cursor / Claude Desktop / VS Code / Windsurf**

```json
{ "mcpServers": { "fairbooks-email-domain-audit": { "command": "npx", "args": ["-y", "fairbooks-email-domain-audit@0.2.0", "mcp", "--root", "/path/to/your/exports"] } } }
```

`--root` is the only folder the tools can read or write. Paths outside it are refused.

## Tools

| Tool | Policy | What it does |
|---|---|---|
| `maildomain_audit` | **allow** | Look up and check the records; findings with severity, record, meaning and RFC |
| `maildomain_dmarc_reports` | **allow** | Read saved DMARC aggregate reports offline; pass/fail by source with reasons and a readiness verdict |
| `maildomain_check_headers` | **allow** | Read a saved message's headers offline; receiver results, alignment, selectors in use, ARC chain |
| `maildomain_write_report` | **allow** | Write `mail-dns-audit.md`, `mail-dns-audit.html`, `findings.csv` (and `dmarc-sources.csv`) to `fairbooks-out/maildomain` |
| `maildomain_draft_records` | **ask (Auto-eligible)** | Pre-stage record changes in `zone-change.md` and `proposed-records.json` with its hash (DNS untouched) |
| `maildomain_plan_dmarc_rollout` | **ask (Auto-eligible)** | Write a staged DMARC plan (`.md`, `.json`, `.ics`) and a proposal for the next stage only (DNS untouched) |
| `maildomain_request_dns_change` | **ask · one-click** | After a named human approves, record the change (bound to its hash) for whoever edits DNS; refused while `[TO CONFIRM]` markers remain |
| `dns_update` | **block** | Listed so agents see the refusal. Fairbooks Email Domain Audit never edits DNS. |
| `send_test_email` | **block** | Listed so agents see the refusal. Fairbooks Email Domain Audit never sends mail. |

Any other tool name is blocked. `fairbooks_info` shows the pinned model, mode, caps and every decision.

## Modes

- **Review** (`--mode review`): read and report only.
- **Assist** (default): the policy above. `ask` returns an `approval_id`; a person approves once with `fairbooks-email-domain-audit approve <id> --as "Your Name"`.
- **Auto** (`--mode auto --auto <tool,...>`): off by default, opt-in per action, with step/spend caps (`--max-steps`, `--max-spend`) and a kill switch (`fairbooks-email-domain-audit kill`).

`maildomain_audit`, `maildomain_dmarc_reports` and `maildomain_write_report` can run on a schedule, and `maildomain_draft_records` and `maildomain_plan_dmarc_rollout` can go on Auto. Changing DNS is a `production_deploy`: it stays **one-click even in Auto**, and `--auto maildomain_request_dns_change` is refused. The approval is tied to the proposal's hash and is refused while any `[TO CONFIRM]` or `[CHECK MERGE]` marker is left. Editing DNS and sending mail stay **blocked**.

Go-live, revoking access, deleting personal data, moving money, legally binding sends and production deploys always need a person's click, in every Fairbooks pack.

## CLI

```bash
fairbooks-email-domain-audit tools
fairbooks-email-domain-audit call maildomain_audit '{"domain":"example.com","selectors":["s1"],"return_path":"send.example.com"}'
fairbooks-email-domain-audit call maildomain_audit '{"domain":"example.com","records":"records.json"}'   # offline, from a saved file
fairbooks-email-domain-audit call maildomain_dmarc_reports '{"reports":["dmarc"],"domain":"example.com"}'
fairbooks-email-domain-audit call maildomain_check_headers '{"message":"messages/forwarded.eml"}'
fairbooks-email-domain-audit validate-config dmarc_rollout dmarc-rollout.json
fairbooks-email-domain-audit eval          # private evals on the bundled fixtures
```

### MCP prompt

`mail_dns_review` (arguments: `domain`, optional `reports`, `message`, `start_date`) walks a host model through the whole workflow: headers, audit, reports, report files, drafting, the rollout plan, and the one-click DNS change a named person approves.

Every call is written to `.fairbooks/audit.jsonl` (hash-chained JSONL; arguments stored as a hash). Read it with [`fairbooks-audit-evidence`](https://www.npmjs.com/package/fairbooks-audit-evidence) or `npx -y -p fairbooks-core fairbooks-verify-log .fairbooks/audit.jsonl`.

## What it is not

- Not a deliverability guarantee. DNS shows what is published, not how a message was actually signed or which servers really send for you; SPF/DKIM alignment and DMARC results need a real message header or DMARC reports.
- It cannot list DKIM selectors; it checks the ones you name and a list of common ones (or the ones a saved message shows).
- It does not verify DKIM, ARC or BIMI signatures or certificates, does not fetch BIMI logos, and does not look up who owns a sending IP address. Report totals cover only receivers that send reports.
- The rollout dates are earliest dates, not a schedule it keeps; nothing moves to the next stage without a person.
- The organisational domain is taken as the last two labels; check it yourself for suffixes like `.co.uk`.
- It never edits DNS at GoDaddy, Cloudflare or anywhere else, and never sends a test message.
- Not fully autonomous: anything risky waits for a named person.

## Data

Live audits send only domain names to the public resolver you choose (`cloudflare-dns.com` or `dns.google`) over HTTPS. Nothing else leaves your machine; no telemetry. With `records` the audit is fully offline. DMARC reports and message headers are always read offline from files under `--root`. The bundled fixtures are fictional records for reserved example domains.

## License

MIT © 2026 Kurt Francisco. Source: <https://github.com/fpavia111-creator/fairbooks-agents/tree/main/packages/fairbooks-email-domain-audit>
