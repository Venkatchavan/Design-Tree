import { addHours } from './workReport.js';

const PILLS = 6;
export const empName = (e) => (e && typeof e === 'object' ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || e.empId : e) || 'Not recorded';
export const empKey = (e) => String(e?.employee?._id ?? e?.employee?.id ?? e?.employee ?? e?._id ?? '');
export const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const projectName = (p) => (typeof p === 'string' ? p : p?.name ?? p?.code ?? 'Not recorded');
export const projectKey = (p) => String(p?._id ?? p?.id ?? p ?? '');
// Same service always gets the same pill colour.
export const pillTone = (s) => [...String(s)].reduce((n, c) => n + c.charCodeAt(0), 0) % PILLS;

// One simple row per piece of work. A day's entry that spans several
// activities or projects is split, so each row names one project, service,
// category, description and hours (05 Nov 2026 client layout).
export function splitEntry(entry) {
  const allocations = Array.isArray(entry.reportAllocations) && entry.reportAllocations.length
    ? entry.reportAllocations
    : [{ project: entry.project, service: entry.service, hours: entry.hours, activities: entry.activities, notes: entry.notes }];
  return allocations.flatMap((alloc, i) => {
    const base = { project: alloc.project, service: alloc.service ?? entry.service ?? '' };
    const acts = (alloc.activities ?? []).filter(Boolean);
    if (alloc.component === 'other') {
      return [{ ...base, key: `${entry.key}:${i}`, category: 'Other project', description: 'Hours on another project', hours: alloc.hours }];
    }
    if (!acts.length) {
      return [{ ...base, key: `${entry.key}:${i}`, category: entry.category ?? entry.type ?? '—', description: String(alloc.notes ?? '').trim() || '—', hours: alloc.hours }];
    }
    return acts.map((a, j) => ({
      ...base, key: `${entry.key}:${i}:${j}`,
      category: a.key || '—', description: String(a.update ?? '').trim() || '—', hours: a.hours ?? alloc.hours,
    }));
  });
}

// Groups every employee's saved work for the day under their name.
export function groupByEmployee(entries, { project = '', service = '' } = {}) {
  const groups = new Map();
  for (const entry of entries) {
    for (const row of splitEntry(entry)) {
      if (project && projectKey(row.project) !== project) continue;
      if (service && row.service !== service) continue;
      const key = empKey(entry);
      const g = groups.get(key) ?? { key, name: empName(entry.employee), rows: [], hours: 0 };
      g.rows.push(row);
      g.hours = addHours(g.hours, row.hours);
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
