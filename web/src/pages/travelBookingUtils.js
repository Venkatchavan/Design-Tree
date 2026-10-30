export { day, bookingStatus, upcoming } from '../lib/travelBooking.js';
export const directorRoles = [
  'founding_director',
  'working_director',
  'executive_director',
  'associate_director',
  'technical_director',
  'assoc_technical_director',
];
export const employeeName = (b) =>
  [b.employee?.firstName, b.employee?.lastName].filter(Boolean).join(' ') ||
  'Employee not added';
export const money = (minor) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
export function dateLabel(value, year = true) {
  return value
    ? new Date(value).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        ...(year ? { year: 'numeric' } : {}),
      })
    : 'Not added';
}
export function dateRange(b) {
  if (!b.departureDate)
    return `${b.returnDate ? 'Return ' + dateLabel(b.returnDate) + ' · ' : ''}Start date missing`;
  if (!b.returnDate)
    return dateLabel(b.departureDate) + ' · Return date missing';
  if (
    String(b.departureDate).slice(0, 10) === String(b.returnDate).slice(0, 10)
  )
    return dateLabel(b.departureDate) + ' · Day trip';
  return dateLabel(b.departureDate, false) + ' – ' + dateLabel(b.returnDate);
}
export async function allPages(api, params = {}) {
  const items = [];
  let page = 1;
  while (true) {
    const r = await api({ ...params, page, limit: 200 });
    const rows = Array.isArray(r) ? r : r.items || [];
    items.push(...rows);
    if (!r.hasMore && !(r.total > items.length)) return items;
    if (!rows.length) throw new Error('Incomplete results. Retry loading.');
    page++;
  }
}
