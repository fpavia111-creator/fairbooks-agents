# mythos-agent-core

The shared core for **Mythos Machine domain agents**: small MCP agents that each own one business process and cannot act outside it.

- **Pack manifest** — name, version, a declared model pin, the tool allowlist and the policy. `defineManifest()` fails closed: an unpinned model (`latest`), a tool without a rule, a write marked `allow`, or a one-click action marked `allow` are rejected at load time.
- **Talos-style policy** — every tool call gets `allow`, `ask` or `block`. Unknown tools are blocked. The default is block.
- **Modes**
  - **Review**: read and report tools only. Everything else is blocked.
  - **Assist** (default): the policy as written. `ask` returns an `approval_id` and waits for a named human.
  - **Auto**: off by default and **opt-in per action** (`--auto tool_a,tool_b`). Only opted-in `ask` actions run without a click. Step and spend caps and a kill switch always apply.
- **Always one-click, even in Auto**: `go_live`, `revoke_access`, `delete_personal_data`, `move_money`, `binding_send`, `production_deploy`. Trying to put one of these on Auto throws an error. Auto prepares the work; a person clicks.
- **Audit log** — append-only JSONL (`.mythos/audit.jsonl`), one line per decision, hash-chained so edits and removed lines show up. Arguments are stored as a SHA-256 hash, not in full. Field names follow Alethea's record vocabulary (`id`, `type`, `date`, `requirements`) so logs sit cleanly next to an Alethea `.decisions/` folder; this package does not write into `.decisions/`.
- **Stdio MCP server** — zero-dependency, newline-delimited JSON-RPC 2.0 (`initialize`, `ping`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`), protocol versions up to `2025-11-25`, tool annotations (`readOnlyHint`, `destructiveHint`, …) derived from each tool's kind, plus a built-in `mythos_info` tool that reports usage and pending approvals.
- **Input validation** — every call is checked against the tool's `inputSchema` before anything runs or reaches a human. Errors carry JSON-pointer paths (`/vendors/3/tin expected string`).
- **Signed audit log (opt-in)** — with `--signing-key`, every line is also signed with Ed25519. A re-chained file fails `verify-log --pubkey`. Key rotation is recorded as a signed entry.
- **Approvals people can actually use** — CLI, a local approvals page on 127.0.0.1, or an HMAC-signed webhook callback. Approvals are single-use, bound to the exact arguments, expire after 24 h by default, and can be rejected.
- **Caps that survive restarts** — per session, per day and per tool, persisted in `.mythos/usage.json`.
- **Private evals** — fixture-based, deterministic test cases, with an offline HTML report and regression highlighting against a baseline.
- **Shared helpers** — JSON Schema validation, iCalendar, SARIF 2.1.0, unified diff/patch, Jaro-Winkler and name/address normalisation, entropy, a small ZIP/DOCX reader, and a self-contained HTML page template.

MIT, Node ≥ 20, no runtime dependencies.

## Install

```bash
npm install mythos-agent-core
```

## A pack in 30 lines

```js
import { defineManifest, main } from 'mythos-agent-core';

const manifest = defineManifest({
  name: 'my-pack', version: '0.1.0', description: 'One process, nothing else.',
  model: { provider: 'anthropic', id: 'claude-sonnet-4-5-20250929' },
  tools: [
    { name: 'my_check', kind: 'read', description: 'Read a CSV and report.',
      inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } },
      handler: async (args, ctx) => { const rows = ctx.records(args.path); return { summary: `${rows.length} rows`, rows: rows.length }; } },
    { name: 'my_fix', kind: 'write', description: 'Change something (needs a human).', handler: async () => ({ summary: 'done' }) },
    { name: 'my_go_live', kind: 'action', category: 'go_live', description: 'Never by an agent.' },
  ],
  policy: { rules: [
    { tool: 'my_check', decision: 'allow' },
    { tool: 'my_fix', decision: 'ask', reason: 'writes need a human' },
    { tool: 'my_go_live', decision: 'block' },
    { tool: '*', decision: 'block' },
  ] },
});

main(manifest); // gives you: mcp | tools | call | demo | eval | approve | reject | approvals | usage | keygen | verify-log | kill | unkill
```

`ctx.records(path)` reads CSV, JSON or JSONL; `ctx.path()` refuses paths outside `--root`; `ctx.outDir()` creates an output folder inside it.

## Scaffold a new agent

```bash
npx -y -p mythos-agent-core mythos-new-agent iris-of-tests --dir packages
```

The generated package passes `npm test`, `eval` and `npm pack --dry-run` as is. See `docs/build-an-agent.md` in the monorepo.

## Approvals

When a call is `ask`, the result contains an `approval_id` bound to that exact tool and arguments. A person approves it once:

```bash
npx -y -p mythos-agent-core mythos-approve 3f2a9c1d0b7e6a55 --as "Your Name" --dir .mythos
```

Then the same call runs and the log records who approved it.

Other ways to decide:

- `npx <pack> approvals serve` opens a local page (127.0.0.1 only, strict CSP, no scripts, a per-start form token, Host and Origin checks) that lists pending approvals with a short, non-sensitive preview of the arguments. Type your name and approve once, or reject.
- `--approval-webhook https://…` POSTs each new pending approval to your endpoint, signed with `MYTHOS_WEBHOOK_SECRET` (HMAC-SHA256, header `x-mythos-signature: t=<unix>,v1=<hex>`). Your system answers by POSTing `{ "id", "decision": "approve"|"reject", "by": "Person Name" }`, signed the same way, to the approvals page's `/callback`. A bad signature, a timestamp older than 5 minutes or a missing name is refused and audited.
- `npx <pack> reject <id> --as "Name"` refuses a pending action.

