// Offline advisory list: only the list the user supplies (none is bundled since 0.2.1). No network.

export const ADVISORIES_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['advisories'],
  properties: {
    snapshot: { type: 'string', description: 'Date the list was taken (YYYY-MM-DD)' },
    source: { type: 'string' },
    advisories: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'ecosystem', 'package', 'affected', 'summary'],
        properties: {
          id: { type: 'string', minLength: 1 },
          ecosystem: { type: 'string', enum: ['npm', 'pypi'] },
          package: { type: 'string', minLength: 1 },
          affected: { type: 'string', minLength: 1, description: 'Version range: "*", "<1.2.3", ">=1.0.0 <1.4.0", "1.2.3 || 1.2.4"' },
          fixed: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          summary: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Since 0.2.1 no advisory snapshot ships with the package (a dated list goes stale and can
 * look like a vulnerability database). Advisories come only from the list you pass with
 * `advisories` (or a policy's `advisories`). Kept so older callers still get a valid, empty list.
 */
export function bundledAdvisories() {
  return { snapshot: null, source: 'none bundled: pass your own advisory list (schema mcpreview-advisories)', advisories: [] };
}

const parts = (v) => {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(v).trim());
  return m ? { n: [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)], pre: m[4] || null } : null;
};

/** Compare two versions (semver-ish; also fits calendar versions like 2025.7.1). */
export function cmpVersion(a, b) {
  const x = parts(a), y = parts(b);
  if (!x || !y) return String(a).localeCompare(String(b));
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1; if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Does exact version v fall in range? Range: comparators joined by spaces (AND) and "||" (OR). */
export function inRange(v, range) {
  if (!parts(v)) return false;
  return String(range).split('||').some((alt) => {
    const cs = alt.trim().split(/\s+/).filter(Boolean);
    if (!cs.length) return false;
    return cs.every((c) => {
      if (c === '*' || c === 'x') return true;
      const m = /^(<=|>=|<|>|=|==)?\s*v?(.+)$/.exec(c); if (!m) return false;
      const d = cmpVersion(v, m[2]);
      switch (m[1]) { case '<': return d < 0; case '<=': return d <= 0; case '>': return d > 0; case '>=': return d >= 0; default: return d === 0; }
    });
  });
}

/** Return matching advisories for one package version. */
export function matchAdvisories(list, ecosystem, name, version) {
  if (!version || !parts(version)) return [];
  const norm = (s) => (ecosystem === 'pypi' ? String(s).toLowerCase().replace(/[-_.]+/g, '-') : String(s));
  return list.filter((a) => a.ecosystem === ecosystem && norm(a.package) === norm(name) && inRange(version, a.affected));
}
