# Fairbooks SuiteScript Inventory (`fairbooks-suitescript-inventory`)

> Inventory SuiteScript files and risk-rank what must move to SuiteScript 2.1. Never deploys code.

Part of [Fairbooks Machine](https://mythosmachines.com) domain agents: one agent, one process, nothing outside its lane. Built on [`fairbooks-core`](https://www.npmjs.com/package/fairbooks-core). MIT, Node ≥ 20, runs on your machine, no account or API key needed.

## What it does

Point Fairbooks SuiteScript Inventory at a folder of scripts (an SDF project, a FileCabinet download, or any folder of `.js` files). It reads each file and reports:
- the SuiteScript version: `1.0` (nlapi/nlobj calls, no `@NApiVersion`), `2.0`, `2.x` or `2.1`, and `unknown` when it cannot tell;
- the script type (`@NScriptType`);
- every 1.0 API call with its line number and a SuiteScript 2.1 module hint (for example `nlapiRequestURL` → `N/https request()`);
- a risk score (0–100) with plain reasons: version, record writes, outbound HTTP/email, scheduling/yield logic, size;
- the `N/` modules each file loads through `define([...])` / `require(...)`, with their aliases;
- a **rough effort estimate** in hours per file and in total, broken down into the signals it counted (version, distinct APIs, calls, size, redesign, writes, outbound calls, APIs with no mapping hint, custom dependencies). Same file and weights give the same number. Calibrate the weights with your own `estimate_config` file;
- a **dependency graph** of your own modules (relative and `/SuiteScripts/...` paths) with a stable conversion order (libraries first), dependency **cycles**, and module paths it could not resolve;
- **progress** against an earlier `inventory.csv`: files converted to 2.1, improved, regressed, added and removed.

Files are read with a small built-in tokenizer, so `nlapi…` calls and `N/…` module names inside comments, strings and regex literals are not counted.

It can also write a **SARIF 2.1.0** file (one result per 1.0 call, with file and line) for GitHub code scanning or any SARIF viewer.

Oracle has announced that custom scripts must run on SuiteScript 2.1 by NetSuite 2028.2. Check the dates and scope against the notice in your own account.

## Install

```bash
npm install -g fairbooks-suitescript-inventory
fairbooks-suitescript-inventory demo        # runs on the bundled fictional sample data
```

### As an MCP server

**Claude Code**

```bash
claude mcp add fairbooks-suitescript-inventory -- npx -y fairbooks-suitescript-inventory@0.2.0 mcp --root /path/to/your/exports
```

**Cursor / Claude Desktop / VS Code / Windsurf**

```json
{ "mcpServers": { "fairbooks-suitescript-inventory": { "command": "npx", "args": ["-y", "fairbooks-suitescript-inventory@0.2.0", "mcp", "--root", "/path/to/your/exports"] } } }
```

`--root` is the only folder the tools can read or write. Paths outside it are refused.

## Tools

| Tool | Policy | What it does |
|---|---|---|
| `scripts_inventory` | **allow** | Scan a folder, rank by risk |
| `scripts_explain_file` | **allow** | Line-by-line 1.0 calls with 2.1 hints |
| `scripts_dependency_graph` | **allow** | Custom-module graph, cycles, unresolved paths, conversion order, Mermaid diagram |
| `scripts_progress` | **allow** | Compare an earlier `inventory.csv` with the folder now |
| `scripts_write_plan` | **allow** | Write `inventory.csv` (with effort and conversion order) + `conversion-test-plan.md` to `fairbooks-out/scripts` |
| `scripts_write_sarif` | **allow** | Write `scripts.sarif` to `fairbooks-out/scripts` |
| `scripts_deploy_conversion` | **block** | Listed so agents see the refusal. Deploys go through your own release process. |

Any other tool name is blocked. `fairbooks_info` shows the pinned model, mode, caps and every decision.

The MCP prompt `scripts_conversion_plan` walks a host model through the planning workflow and stops at the human deploy step.

### Effort weights (`estimate_config`)

```json
{ "name": "Team A calibration", "base_hours": { "1.0": 4, "2.0": 1.5 }, "per_distinct_api": 0.75, "redesign": 6 }
```

Keys you leave out keep the defaults (`1.0` 3 h, `2.0` 1 h, `2.x` 0.5 h, `unknown` 1 h; 0.5 h per distinct API, 0.1 h per call, 0.5 h per 100 lines, 4 h redesign, 1 h for record writes, 1 h for outbound calls, 0.5 h per unmapped API, 1 h for mixed versions, 0.25 h per custom dependency). Typos fail with a JSON pointer: `fairbooks-suitescript-inventory validate-config estimate_config weights.json`.

## Modes

- **Review** (`--mode review`): read and report only.
- **Assist** (default): the policy above. `ask` returns an `approval_id`; a person approves once with `fairbooks-suitescript-inventory approve <id> --as "Your Name"`.
- **Auto** (`--mode auto --auto <tool,...>`): off by default, opt-in per action, with step/spend caps (`--max-steps`, `--max-spend`) and a kill switch (`fairbooks-suitescript-inventory kill`).

All tools are read or report. Deploying is `production_deploy`, which is one-click by rule and **blocked** in this pack.

Go-live, revoking access, deleting personal data, moving money, legally binding sends and production deploys always need a person's click, in every Fairbooks pack.

## CLI

```bash
fairbooks-suitescript-inventory tools
fairbooks-suitescript-inventory call scripts_inventory '{"dir":"src/FileCabinet"}'
fairbooks-suitescript-inventory eval          # private evals on the bundled fixtures
```

Every call is written to `.fairbooks/audit.jsonl` (hash-chained JSONL; arguments stored as a hash). Read it with [`fairbooks-audit-evidence`](https://www.npmjs.com/package/fairbooks-audit-evidence) or `npx -y -p fairbooks-core fairbooks-verify-log .fairbooks/audit.jsonl`.

## What it is not

- Not a converter. It does not rewrite or deploy code, and it does not claim a better conversion than Oracle's own tooling.
- Detection uses a tokenizer, not a full JavaScript parser or type checker. Dynamic calls (`this['nlapi' + name]`), minified code and SuiteScript 1.0 library scripts attached on the script record (not in code) are not seen; `unknown` files need a manual look.
- Effort figures are rough planning estimates from fixed weights, not a quote.
- Module paths resolved through `@NAmdConfig` are not followed; they show up as unresolved.
- API hints are a starting point. Behaviour differences between 1.0 and 2.1 must be tested.
- Not fully autonomous: anything risky waits for a named person.

## Data

Everything runs locally on files you choose. No network calls, no telemetry. The bundled fixtures are fictional.

## License

MIT © 2026 Kurt Francisco. Source: <https://github.com/fpavia111-creator/fairbooks-agents/tree/main/packages/fairbooks-suitescript-inventory>
