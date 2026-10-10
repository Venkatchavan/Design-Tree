import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { bookingsApi, downloadCsv } from '../lib/phase3Api.js';
import { allowanceApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'bookings', label: 'Travel bookings' },
  { key: 'requests', label: 'LA / Cab / Other requests' },
];
const STATUSES = ['Pending', 'Approved', 'Confirmed', 'Rejected', 'Rescheduled', 'Cancelled', 'Completed'];
const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);

function fmtDay(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })}`;
}

function fmtRange(dep, ret) {
  if (!dep) return '—';
  if (!ret) return fmtDay(dep);
  const a = new Date(dep);
  const b = new Date(ret);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return fmtDay(dep);
  if (a.toDateString() === b.toDateString()) return fmtDay(dep);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${String(a.getDate()).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')} ${a.toLocaleString('en-GB', { month: 'short' })}`;
  }
  return `${fmtDay(dep)} → ${fmtDay(ret)}`;
}

function fmtStamp(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}, ${String(h).padStart(2, '0')}:${m} ${ap}`;
}

const inr = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function TravelBookingPage({ bootstrap }) {
  const [tab, setTab] = useState('bookings');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    employee: '', project: '', department: '', fromCity: '', toCity: '', departureDate: '',
    returnDate: '', mode: '', preferredSeat: '', checkIn: '', checkOut: '', hotel: '', location: '', nights: '',
    reason: '', extraCharges: '',
  });
  const [editingId, setEditingId] = useState('');
  const role = bootstrap?.role?.key ?? '';
  const canWrite = role === 'finance' || role === 'founding_director' || role === 'working_director';
  const isDirector = DIRECTOR_ROLES.has(role);
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['booking-summary'], queryFn: bookingsApi.summary });
  const list = useQuery({ queryKey: ['travel-bookings'], queryFn: () => bookingsApi.list({}) });
  const employees = useQuery({ queryKey: ['employees-pick'], queryFn: () => employeesApi.list({}) });
  const projects = useQuery({ queryKey: ['projects-pick'], queryFn: () => projectsApi.list({}) });
  const create = useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-summary'] });
      setModal(false);
      setEditingId('');
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => bookingsApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-summary'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => bookingsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-summary'] });
      setModal(false);
      setEditingId('');
    },
  });
  const remove = useMutation({
    mutationFn: (id) => bookingsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-summary'] });
    },
  });
  const s = summary.data ?? {};
  const rows = useMemo(() => [...(list.data?.items ?? [])].sort((a, b) =>
    String(b.departureDate ?? b.createdAt ?? '').localeCompare(String(a.departureDate ?? a.createdAt ?? '')),
  ), [list.data]);

  const blankForm = {
    employee: '', project: '', department: '', fromCity: '', toCity: '', departureDate: '',
    returnDate: '', mode: '', preferredSeat: '', checkIn: '', checkOut: '', hotel: '', location: '', nights: '',
    reason: '', extraCharges: '',
  };

  function openAdd() {
    setForm({ ...blankForm });
    setEditingId('');
    setModal(true);
  }

  function openEdit(r) {
    setForm({
      employee: String(r.employee?._id ?? r.employee ?? ''),
      project: String(r.project?._id ?? r.project ?? ''),
      department: r.department ?? '',
      fromCity: r.fromCity ?? '', toCity: r.toCity ?? '',
      departureDate: r.departureDate ? String(r.departureDate).slice(0, 10) : '',
      returnDate: r.returnDate ? String(r.returnDate).slice(0, 10) : '',
      mode: r.mode ?? '', preferredSeat: r.preferredSeat ?? '', checkIn: r.checkIn ?? '', checkOut: r.checkOut ?? '',
      hotel: r.hotel ?? '', location: r.location ?? '',
      nights: r.nights ?? '', reason: r.reason ?? '',
      extraCharges: r.extraCharges ?? '',
    });
    setEditingId(r._id);
    setModal(true);
  }

  function submit(e) {
    e.preventDefault();
    const body = {
      ...form,
      project: form.project || undefined,
      department: form.department || undefined,
      preferredSeat: form.preferredSeat || undefined,
      checkIn: form.checkIn || undefined,
      checkOut: form.checkOut || undefined,
      nights: Number(form.nights) || 0,
      extraCharges: Number(form.extraCharges) || 0,
      departureDate: form.departureDate || undefined,
      returnDate: form.returnDate || undefined,
    };
    if (editingId) update.mutate({ id: editingId, body });
    else create.mutate(body);
  }

  return (
    <div id="view-travelbooking">
      <div className="page-head">
        <div className="page-title">Travel Booking</div>
        <div className="page-sub">{isDirector
          ? 'Travel & hotel bookings, and Local Allowance / Cab booking / other travel requests raised by employees — review attached bills and approve, reject or return for clarification'
          : 'Travel and hotel bookings. Finance reviews attached bills and approves, rejects or returns requests.'}</div>
      </div>
      {isDirector ? (
      <div className="kpi-grid cols-4">
        <KpiCard label="Total bookings" value={s.total ?? 0} accent="blueprint" />
        <KpiCard label="Hotel nights (all time)" value={s.nights ?? 0} accent="copper" />
        <KpiCard label="Rescheduled" value={s.rescheduled ?? 0} accent="amber" />
        <KpiCard label="Cancelled" value={s.cancelled ?? 0} accent="rust" />
      </div>
      ) : (
      <div className="kpi-grid cols-6">
        <KpiCard label="Total bookings" value={s.total ?? 0} accent="blueprint" />
        <KpiCard label="Hotel nights" value={s.nights ?? 0} accent="copper" />
        <KpiCard label="Pending" value={s.pending ?? 0} accent="amber" />
        <KpiCard label="Approved" value={s.approved ?? 0} accent="forest" />
        <KpiCard label="Rejected" value={s.rejected ?? 0} accent="rust" />
        <KpiCard label="Completed" value={s.completed ?? 0} accent="teal" />
      </div>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'bookings' ? (
        isDirector ? (
        <Panel title="Travel & hotel bookings" sub="Every logged trip across every department, most recent first">
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <button className="btn-primary" type="button" onClick={openAdd}>Add travel booking</button>
          </div>
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'department', label: 'Department', render: (r) => r.department ?? r.employee?.department ?? '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'dates', label: 'Dates', render: (r) => fmtRange(r.departureDate, r.returnDate) },
              { key: 'requestedOn', label: 'Requested on', render: (r) => fmtDateTime(r.createdAt) },
              { key: 'mode', label: 'Mode', render: (r) => r.mode ?? '—' },
              { key: 'preferredSeat', label: 'Preferred seat', render: (r) => r.preferredSeat ?? '—' },
              { key: 'checkIn', label: 'Check-in', render: (r) => r.checkIn ?? '—' },
              { key: 'checkOut', label: 'Check-out', render: (r) => r.checkOut ?? '—' },
              { key: 'hotel', label: 'Hotel', render: (r) => r.hotel ?? '—' },
              { key: 'location', label: 'Location', render: (r) => r.location ?? '—' },
              { key: 'nights', label: 'Nights', render: (r) => r.nights ?? '—' },
              { key: 'status', label: 'Booking status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'extraCharges', label: 'Extra charges', render: (r) => r.extraCharges ? inr(r.extraCharges) : '—' },
              {
                key: 'actions', label: '', render: (r) => (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="approve-btn" onClick={() => openEdit(r)}>Edit</button>
                    <button type="button" className="approve-btn" onClick={() => { if (window.confirm('Delete this booking?')) remove.mutate(r._id); }}>Delete</button>
                  </span>
                ),
              },
            ]}
            rows={rows}
            emptyText="No travel bookings yet."
          />
        </Panel>
        ) : (
        <Panel title="Travel bookings">
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            {canWrite && <button className="btn-primary" type="button" onClick={() => setModal(true)}>Add travel booking</button>}
            <button className="approve-btn" type="button" onClick={() => window.print()}>Export CSV</button>
          </div>
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'dates', label: 'Dates', render: (r) => `${r.departureDate ? new Date(r.departureDate).toLocaleDateString() : '—'} → ${r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '—'}` },
              { key: 'requestedOn', label: 'Requested on', render: (r) => fmtDateTime(r.createdAt) },
              { key: 'mode', label: 'Mode' },
              { key: 'preferredSeat', label: 'Preferred seat', render: (r) => r.preferredSeat ?? '—' },
              { key: 'hotel', label: 'Hotel', render: (r) => r.hotel ? `${r.hotel} (${r.location ?? '—'})` : '—' },
              { key: 'nights', label: 'Nights' },
              { key: 'status', label: 'Booking status', render: (r) => canWrite
                ? <select className="filter-select" value={r.status} onChange={(e) => setStatus.mutate({ id: r._id, status: e.target.value })}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
                : <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'reason', label: 'Reason' },
            ]}
            rows={rows}
            emptyText="No travel bookings yet."
          />
          {tab === 'bookings' && modal && (
            <Modal title={editingId ? 'Edit travel booking' : 'Add travel booking'} onClose={() => { setModal(false); setEditingId(''); }} wide>
              <form onSubmit={submit} className="field-grid">
                <div className="form-row"><label className="form-label">Employee *</label><select required className="filter-select" style={{ width: '100%' }} value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}><option value="">Select employee</option>{(employees.data?.items ?? []).map((x) => <option key={x._id} value={x._id}>{x.firstName} {x.lastName} ({x.empId})</option>)}</select></div>
                <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}><option value="">No project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                <div className="form-row"><label className="form-label">Department</label><input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">From city</label><input className="form-input" value={form.fromCity} onChange={(e) => setForm({ ...form, fromCity: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">To city</label><input className="form-input" value={form.toCity} onChange={(e) => setForm({ ...form, toCity: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Departure date</label><input type="date" className="form-input" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Return date</label><input type="date" className="form-input" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Mode</label><input className="form-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Preferred seat (flight)</label><input className="form-input" placeholder="e.g. 14A, window" value={form.preferredSeat} onChange={(e) => setForm({ ...form, preferredSeat: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Check-in</label><input className="form-input" placeholder="18 Aug, 03:00 pm" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Check-out</label><input className="form-input" placeholder="19 Aug, 11:00 am" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Hotel</label><input className="form-input" value={form.hotel} onChange={(e) => setForm({ ...form, hotel: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Nights</label><input type="number" min="0" className="form-input" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Reason</label><input className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Extra charges (₹)</label><input type="number" min="0" className="form-input" value={form.extraCharges} onChange={(e) => setForm({ ...form, extraCharges: e.target.value })} /></div>
                {(create.isError || update.isError) && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{create.error?.message ?? update.error?.message}</div>}
                <button className="btn-primary" type="submit" disabled={create.isPending || update.isPending}>{editingId ? (update.isPending ? 'Saving…' : 'Update booking') : (create.isPending ? 'Saving…' : 'Save booking')}</button>
              </form>
            </Modal>
          )}
        </Panel>
        )
      ) : (
        isDirector ? <DirectorAllowanceLog /> : <AllowanceLog canDecide={canWrite} />
      )}
    </div>
  );
}

function AllowanceLog({ canDecide }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['allowances-finance'], queryFn: () => allowanceApi.list({}) });
  const decide = useMutation({
    mutationFn: ({ id, status }) => allowanceApi.decide(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allowances-finance'] }),
  });
  return (
    <Panel title="LA / Cab / Other request log">
      <DataTable
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'reqType', label: 'Type' },
          { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'route', label: 'Route', render: (r) => r.route ?? `${r.pickup ?? ''} → ${r.drop ?? ''}` },
          { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
          { key: 'bill', label: 'Bill' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'remarks', label: 'Remarks' },
          {
            key: 'review', label: 'Review', render: (r) => canDecide && r.status === 'Pending' ? (
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="approve-btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: r._id, status: 'Approved' })}>Approve</button>
                <button type="button" className="approve-btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: r._id, status: 'Rejected' })}>Reject</button>
              </span>
            ) : '—',
          },
        ]}
        rows={list.data?.items ?? []}
        emptyText="No local allowance, cab or other travel requests."
      />
      {decide.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{decide.error.message}</div>}
    </Panel>
  );
}

const REQ_TYPES = [
  { key: '', label: 'All types' },
  { key: 'LA', label: 'Local Allowance' },
  { key: 'Cab', label: 'Cab booking' },
  { key: 'Other', label: 'Other' },
];
const REQ_STATUSES = ['', 'Pending', 'Approved', 'Rejected', 'Completed', 'Returned for clarification'];

function reqTypeLabel(t) {
  if (t === 'LA') return 'Local Allowance';
  if (t === 'Cab') return 'Cab booking';
  return t ?? '—';
}

function reqDetails(r) {
  if (r.reqType === 'LA') {
    return r.days != null ? `${r.days} day${Number(r.days) === 1 ? '' : 's'}` : (r.description ?? r.purpose ?? '—');
  }
  const route = r.route ?? [r.pickup, r.drop].filter(Boolean).join(' → ');
  const parts = [route, r.meetingTime, r.vehicle, r.passengers != null ? `${r.passengers} pax` : ''].filter(Boolean);
  return parts.join(' · ') || (r.description ?? r.purpose ?? '—');
}

function billCell(r) {
  if (!r.bill) return 'No bill';
  const b = String(r.bill);
  if (/^(https?:\/\/|\/)/i.test(b)) return <a href={b} target="_blank" rel="noreferrer">View bill</a>;
  return 'View bill';
}

function DirectorAllowanceLog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [remarks, setRemarks] = useState('');
  const list = useQuery({ queryKey: ['allowances-finance'], queryFn: () => allowanceApi.list({}) });
  const decide = useMutation({
    mutationFn: ({ id, status, remarks }) => allowanceApi.decide(id, { status, remarks: remarks || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowances-finance'] });
      setReviewId('');
      setRemarks('');
    },
  });
  const items = useMemo(() => [...(list.data?.items ?? [])].sort((a, b) =>
    String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? '')),
  ), [list.data]);
  const rows = items.filter((r) => {
    const hay = `${r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : ''} ${r.project?.name ?? ''}`.toLowerCase();
    return (
      (!type || r.reqType === type) &&
      (!status || r.status === status) &&
      (!search.trim() || hay.includes(search.trim().toLowerCase()))
    );
  });
  const countBy = (st) => items.filter((r) => r.status === st).length;
  const reviewing = rows.find((r) => String(r._id) === reviewId) ?? null;

  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Pending" value={countBy('Pending')} accent="amber" />
        <KpiCard label="Approved" value={countBy('Approved')} accent="forest" />
        <KpiCard label="Rejected" value={countBy('Rejected')} accent="rust" />
        <KpiCard label="Completed" value={countBy('Completed')} accent="teal" />
      </div>
      <Panel title="Request log" sub="Every Local Allowance, Cab booking and other travel request, most recent first">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="form-input" style={{ maxWidth: 220 }} placeholder="Search employee / project" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={type} onChange={(e) => setType(e.target.value)}>{REQ_TYPES.map((t) => <option key={t.label} value={t.key}>{t.label}</option>)}</select>
          <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>{REQ_STATUSES.map((x) => <option key={x} value={x}>{x === '' ? 'All statuses' : x}</option>)}</select>
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, [
            { key: 'employee', label: 'Employee', value: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '' },
            { key: 'department', label: 'Department', value: (r) => r.employee?.department ?? '' },
            { key: 'project', label: 'Project', value: (r) => r.project?.name ?? '' },
            { key: 'reqType', label: 'Type', value: (r) => reqTypeLabel(r.reqType) },
            { key: 'date', label: 'Date', value: (r) => fmtStamp(r.date) },
            { key: 'details', label: 'Details', value: (r) => reqDetails(r) },
            { key: 'purpose', label: 'Purpose', value: (r) => r.purpose ?? '' },
            { key: 'amount', label: 'Amount', value: (r) => r.amount ?? 0 },
            { key: 'status', label: 'Status', value: (r) => r.status ?? '' },
            { key: 'remarks', label: 'Remarks', value: (r) => r.remarks ?? '' },
          ], 'la-cab-other-requests.csv')}>Export CSV</button>
        </div>
        {list.isLoading ? <EmptyState text="Loading requests…" /> : list.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{list.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'department', label: 'Department', render: (r) => r.employee?.department ?? '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'reqType', label: 'Type', render: (r) => reqTypeLabel(r.reqType) },
              { key: 'date', label: 'Date', render: (r) => fmtStamp(r.date) },
              { key: 'details', label: 'Details', render: (r) => reqDetails(r) },
              { key: 'purpose', label: 'Purpose', render: (r) => r.purpose ?? '—' },
              { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
              { key: 'bill', label: 'Bill', render: (r) => billCell(r) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
              { key: 'submitted', label: 'Submitted', render: (r) => fmtStamp(r.createdAt) },
              {
                key: 'action', label: '', render: (r) => {
                  if (r.status === 'Pending') return <button type="button" className="approve-btn" onClick={() => { setReviewId(String(r._id)); setRemarks(''); }}>Review</button>;
                  if (r.status === 'Approved') return <button type="button" className="approve-btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: r._id, status: 'Completed' })}>Mark completed</button>;
                  if (r.status === 'Returned for clarification') return 'Awaiting employee';
                  return '—';
                },
              },
            ]}
            rows={rows}
            emptyText="No local allowance, cab or other travel requests."
          />
        )}
        {decide.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{decide.error.message}</div>}
      </Panel>
      {reviewing && (
        <Modal title="Review request" onClose={() => setReviewId('')}>
          <div className="field-grid">
            <div className="form-row"><label className="form-label">Employee</label><div>{reviewing.employee ? `${reviewing.employee.firstName} ${reviewing.employee.lastName}` : '—'}</div></div>
            <div className="form-row"><label className="form-label">Details</label><div>{reqDetails(reviewing)}</div></div>
            <div className="form-row"><label className="form-label">Amount</label><div>{inr(reviewing.amount)}</div></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label className="form-label">Remarks</label><input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for decision or clarification needed" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: reviewing._id, status: 'Approved', remarks })}>Approve</button>
            <button type="button" className="approve-btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: reviewing._id, status: 'Rejected', remarks })}>Reject</button>
            <button type="button" className="approve-btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: reviewing._id, status: 'Returned for clarification', remarks })}>Return for clarification</button>
          </div>
          {decide.isError && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 8 }}>{decide.error.message}</div>}
        </Modal>
      )}
    </>
  );
}
