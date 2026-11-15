# Build a Mythos agent

A Mythos agent owns one business process, runs on the buyer's machine, reads exports under `--root`, and cannot act outside its lane. This guide goes from nothing to a published package.

## 1. Scaffold

```bash
npx -y -p mythos-agent-core mythos-new-agent iris-of-tests --dir packages
```

Add `packages/iris-of-tests` to the root `workspaces`, run `npm install`, then `cd packages/iris-of-tests && npm test`. The scaffold passes `npm test`, `eval` and `npm pack --dry-run` as generated.

Check the name is free first: `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/iris-of-tests` must print `404`.

## 2. Write the manifest

`src/manifest.js` is the whole contract:

- `tools`: each has `name`, `kind` (`read`, `report`, `write`, `action`), `description`, an accurate `inputSchema` (the runtime validates every call against it), an optional `title`, and a `handler(args, ctx)`.
- `policy.rules`: one rule per tool (`allow`, `ask`, `block`), ending with `{ tool: '*', decision: 'block' }`. Writes and actions can never be `allow`.
- One-click categories (`go_live`, `revoke_access`, `delete_personal_data`, `move_money`, `binding_send`, `production_deploy`) are `ask` (a named person approves) or `block`. They can never go on Auto.
- List refused tools (`send_email`, `erp_post_invoice`, …) as `block` so a host model sees they exist and are refused.
- `prompts`: an MCP prompt that walks a host model through the workflow.
- `configSchemas`: a JSON Schema per config file; load configs with `ctx.readJson(path, 'name')`.

Keep domain logic pure in `src/<domain>.js` and do all file access through `ctx` (`records`, `readText`, `readJson`, `outDir`, `writeFile`), which refuses paths outside `--root`, including through symlinks.

## 3. The draft → request → one click pattern

1. A `write` tool drafts files into `mythos-out/<agent>/` and returns their sha256.
2. An `action` tool in a one-click category re-hashes the draft, refuses if it changed or still holds `[TO CONFIRM]` markers, then returns `needs_approval`.
3. A person approves (CLI, `approvals serve` page, or a signed webhook) and the same call runs once.

## 4. Fixtures, tests, evals

- Fixtures are fictional: `example.com`, `.test`, `555` numbers, invalid TINs, made-up names.
- `test/*.test.js` with `node:test`. Approvals are single-use and bound to arguments, so use different args in each approval test.
- `evals/cases.json`: tool-level cases with `expect.status`, `contains`, `equals`, `matches`, `min`, `max`, `length`. Run `node bin/<agent>.js eval --report eval-out/` for an offline HTML report; add `--baseline` to fail on regressions.

## 5. Connect a host

```jsonc
// Claude Code: .mcp.json in your project
{ "mcpServers": { "iris": { "command": "npx", "args": ["-y", "iris-of-tests", "mcp", "--root", "."] } } }
```

```jsonc
// Claude Desktop: claude_desktop_config.json
{ "mcpServers": { "iris": { "command": "npx", "args": ["-y", "iris-of-tests", "mcp", "--root", "/path/to/exports"] } } }
```

```jsonc
// Cursor: .cursor/mcp.json   |   VS Code: .vscode/mcp.json uses "servers" instead of "mcpServers"
{ "mcpServers": { "iris": { "command": "npx", "args": ["-y", "iris-of-tests", "mcp", "--root", "."] } } }
```

Give the host the MCP server only, not a shell in the same folder, so approvals mean something. For stronger evidence, start the server with `--signing-key` (a key kept outside `--root`) and keep an `--audit-mirror`.

## 6. Release checklist

1. Name free on npm. 2. `npm test` on Node 20, 22, 24 (the CI matrix does this). 3. `eval` passes. 4. `npm pack --dry-run` shows no `node_modules`, `.mythos`, `mythos-out`, `.npmrc` or `.tgz`. 5. Secret scan. 6. Publish from CI with `npm publish --provenance`.
