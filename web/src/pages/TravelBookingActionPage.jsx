import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { employeesApi, projectsApi } from '../lib/api.js';
import { bookingsApi } from '../lib/phase3Api.js';
import {
  BookingCostFields,
  BookingActionSidebar,
} from './TravelBookingCosts.jsx';
import { TravelDetails, Field } from './TravelBookingFields.jsx';
import {
  directorRoles,
  allPages,
  day,
  upcoming,
} from './travelBookingUtils.js';
import {
  RESCHEDULE_REASONS,
  CANCEL_REASONS,
  rescheduleCost,
  cancellationCost,
  validDate,
} from '../lib/travelBooking.js';
const DETAIL_KEYS = [
  'fromCity',
  'toCity',
  'departureDate',
  'returnDate',
  'mode',
  'preferredSeat',
  'hotel',
  'location',
  'checkIn',
  'checkOut',
  'hotelDatesSameAsTravel',
];
const FORM_KEYS = [
  ...DETAIL_KEYS,
  'reason',
  'extraCharges',
  'transportFare',
  'hotelAmount',
  'project',
];
const normalize = (b, k) =>
  ['departureDate', 'returnDate'].includes(k)
    ? day(b[k])
    : k === 'project'
      ? b.project?._id || b.project || ''
      : (b[k] ?? '');
