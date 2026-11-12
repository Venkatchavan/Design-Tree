// Reason for extra working hours, shown on every work-progress form so it is
// never hidden. Required once the day passes the threshold, or for any work
// on a Sunday. The reason goes to the reporting TL / PTL / head, who approves
// or declines it with a reason of their own (Extra-hours approvals).
export const EXTRA_HOURS_AT = 8;

export function isSundayKey(dateKey) {
  if (!dateKey) return false;
  const d = new Date(`${String(dateKey).slice(0, 10)}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 0;
}

export function extraHoursRequired(dayTotal, dateKey) {
  return dayTotal > EXTRA_HOURS_AT || (isSundayKey(dateKey) && dayTotal > 0);
}

export default function ExtraHoursReasonField({ value, onChange, dayTotal = 0, loggedToday = 0, dateKey }) {
  const sunday = isSundayKey(dateKey);
  const required = extraHoursRequired(dayTotal, dateKey);
  const why = sunday
    ? 'Required: work on a Sunday is extra hours.'
    : required
      ? `Required: ${dayTotal.toFixed(1)}h for this day (${loggedToday.toFixed(1)}h already logged) is over ${EXTRA_HOURS_AT}h.`
      : `Only needed when the day goes past ${EXTRA_HOURS_AT}h, or on a Sunday or holiday.`;
  return (
    <div
      className="form-row"
      style={{
        border: `1px solid ${required ? 'var(--amber, #b54708)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <label className="form-label" htmlFor="extra-hours-reason">
        Reason for extra hours{required ? ' *' : ''}
      </label>
      <textarea
        id="extra-hours-reason"
        className="form-input"
        rows={2}
        maxLength={1000}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Why you worked beyond the standard day (sent to your team lead for approval)"
      />
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
        {why} Your team lead approves or declines it with a reason.
      </div>
    </div>
  );
}
