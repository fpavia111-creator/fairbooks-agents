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
