import { toCsv, htmlPage, escapeHtml, sha256, canonical } from 'mythos-agent-core';

const n = (s) => String(s ?? '').trim();
const low = (s) => n(s).toLowerCase();
const DEFAULT_PRIV = /\b(admin|administrator|full ?access|owner|super ?user|root|superadmin|global admin|finance approver|payments?|treasury|security admin)\b/i;
const SHARED = /^(admin|administrator|shared|generic|test|temp|service|info|accounts?|ops)[@._-]/i;

function colKey(row, names) {
  const keys = Object.keys(row);
  for (const want of names) { const k = keys.find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '') === want); if (k) return k; }
  return null;
}
function col(row, names) { const k = colKey(row, names); return k ? row[k] : ''; }
const ROTATION_COLS = ['lastrotated', 'credentialrotated', 'keyrotated', 'rotatedat', 'lastrotation', 'secretrotated', 'credentiallastrotated'];

export function normalizeAccess(rows) {
  return rows.map((r, i) => ({
    row: i + 2,
    system: n(col(r, ['system', 'app', 'application', 'tool'])),
    user: n(col(r, ['user', 'username', 'name', 'account', 'login'])),
    email: low(col(r, ['email', 'mail', 'useremail'])),
    account_type: low(col(r, ['accounttype', 'type', 'kind'])) || 'human',
    role: n(col(r, ['role', 'roles', 'permission', 'permissions', 'group', 'access'])),
    owner: n(col(r, ['owner', 'manager', 'accountowner', 'sponsor'])),
    last_login: n(col(r, ['lastlogin', 'lastlogon', 'lastused', 'lastactive', 'lastseen'])),
    status: low(col(r, ['status', 'state'])) || 'active',
    mfa: low(col(r, ['mfa', '2fa', 'mfaenabled', 'twofactor'])),
    // null when the export has no rotation column at all (rotation then cannot be checked).
    last_rotated: colKey(r, ROTATION_COLS) ? n(col(r, ROTATION_COLS)) : null,
  }));
}

export function normalizeRoster(rows) {
  const m = new Map();
  for (const r of rows) {
    const email = low(col(r, ['email', 'mail', 'workemail']));
    if (email) m.set(email, { status: low(col(r, ['status', 'employmentstatus', 'state'])) || 'active', termination_date: n(col(r, ['terminationdate', 'enddate', 'leftdate'])), manager: n(col(r, ['manager'])) });
  }
  return m;
}

function days(from, to) {
  const a = Date.parse(from), b = Date.parse(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86400000) : null;
}
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const roleRe = (list) => new RegExp(`\\b(${list.map(reEsc).join('|')})\\b`, 'i');
const NON_HUMAN = ['agent', 'service', 'bot'];
export const isNonHuman = (r) => NON_HUMAN.includes(r.account_type);
export function addDays(isoDate, d) { const t = Date.parse(isoDate + 'T00:00:00Z'); return Number.isFinite(t) ? new Date(t + d * 86400000).toISOString().slice(0, 10) : ''; }

/** Merge a policy file (already schema-checked) with call arguments. Arguments win. */
export function effectiveOptions(policy = {}, args = {}) {
  const o = { ...policy };
  for (const k of ['as_of', 'stale_days', 'privileged_roles', 'due_days', 'rotation_max_days']) if (args[k] !== undefined) o[k] = args[k];
  return o;
}

/**
 * Segregation-of-duties check: one person (by email, else user name) holding a role
 * matching roles_a and a role matching roles_b, in any systems.
 */
export function sodConflicts(rows, rules = []) {
  const out = [];
  if (!rules.length) return out;
  const byPerson = new Map();
  for (const r of rows) { const k = r.email || low(r.user); if (!k) continue; if (!byPerson.has(k)) byPerson.set(k, []); byPerson.get(k).push(r); }
  for (const rule of rules) {
    const A = roleRe(rule.roles_a), B = roleRe(rule.roles_b);
    for (const [person, list] of byPerson) {
      const a = list.filter((r) => A.test(r.role)), b = list.filter((r) => B.test(r.role));
      if (!a.length || !b.length) continue;
      if (a.length === 1 && b.length === 1 && a[0] === b[0] && !rule.same_role_counts) continue;
      out.push({ rule: rule.name, person, rows: [...new Set([...a, ...b].map((r) => r.row))].sort((x, y) => x - y), detail: `${a.map((r) => `${r.system}: ${r.role}`).join(', ')} + ${b.map((r) => `${r.system}: ${r.role}`).join(', ')}` });
    }
  }
  return out;
}