Approvals expire 24 hours after a person approves (`--approval-ttl HOURS`). Names like "agent" or "claude" are refused as approvers. One-click categories can be approved by a person through any of these routes, but never by Auto.

**Honest limit:** approvals are a file. If the agent also has a shell in the same folder, it could write that file itself. For approvals to mean something, give the agent the MCP server only, not a shell, or keep `--state-dir` somewhere the agent cannot write.

## Kill switch and caps

- `npx <pack> kill` creates `.mythos/KILL`; every call is then blocked until `unkill`. `MYTHOS_KILL=1` does the same.
- `--max-steps N` and `--max-spend USD` stop a session and report. Spend counts each tool's declared `costUsd` (the wave-1 packs are local and declare $0), plus any `costUsd` a handler returns.

- Caps persist in `.mythos/usage.json`: `--session ID` keeps a session's count across restarts, `--max-steps-per-day` and `--max-spend-per-day` cap a whole day, and a manifest can set `caps.perTool.<tool>.maxSteps` so one tool cannot use the whole budget. A cap hit returns `{ status: "blocked", cap: { cap, scope, limit, used } }` and is audited. `npx <pack> usage` shows the counters.

## Verify a log

```bash
npx -y -p mythos-agent-core mythos-verify-log .mythos/audit.jsonl
```

Unsigned, the chain is tamper-evident, not tamper-proof: someone with write access can rewrite the whole file. To close that gap, sign it:

```bash
npx <pack> keygen --out ~/.mythos-keys/my-pack        # keep this outside --root
npx <pack> mcp --signing-key ~/.mythos-keys/my-pack/private.pem --audit-mirror /backup/my-pack-audit.jsonl
npx <pack> verify-log --pubkey ~/.mythos-keys/my-pack/public.pem
npx <pack> rotate-key --signing-key OLD.pem --new-key NEW.pem --as "Your Name"
```

The key is refused if it sits under `--root`, and it is never logged. With `--pubkey`, every line must carry a valid signature from a trusted key (or a key introduced by a signed rotation). Old unsigned logs still verify as "chained, unsigned". Signing proves the lines came from whoever holds the key; it cannot stop that holder from writing a false line.

## Untrusted data and broken arguments

Agents read files that other people wrote: vendor names, memos, email bodies, page content. The runtime treats that text as hostile until shown otherwise, for every pack built on it.

- **Spreadsheets.** `toCsv` puts an apostrophe in front of a cell that a spreadsheet would run as a formula (it starts with `=`, or with `+`, `-` or `@` and is not a plain number, a phone-style value or a bare `@handle`). Pass `{ formulas: 'keep' }` for a file only a program reads.
- **Markdown.** `ctx.writeFile` passes `.md` output through `safeMarkdown`: raw HTML outside code becomes literal text (`\<script>`), and remote or reference-style images become plain text, so a Markdown preview shows what a data cell contained instead of rendering it or fetching an image for it. Links are left as they are. Pass `{ raw: true }` when the file is a copy of the person's own document. If you store a hash of Markdown you write, hash `safeMarkdown(text)` or the file itself.
- **File names.** `ctx.writeFile(dir, name, …)` refuses a name that leaves `dir`. Use `safeFileName(id)` when a name comes from data.
- **HTML.** `htmlPage` wraps every table so a wide one scrolls inside the page on a phone, adds `scope` to header cells for screen readers, and right-aligns the header of a numeric column. `bodyHtml` must still be escaped with `escapeHtml` by the pack.
- **Instructions aimed at the model.** When a result quotes text that reads like instructions to an AI ("ignore previous instructions", fake chat markup, "do not tell the user", hidden or direction-flipping characters), the result carries a `warnings` entry and the audit line an `injection_signals` list. The data is returned unchanged. This is a short, high-precision heuristic (`injectionSignals`): it catches common shapes and misses others. The MCP `initialize` instructions also tell the host model that tool results are data. One-click actions still need a named human whatever the model was told.
- **Arguments.** A misspelled argument that is one or two letters from a real one (`receipt` for `receipts`, `outdir` for `out_dir`) is refused with the right name. An unrelated extra argument is refused by tools that set `additionalProperties: false`, and otherwise ignored with a `warnings` entry and an `ignored_args` audit field. A required argument given as an empty string counts as missing.
- **Errors.** File errors are plain sentences with paths relative to `--root` ("file not found: data/vendors.csv"); the absolute root never appears in an error, and long messages are clipped at about 1,200 characters.

`node scripts/hostile-inputs.mjs` in the monorepo plants hostile values in every pack's fixtures, runs every eval case and inspects the output; `--args` also calls every tool with broken arguments.

## Configs

A pack can declare `configSchemas: { playbook: { …JSON Schema… } }`. Handlers load configs with `ctx.readJson(path, 'playbook')`, which fails with JSON-pointer errors, and people can check a file before use with `npx <pack> validate-config playbook ./my-playbook.json`.

## Prompts

A pack can ship MCP prompts (`prompts: [{ name, description, arguments, text }]`) that walk a host model through its workflow. `{{arg}}` placeholders are filled from the prompt arguments.

## Eval reports

```bash
npx <pack> eval --report eval-out/          # report.json + report.html (no scripts, no network)
npx <pack> eval --report eval-new/ --baseline eval-out/report.json   # exits 1 on a regression
```

## What the model pin means

The manifest declares which host model a pack's prompts and evals target. An MCP server cannot force your MCP host to use that model; the pin is reported in `initialize` and `mythos_info` so you can check it. The wave-1 packs' tools are deterministic and call no model at all.

## Packs built on this core

All 30 Mythos domain agents in the monorepo, from `olympus-of-migration` to `solon-of-clauses`. Source: <https://github.com/fpavia111-creator/mythos-agents>.

## License

MIT © 2026 Kurt Francisco