export default function TravelBookingActionPage({ bootstrap, viewKey }) {
  const { id } = useParams();
  const action = viewKey.replace('travel-booking-', '');
  const readOnly = directorRoles.includes(bootstrap?.role?.key);
  const booking = useQuery({
    queryKey: ['travel-booking', id],
    queryFn: () => bookingsApi.get(id),
    enabled: !!id && !readOnly,
    retry: false,
  });
  const employees = useQuery({
    queryKey: ['travel-booking-employees'],
    queryFn: () => allPages(employeesApi.list),
    enabled: action === 'new' && !readOnly,
  });
  const projects = useQuery({
    queryKey: ['travel-booking-projects'],
    queryFn: () => allPages(projectsApi.list, { status: 'Active' }),
    enabled: ['new', 'edit'].includes(action) && !readOnly,
  });
  if (readOnly)
    return (
      <p>
        Directors have read-only access to travel bookings.{' '}
        <Link to="/travel-booking">All bookings</Link>
      </p>
    );
  if (booking.isLoading || employees.isLoading || projects.isLoading)
    return <p role="status">Loading booking details…</p>;
  const failed = [booking, employees, projects].find((q) => q.isError);
  if (failed)
    return (
      <div role="alert">
        {failed.error.message}{' '}
        <button onClick={() => failed.refetch()}>Retry</button>{' '}
        <Link to="/travel-booking">All bookings</Link>
      </div>
    );
  return (
    <BookingEditor
      key={id || 'new'}
      action={action}
      booking={booking.data?.item}
      employees={employees.data || []}
      projects={projects.data || []}
    />
  );
}
function BookingEditor({ action, booking: b, employees, projects }) {
  const initial = Object.fromEntries(
    FORM_KEYS.map((k) => [
      k,
      b ? normalize(b, k) : k === 'hotelDatesSameAsTravel' ? true : '',
    ]),
  );
  const [form, setForm] = useState({
    ...initial,
    employee: '',
    department: b?.department || '',
    moneyLocked: !!(b?.history?.length || b?.status === 'Cancelled'),
  });
  const [reason, setReason] = useState(''),
    [note, setNote] = useState(''),
    [error, setError] = useState('');
  const [transport, setTransport] = useState({
    originalAmount: b?.transportFare ?? '',
    newAmount: '',
    amountPaid: b?.transportFare ?? '',
    fee: '',
  });
  const [stay, setStay] = useState({
    originalAmount: b?.hotelAmount ?? '',
    newAmount: '',
    amountPaid: b?.hotelAmount ?? '',
    fee: '',
  });
  const qc = useQueryClient(),
    navigate = useNavigate();
  const operation = ['reschedule', 'cancel'].includes(action),
    cancel = action === 'cancel',
    hasStay = !!(form.hotel || b?.hotel);
  function set(k, v) {
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (
        n.hotelDatesSameAsTravel &&
        ['departureDate', 'returnDate', 'hotelDatesSameAsTravel'].includes(k)
      ) {
        n.checkIn = n.departureDate;
        n.checkOut = n.returnDate;
      }
      return n;
    });
  }
  const changes = Object.fromEntries(
    (operation ? DETAIL_KEYS : FORM_KEYS)
      .filter((k) => form[k] !== initial[k])
      .map((k) => [k, form[k]]),
  );
  let transportCost, stayCost, costError;
  try {
    transportCost = cancel
      ? cancellationCost(transport)
      : rescheduleCost(transport);
    stayCost = hasStay
      ? cancel
        ? cancellationCost(stay)
        : rescheduleCost(stay)
      : cancel
        ? cancellationCost()
        : rescheduleCost();
  } catch (e) {
    costError = e.message;
  }
  const save = useMutation({
    mutationFn: (payload) =>
      action === 'new'
        ? bookingsApi.create(payload)
        : action === 'edit'
          ? bookingsApi.update(b._id, payload)
          : cancel
            ? bookingsApi.cancel(b._id, payload)
            : bookingsApi.reschedule(b._id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      await qc.invalidateQueries({ queryKey: ['travel-booking', b?._id] });
      navigate('/travel-booking', {
        state: {
          confirmation:
            action === 'new'
              ? 'Travel booking added.'
              : cancel
                ? 'Trip cancelled. Fees and refunds are recorded.'
                : action === 'edit'
                  ? 'Booking updated.'
                  : 'New dates saved. Booking rescheduled.',
        },
      });
    },
  });
  function submit(e) {
    e.preventDefault();
    setError('');
    if (!cancel) {
      if (action === 'new' && !form.employee)
        return setError('Select an employee.');
      if ((action === 'new' || 'toCity' in changes) && !form.toCity.trim())
        return setError('Add the To city.');
      if (
        (action === 'new' ||
          'departureDate' in changes ||
          'returnDate' in changes) &&
        (!validDate(form.departureDate) || !validDate(form.returnDate))
      )
        return setError('Add both the travel and return dates.');
      if (
        (action === 'new' ||
          'departureDate' in changes ||
          'returnDate' in changes) &&
        form.returnDate < form.departureDate
      )
        return setError('Return date cannot be before the travel date.');
      if (
        form.hotel &&
        (action === 'new' ||
          [
            'checkIn',
            'checkOut',
            'hotel',
            'hotelDatesSameAsTravel',
            'departureDate',
            'returnDate',
          ].some((k) => k in changes)) &&
        (!validDate(form.checkIn) ||
          !validDate(form.checkOut) ||
          form.checkOut < form.checkIn)
      )
        return setError('Check the hotel check-in and check-out dates.');
    }
    if (operation && !reason)
      return setError(
        cancel
          ? 'Choose a reason for cancelling.'
          : 'Choose a reason for the reschedule.',
      );
    if (action === 'reschedule' && !Object.keys(changes).length)
      return setError(
        'Nothing has changed yet. Update the dates or details first.',
      );
    if (operation && costError) return setError(costError);
    let payload;
    if (operation) {
      const fee = (x) =>
        cancel
          ? { amountPaid: x.amountPaid, fee: x.fee }
          : {
              originalAmount: x.originalAmount,
              newAmount: x.newAmount,
              fee: x.fee,
            };
      payload = {
        expectedVersion: b.__v ?? 0,
        reason,
        note,
        transport: fee(transport),
        ...(hasStay ? { stay: fee(stay) } : {}),
        ...(!cancel ? { changes } : {}),
      };
    } else if (action === 'new') {
      payload = Object.fromEntries(
        FORM_KEYS.map((k) => [k, k === 'project' ? form[k] || null : form[k]]),
      );
      payload.employee = form.employee;
    } else {
      payload = { ...changes, expectedVersion: b.__v ?? 0 };
      if (payload.project === '') payload.project = null;
    }
    save.mutate(payload);
  }
  if (operation && !upcoming(b))
    return (
      <p>
        This trip has no future departure date available for{' '}
        {cancel ? 'cancellation' : 'rescheduling'}.{' '}
        <Link to="/travel-booking">All bookings</Link>
      </p>
    );
  const currentProjects =
    b?.project?._id && !projects.some((p) => p._id === b.project._id)
      ? [b.project, ...projects]
      : projects;

  return (
    <div className="travel-bookings">
      <Link to="/travel-booking">← All bookings</Link>
      <h1>
        {action === 'new'
          ? 'New travel booking'
          : action === 'edit'
            ? 'Edit travel booking'
            : cancel
              ? 'Cancel trip'
              : 'Reschedule travel booking'}
      </h1>
      <div className="travel-editor">
        <form onSubmit={submit} noValidate>
          {!cancel && (
            <TravelDetails
              form={form}
              set={set}
              employees={employees}
              projects={currentProjects}
              action={action}
            />
          )}
          {operation && (
            <>
              <BookingCostFields
                title={cancel ? 'Transport' : 'Fare and fees — Transport'}
                data={transport}
                setData={setTransport}
                label={form.mode || 'Transport'}
                cancel={cancel}
              />
              {hasStay && (
                <BookingCostFields
                  title={cancel ? 'Stay' : 'Fare and fees — Stay'}
                  data={stay}
                  setData={setStay}
                  label="Hotel"
                  cancel={cancel}
                />
              )}
              <section className="travel-form-section">
                <h2>{cancel ? 'Reason' : 'Why it is moving'}</h2>
                <Field
                  label={
                    cancel
                      ? 'Reason for cancelling *'
                      : 'Reason for reschedule *'
                  }
                >
                  <select
                    className="form-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">Choose a reason…</option>
                    {(cancel ? CANCEL_REASONS : RESCHEDULE_REASONS).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Note (optional)">
                  <textarea
                    className="form-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </section>
            </>
          )}
          {(error || save.error) && (
            <div role="alert" className="travel-form-error">
              {error || save.error.message}
              {save.error?.message?.includes('Reload') && (
                <p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Reload booking
                  </button>
                </p>
              )}
            </div>
          )}
          <div className="travel-save">
            <button
              className="btn-primary"
              type="submit"
              disabled={save.isPending}
            >
              {save.isPending
                ? 'Saving…'
                : action === 'new'
                  ? 'Add booking'
                  : action === 'edit'
                    ? 'Save changes'
                    : cancel
                      ? 'Cancel this trip'
                      : 'Save new dates'}
            </button>
            <Link to="/travel-booking">Back to log</Link>
          </div>
        </form>
        <BookingActionSidebar
          booking={b}
          operation={operation}
          cancel={cancel}
          action={action}
          costError={costError}
          transportCost={transportCost}
          stayCost={stayCost}
          hasStay={hasStay}
          changes={changes}
          initial={initial}
        />
      </div>
    </div>
  );
}
