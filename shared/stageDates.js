// A timeline date is a calendar day. Business "today" changes at midnight IST;
// subtraction uses UTC midnights so daylight-saving changes never add a day.
export const dateOnly = value => value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : '';
export function day(value = new Date()) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}
export const today = () => day();
export const calendarDays = (a, b) => a && b ? Math.round((Date.parse(dateOnly(a)) - Date.parse(dateOnly(b))) / 86400000) : null;
export const daysBetween = calendarDays;
export const nextDay = value => new Date(Date.parse(dateOnly(value)) + 86400000).toISOString().slice(0, 10);
export function varianceLabel(actual, planned) {
  const n = calendarDays(actual, planned);
  return n === null ? '—' : n > 0 ? `+${n} d late` : n < 0 ? `${-n} d early` : 'On time';
}
export function stageMetrics(row, currentDay = day()) {
  const plannedDuration = calendarDays(row.plannedCompletion, row.startDate);
  const actualDuration = calendarDays(row.actualCompletion, row.startDate);
  const variance = calendarDays(row.actualCompletion, row.plannedCompletion);
  const baselineVariance = calendarDays(row.actualCompletion, row.baselineCompletion);
  let label = '—',
    color = 'grey';
  if (variance !== null) {
    label = varianceLabel(row.actualCompletion, row.plannedCompletion);
    color = variance > 0 ? 'red' : 'green';
  } else if (row.plannedCompletion && !row.actualCompletion && row.confirmationStatus !== 'TD Approved' && row.billingReadiness !== 'Billed') {
    const n = calendarDays(currentDay, row.plannedCompletion);
    label = n > 0 ? `Overdue ${n} d` : n === 0 ? 'Due today' : `Due in ${-n} d`;
    color = n > 0 ? 'amber' : 'blue';
  }
  return {
    plannedDuration,
    actualDuration,
    variance,
    baselineVariance,
    label,
    color
  };
}
export const timelineLabel = row => stageMetrics(row).label;
