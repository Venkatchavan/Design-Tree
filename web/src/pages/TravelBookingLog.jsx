import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../lib/phase3Api.js';
import {
  employeeName,
  money,
  dateLabel,
  dateRange,
  bookingStatus,
  upcoming,
  allPages,
} from './travelBookingUtils.js';
import './travelBooking.css';
function FeeLine({ label, cost, cancel = false }) {
  if (!cost) return null;
  return (
    <div>
      {label}:{' '}
      {cancel ? (
        <>
          paid {money(cost.paidMinor)} · fee {money(cost.feeMinor)} · refund{' '}
          {money(cost.refundMinor)}
        </>
      ) : (
        <>
          fees {money(cost.feeMinor)} · difference{' '}
          <span
            className={
              cost.differenceMinor > 0 ? 'travel-increase' : 'travel-decrease'
            }
          >
            {cost.differenceMinor > 0 ? '+' : ''}
            {money(cost.differenceMinor)}
          </span>{' '}
          · extra cost {money(cost.extraCostMinor)}
        </>
      )}
    </div>
  );
}
export function BookingFees({ booking: b }) {
  if (!b.history?.length) return null;
  const c = b.cancellation;
  const changes = b.history.filter((e) => e.type === 'reschedule');
  const sum = (key) =>
    changes.reduce(
      (a, e) => {
        for (const k of ['feeMinor', 'differenceMinor', 'extraCostMinor'])
          a[k] += e[key]?.[k] || 0;
        return a;
      },
      { feeMinor: 0, differenceMinor: 0, extraCostMinor: 0 },
    );
  return (
    <div className="travel-fees">
      <FeeLine
        label="Transport"
        cost={c?.transport || sum('transport')}
        cancel={!!c}
      />
      {(b.hotel || changes.some((e) => e.before?.hotel || e.after?.hotel)) && (
        <FeeLine label="Stay" cost={c?.stay || sum('stay')} cancel={!!c} />
      )}
      <strong>
        Total:{' '}
        {c ? (
          <>
            cancellation fees {money(c.totalFeesMinor)} · refund due{' '}
            {money(c.totalRefundMinor)} · not refunded{' '}
            {money(c.notRefundedMinor)}
            {changes.length > 0 && (
              <> · earlier reschedule fees {money(c.previousFeesMinor)}</>
            )}
          </>
        ) : (
          <>
            fees {money(b.costs?.feesMinor)} · difference{' '}
            {money(b.costs?.differenceMinor)} · extra cost{' '}
            {money(b.costs?.extraCostMinor)}
          </>
        )}
      </strong>
    </div>
  );
}
export function BookingSummary({ booking: b }) {
  return (
    <div>
      <strong>{employeeName(b)}</strong>
      <p>
        {[b.fromCity, b.toCity].filter(Boolean).join(' → ') || 'City not added'}{' '}
        · {b.mode || 'Mode not added'}
      </p>
      <p>{dateRange(b)}</p>
      <p>
        {b.hotel
          ? [b.hotel, b.location].filter(Boolean).join(', ')
          : 'No hotel'}
      </p>
      <p>{b.reason || 'Purpose not added'}</p>
      <span className="travel-status">{bookingStatus(b)}</span>
    </div>
  );
}
export default function TravelBookingLog({
  readOnly = false,
  embedded = false,
}) {
  const [filter, setFilter] = useState('All'),
    [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['travel-bookings'],
    queryFn: () => allPages(bookingsApi.list),
  });
  const items = q.data || [];
  const matches = (b, f) =>
    f === 'All' || (f === 'Upcoming' ? upcoming(b) : bookingStatus(b) === f);
  const rows = items
    .filter((b) => matches(b, filter))
    .filter((b) =>
      [
        employeeName(b),
        b.department,
        b.employee?.department,
        b.fromCity,
        b.toCity,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <section
      className={`travel-bookings ${embedded ? 'travel-embedded' : ''}`}
      aria-label="Travel & hotel bookings"
    >
      {!embedded && (
        <header className="travel-head">
          <div>
            <h1>Travel & hotel bookings</h1>
            <p>Every trip across all departments, newest first.</p>
          </div>
          {!readOnly && (
            <Link className="btn-primary" to="/travel-booking/new">
              + Add travel booking
            </Link>
          )}
        </header>
      )}
      <div className="travel-toolbar">
        <div className="travel-tabs" aria-label="Filter bookings">
          {['All', 'Upcoming', 'Rescheduled', 'Cancelled', 'Travelled'].map(
            (f) => (
              <button
                key={f}
                type="button"
                aria-pressed={f === filter}
                onClick={() => setFilter(f)}
              >
                {f} ({items.filter((b) => matches(b, f)).length})
              </button>
            ),
          )}
        </div>
        <input
          className="form-input"
          aria-label="Search employee, department or city"
          placeholder="Search employee, department or city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {q.isLoading ? (
        <p role="status">Loading bookings…</p>
      ) : q.isError ? (
        <div role="alert">
          {q.error.message} <button onClick={() => q.refetch()}>Retry</button>
        </div>
      ) : !rows.length ? (
        <p>No bookings match these filters.</p>
      ) : (
        rows.map((b) => (
          <article key={b._id} className="travel-row">
            <div className="travel-blocks">
              <div>
                <small>Employee</small>
                <div className="travel-employee">
                  <span className="travel-avatar">
                    {employeeName(b)
                      .split(' ')
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join('')}
                  </span>
                  <strong>{employeeName(b)}</strong>
                </div>
                <p>
                  {b.department ||
                    b.employee?.department ||
                    'Department not added'}
                </p>
              </div>
              <div>
                <small>Trip</small>
                <strong>
                  {[b.fromCity, b.toCity].filter(Boolean).join(' → ') ||
                    'City not added'}{' '}
                  · {b.mode || 'Mode not added'}
                  {b.preferredSeat && ` · ${b.preferredSeat}`}
                </strong>
                <p>{dateRange(b)}</p>
                {!b.departureDate && (
                  <span className="travel-warning">Start date missing</span>
                )}
              </div>
              <div>
                <small>Stay</small>
                <strong>
                  {b.hotel
                    ? [b.hotel, b.location].filter(Boolean).join(', ')
                    : String(b.departureDate).slice(0, 10) ===
                          String(b.returnDate).slice(0, 10) && b.departureDate
                      ? 'Day trip, no hotel'
                      : 'No hotel'}
                </strong>
                {b.hotel && (
                  <p>
                    {b.checkIn && b.checkOut
                      ? `${b.nights ?? 0} night${b.nights === 1 ? '' : 's'} · ${dateLabel(b.checkIn, false)} – ${dateLabel(b.checkOut, false)}`
                      : 'Stay dates not added'}
                  </p>
                )}
              </div>
              <div>
                <small>Purpose</small>
                <strong>{b.reason || 'Not added'}</strong>
                {b.project?.name && <p>Project: {b.project.name}</p>}
                {b.extraCharges > 0 && (
                  <p>Extra charges {money(Math.round(b.extraCharges * 100))}</p>
                )}
              </div>
              <div>
                <small>Status</small>
                <span
                  className={`travel-status travel-${bookingStatus(b).toLowerCase()}`}
                >
                  {bookingStatus(b)}
                </span>
              </div>
              <div className="travel-actions">
                <small>Actions</small>
                {!readOnly && (
                  <>
                    {upcoming(b) && (
                      <>
                        <Link to={`/travel-booking/${b._id}/reschedule`}>
                          Reschedule
                        </Link>
                        <Link to={`/travel-booking/${b._id}/cancel`}>
                          Cancel trip
                        </Link>
                      </>
                    )}
                    <Link to={`/travel-booking/${b._id}/edit`}>Edit</Link>
                  </>
                )}
                {readOnly && <span>View only</span>}
              </div>
            </div>
            {b.history?.length > 0 && (
              <div className="travel-history">
                {b.history.map((e, i) => (
                  <div key={i}>
                    {e.type === 'cancel'
                      ? `Cancelled on ${dateLabel(e.at)}`
                      : `Moved from ${dateRange(e.before)}`}{' '}
                    · {e.reason}
                    {e.note && ` · ${e.note}`}
                  </div>
                ))}
                {b.history.filter((e) => e.type === 'reschedule').length >
                  1 && (
                  <p>
                    {b.history.filter((e) => e.type === 'reschedule').length}{' '}
                    changes
                  </p>
                )}
                <BookingFees booking={b} />
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
}
