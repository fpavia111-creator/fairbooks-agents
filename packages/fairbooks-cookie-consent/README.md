# Fair-Agents Cookie Consent (`fairbooks-cookie-consent`)

> Inventories the cookies and third-party scripts a site actually sets and loads, compares them with your cookie policy and banner, and reports the gaps. Publishing changes is one human click. Not a consent-management platform, and it never claims GDPR or CCPA compliance.

Part of [Fair-Agents](https://mythosmachines.com) domain agents: one agent, one process, nothing outside its lane. Built on [`fairbooks-core`](https://www.npmjs.com/package/fairbooks-core). MIT, Node ≥ 20, runs on your machine, no account or API key needed.

## What it does

Give Fair-Agents Cookie Consent what the site really does: a folder of exported HTML pages and/or HAR captures from your browser's network panel. Use a clean profile and record a **first visit** before any choice, optionally a visit **after "Reject"**, and one **after "Accept"**. Add your stated policy as a small JSON file (cookies with provider, purpose and duration; third-party hosts with purpose). It builds an inventory and reports:
- **cookies**: every cookie set by a `Set-Cookie` header or by a script (seen in later requests), first or third party, lifetime, `Secure`, `SameSite`, and which capture it appeared in;
- **third-party hosts**: scripts, frames, pixels, fonts and requests to other sites, and whether a script in the HTML is consent-gated (`type="text/plain"` with a `data-category`, or similar);
- **gaps**: undeclared cookies and hosts; analytics or marketing cookies and requests **before consent** or **after a reject**; tracker scripts loaded with no gating; a page saying "no cookies", "no tracking cookies", "no trackers" or "no analytics" when the captures show otherwise; `SameSite=None` without `Secure`; cookies without `Secure` on https; lifetimes over about 13 months; durations that differ from the policy; declared items not seen; no consent banner or consent manager; no link to a cookie or privacy policy.

- **Global Privacy Control**: give a capture recorded with GPC turned on (`har_gpc`; any capture whose requests carry `Sec-GPC: 1` is checked) and it flags analytics or marketing cookies and requests that still appear (`gpc_signal_ignored`). If the site folder has `.well-known/gpc.json` saying `"gpc": true`, that becomes an error, and if no GPC capture was given it says the claim was not tested. Whether a site has to honour the signal depends on where it operates; Fair-Agents Cookie Consent only reports what the capture shows.

Purposes come from your policy. For anything undeclared, Fair-Agents Cookie Consent uses a **versioned vendor list** (`src/vendors.json`, about 135 hosts and 90 cookie patterns, version shown on every match) and **labels it a guess**. You can add your own list (`vendors`, same format, matched first and cited by its own version).

Run it again next month and give it the `inventory.json` from the last report (`consent_diff_inventory`): it lists new and gone cookies and hosts, purpose changes, new gaps and gaps no longer found. With approval it drafts a cookie table for your policy page, with `[TO CONFIRM]` wherever a person has to decide. It does not edit scripts, the banner or the policy text.

## Install

```bash
npm install -g fairbooks-cookie-consent
fairbooks-cookie-consent demo        # runs on the bundled fictional sample data
```

### As an MCP server

**Claude Code**

```bash
claude mcp add fairbooks-cookie-consent -- npx -y fairbooks-cookie-consent@0.2.1 mcp --root /path/to/your/exports
```

**Cursor / Claude Desktop / VS Code / Windsurf**

```json
{ "mcpServers": { "fairbooks-cookie-consent": { "command": "npx", "args": ["-y", "fairbooks-cookie-consent@0.2.1", "mcp", "--root", "/path/to/your/exports"] } } }
```

`--root` is the only folder the tools can read or write. Paths outside it are refused.

## Tools

| Tool | Policy | What it does |
|---|---|---|
| `consent_inventory` | **allow** | Cookie and third-party inventory with every gap against the declared policy |
| `consent_write_report` | **allow** | Write `consent-audit.md`, `consent-audit.html` (self-contained, no scripts), `cookie-inventory.csv`, `third-parties.csv` and `inventory.json` (no cookie values) to `fairbooks-out/consent`; the output hash goes into the audit line |
| `consent_diff_inventory` | **allow** | Compare an earlier `inventory.json` with the current captures |
| `consent_draft_policy_table` | **ask (Auto-eligible)** | Draft `cookie-table.md` and `declared.proposed.json` with `[TO CONFIRM]` markers, plus `proposal.json` with hashes |
| `consent_request_publish` | **ask · one-click** | After a named human approves, record the reviewed table (bound to its hash; refused while markers remain) for whoever publishes |
| `deploy_site` | **block** | Listed so agents see the refusal. Fair-Agents Cookie Consent never changes the live site, banner or tag manager. |
| `http_fetch` | **block** | Listed so agents see the refusal. Fair-Agents Cookie Consent makes no network calls. |

Any other tool name is blocked. `fairbooks_info` shows the pinned model, mode, caps and every decision.

### MCP prompt

`consent_consent_audit` (arguments `base_url`, `har_first_visit`, optional `site`, `har_after_reject`, `har_gpc`, `declared`, `previous`) walks the host model through validating the policy file, the inventory, GPC, the comparison with the last scan, the report, an optional draft and the one-click publish.

### Config files

The declared policy (`declared_policy`) and an extra vendor list (`vendor_list`) are checked against JSON Schemas; typos and wrong types fail with a JSON pointer (`/cookies/2/purpose must be one of …`). Check a file on its own with `fairbooks-cookie-consent validate-config declared_policy declared.json`.

## Recording the captures (optional helper)

You can record the HAR files from your browser's network panel. If you have [Playwright](https://playwright.dev) installed yourself, `consent-capture` does it headlessly:

```bash
consent-capture --url https://www.example.com/ --page /order.html \
  --reject "#reject-all" --accept "#accept-all" --out captures --allow-network
```

Without `--allow-network` nothing leaves your machine; point `--map https://www.example.com=http://127.0.0.1:8080` at a local copy to capture offline.

It writes `first-visit.har`, `after-reject.har` and `after-accept.har` (when you give the button selectors) and `gpc-visit.har` (sent with `Sec-GPC: 1`; `--no-gpc` to skip), with **cookie values redacted**. It opens a real headless browser but is **offline by default**: every request that is not mapped with `--map` (for example to a local copy of your site) or stubbed with `--stubs` gets an empty 204. Only when you pass `--allow-network` does it visit your real site and every third party it loads. Playwright is not a dependency of this package and is only imported when you run the helper; no MCP tool runs it.

## Modes

- **Review** (`--mode review`): read and report only.
- **Assist** (default): the policy above. `ask` returns an `approval_id`; a person approves once with `fairbooks-cookie-consent approve <id> --as "Your Name"`.
- **Auto** (`--mode auto --auto <tool,...>`): off by default, opt-in per action, with step/spend caps (`--max-steps`, `--max-spend`) and a kill switch (`fairbooks-cookie-consent kill`).

The inventory and report can run on a schedule over fresh captures, and `consent_draft_policy_table` can go on Auto. Publishing a policy, banner or site change is a `production_deploy`: it stays **one-click even in Auto**, and `--auto consent_request_publish` is refused. The approval is tied to the proposal's hash, every drafted file is re-hashed, and it is refused while any `[TO CONFIRM]` is left. To clear them, fill in `declared.proposed.json`, save it as your policy file and draft again. Deploying and fetching stay **blocked**; the capture helper is a separate command you run, never a tool.

Go-live, revoking access, deleting personal data, moving money, legally binding sends and production deploys always need a person's click, in every Fair-Agents pack.

## CLI

```bash
fairbooks-cookie-consent tools
fairbooks-cookie-consent call consent_inventory '{"site":"site","base_url":"https://www.example.com","har_first_visit":"first-visit.har","declared":"declared.json"}'
fairbooks-cookie-consent eval          # private evals on the bundled fixtures
```

Every call is written to `.fairbooks/audit.jsonl` (hash-chained JSONL; arguments stored as a hash). Read it with [`fairbooks-audit-evidence`](https://www.npmjs.com/package/fairbooks-audit-evidence) or `npx -y -p fairbooks-core fairbooks-verify-log .fairbooks/audit.jsonl`.

## What it is not

- Not legal advice, and it never says a site is GDPR, CCPA/CPRA or ePrivacy compliant. It is a technical inventory to check against what your policy and banner say.
- Not a consent-management platform. It shows no banner and stores no consent.
- It only sees what your files show. Cookies set on pages or flows you did not capture, or only for some visitors or regions, are missed. Vendor purposes for undeclared items are guesses.
- The MCP tools do not crawl or fetch your site; you export the pages and record the captures (by hand or with the optional `consent-capture` helper, which you run yourself).
- A GPC finding says trackers were seen while the signal was sent. It does not say what the law requires of your site.
- Not fully autonomous: anything risky waits for a named person.

## Data

The MCP tools run locally on files you choose: no network calls, no telemetry. Only `consent-capture`, when you run it with `--allow-network`, visits your site. HAR files can contain cookie values and session tokens. Fair-Agents Cookie Consent reports cookie names and attributes, never their values, but keep the captures private and delete them when you are done. `consent-capture` redacts cookie values unless you pass `--no-redact`. The bundled fixtures are fictional.

## License

MIT © 2026 Kurt Francisco. Source: <https://github.com/fpavia111-creator/fairbooks-agents/tree/main/packages/fairbooks-cookie-consent>