/** Flag access rows for a human reviewer. Suggestions only; nothing is revoked here. */
export function reviewAccess(rows, roster, opts = {}) {
  const asOf = opts.as_of || new Date().toISOString().slice(0, 10);
  const stale = Number(opts.stale_days ?? 90);
  const rotationMax = Number(opts.rotation_max_days ?? 90);
  const dueDays = Number(opts.due_days ?? 14);
  const priv = opts.privileged_roles && opts.privileged_roles.length ? roleRe(opts.privileged_roles) : DEFAULT_PRIV;
  const rotationKnown = rows.some((r) => r.last_rotated !== null && r.last_rotated !== undefined);
  const delegations = (opts.delegations || []).map((d) => ({ from: low(d.from), to: n(d.to), reason: n(d.reason) }));
  const active = rows.filter((r) => r.status !== 'disabled' && r.status !== 'inactive' && r.status !== 'deleted');
  const sod = sodConflicts(active, opts.sod_rules || []);
  const sodByRow = new Map();
  for (const c of sod) for (const row of c.rows) { if (!sodByRow.has(row)) sodByRow.set(row, []); sodByRow.get(row).push(c.rule); }
  const seen = new Map();
  const items = active.map((r) => {
    const flags = []; let score = 0;
    const isPriv = priv.test(r.role);
    const nonHuman = isNonHuman(r);
    const hr = !nonHuman && roster && r.email ? roster.get(r.email) : null;
    if (isPriv) { flags.push('privileged_role'); score += 20; }
    if (!nonHuman && roster) {
      if (!hr) { flags.push('not_in_hr_roster'); score += 30; }
      else if (/terminat|left|inactive|leaver/.test(hr.status)) { flags.push('terminated_in_hr'); score += 60; }
    }
    if (nonHuman && !r.owner) { flags.push('non_human_without_owner'); score += 40; }
    if (nonHuman && rotationKnown) {
      if (!r.last_rotated || /^never$/i.test(r.last_rotated)) { flags.push('non_human_without_rotation_date'); score += 20; }
      else { const d = days(r.last_rotated, asOf); if (d === null) { flags.push('rotation_date_unreadable'); score += 10; } else if (d > rotationMax) { flags.push(`credential_not_rotated_${d}_days`); score += 20; } }
    }
    if (!r.last_login || /^never$/i.test(r.last_login)) { flags.push('never_logged_in'); score += 15; }
    else { const d = days(r.last_login, asOf); if (d === null) { flags.push('last_login_unreadable'); score += 5; } else if (d > stale) { flags.push(`stale_${d}_days`); score += 20; } }
    if (isPriv && r.mfa && /^(no|false|0|off|disabled)$/.test(r.mfa)) { flags.push('privileged_without_mfa'); score += 30; }
    if (SHARED.test(r.email || r.user)) { flags.push('shared_or_generic_account'); score += 15; }
    for (const rule of sodByRow.get(r.row) || []) { flags.push(`sod_conflict:${rule}`); score += 30; }
    const key = `${low(r.system)}|${r.email || low(r.user)}`;
    if (seen.has(key)) { flags.push(`duplicate_of_row_${seen.get(key)}`); score += 10; } else seen.set(key, r.row);
    const risk = score >= 60 ? 'high' : score >= 30 ? 'medium' : score > 0 ? 'low' : 'none';
    const suggested = flags.some((f) => f === 'terminated_in_hr') ? 'revoke candidate' : risk === 'high' || risk === 'medium' ? 'review closely' : 'confirm or keep';
    // Reviewer: the account owner, else the person's manager from the HR roster.
    const assigned = r.owner || (hr && hr.manager) || '';
    const del = assigned ? delegations.find((d) => d.from === low(assigned)) : null;
    // High-risk lines are due in half the time.
    const due = addDays(asOf, risk === 'high' ? Math.max(1, Math.ceil(dueDays / 2)) : dueDays);
    const reasons = flags.map(explainFlag);
    return { ...r, risk, score: Math.min(100, score), flags, reasons, suggested_action: suggested, assigned_reviewer: assigned, delegated_to: del ? del.to : '', delegation_reason: del ? del.reason : '', due_date: due };
  });
  items.sort((a, b) => b.score - a.score || a.system.localeCompare(b.system) || a.row - b.row);
  const count = (k) => items.filter((i) => i.risk === k).length;
  return {
    as_of: asOf, stale_days: stale, due_days: dueDays, accounts: items.length, skipped_disabled: rows.length - items.length,
    by_risk: { high: count('high'), medium: count('medium'), low: count('low'), none: count('none') },
    agents_and_services: items.filter(isNonHuman).length,
    rotation_checked: rotationKnown, rotation_max_days: rotationMax,
    sod_conflicts: sod, unassigned_reviewer: items.filter((i) => !i.assigned_reviewer && !i.delegated_to).length,
    roster_checked: !!roster, items,
    note: 'Suggestions only. A named reviewer decides keep / modify / revoke for every line.' + (rotationKnown ? '' : ' No credential-rotation column in the export, so rotation was not checked.'),
  };
}

