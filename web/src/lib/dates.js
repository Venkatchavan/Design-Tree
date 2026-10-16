// Formats dates as 28-Apr-26 (short year) or 15-Aug-2026 (full year).
export function fmtDashDate(v, year = 'numeric') {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year }).replace(/ /g, '-');
}

export function dateInput(v) {
  return v ? String(v).slice(0, 10) : '';
}
