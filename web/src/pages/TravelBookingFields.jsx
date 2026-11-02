import EmployeeSelect from '../components/EmployeeSelect.jsx';
import { cloneElement, useId } from 'react';
import { MODES, SEATS, day } from '../lib/travelBooking.js';
export function Field({ label, children }) {
  const id = useId();
  return (
    <div className="travel-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function AmountField({ label, value, onChange, readOnly = false }) {
  return (
    <Field label={label}>
      <input
        className="form-input"
        type="number"
        min="0"
        step="0.01"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
      />
    </Field>
  );
}
export function TravelDetails({
  form,
  set,
  employees = [],
  projects = [],
  action,
}) {
  const isNew = action === 'new',
    isReschedule = action === 'reschedule';
  function input(k, label, type = 'text', required = false, disabled = false) {
    return (
      <Field label={label}>
        <input
          className="form-input"
          type={type}
          required={required}
          value={form[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
          disabled={disabled}
        />
      </Field>
    );
  }
  function select(k, label, options) {
    return (
      <Field label={label}>
        <select
          className="form-input"
          value={form[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
        >
          <option value="">Not added</option>
          {form[k] && !options.includes(form[k]) && <option>{form[k]}</option>}
          {options.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
    );
  }
  return (
    <>
      {isNew && (
        <section className="travel-form-section">
          <h2>Employee</h2>
          <div className="travel-form-grid">
            <Field label="Employee *">
              <EmployeeSelect employees={employees}
                className="form-input"
                value={form.employee}
                required
                onChange={(e) => {
                  set('employee', e.target.value);
                  set(
                    'department',
                    employees.find((x) => x._id === e.target.value)
                      ?.department || '',
                  );
                }}
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {[e.firstName, e.lastName].filter(Boolean).join(' ')}
                    {e.empId ? ` (${e.empId})` : ''}
                  </option>
                ))}
              </EmployeeSelect>
            </Field>
            <Field label="Department">
              <input
                className="form-input"
                value={form.department || ''}
                readOnly
              />
            </Field>
          </div>
        </section>
      )}
      {!isNew && !isReschedule && (
        <section className="travel-form-section">
          <Field label="Department">
            <input className="form-input" readOnly value={form.department} />
          </Field>
        </section>
      )}
      <section className="travel-form-section">
        <h2>{isReschedule ? 'Revised travel' : 'Travel'}</h2>
        <div className="travel-form-grid">
          {input('fromCity', 'From city')}
          {input('toCity', 'To city *', 'text', true)}
          {input('departureDate', 'Departure date *', 'date', true)}
          {input('returnDate', 'Return date *', 'date', true)}
          {select('mode', 'Mode', MODES)}
          {select('preferredSeat', 'Preferred seat', SEATS)}
        </div>
      </section>
      <section className="travel-form-section">
        <h2>Hotel</h2>
        <label>
          <input
            type="checkbox"
            checked={form.hotelDatesSameAsTravel === true}
            onChange={(e) => set('hotelDatesSameAsTravel', e.target.checked)}
          />{' '}
          Hotel dates same as travel dates
        </label>
        <p>Leave the hotel empty for a day trip.</p>
        <div className="travel-form-grid">
          {input('hotel', 'Hotel')}
          {input('location', 'Location')}
          {input(
            'checkIn',
            'Check-in',
            'date',
            false,
            form.hotelDatesSameAsTravel,
          )}
          {input(
            'checkOut',
            'Check-out',
            'date',
            false,
            form.hotelDatesSameAsTravel,
          )}
        </div>
        <p>
          {form.checkIn && form.checkOut
            ? Math.max(
                0,
                (Date.parse(day(form.checkOut)) -
                  Date.parse(day(form.checkIn))) /
                  86400000,
              )
            : 'Not added'}{' '}
          nights
        </p>
      </section>
      {!isReschedule && (
        <section className="travel-form-section">
          <h2>Purpose and amounts</h2>
          <div className="travel-form-grid">
            <Field label="Project">
              <select
                className="form-input"
                value={form.project || ''}
                onChange={(e) => set('project', e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {input('reason', 'Reason')}
            <AmountField
              label={`${form.mode || 'Transport'} fare (₹)`}
              value={form.transportFare}
              onChange={(v) => set('transportFare', v)}
              readOnly={form.moneyLocked}
            />
            <AmountField
              label="Hotel amount (₹)"
              value={form.hotelAmount}
              onChange={(v) => set('hotelAmount', v)}
              readOnly={form.moneyLocked}
            />
            <AmountField
              label="Extra charges (₹)"
              value={form.extraCharges}
              onChange={(v) => set('extraCharges', v)}
            />
          </div>
          {form.moneyLocked && (
            <p>Recorded fares are retained with the trip history.</p>
          )}
        </section>
      )}
    </>
  );
}
