// DT Peer Review management overview (26 Nov 2026, client's Peer Review
// dashboard). Every figure is worked out from the peer review packages the
// viewer can read — nothing here is sample data.

const DAY = 86400000;
export const SEVERITIES = ['Critical', 'Major', 'Moderate', 'Minor'];
export const RISK = ['Low', 'Medium', 'High'];
export const ESCALATE_DAYS = 10;
export const REPEAT_MIN = 3;
// A reviewer on this many active packages is flagged as a resource conflict.
export const BUSY_PACKAGES = 3;

const id = (v) => String(v?._id ?? v ?? '');
const time = (v) => (v ? new Date(v).getTime() : NaN);
const dayKey = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const round1 = (n) => Math.round(n * 10) / 10;
const avg = (list) => (list.length ? round1(list.reduce((a, b) => a + b, 0) / list.length) : null);
export const person = (e) => (e && typeof e === 'object' ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : '');
export const projectName = (p) => p?.item?.project?.name ?? 'Project';

// Likelihood x impact on a 1-3 scale: 6+ high, 3-4 medium, below low.
export function riskBand(likelihood, impact) {
  const l = RISK.indexOf(likelihood) + 1, i = RISK.indexOf(impact) + 1;
  if (!l || !i) return '';
  const score = l * i;
  return score >= 6 ? 'High' : score >= 3 ? 'Medium' : 'Low';
}

// Last date anything happened on a comment (DesignTree round or response).
export function lastAction(c) {
  const r = (c.rounds ?? [])[(c.rounds ?? []).length - 1];
  return Math.max(time(r?.responseDate) || 0, time(r?.commentDate) || 0) || NaN;
}
export const raisedAt = (c) => time(c.rounds?.[0]?.commentDate);

// Comments of every package with their package and server-computed state.
export function allComments(packages) {
  return packages.flatMap((p) => (p.item.comments ?? []).map((c) => ({
    ...c, pkg: p, project: projectName(p), consultant: p.item.principalConsultant || '',
    state: p.summary.commentStates?.[id(c)] ?? { open: false, overdue: false, label: '' },
  })));
}

export function applyFilters(packages, f = {}, now = Date.now()) {
  const since = f.days ? now - Number(f.days) * DAY : null;
  const pkgs = packages.filter((p) => (!f.project || id(p.item) === f.project)
    && (!f.consultant || (p.item.principalConsultant || '') === f.consultant)
    && (!f.reviewer || (p.item.reviewTeam ?? []).some((e) => id(e) === f.reviewer))
    && (!f.risk || riskBand(p.item.likelihood, p.item.impact) === f.risk));
  const comments = allComments(pkgs).filter((c) => (!f.severity || c.severity === f.severity)
    && (!since || raisedAt(c) >= since));
  return { packages: pkgs, comments };
}

export function kpis(packages, comments) {
  const closed = comments.filter((c) => !c.state.open).length;
  return {
    projects: packages.length,
    active: packages.filter((p) => !p.summary.released).length,
    critical: comments.filter((c) => c.state.open && c.severity === 'Critical').length,
    overdue: comments.filter((c) => c.state.open && c.state.overdue).length,
    closurePct: comments.length ? Math.round((closed / comments.length) * 100) : 0,
    open: comments.filter((c) => c.state.open).length,
    total: comments.length,
  };
}

// Projects placed on the likelihood (rows, High first) x impact grid.
export function riskMatrix(packages) {
  const cells = {};
  const unrated = [];
  for (const p of packages) {
    const { likelihood, impact } = p.item;
    if (!RISK.includes(likelihood) || !RISK.includes(impact)) { unrated.push(p); continue; }
    (cells[`${likelihood}|${impact}`] ??= []).push(p);
  }
  return { rows: [...RISK].reverse(), cols: RISK, cells, unrated };
}