const FLAG_TEXT = {
  privileged_role: 'Role looks privileged (admin, full access, payments…).',
  not_in_hr_roster: 'Email not found in the HR roster.',
  terminated_in_hr: 'Person is marked as a leaver in the HR roster.',
  non_human_without_owner: 'Agent or service account with no named owner.',
  non_human_without_rotation_date: 'Agent or service account with no credential rotation date.',
  rotation_date_unreadable: 'Credential rotation date could not be read.',
  never_logged_in: 'Account has never been used.',
  last_login_unreadable: 'Last login date could not be read.',
  privileged_without_mfa: 'Privileged account without MFA.',
  shared_or_generic_account: 'Looks like a shared or generic account.',
};
export function explainFlag(f) {
  if (FLAG_TEXT[f]) return FLAG_TEXT[f];
  let m;
  if ((m = /^stale_(\d+)_days$/.exec(f))) return `No login for ${m[1]} days.`;
  if ((m = /^credential_not_rotated_(\d+)_days$/.exec(f))) return `Credential not rotated for ${m[1]} days.`;
  if ((m = /^sod_conflict:(.+)$/.exec(f))) return `Segregation-of-duties rule "${m[1]}": the same person holds both sides.`;
  if ((m = /^duplicate_of_row_(\d+)$/.exec(f))) return `Same system and person as row ${m[1]}.`;
  return f;
}

export const SHEET_COLUMNS = ['system', 'user', 'email', 'account_type', 'role', 'owner', 'last_login', 'last_rotated', 'risk', 'flags', 'suggested_action', 'assigned_reviewer', 'delegated_to', 'due_date', 'reviewer_decision', 'reviewer_name', 'review_date', 'notes'];

export function sheetCsv(review) {
  return toCsv(review.items.map((i) => ({ ...i, last_rotated: i.last_rotated ?? '', flags: i.flags.join('; '), reviewer_decision: '', reviewer_name: '', review_date: '', notes: i.delegated_to ? `Delegated by ${i.assigned_reviewer}${i.delegation_reason ? ': ' + i.delegation_reason : ''}` : '' })), SHEET_COLUMNS);
}

