# Olympus of Migration (`olympus-of-migration`)

> Check NetSuite / ERP migration exports before go-live. Read-only on your data. Never approves go-live.

Part of [Mythos Machine](https://mythosmachines.com) domain agents: one agent, one process, nothing outside its lane. Built on [`mythos-agent-core`](https://www.npmjs.com/package/mythos-agent-core). MIT, Node ≥ 20, runs on your machine, no account or API key needed.

## What it does

Olympus compares what you exported from the old system with what landed in the new one (for example a NetSuite sandbox trial load) and writes a readiness report. It works on export files you already have (CSV, JSON or JSONL). It needs no NetSuite login and no credentials.

It finds:
- source records missing from the target, and extra target records;
- duplicate and blank keys;
- field values that differ (numbers compared by value, so `$1,200.00` equals `1200`);
- amount totals that do not tie;
- trial-balance accounts that do not tie, or whose balance is blank (reported as unknown, never guessed);
- trial balances by **subsidiary and currency**: amounts converted to a base currency with FX rates **you** supply (a currency with no rate is reported as unknown, never guessed), with a per-subsidiary difference;
- rows that break your **field rules** (required, unique, number/date type, allowed values, pattern, min/max, max length), with spreadsheet row numbers;
- what changed **between two trial loads** (findings resolved, new and still open; records fixed and newly missing).

The readiness report has a prioritised **next-actions** list (P1 items block go-live, each with the reason), an `exceptions.csv` with one row per problem and empty `owner`/`resolution` columns, and an HTML copy (self-contained, no scripts). The report's hash (`output_sha256`) is written into the audit line, so with `--signing-key` it lands in a signed log.

### Tolerances, FX and rules (`migration_rules`)

Put your settings in one JSON file and pass it as `config` to any tool. Arguments you pass explicitly win over the file.

```json
{
  "name": "Trial load 3 rules",
  "key": "externalid", "amount_column": "amount",
  "tolerance": 0.01,
  "subsidiary_column": "subsidiary", "currency_column": "currency",
  "base_currency": "USD", "fx_rates": { "EUR": 1.10 },
  "field_rules": [ { "id": "INV-KEY", "column": "externalid", "required": true, "unique": true } ]
}
```

`tolerance`: differences up to and including it count as tied (default 0.005). Typos fail with a JSON pointer instead of being ignored; check a file with `olympus-of-migration validate-config migration_rules rules.json`.

## Install

```bash
npm install -g olympus-of-migration
olympus-of-migration demo        # runs on the bundled fictional sample data
```

### As an MCP server

**Claude Code**

```bash
claude mcp add olympus-of-migration -- npx -y olympus-of-migration@0.2.0 mcp --root /path/to/your/exports
```

**Cursor / Claude Desktop / VS Code / Windsurf**

```json
{ "mcpServers": { "olympus-of-migration": { "command": "npx", "args": ["-y", "olympus-of-migration@0.2.0", "mcp", "--root", "/path/to/your/exports"] } } }
```

`--root` is the only folder the tools can read or write. Paths outside it are refused.

## Tools

| Tool | Policy | What it does |
|---|---|---|
| `olympus_compare_exports` | **allow** | Compare source vs target export |
| `olympus_tie_out_balances` | **allow** | Trial balance tie-out by account |
| `olympus_check_fields` | **allow** | Check one export against field rules |
| `olympus_compare_runs` | **allow** | Compare two `findings.json` files (trial load N vs N+1) |
| `olympus_readiness_report` | **allow** | Write `readiness-report.md`, `readiness-report.html`, `findings.json` and `exceptions.csv` to `mythos-out/olympus`; records the report hash in the audit log |
| `olympus_approve_go_live` | **block** | Listed so agents see the refusal. Go-live is a human decision. |

Any other tool name is blocked. `mythos_info` shows the pinned model, mode, caps and every decision.

The MCP prompt `olympus_go_live_readiness` walks a host model through the whole check (compare, tie-out, field rules, run comparison, report) and stops at the human go-live sign-off.

## Modes

- **Review** (`--mode review`): read and report only.
- **Assist** (default): the policy above. `ask` returns an `approval_id`; a person approves once with `olympus-of-migration approve <id> --as "Your Name"`.
- **Auto** (`--mode auto --auto <tool,...>`): off by default, opt-in per action, with step/spend caps (`--max-steps`, `--max-spend`) and a kill switch (`olympus-of-migration kill`).

Every Olympus tool is read or report, so Auto changes nothing here. Go-live stays **blocked** in every mode.

Go-live, revoking access, deleting personal data, moving money, legally binding sends and production deploys always need a person's click, in every Mythos pack.

## CLI

```bash
olympus-of-migration tools
olympus-of-migration call olympus_compare_exports '{"source":"legacy-open-invoices.csv","target":"sandbox-open-invoices.csv","key":"externalid","amount_column":"amount"}'
olympus-of-migration eval          # private evals on the bundled fixtures
```

Every call is written to `.mythos/audit.jsonl` (hash-chained JSONL; arguments stored as a hash). Read it with [`eirene-of-controls`](https://www.npmjs.com/package/eirene-of-controls) or `npx -y -p mythos-agent-core mythos-verify-log .mythos/audit.jsonl`.

## What it is not

- Not an ERP, an importer or a migration tool. It does not load data.
- Not a guarantee that the books tie. It checks the files you give it.
- Not accounting, tax or audit advice, and not a certification.
- It does not fetch FX rates or connect to NetSuite; you supply rates and export files. (A saved-search connector is planned, not built.)
- Not fully autonomous: anything risky waits for a named person.

## Data

Everything runs locally on files you choose. No network calls, no telemetry. The bundled fixtures are fictional.

## License

MIT © 2026 Kurt Francisco. Source: <https://github.com/fpavia111-creator/mythos-agents/tree/main/packages/olympus-of-migration>
