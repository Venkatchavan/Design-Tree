import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { bookingsApi, downloadCsv } from '../lib/phase3Api.js';
import { allowanceApi } from '../lib/phase4bApi.js';
import { fileUrl } from '../lib/docsApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
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
  const [tab, setTab] = useState('bookings');

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
      <Tabs
        tabs={[
          { key: 'bookings', label: 'Travel & hotel bookings' },
          { key: 'requests', label: 'Request log (LA / Cab / Other)' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'bookings' && (
      <div className="kpi-grid cols-4">
        <KpiCard label="Total bookings" value={summary.total ?? 0} accent="blueprint" />
        <KpiCard label="Hotel nights (all time)" value={summary.nights ?? 0} accent="forest" />
        <KpiCard label="Rescheduled" value={summary.rescheduled ?? 0} accent="amber" />
        <KpiCard label="Cancelled" value={summary.cancelled ?? 0} accent="rust" />
      </div>
      )}
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      {actionError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{actionError}</div>
      )}

      {tab === 'bookings' && form && (
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

      {tab === 'bookings' && (
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
      )}
      {tab === 'requests' && <RequestLogTab canWrite={canWrite} />}
    </div>
  );
}

const REQ_TYPE_LABEL = { LA: 'Local Allowance', Cab: 'Cab booking', Other: 'Other' };
const REQ_STATUSES = ['Pending', 'Approved', 'Rejected', 'Returned for clarification', 'Completed'];

function fmtShort(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function allowanceDetails(r) {
  if (r.reqType === 'LA') {
    return r.days != null ? `${r.days} day${Number(r.days) === 1 ? '' : 's'}` : (r.description ?? r.purpose ?? '—');
  }
  const route = r.route ?? [r.pickup, r.drop].filter(Boolean).join(' → ');
  const parts = [route, r.meetingTime, r.vehicle, r.passengers != null ? `${r.passengers} pax` : ''].filter(Boolean);
  return parts.join(' · ') || (r.description ?? r.purpose ?? '—');
}

function allowanceEmployee(r) {
  const e = r.employee;
  if (e && typeof e === 'object') {
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
  }
  return '—';
}

function RequestLogTab({ canWrite }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [err, setErr] = useState('');

  const listQ = useQuery({ queryKey: ['allowances-all'], queryFn: () => allowanceApi.list({}) });
  const items = arr(listQ.data);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => !typeFilter || r.reqType === typeFilter)
      .filter((r) => !statusFilter || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        const emp = allowanceEmployee(r).toLowerCase();
        const proj = (r.project?.name ?? '').toLowerCase();
        return emp.includes(q) || proj.includes(q);
      })
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [items, search, typeFilter, statusFilter]);

  const count = (s) => items.filter((r) => r.status === s).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['allowances-all'] });

  async function decide(id, status) {
    setErr('');
    let remarks;
    if (status === 'Rejected') {
      const v = window.prompt('Reason for rejecting (required, shown to the requester):', '');
      if (v == null) return;
      remarks = v.trim();
      if (!remarks) {
        setErr('A reason is required when rejecting.');
        return;
      }
    }
    try {
      await allowanceApi.decide(id, { status, remarks });
      invalidate();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function markCompleted(id) {
    setErr('');
    try {
      await allowanceApi.complete(id);
      invalidate();
    } catch (e) {
      setErr(e.message);
    }
  }

  // Pending rows get Approve + Reject (reject prompts for the required
  // reason); Approved rows get Mark completed; clarification returns wait.
  function reviewCell(r) {
    if (!canWrite) return '—';
    if (r.status === 'Pending') {
      return (
        <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
          <button type="button" className="approve-btn" onClick={() => decide(r._id, 'Approved')}>Approve</button>
          <button type="button" className="approve-btn" onClick={() => decide(r._id, 'Rejected')}>Reject</button>
        </span>
      );
    }
    if (r.status === 'Approved') {
      return <button type="button" className="approve-btn" onClick={() => markCompleted(r._id)}>Mark completed</button>;
    }
    if (r.status === 'Returned for clarification') {
      return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Awaiting employee</span>;
    }
    return '—';
  }

  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => allowanceEmployee(r) },
    { key: 'department', label: 'Department', render: (r) => r.employee?.department ?? r.employee?.designation ?? '—' },
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
    { key: 'type', label: 'Type', render: (r) => REQ_TYPE_LABEL[r.reqType] ?? r.reqType ?? '—' },
    { key: 'date', label: 'Date', render: (r) => fmtShort(r.date) },
    { key: 'details', label: 'Details', render: (r) => allowanceDetails(r) },
    { key: 'purpose', label: 'Purpose', render: (r) => r.purpose ?? r.description ?? '—' },
    { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
    { key: 'bill', label: 'Bill', render: (r) => (r.bill ? <a href={fileUrl(r.bill)} target="_blank" rel="noreferrer">View bill</a> : 'No bill') },
    { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
    { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
    { key: 'submitted', label: 'Submitted', render: (r) => fmtShort(r.createdAt) },
    { key: 'actions', label: '', render: (r) => reviewCell(r) },
  ];

  const csvColumns = [
    { label: 'Employee', value: (r) => allowanceEmployee(r) },
    { label: 'Department', value: (r) => r.employee?.department ?? r.employee?.designation ?? '' },
    { label: 'Project', value: (r) => r.project?.name ?? '' },
    { label: 'Type', value: (r) => REQ_TYPE_LABEL[r.reqType] ?? r.reqType ?? '' },
    { label: 'Date', value: (r) => fmtShort(r.date) },
    { label: 'Details', value: (r) => allowanceDetails(r) },
    { label: 'Purpose', value: (r) => r.purpose ?? r.description ?? '' },
    { label: 'Amount', value: (r) => r.amount ?? 0 },
    { label: 'Bill attached', value: (r) => (r.bill ? 'Yes' : 'No') },
    { label: 'Status', value: (r) => r.status ?? '' },
    { label: 'Remarks', value: (r) => r.remarks ?? '' },
    { label: 'Submitted', value: (r) => fmtShort(r.createdAt) },
  ];

  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Pending" value={count('Pending')} accent="amber" />
        <KpiCard label="Approved" value={count('Approved')} accent="blueprint" />
        <KpiCard label="Rejected" value={count('Rejected')} accent="rust" />
        <KpiCard label="Completed" value={count('Completed')} accent="forest" />
      </div>
      <Panel title="Request log" sub="Every Local Allowance, Cab booking and other travel request, most recent first">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            className="filter-select"
            style={{ width: 190 }}
            placeholder="Search employee / project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="LA">Local Allowance</option>
            <option value="Cab">Cab booking</option>
            <option value="Other">Other</option>
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {REQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, csvColumns, 'request-log.csv')}>
            Export CSV
          </button>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {listQ.isLoading ? (
          <EmptyState text="Loading requests…" />
        ) : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            emptyText={search || typeFilter || statusFilter ? 'No requests match these filters.' : 'No requests submitted yet.'}
          />
        )}
      </Panel>
    </>
  );
}