export function summaryMarkdown(review, generatedAt) {
  const L = ['# Access recertification', '', `Generated ${generatedAt} by ladon-of-access. As of ${review.as_of}; stale after ${review.stale_days} days; lines due ${review.due_days} days after (high risk: half that).`, ''];
  L.push(`- Active accounts reviewed: ${review.accounts} (${review.skipped_disabled} disabled rows skipped)`, `- Risk: high ${review.by_risk.high}, medium ${review.by_risk.medium}, low ${review.by_risk.low}, none ${review.by_risk.none}`, `- Agents and service accounts: ${review.agents_and_services} (credential rotation ${review.rotation_checked ? `checked, max ${review.rotation_max_days} days` : 'not checked: no rotation column'})`, `- HR roster checked: ${review.roster_checked ? 'yes' : 'no (pass "roster" to find leavers)'}`, `- Segregation-of-duties conflicts: ${review.sod_conflicts.length}`, `- Lines with no reviewer assigned: ${review.unassigned_reviewer}`, '');
  L.push('## How to use the sheet', '', 'Open `recertification.csv`. For every line, the assigned reviewer (or the person in `delegated_to`) fills in `reviewer_decision` (keep / modify / revoke), `reviewer_name` and `review_date` by `due_date`. Ladon\'s `suggested_action` is a hint, not a decision. Revocations are carried out by an admin in each system. Run `ladon_campaign_status` on the filled sheet to see overdue and incomplete lines.', '');
  L.push('## Highest risk', '', '| System | User | Role | Risk | Due | Why |', '|---|---|---|---|---|---|');
  for (const i of review.items.filter((x) => x.risk === 'high' || x.risk === 'medium').slice(0, 50)) L.push(`| ${i.system} | ${i.user || i.email} | ${i.role} | ${i.risk} | ${i.due_date} | ${i.reasons.join(' ')} |`);
  if (review.sod_conflicts.length) { L.push('', '## Segregation-of-duties conflicts', ''); for (const c of review.sod_conflicts) L.push(`- **${c.rule}** — ${c.person}: ${c.detail}`); }
  L.push('', 'This sheet supports a review; it is not, by itself, evidence that a review happened or that access is appropriate.', '');
  return L.join('\n');
}

const DECISIONS = ['keep', 'modify', 'revoke'];

/**
 * Read a filled recertification sheet and report progress: open, overdue, signed,
 * incomplete sign-offs, self-reviews, signed by someone other than the assigned or
 * delegated reviewer, and a chase list per reviewer.
 */
export function campaignStatus(rows, { as_of } = {}) {
  const asOf = as_of || new Date().toISOString().slice(0, 10);
  const lines = rows.map((r, i) => {
    const g = (k) => n(r[k]);
    const decision = low(r.reviewer_decision);
    const reviewer = g('delegated_to') || g('assigned_reviewer');
    const issues = [];
    let state;
    if (!decision) {
      const d = g('due_date') ? days(g('due_date'), asOf) : null;
      state = d !== null && d > 0 ? 'overdue' : 'open';
      if (state === 'overdue') issues.push(`overdue by ${d} day(s) (due ${g('due_date')})`);
      if (!g('due_date')) issues.push('no due date');
    } else if (!DECISIONS.includes(decision)) { state = 'invalid'; issues.push(`decision "${r.reviewer_decision}" is not keep, modify or revoke`); }
    else {
      state = 'decided';
      if (!g('reviewer_name')) issues.push('decision has no reviewer_name');
      if (!g('review_date')) issues.push('decision has no review_date');
      else if (g('due_date') && days(g('due_date'), g('review_date')) > 0) issues.push(`signed after the due date (${g('review_date')} > ${g('due_date')})`);
      const who = low(g('reviewer_name'));
      const local = low(g('email')).split('@')[0].replace(/[._-]+/g, ' ');
      if (who && (who === low(g('user')) || (local && who.replace(/\s*\(.*\)$/, '') === local))) issues.push('self-review: the reviewer is the account holder');
      if (who && reviewer && who !== low(reviewer) && who !== low(g('assigned_reviewer'))) issues.push(`signed by ${g('reviewer_name')}, not the assigned reviewer (${reviewer})`);
      if (issues.length) state = 'incomplete';
    }
    return { line: i + 2, system: g('system'), user: g('user') || g('email'), risk: low(r.risk), reviewer: reviewer || '(unassigned)', delegated: !!g('delegated_to'), due_date: g('due_date'), decision: decision || '', state, issues };
  });
  const by = (s) => lines.filter((l) => l.state === s).length;
  const reviewers = new Map();
  for (const l of lines) {
    if (!reviewers.has(l.reviewer)) reviewers.set(l.reviewer, { reviewer: l.reviewer, total: 0, decided: 0, open: 0, overdue: 0, needs_fix: 0, delegated: 0 });
    const s = reviewers.get(l.reviewer); s.total++;
    if (l.delegated) s.delegated++;
    if (l.state === 'decided') s.decided++; else if (l.state === 'overdue') s.overdue++; else if (l.state === 'open') s.open++; else s.needs_fix++;
  }
  const decided = by('decided');
  return {
    as_of: asOf, lines: lines.length, decided, open: by('open'), overdue: by('overdue'), incomplete: by('incomplete'), invalid: by('invalid'),
    percent_complete: lines.length ? Math.round((decided / lines.length) * 1000) / 10 : 0,
    decisions: { keep: lines.filter((l) => l.decision === 'keep').length, modify: lines.filter((l) => l.decision === 'modify').length, revoke: lines.filter((l) => l.decision === 'revoke').length },
    revocations_to_request: lines.filter((l) => l.decision === 'revoke' && l.state === 'decided').map((l) => ({ line: l.line, system: l.system, user: l.user })),
    chase_list: [...reviewers.values()].filter((r) => r.open + r.overdue + r.needs_fix > 0).sort((a, b) => b.overdue - a.overdue || b.open + b.needs_fix - (a.open + a.needs_fix) || a.reviewer.localeCompare(b.reviewer)),
    reviewers: [...reviewers.values()].sort((a, b) => a.reviewer.localeCompare(b.reviewer)),
    exceptions: lines.filter((l) => l.state !== 'decided'),
    note: 'Reads what the sheet says. Revocations still go through ladon_request_revocation (one named human click each).',
  };
}

