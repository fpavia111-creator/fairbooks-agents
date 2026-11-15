// Period-over-period comparison of two audited exports, keyed by canonical email.
const base = (f) => f.replace(/_\d+.*$|_of_.*$|_[a-z]+\.[a-z.]+$/, '');

export function compareAudits(prev, cur) {
  const key = (i) => i.canonical || `id:${i.id}`;
  const p = new Map(prev.items.map((i) => [key(i), i])); const c = new Map(cur.items.map((i) => [key(i), i]));
  const added = []; const removed = []; const worse = []; const better = []; const actionChanged = [];
  for (const [k, i] of c) {
    const o = p.get(k);
    if (!o) { added.push({ id: i.id, email: i.email, suggested_action: i.suggested_action, flags: i.flags }); continue; }
    const of = new Set(o.flags.map(base)); const nf = new Set(i.flags.map(base));
    const gained = [...nf].filter((f) => !of.has(f)); const lost = [...of].filter((f) => !nf.has(f));
    if (gained.length) worse.push({ id: i.id, email: i.email, new_flags: gained });
    if (lost.length) better.push({ id: i.id, email: i.email, resolved_flags: lost });
    if (o.suggested_action !== i.suggested_action) actionChanged.push({ id: i.id, email: i.email, from: o.suggested_action, to: i.suggested_action });
  }
  for (const [k, o] of p) if (!c.has(k)) removed.push({ id: o.id, email: o.email });
  const flagDelta = {}; for (const f of new Set([...Object.keys(prev.flag_counts), ...Object.keys(cur.flag_counts)])) { const d = (cur.flag_counts[f] || 0) - (prev.flag_counts[f] || 0); if (d) flagDelta[f] = d; }
  return {
    previous: { as_of: prev.as_of, contacts: prev.contacts, health: prev.health.score }, current: { as_of: cur.as_of, contacts: cur.contacts, health: cur.health.score },
    health_change: cur.health.score - prev.health.score, added: added.length, removed: removed.length, newly_flagged: worse.length, improved: better.length, flag_count_change: flagDelta,
    newly_flagged_contacts: worse, improved_contacts: better, action_changes: actionChanged, added_contacts: added, removed_contacts: removed,
    note: 'Matched by canonical email (case, +tags and Gmail dots ignored); rows without an email are matched by id.',
  };
}
