import { AmountField } from './TravelBookingFields.jsx';
import { money } from './travelBookingUtils.js';
import { cancellationCost, hasKnownAmount } from '../lib/travelBooking.js';
import { BookingSummary, BookingFees } from './TravelBookingLog.jsx';
function CancellationPreview({ data, knownAmount }) {
  let cost, error;
  try {
    cost = cancellationCost(data, knownAmount);
  } catch (e) {
    error = e.message;
  }
  return error ? (
    <p role="alert">{error}</p>
  ) : (
    <p aria-live="polite">
      Refund {money(cost.refundMinor)} · Not refunded{' '}
      {money(cost.paidMinor - cost.refundMinor)}
    </p>
  );
}
export function BookingCostFields({
  title,
  data,
  setData,
  label,
  cancel,
  knownAmount,
  retained = false,
}) {
  const known = hasKnownAmount(knownAmount);
  const hint = known ? 'saved current amount' : 'not recorded; enter amount';
  return (
    <section className="travel-form-section">
      <h2>{title}</h2>
      {retained && (
        <p>
          No current hotel. Recorded stay amounts and fees remain payable or
          refundable until recorded here.
        </p>
      )}
      {known && (
        <p>
          Original and paid amounts use the saved current amount. Corrections
          use Edit before any recorded travel change.
        </p>
      )}
      <div className="travel-form-grid">
        {cancel ? (
          <>
            <AmountField
              label={`${label} amount paid (₹) — ${hint}`}
              readOnly={known}
              value={data.amountPaid}
              onChange={(v) => setData((x) => ({ ...x, amountPaid: v }))}
            />
            <AmountField
              label={`${label} cancellation fee (₹)`}
              value={data.fee}
              onChange={(v) => setData((x) => ({ ...x, fee: v }))}
            />
          </>
        ) : (
          <>
            <AmountField
              label={`Original ${label.toLowerCase()} amount (₹) — ${hint}`}
              readOnly={known}
              value={data.originalAmount}
              onChange={(v) => setData((x) => ({ ...x, originalAmount: v }))}
            />
            <AmountField
              label={`New ${label.toLowerCase()} amount (₹) — empty means unchanged`}
              value={data.newAmount}
              onChange={(v) => setData((x) => ({ ...x, newAmount: v }))}
            />
            <AmountField
              label={`${label} ${label === 'Hotel' ? 'change' : 'reschedule'} fee (₹)`}
              value={data.fee}
              onChange={(v) => setData((x) => ({ ...x, fee: v }))}
            />
          </>
        )}
      </div>
      {cancel && <CancellationPreview data={data} knownAmount={knownAmount} />}
    </section>
  );
}
export function BookingActionSidebar({
  booking: b,
  operation,
  cancel,
  action,
  costError,
  transportCost,
  stayCost,
  hasStay,
  changes,
  initial,
}) {
  return (
    <aside className="travel-side">
      {b && (
        <section>
          <h2>Current booking</h2>
          <BookingSummary booking={b} />
          <BookingFees booking={b} />
        </section>
      )}
      {operation && (
        <section aria-live="polite">
          <h2>{cancel ? 'Refund summary' : 'Cost of this change'}</h2>
          {costError ? (
            <p role="alert">{costError}</p>
          ) : (
            <>
              {[
                ['Transport', transportCost],
                ...(hasStay ? [['Stay', stayCost]] : []),
              ].map(([label, c]) => (
                <p key={label}>
                  <strong>{label}</strong>
                  <br />
                  {cancel ? (
                    <>
                      Refund {money(c.refundMinor)} · not refunded{' '}
                      {money(c.paidMinor - c.refundMinor)}
                    </>
                  ) : (
                    <>
                      Fee {money(c.feeMinor)} · difference{' '}
                      <span
                        className={
                          c.differenceMinor > 0
                            ? 'travel-increase'
                            : 'travel-decrease'
                        }
                      >
                        {c.differenceMinor > 0 ? '+' : ''}
                        {money(c.differenceMinor)}
                      </span>{' '}
                      · extra cost {money(c.extraCostMinor)}
                    </>
                  )}
                </p>
              ))}
              {cancel ? (
                <>
                  <p>
                    <strong>
                      Total refund due{' '}
                      {money(transportCost.refundMinor + stayCost.refundMinor)}
                    </strong>
                  </p>
                  <p>
                    Total not refunded{' '}
                    {money(transportCost.feeMinor + stayCost.feeMinor)}
                  </p>
                  {b.costs?.feesMinor > 0 && (
                    <p>Earlier reschedule fees {money(b.costs.feesMinor)}</p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Total fees{' '}
                    {money(transportCost.feeMinor + stayCost.feeMinor)}
                  </p>
                  <p>
                    Total difference{' '}
                    {money(
                      transportCost.differenceMinor + stayCost.differenceMinor,
                    )}
                  </p>
                  <strong>
                    Total extra cost{' '}
                    {money(
                      transportCost.extraCostMinor + stayCost.extraCostMinor,
                    )}
                  </strong>
                </>
              )}
            </>
          )}
        </section>
      )}
      {action === 'reschedule' && (
        <section>
          <h2>What changes</h2>
          {Object.keys(changes).length ? (
            <ul className="travel-diff">
              {Object.entries(changes).map(([k, v]) => (
                <li key={k}>
                  {k.replace(/([A-Z])/g, ' $1')}
                  <del>{String(initial[k] || 'Not added')}</del>
                  <strong>{String(v || 'Not added')}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing has changed yet.</p>
          )}
        </section>
      )}
    </aside>
  );
}