/** Compare two access exports (previous and current period). Keyed by system + email (or user). */
export function accessDiff(prevRows, curRows, opts = {}) {
  const priv = opts.privileged_roles && opts.privileged_roles.length ? roleRe(opts.privileged_roles) : DEFAULT_PRIV;
  const live = (r) => !['disabled', 'inactive', 'deleted'].includes(r.status);
  const key = (r) => `${low(r.system)}|${r.email || low(r.user)}`;
  const P = new Map(), C = new Map();
  for (const r of prevRows) if (!P.has(key(r))) P.set(key(r), r);
  for (const r of curRows) if (!C.has(key(r))) C.set(key(r), r);
  const brief = (r) => ({ system: r.system, user: r.user || r.email, email: r.email, account_type: r.account_type, role: r.role, status: r.status });
  const added = [], removed = [], role_changed = [], privilege_gained = [], reactivated = [], deactivated = [], owner_changed = [];
  for (const [k, c] of C) {
    const p = P.get(k);
    if (!p) { if (live(c)) added.push({ ...brief(c), privileged: priv.test(c.role), non_human: isNonHuman(c) }); continue; }
    if (!live(p) && live(c)) reactivated.push(brief(c));
    if (live(p) && !live(c)) deactivated.push(brief(c));
    if (low(p.role) !== low(c.role)) {
      role_changed.push({ ...brief(c), from: p.role, to: c.role });
      if (!priv.test(p.role) && priv.test(c.role)) privilege_gained.push({ ...brief(c), from: p.role, to: c.role });
    }
    if (isNonHuman(c) && low(p.owner) !== low(c.owner)) owner_changed.push({ ...brief(c), from: p.owner, to: c.owner });
  }
  for (const [k, p] of P) if (!C.has(k) && live(p)) removed.push(brief(p));
  const newPriv = added.filter((a) => a.privileged);
  return {
    previous: prevRows.length, current: curRows.length,
    counts: { added: added.length, removed: removed.length, role_changed: role_changed.length, privilege_gained: privilege_gained.length + newPriv.length, reactivated: reactivated.length, deactivated: deactivated.length, new_non_human: added.filter((a) => a.non_human).length, owner_changed: owner_changed.length },
    added, removed, role_changed, privilege_gained: [...privilege_gained, ...newPriv.map((a) => ({ ...a, from: '(new account)', to: a.role }))], reactivated, deactivated, owner_changed,
    review_first: [...privilege_gained.map((x) => `${x.system}: ${x.user} gained ${x.to}`), ...newPriv.map((x) => `${x.system}: new privileged account ${x.user} (${x.role})`), ...reactivated.map((x) => `${x.system}: ${x.user} was reactivated`), ...added.filter((a) => a.non_human && !a.privileged).map((x) => `${x.system}: new ${x.account_type} ${x.user}`)],
    note: 'Changes between two exports. A change is not wrong by itself; the reviewer decides.',
  };
}

