// Local approvals page: lists pending approvals and lets a named person approve
// or reject them. Binds to 127.0.0.1 by default, strict CSP, no scripts, a
// per-start CSRF token, and Host/Origin checks against DNS rebinding.
// Optional: POST /callback accepts HMAC-signed decisions (MYTHOS_WEBHOOK_SECRET).

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ApprovalStore, verifyWebhook } from './approvals.js';
import { AuditLog } from './audit.js';
import { escapeHtml, htmlPage } from './formats.js';
import { join } from 'node:path';

const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function readBody(req, limit = 64 * 1024) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { rej(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}

const eq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

/**
 * Start the approvals server. Returns { server, url, token, close() }.
 * opts: { stateDir, host='127.0.0.1', port=0, ttlHours, secret=process.env.MYTHOS_WEBHOOK_SECRET, title }
 */
export function serveApprovals({ stateDir, host = '127.0.0.1', port = 0, ttlHours, secret = process.env.MYTHOS_WEBHOOK_SECRET, title = 'Mythos approvals' } = {}) {
  if (!stateDir) throw new Error('stateDir is required');
  const store = new ApprovalStore(stateDir, { ttlHours });
  const audit = new AuditLog(join(stateDir, 'audit.jsonl'));
  const token = randomBytes(18).toString('hex');
  let allowedHosts = new Set();

  const send = (res, code, body, type = 'text/html; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', 'x-frame-options': 'DENY' });
    res.end(body);
  };

  function page(msg = '') {
    const rows = store.pending();
    const body = [`<h1>${escapeHtml(title)}</h1>`, `<p class="mut">State folder: <code>${escapeHtml(stateDir)}</code>. Approvals are single-use and expire ${escapeHtml(String(store.ttlHours))} h after you approve.</p>`];
    if (msg) body.push(`<p><b>${escapeHtml(msg)}</b></p>`);
    if (!rows.length) body.push('<p>No pending approvals.</p>');
    for (const r of rows) {
      body.push(`<section style="border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:12px 0;background:var(--card)">
<div><b>${escapeHtml(r.tool)}</b> <span class="mut">· ${escapeHtml(r.agent || '')}${r.category ? ' · ' + escapeHtml(r.category) : ''}${r.one_click ? ' · <span class="warn">one-click</span>' : ''}</span></div>
<div class="mut">Requested ${escapeHtml(r.ts)} · id <code>${escapeHtml(r.id)}</code> · args sha256 <code>${escapeHtml(String(r.args_sha256 || '').slice(0, 16))}…</code></div>
<div>${escapeHtml(r.reason || '')}</div>
${r.details ? `<div><b>What you are approving</b></div><pre style="white-space:pre-wrap;font-size:13px">${escapeHtml(JSON.stringify(r.details, null, 2))}</pre>` : ''}
<pre style="white-space:pre-wrap;font-size:13px">${escapeHtml(JSON.stringify(r.args_preview || {}, null, 2))}</pre>
<form method="post" action="/decide" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
<input type="hidden" name="csrf" value="${token}"><input type="hidden" name="id" value="${escapeHtml(r.id)}">
<label>Your name <input name="name" required minlength="2" maxlength="80"></label>
<label>Note <input name="note" maxlength="200"></label>
<button name="decision" value="approve">Approve once</button><button name="decision" value="reject">Reject</button>
</form></section>`);
    }
    return htmlPage({ title, bodyHtml: body.join('\n'), footer: 'Local page. No scripts, no trackers, nothing leaves this machine.' });
  }

  const server = createServer(async (req, res) => {
    try {
      const hostHdr = String(req.headers.host || '');
      if (!allowedHosts.has(hostHdr)) return send(res, 421, 'Misdirected request (unexpected Host header)', 'text/plain');
      const url = new URL(req.url, `http://${hostHdr}`);
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page());
      if (req.method === 'GET' && url.pathname === '/pending.json') return send(res, 200, JSON.stringify(store.pending().map(({ args_preview, details, ...r }) => r)), 'application/json');
      if (req.method === 'POST' && url.pathname === '/decide') {
        const origin = req.headers.origin;
        if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return send(res, 403, 'Cross-origin request refused', 'text/plain');
        const f = new URLSearchParams(await readBody(req));
        if (!eq(f.get('csrf') || '', token)) return send(res, 403, 'Bad or missing form token. Reload the page.', 'text/plain');
        const id = f.get('id'); const name = f.get('name'); const note = f.get('note') || '';
        let msg;
        try {
          if (f.get('decision') === 'approve') { const r = store.approve(id, name, note, 'local-page'); msg = `Approved ${r.id} as ${r.approved_by}. The agent can now repeat the same call once.`; }
          else if (f.get('decision') === 'reject') { const r = store.reject(id, name, note, 'local-page'); msg = `Rejected ${r.id} as ${r.rejected_by}.`; }
          else msg = 'Unknown decision.';
          audit.write({ type: 'approval-decision', via: 'local-page', approval_id: id, decision: f.get('decision'), by: String(name || '').trim() });
        } catch (e) { msg = e.message; }
        return send(res, 200, page(msg));
      }
      if (req.method === 'POST' && url.pathname === '/callback') {
        const body = await readBody(req);
        const v = verifyWebhook(body, req.headers['x-mythos-signature'], secret);
        if (!v.ok) {
          audit.write({ type: 'webhook-rejected', via: 'callback', reason: v.reason });
          return send(res, 401, JSON.stringify({ ok: false, reason: v.reason }), 'application/json');
        }
        const p = v.payload;
        try {
          const r = p.decision === 'approve' ? store.approve(p.id, p.by, p.note || '', 'webhook') : store.reject(p.id, p.by, p.note || '', 'webhook');
          audit.write({ type: 'approval-decision', via: 'webhook', approval_id: p.id, decision: p.decision, by: String(p.by).trim() });
          return send(res, 200, JSON.stringify({ ok: true, id: r.id }), 'application/json');
        } catch (e) {
          audit.write({ type: 'webhook-rejected', via: 'callback', reason: e.message, approval_id: p.id });
          return send(res, 409, JSON.stringify({ ok: false, reason: e.message }), 'application/json');
        }
      }
      return send(res, 404, 'Not found', 'text/plain');
    } catch (e) {
      return send(res, 400, 'Bad request', 'text/plain');
    }
  });

  return new Promise((resolveP, rejectP) => {
    server.once('error', rejectP);
    server.listen(port, host, () => {
      const p = server.address().port;
      allowedHosts = new Set([`${host}:${p}`, `localhost:${p}`, `127.0.0.1:${p}`]);
      resolveP({ server, url: `http://${host}:${p}/`, token, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
