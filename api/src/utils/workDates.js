// Work dates are business calendar dates in Asia/Kolkata, independent of host TZ.
export function workDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid work date.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function dayStart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new Error('Use a valid YYYY-MM-DD work date.');
  const date = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(date.getTime()) || workDate(date) !== value) throw new Error('Invalid work date.');
  return date;
}
export function workDateFilter({ date, from, to }) {
  const start = date || from, end = date || to;
  const filter = {};
  if (start) filter.$gte = dayStart(start);
  if (end) filter.$lt = new Date(dayStart(end).getTime() + 86400000);
  if (start && end && start > end) throw new Error('From date must precede To date.');
  return Object.keys(filter).length ? filter : undefined;
}