/**
 * Evidence pack for a recertification campaign: a JSON record (with the sha256 of the
 * sheet it was built from) and a self-contained HTML page. Deterministic: no clock time,
 * only the as_of date, so the same sheet always gives the same hash.
 */
export function evidencePack(status, { sheet_sha256, sheet_path, campaign }) {
  const record = {
    kind: 'ladon-recertification-evidence', campaign: campaign || 'access recertification', as_of: status.as_of,
    sheet: { path: sheet_path, sha256: sheet_sha256 },
    totals: { lines: status.lines, decided: status.decided, open: status.open, overdue: status.overdue, incomplete: status.incomplete, invalid: status.invalid, percent_complete: status.percent_complete },
    decisions: status.decisions, revocations_to_request: status.revocations_to_request,
    reviewers: status.reviewers, exceptions: status.exceptions.map((e) => ({ line: e.line, system: e.system, user: e.user, state: e.state, issues: e.issues })),
    complete: status.lines > 0 && status.decided === status.lines,
    note: 'Records what the sheet says on the as_of date. It does not prove that the reviews took place or that access is appropriate, and it is not an audit opinion.',
  };
  const json = JSON.stringify(record, null, 2) + '\n';
  const t = (cells, th) => `<tr>${cells.map((c) => `<${th ? 'th' : 'td'}>${escapeHtml(c)}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
  const body = [
    `<h1>${escapeHtml(record.campaign)}</h1>`,
    `<p class="mut">As of ${escapeHtml(record.as_of)} · sheet <code>${escapeHtml(sheet_path)}</code> · sha256 <code>${escapeHtml(sheet_sha256)}</code></p>`,
    `<div class="tiles"><div class="tile">Lines<b>${status.lines}</b></div><div class="tile">Decided<b class="ok">${status.decided}</b></div><div class="tile">Overdue<b class="bad">${status.overdue}</b></div><div class="tile">Open<b>${status.open}</b></div><div class="tile">Needs fixing<b class="warn">${status.incomplete + status.invalid}</b></div><div class="tile">Complete<b>${status.percent_complete}%</b></div></div>`,
    `<h2>Decisions</h2><p>keep ${status.decisions.keep} · modify ${status.decisions.modify} · revoke ${status.decisions.revoke}</p>`,
    `<h2>Reviewers</h2><div class="wrap"><table>${t(['Reviewer', 'Lines', 'Decided', 'Open', 'Overdue', 'Needs fixing', 'Delegated'], true)}${status.reviewers.map((r) => t([r.reviewer, r.total, r.decided, r.open, r.overdue, r.needs_fix, r.delegated])).join('')}</table></div>`,
    `<h2>Exceptions</h2>${record.exceptions.length ? `<div class="wrap"><table>${t(['Line', 'System', 'User', 'State', 'Issues'], true)}${record.exceptions.map((e) => t([e.line, e.system, e.user, e.state, e.issues.join('; ')])).join('')}</table></div>` : '<p class="ok">None.</p>'}`,
    `<h2>Revocations to request</h2>${status.revocations_to_request.length ? `<ul>${status.revocations_to_request.map((r) => `<li>${escapeHtml(r.system)}: ${escapeHtml(r.user)} (line ${r.line})</li>`).join('')}</ul><p class="mut">Each goes through ladon_request_revocation: one named human click.</p>` : '<p>None.</p>'}`,
    `<p class="mut">${escapeHtml(record.note)}</p>`,
  ].join('\n');
  const html = htmlPage({ title: `${record.campaign} — evidence`, bodyHtml: body, footer: `ladon-of-access · evidence sha256 ${sha256(canonical(record))}` });
  return { record, json, html, record_sha256: sha256(canonical(record)) };
}
