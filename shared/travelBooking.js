// Calendar dates are business dates; timestamps use Asia/Kolkata when displayed.
export const RESCHEDULE_REASONS = [
  'Client meeting moved',
  'Site not ready',
  'Flight or train change',
  'Employee unavailable',
  'Other',
];
export const CANCEL_REASONS = [
  'Project postponed',
  'Client cancelled meeting',
  'Employee unavailable',
  'Booked by mistake',
  'Other',
];
export const MODES = ['Flight', 'Train', 'Bus', 'Car'];
export const SEATS = [
  'No preference',
  'Front seat',
  'Window',
  'Aisle',
  'Lower berth',
  'Upper berth',
];
export function day(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function minor(value) {
  const raw = String(value ?? '').trim() || '0';
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw Object.assign(
      new Error(
        'Amounts must be non-negative with at most two decimal places.',
      ),
      { status: 400 },
    );
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 1e12)
    throw Object.assign(new Error('Amount is too large.'), { status: 400 });
  return amount;
}
export function rupees(value) {
  return (value / 100).toFixed(2);
}
export function upcoming(b, today = day(new Date())) {
  return (
    b.status !== 'Cancelled' &&
    !!day(b.departureDate) &&
    day(b.departureDate) > today &&
    (!day(b.returnDate) || day(b.returnDate) >= day(b.departureDate))
  );
}
export function bookingStatus(b, today = day(new Date())) {
  if (b.status === 'Cancelled') return 'Cancelled';
  if (day(b.returnDate) && day(b.returnDate) < today) return 'Travelled';
  if (
    b.history?.some((e) => e.type === 'reschedule') ||
    b.status === 'Rescheduled'
  )
    return 'Rescheduled';
  if (day(b.departureDate)) return 'Booked';
  return b.status || 'Not added';
}
export function hasKnownAmount(value) {
  return value != null && String(value).trim() !== '';
}
// A removed hotel does not settle its paid amount or earlier change fees.
export function hasStayCosts(booking = {}) {
  return !!(
    booking.hotel ||
    (hasKnownAmount(booking.hotelAmount) && minor(booking.hotelAmount) > 0) ||
    booking.history?.some(
      (event) =>
        event.before?.hotel ||
        event.after?.hotel ||
        ['originalMinor', 'newMinor', 'paidMinor', 'feeMinor'].some(
          (key) => event.stay?.[key] > 0,
        ),
    )
  );
}
export function sameTravelDetail(key, left, right) {
  if (['departureDate', 'returnDate'].includes(key))
    return day(left) === day(right);
  if (key === 'hotelDatesSameAsTravel')
    return (left ?? null) === (right ?? null);
  return String(left ?? '').trim() === String(right ?? '').trim();
}
function baselineAmount(input, saved) {
  if (!hasKnownAmount(saved)) return minor(input);
  const baseline = minor(saved);
  if (input != null && (!hasKnownAmount(input) || minor(input) !== baseline)) {
    throw new Error(
      'The original / paid amount must match the saved current amount. Use Edit for corrections before any recorded travel change.',
    );
  }
  return baseline;
}
export function rescheduleCost(input = {}, fallback) {
  const originalMinor = baselineAmount(input.originalAmount, fallback);
  const newMinor =
    input.newAmount === '' || input.newAmount == null
      ? originalMinor
      : minor(input.newAmount);
  const feeMinor = minor(input.fee);
  return {
    originalMinor,
    newMinor,
    feeMinor,
    differenceMinor: newMinor - originalMinor,
    extraCostMinor: feeMinor + newMinor - originalMinor,
  };
}
export function cancellationCost(input = {}, fallback) {
  const paidMinor = baselineAmount(input.amountPaid, fallback),
    feeMinor = minor(input.fee);
  if (feeMinor > paidMinor)
    throw new Error(
      'The transport / hotel cancellation fee cannot be more than the amount paid.',
    );
  return {
    paidMinor,
    feeMinor,
    refundMinor: Math.max(0, paidMinor - feeMinor),
  };
}