// Where each package is: its current review stage, or released.
export function pipeline(packages, stages) {
  const rows = stages.map((s) => ({ key: s.code, label: `${s.code} · ${s.name}`, count: 0 }));
  const done = { key: 'released', label: 'Released for issue', count: 0 };
  const ready = { key: 'ready', label: 'All stages signed off — awaiting release', count: 0 };
  for (const p of packages) {
    if (p.summary.released) { done.count += 1; continue; }
    const cur = (p.summary.stages ?? []).find((s) => !s.signedOff);
    const row = cur && rows.find((r) => r.key === cur.code);
    if (row) row.count += 1; else ready.count += 1;
  }
  const all = [...rows, ready, done];
  const total = packages.length || 1;
  return all.map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }));
}

export function severityCounts(comments) {
  const open = comments.filter((c) => c.state.open);
  const out = Object.fromEntries(SEVERITIES.map((s) => [s, open.filter((c) => c.severity === s).length]));
  out.Unclassified = open.filter((c) => !SEVERITIES.includes(c.severity)).length;
  return out;
}

// Open comments per review item, for one category and (optionally) one element.
export function breakdown(comments, category, element) {
  const counts = new Map();
  for (const c of comments) {
    if (!c.state.open || c.category !== category || (element && c.element !== element)) continue;
    const key = c.reviewItem || 'Item not set';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

export function reviewerWorkload(packages, now = Date.now()) {
  const people = new Map();
  for (const p of packages) {
    const active = !p.summary.released;
    const open = allComments([p]).filter((c) => c.state.open);
    for (const e of p.item.reviewTeam ?? []) {
      const key = id(e);
      const r = people.get(key) ?? { id: key, name: person(e) || '—', packages: 0, open: 0, overdue: 0, hours: 0, docs: 0 };
      if (active) { r.packages += 1; r.open += open.length; r.overdue += open.filter((c) => c.state.overdue).length; }
      people.set(key, r);
    }
    for (const a of p.item.activity ?? []) {
      const r = people.get(id(a.by));
      if (r && now - time(a.date) <= 7 * DAY) { r.hours += Number(a.hours) || 0; r.docs += Number(a.docsChecked) || 0; }
    }
  }
  return [...people.values()].map((r) => ({ ...r, hours: round1(r.hours), busy: r.packages >= BUSY_PACKAGES }))
    .sort((a, b) => b.packages - a.packages || b.open - a.open || a.name.localeCompare(b.name));
}

// Principal Consultant response record across their packages.
export function consultantPerformance(comments) {
  const map = new Map();
  for (const c of comments) {
    const key = c.consultant || 'Not set';
    const r = map.get(key) ?? { name: key, received: 0, closed: 0, tat: [] };
    r.received += 1;
    if (!c.state.open) r.closed += 1;
    for (const round of c.rounds ?? []) {
      const d = (time(round.responseDate) - time(round.commentDate)) / DAY;
      if (Number.isFinite(d) && d >= 0) r.tat.push(d);
    }
    map.set(key, r);
  }
  return [...map.values()].map((r) => ({ name: r.name, received: r.received, closed: r.closed, avgTat: avg(r.tat), closurePct: Math.round((r.closed / r.received) * 100) }))
    .sort((a, b) => b.received - a.received);
}

// The same review item logged REPEAT_MIN or more times; trend compares the
// last 30 days with the 30 before.
export function repeatObservations(comments, now = Date.now()) {
  const map = new Map();
  for (const c of comments) {
    const label = c.reviewItem || c.topic;
    if (!label) continue;
    const key = label.trim().toLowerCase();
    const r = map.get(key) ?? { issue: label.trim(), category: c.category || '—', count: 0, projects: new Set(), recent: 0, before: 0 };
    r.count += 1;
    r.projects.add(c.project);
    const age = (now - raisedAt(c)) / DAY;
    if (age <= 30) r.recent += 1; else if (age <= 60) r.before += 1;
    map.set(key, r);
  }
  return [...map.values()].filter((r) => r.count >= REPEAT_MIN)
    .map((r) => ({ issue: r.issue, category: r.category, occurrences: r.count, projects: r.projects.size, trend: r.recent > r.before ? 'Rising' : r.recent < r.before ? 'Falling' : 'Steady' }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

// Average DesignTree review rounds per comment, by project type.
export function reviewCycles(packages) {
  const map = new Map();
  for (const p of packages) {
    const key = p.item.projectType || 'Type not set';
    const r = map.get(key) ?? { type: key, projects: 0, rounds: [] };
    r.projects += 1;
    for (const c of p.item.comments ?? []) r.rounds.push((c.rounds ?? []).length);
    map.set(key, r);
  }
  return [...map.values()].map((r) => ({ type: r.type, projects: r.projects, comments: r.rounds.length, avgCycles: avg(r.rounds) }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

// Day by day: comments raised, critical raised, re-reviews, responses and
// closures from the comment log, plus hours / documents from the review log.
export function dailyActivity(packages, comments, limit = 7) {
  const days = new Map();
  const at = (v) => {
    const k = dayKey(v);
    if (!k) return null;
    if (!days.has(k)) days.set(k, { date: k, raised: 0, critical: 0, rereviews: 0, responses: 0, closed: 0, hours: 0, docs: 0 });
    return days.get(k);
  };
  for (const c of comments) {
    (c.rounds ?? []).forEach((r, i) => {
      const d = at(r.commentDate);
      if (d && i === 0) { d.raised += 1; if (c.severity === 'Critical') d.critical += 1; }
      if (d && i > 0) { d.rereviews += 1; if (r.verdict === 'Closed') d.closed += 1; }
      const resp = r.response && at(r.responseDate);
      if (resp) resp.responses += 1;
    });
  }
  for (const p of packages) for (const a of p.item.activity ?? []) {
    const d = at(a.date);
    if (d) { d.hours += Number(a.hours) || 0; d.docs += Number(a.docsChecked) || 0; }
  }
  return [...days.values()].map((d) => ({ ...d, hours: round1(d.hours) }))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function actionCentre(packages, comments, workload, now = Date.now()) {
  const open = comments.filter((c) => c.state.open);
  const byProject = (list) => {
    const m = new Map();
    for (const c of list) m.set(c.project, (m.get(c.project) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([project, count]) => ({ project, count }));
  };
  const critical = open.filter((c) => c.severity === 'Critical');
  const overdue = open.filter((c) => c.state.overdue);
  const escalations = open.map((c) => ({ ...c, days: Math.floor((now - lastAction(c)) / DAY) }))
    .filter((c) => c.days > ESCALATE_DAYS).sort((a, b) => b.days - a.days);
  return {
    critical: { count: critical.length, projects: byProject(critical) },
    overdue: { count: overdue.length, projects: byProject(overdue) },
    conflicts: workload.filter((r) => r.busy),
    escalations,
    atRisk: packages.filter((p) => riskBand(p.item.likelihood, p.item.impact) === 'High' && !p.summary.released),
  };
}

// Rows for the Excel export of the comment log.
export function exportRows(comments) {
  const fmt = (v) => (v ? dayKey(v) : '');
  return comments.map((c, n) => {
    const rounds = c.rounds ?? [];
    const last = rounds[rounds.length - 1] ?? {};
    const lastDt = [...rounds].reverse().find((r) => r.comment)?.comment ?? '';
    const lastResp = [...rounds].reverse().find((r) => r.response)?.response ?? '';
    return {
      '#': n + 1,
      Project: c.project,
      Stage: c.stage,
      Document: c.document || '',
      Topic: c.topic || '',
      'Page / Detail': c.detail || '',
      Severity: c.severity || '',
      Category: c.category || '',
      'Review item': c.reviewItem || '',
      Element: c.element || '',
      Rounds: rounds.length,
      'Raised on': fmt(rounds[0]?.commentDate),
      'Last action': fmt(lastAction(c)),
      Status: c.state.open ? c.state.label + (c.state.overdue ? ' (overdue)' : '') : 'Closed',
      'Latest DT comment': lastDt,
      'Latest consultant response': lastResp,
      'Last verdict': last.verdict || '',
      'Principal Consultant': c.consultant,
    };
  });
}
