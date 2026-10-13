import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { bookingsApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const BOOKING_STATUSES = ['Pending', 'Approved', 'Confirmed', 'Rejected', 'Rescheduled', 'Cancelled', 'Completed'];
// Finance-only (FD/WD superusers pass server-side via requireRole bypass).
const WRITER_ROLES = new Set([
  'finance',
  'founding_director',
  'working_director',
]);
const EMPTY_FORM = {
  employee: '',
  department: '',
  project: '',
  fromCity: '',
  toCity: '',
  departureDate: '',
  returnDate: '',
  mode: '',
  preferredSeat: '',
  checkIn: '',
  checkOut: '',
  hotel: '',
  location: '',
  nights: '',
  reason: '',
  extraCharges: '',
};

const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const dateInput = (v) => (v ? String(v).slice(0, 10) : '');
const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

function toPayload(f) {
  const str = (v) => (v === '' || v == null ? undefined : String(v).trim() || undefined);
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  return {
    employee: f.employee,
    department: str(f.department),
    project: str(f.project),
    fromCity: str(f.fromCity),
    toCity: str(f.toCity),
    departureDate: str(f.departureDate),
    returnDate: str(f.returnDate),
    mode: str(f.mode),
    preferredSeat: str(f.preferredSeat),
    checkIn: str(f.checkIn),
    checkOut: str(f.checkOut),
    hotel: str(f.hotel),
    location: str(f.location),
    nights: num(f.nights),
    reason: str(f.reason),
    extraCharges: num(f.extraCharges),
  };
}

function Field({ label, children }) {
  return (
    <div className="form-row" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function TravelBookingPage({ bootstrap }) {
  const role = bootstrap?.role?.key ?? '';
  const canWrite = WRITER_ROLES.has(role);
  const qc = useQueryClient();

  const [form, setForm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const bookingsQ = useQuery({ queryKey: ['travel-bookings'], queryFn: () => bookingsApi.list({}) });
  const summaryQ = useQuery({ queryKey: ['travel-bookings-summary'], queryFn: () => bookingsApi.summary() });
  const employeesQ = useQuery({
    queryKey: ['travel-bookings-employees'],
    queryFn: () => employeesApi.list({}),
    enabled: canWrite,
    retry: false,
  });
  const projectsQ = useQuery({
    queryKey: ['travel-bookings-projects'],
    queryFn: () => projectsApi.list({}),
    enabled: canWrite,
    retry: false,
  });

  const allRows = arr(bookingsQ.data);
  const rows = useMemo(
    () => allRows.filter((b) => !statusFilter || b.status === statusFilter),
    [allRows, statusFilter],
  );
  const summary = summaryQ.data ?? {};
  const employees = arr(employeesQ.data);
  const projects = arr(projectsQ.data);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['travel-bookings'] });
    qc.invalidateQueries({ queryKey: ['travel-bookings-summary'] });
  };

  const save = useMutation({
    mutationFn: ({ id, body }) => (id ? bookingsApi.update(id, body) : bookingsApi.create(body)),
    onSuccess: () => {
      setForm(null);
      invalidate();
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => bookingsApi.setStatus(id, status),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id) => bookingsApi.remove(id),
    onSuccess: invalidate,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(b) {
    setForm({
      id: b._id,
      employee: b.employee?._id ?? b.employee ?? '',
      department: b.department ?? '',
      project: b.project?._id ?? b.project ?? '',
      fromCity: b.fromCity ?? '',
      toCity: b.toCity ?? '',
      departureDate: dateInput(b.departureDate),
      returnDate: dateInput(b.returnDate),
      mode: b.mode ?? '',
      preferredSeat: b.preferredSeat ?? '',
      checkIn: b.checkIn ?? '',
      checkOut: b.checkOut ?? '',
      hotel: b.hotel ?? '',
      location: b.location ?? '',
      nights: b.nights ?? '',
      reason: b.reason ?? '',
      extraCharges: b.extraCharges ?? '',
    });
  }

  function onEmployeeChange(e) {
    const id = e.target.value;
    const emp = employees.find((x) => String(x._id) === id);
    setForm((f) => ({ ...f, employee: id, department: emp?.department ?? f.department }));
  }

  function submitForm(e) {
    e.preventDefault();
    const { id, ...fields } = form;
    save.mutate({ id, body: toPayload(fields) });
  }

  function confirmDelete(b) {
    if (window.confirm('Delete this travel booking?')) remove.mutate(b._id);
  }

  const loadError = bookingsQ.error?.message ?? summaryQ.error?.message;
  const actionError = save.error?.message ?? setStatus.error?.message ?? remove.error?.message;

  return (
    <div id="view-travel-booking">
      <div className="page-head">
        <div className="page-title">Travel Booking</div>
        <div className="page-sub">Travel and hotel bookings across every department</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Total bookings" value={summary.total ?? 0} accent="blueprint" />
        <KpiCard label="Hotel nights (all time)" value={summary.nights ?? 0} accent="forest" />
        <KpiCard label="Rescheduled" value={summary.rescheduled ?? 0} accent="amber" />
        <KpiCard label="Cancelled" value={summary.cancelled ?? 0} accent="rust" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      {actionError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{actionError}</div>
      )}

      {form && (
        <Panel title={form.id ? 'Edit travel booking' : 'New travel booking'}>
          <form onSubmit={submitForm}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Employee *">
                <select className="filter-select" style={{ width: '100%' }} required value={form.employee} onChange={onEmployeeChange}>
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e._id} value={String(e._id)}>
                      {`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()}{e.empId ? ` (${e.empId})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <input className="form-input" value={form.department} onChange={set('department')} />
              </Field>
              <Field label="Project">
                <select className="filter-select" style={{ width: '100%' }} value={form.project} onChange={set('project')}>
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p._id} value={String(p._id)}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </Field>
              <Field label="From city">
                <input className="form-input" value={form.fromCity} onChange={set('fromCity')} />
              </Field>
              <Field label="To city">
                <input className="form-input" value={form.toCity} onChange={set('toCity')} />
              </Field>
              <Field label="Departure date">
                <input type="date" className="form-input" value={form.departureDate} onChange={set('departureDate')} />
              </Field>
              <Field label="Return date">
                <input type="date" className="form-input" value={form.returnDate} onChange={set('returnDate')} />
              </Field>
              <Field label="Mode">
                <input className="form-input" value={form.mode} onChange={set('mode')} placeholder="e.g. Flight, Train" />
              </Field>
              <Field label="Preferred seat">
                <input className="form-input" value={form.preferredSeat} onChange={set('preferredSeat')} />
              </Field>
              <Field label="Hotel">
                <input className="form-input" value={form.hotel} onChange={set('hotel')} />
              </Field>
              <Field label="Location">
                <input className="form-input" value={form.location} onChange={set('location')} />
              </Field>
              <Field label="Check-in">
                <input className="form-input" value={form.checkIn} onChange={set('checkIn')} />
              </Field>
              <Field label="Check-out">
                <input className="form-input" value={form.checkOut} onChange={set('checkOut')} />
              </Field>
              <Field label="Nights">
                <input type="number" min="0" className="form-input" value={form.nights} onChange={set('nights')} />
              </Field>
              <Field label="Extra charges (₹)">
                <input type="number" min="0" className="form-input" value={form.extraCharges} onChange={set('extraCharges')} />
              </Field>
              <Field label="Reason">
                <input className="form-input" value={form.reason} onChange={set('reason')} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn-primary" disabled={save.isPending || !form.employee}>
                {save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Add booking'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Travel & hotel bookings" sub="Every logged trip across every department, most recent first">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {canWrite && !form && (
            <button type="button" className="approve-btn" onClick={openCreate}>+ Add travel booking</button>
          )}
        </div>
        {bookingsQ.isLoading ? (
          <EmptyState text="Loading bookings…" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'employee',
                label: 'Employee',
                render: (r) => (r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() : '—'),
              },
              { key: 'department', label: 'Department', render: (r) => r.department || r.employee?.department || '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              {
                key: 'dates',
                label: 'Dates',
                render: (r) => `${fmtDate(r.departureDate)} → ${fmtDate(r.returnDate)}`,
              },
              { key: 'mode', label: 'Mode', render: (r) => r.mode || '—' },
              { key: 'checkIn', label: 'Check-in', render: (r) => r.checkIn || '—' },
              { key: 'checkOut', label: 'Check-out', render: (r) => r.checkOut || '—' },
              { key: 'hotel', label: 'Hotel', render: (r) => r.hotel || '—' },
              { key: 'location', label: 'Location', render: (r) => r.location || '—' },
              { key: 'nights', label: 'Nights', render: (r) => r.nights ?? '—' },
              {
                key: 'status',
                label: 'Booking status',
                render: (r) =>
                  canWrite ? (
                    <select
                      className="filter-select"
                      value={r.status}
                      disabled={setStatus.isPending}
                      onChange={(e) => setStatus.mutate({ id: r._id, status: e.target.value })}
                    >
                      {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <StatusPill status={r.status}>{r.status}</StatusPill>
                  ),
              },
              { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
              { key: 'extraCharges', label: 'Extra charges', render: (r) => money(r.extraCharges) },
              {
                key: 'actions',
                label: '',
                render: (r) =>
                  canWrite ? (
                    <span style={{ display: 'flex', gap: 10, whiteSpace: 'nowrap' }}>
                      <button type="button" className="back-link" onClick={() => openEdit(r)}>Edit</button>
                      <button type="button" className="back-link" disabled={remove.isPending} onClick={() => confirmDelete(r)}>Delete</button>
                    </span>
                  ) : null,
              },
            ]}
            rows={rows}
            emptyText={statusFilter ? 'No bookings with this status.' : 'No travel bookings yet.'}
          />
        )}
      </Panel>
    </div>
  );
}
