// Taint-style data-flow checks, one file at a time. Deliberately small and explainable:
// it tracks named variables through simple assignments and reports a source -> ... -> sink
// path with line numbers. It does not follow calls across functions or files, so it can
// miss flows (false negatives) and flag guarded ones (false positives). Findings are places
// to read, not proof.

const SOURCES = {
  env: /\bprocess\.env\b|\bos\.environ\b|\bos\.getenv\s*\(|\bDeno\.env\.get\s*\(|\bBun\.env\b/,
  secretfile: /\b(readFileSync|readFile|open)\s*\([^)]*(\.ssh|id_rsa|id_ed25519|\.aws|\.npmrc|\.netrc|\.kube|\.docker|credentials|\.pem)/,
  token: /\b(req|request|ctx\.request|extra\.request|httpReq)\.headers\s*(\.authorization\b|\[\s*['"]authorization['"]\s*\]|\.get\(\s*['"]authorization['"]\s*\))|\bextra\.authInfo\.token\b|request\.headers\.get\(\s*['"]Authorization['"]/i,
  input: /\b(args|input|params|arguments|toolArgs|tool_input|req\.body|req\.query|request\.params\.arguments|request\.json\(\)|request\.args)\s*(\.|\[)/,
};

const SINKS = {
  exec: /\b(execSync|exec|spawnSync|spawn|execFile|execFileSync|execa|execaSync)\s*\(|\bsubprocess\.\w+\s*\(|\bos\.(system|popen)\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.runIn\w*\s*\(|\bBun\.spawn\w*\s*\(/,
  net: /\bfetch\s*\(|\baxios(\.\w+)?\s*\(|\bhttps?\.(request|get)\s*\(|\brequests\.\w+\s*\(|\bhttpx\.\w+\s*\(|\burllib\.request\.urlopen\s*\(|\bgot(\.\w+)?\s*\(|\bnew\s+WebSocket\s*\(|\bundici\.request\s*\(/,
  path: /\b(readFileSync|readFile|writeFileSync|writeFile|appendFileSync|appendFile|createReadStream|createWriteStream|rmSync|unlinkSync|unlink|rm|readdirSync)\s*\(|(?<![\w.])open\s*\(|\bshutil\.(rmtree|copy\w*|move)\s*\(|\bPath\s*\(/,
};

const SOURCE_LABEL = { input: 'tool input', token: 'incoming Authorization header', secretfile: 'credential file', env: 'environment' };

// [source class, sink] -> rule
const FLOWS = [
  { cls: ['env', 'secretfile'], sink: 'net', id: 'NEM-FLOW-ENV-TO-NET' },
  { cls: ['token'], sink: 'net', id: 'NEM-TOKEN-PASSTHROUGH' },
  { cls: ['input'], sink: 'exec', id: 'NEM-FLOW-INPUT-TO-EXEC' },
  { cls: ['input'], sink: 'net', id: 'NEM-FLOW-INPUT-TO-NET' },
  { cls: ['input'], sink: 'path', id: 'NEM-FLOW-INPUT-TO-PATH' },
];

// Calls treated as sanitizers: their arguments are removed before looking for tainted names.
const SANITIZER = /\b(inside|safePath|safe_path|resolveInside|resolveInRoot|within\w*|sanitiz\w*|validat\w*|assert\w*|guard\w*|check\w*|isAllowed\w*|allowed\w*|shellQuote|shlex\.quote|encodeURIComponent|path\.basename|basename|parseInt|Number|Boolean)\s*\(/g;

function stripCalls(s, re) {
  let out = s; let m; let guard = 0;
  re.lastIndex = 0;
  while ((m = re.exec(out)) && guard++ < 50) {
    let i = m.index + m[0].length; let depth = 1;
    while (i < out.length && depth) { if (out[i] === '(') depth++; else if (out[i] === ')') depth--; i++; }
    out = out.slice(0, m.index) + 'SANITIZED' + out.slice(i);
    re.lastIndex = m.index + 9;
  }
  return out;
}

const isComment = (l) => /^\s*(\/\/|#|\*|\/\*)/.test(l);

/** Join lines from i until parentheses/brackets balance (max 12 lines). */
function statement(lines, i) {
  let text = ''; let depth = 0; let j = i;
  for (; j < lines.length && j < i + 12; j++) {
    const l = lines[j].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    text += (j > i ? '\n' : '') + lines[j];
    for (const ch of l) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; }
    if (depth <= 0) break;
  }
  return { text, end: j };
}

const identRe = (name) => new RegExp(`(?<![\\w$.])${name.replace(/[$]/g, '\\$')}(?![\\w$])`);

/**
 * Scan one file's text. Returns [{ id, line, flow: [{ line, code, label }] }].
 * snippet(line) masks secrets in code excerpts.
 */
export function scanFlows(text, { snippet = (s) => s.trim().slice(0, 160) } = {}) {
  const lines = text.split(/\r?\n/);
  const taint = new Map(); // name -> { cls:Set, chain:[] }
  const out = []; const seen = new Set();
  // Variables checked against an allowlist anywhere in the file count as sanitized for exec.
  const allowGuarded = new Set();
  for (const m of text.matchAll(/\b\w*(allow|permit|whitelist)\w*\s*\.\s*(includes|has)\s*\(\s*([\w$.]+)\s*\)/gi)) allowGuarded.add(m[3]);
  for (const m of text.matchAll(/\b([\w.]+)\s+(?:not\s+)?in\s+\w*(ALLOW|allow|PERMIT|permit)\w*/g)) allowGuarded.add(m[1]);

  const classesIn = (s) => {
    const cls = new Map(); // cls -> chain
    for (const [c, re] of Object.entries(SOURCES)) if (re.test(s)) cls.set(c, []);
    for (const [name, t] of taint) if (identRe(name).test(s)) for (const c of t.cls) if (!cls.has(c) || cls.get(c).length > t.chain.length) cls.set(c, t.chain);
    return cls;
  };
  let pendingPyParams = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line) || !line.trim()) continue;
    // Python MCP tool functions: parameters of a function decorated with @x.tool are input.
    if (/^\s*@\w+(\.\w+)*\.tool\b/.test(line)) { pendingPyParams = true; continue; }
    const def = /^\s*(?:async\s+)?def\s+\w+\s*\(([^)]*)\)/.exec(line);
    if (def && pendingPyParams) {
      for (const p of def[1].split(',')) { const n = p.trim().split(/[:=\s]/)[0]; if (n && n !== 'self' && n !== 'ctx') taint.set(n, { cls: new Set(['input']), chain: [{ line: i + 1, code: snippet(line), label: `tool parameter ${n}` }] }); }
      pendingPyParams = false; continue;
    }
    // JS handlers with destructured arguments: async ({ path, cmd }) => ...
    for (const m of line.matchAll(/\(\s*\{([^}]*)\}\s*(?::\s*[\w<>{}\[\]|, ]+)?\)\s*=>/g)) {
      for (const p of m[1].split(',')) { const n = p.trim().split(/[:=\s]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(n)) taint.set(n, { cls: new Set(['input']), chain: [{ line: i + 1, code: snippet(line), label: `tool argument ${n}` }] }); }
    }

    // Sinks
    for (const [sink, re] of Object.entries(SINKS)) {
      if (!re.test(line)) continue;
      const st = statement(lines, i);
      let s = stripCalls(st.text, new RegExp(SANITIZER.source, 'g')).replace(/\(\s*\{[^}]*\}\s*(?::\s*[\w<>{}\[\]|, ]+)?\)\s*=>/g, '() =>');
      if (sink === 'path' && /\bjoin\s*\(\s*(ROOT|root|base|BASE|this\.root|rootDir)\b/.test(s) && /startsWith\(\s*['"]\.\.['"]|relative\(/.test(text)) continue;
      const cls = classesIn(s);
      for (const f of FLOWS) {
        if (f.sink !== sink) continue;
        const hit = f.cls.find((c) => cls.has(c));
        if (!hit) continue;
        if (sink === 'exec' && [...allowGuarded].some((g) => identRe(g).test(s))) continue;
        const key = `${f.id}|${i}`; if (seen.has(key)) continue; seen.add(key);
        const chain = cls.get(hit);
        const sinkName = (line.match(re) || [''])[0].replace(/\s*\($/, '');
        const flow = [...chain, { line: i + 1, code: snippet(line), label: `sink: ${sinkName}` }];
        if (!chain.length) flow.unshift({ line: i + 1, code: snippet(line), label: `source: ${SOURCE_LABEL[hit]}` });
        out.push({ id: f.id, line: i + 1, flow });
      }
    }

    // Assignments (const/let/var/plain, Python), including object destructuring.
    const st = statement(lines, i);
    const a = /^\s*(?:export\s+)?(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>\[\]|. ]+)?\s*=(?![=>])\s*([\s\S]+)$/.exec(st.text);
    const d = /^\s*(?:const|let|var)\s*\{([^}]+)\}\s*=\s*([\s\S]+)$/.exec(st.text);
    const targets = a ? [a[1]] : d ? d[1].split(',').map((p) => p.trim().split(/[:=\s]/).pop()).filter(Boolean) : [];
    const rhs = a ? a[2] : d ? d[2] : null;
    if (rhs !== null) {
      const cleaned = stripCalls(rhs, new RegExp(SANITIZER.source, 'g'));
      const cls = classesIn(cleaned);
      for (const name of targets) {
        if (!cls.size) { taint.delete(name); continue; }
        const longest = [...cls.values()].reduce((x, y) => (y.length > x.length ? y : x), []);
        const chain = longest.length
          ? [...longest, { line: i + 1, code: snippet(line), label: `${name} = ...` }]
          : [{ line: i + 1, code: snippet(line), label: `${name} = ${[...cls.keys()].map((c) => SOURCE_LABEL[c]).join(' + ')}` }];
        taint.set(name, { cls: new Set(cls.keys()), chain });
      }
    }
  }
  return out;
}

export const FLOW_RULE_IDS = FLOWS.map((f) => f.id);
