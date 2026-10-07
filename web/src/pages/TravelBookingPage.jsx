import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { bookingsApi } from '../lib/phase3Api.js';
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
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Rescheduled', 'Cancelled', 'Completed'];

export default function TravelBookingPage({ bootstrap }) {
  const [tab, setTab] = useState('bookings');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    employee: '', project: '', fromCity: '', toCity: '', departureDate: '',
    returnDate: '', mode: '', hotel: '', location: '', nights: '', reason: '',
  });
  const role = bootstrap?.role?.key ?? '';
  const canWrite = role === 'finance' || role === 'founding_director' || role === 'working_director';
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
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => bookingsApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-summary'] });
    },
  });
  const s = summary.data ?? {};
  const rows = list.data?.items ?? [];

  function submit(e) {
    e.preventDefault();
    create.mutate({
      ...form,
      project: form.project || undefined,
      nights: Number(form.nights) || 0,
      departureDate: form.departureDate || undefined,
      returnDate: form.returnDate || undefined,
    });
  }

  return (
    <div id="view-travelbooking">
      <div className="page-head">
        <div className="page-title">Travel Booking</div>
        <div className="page-sub">Travel and hotel bookings. Finance reviews attached bills and approves, rejects or returns requests.</div>
      </div>
      <div className="kpi-grid cols-6">
        <KpiCard label="Total bookings" value={s.total ?? 0} accent="blueprint" />
        <KpiCard label="Hotel nights" value={s.nights ?? 0} accent="copper" />
        <KpiCard label="Pending" value={s.pending ?? 0} accent="amber" />
        <KpiCard label="Approved" value={s.approved ?? 0} accent="forest" />
        <KpiCard label="Rejected" value={s.rejected ?? 0} accent="rust" />
        <KpiCard label="Completed" value={s.completed ?? 0} accent="teal" />
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'bookings' ? (
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
              { key: 'mode', label: 'Mode' },
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
          {modal && (
            <Modal title="Add travel booking" onClose={() => setModal(false)} wide>
              <form onSubmit={submit} className="field-grid">
                <div className="form-row"><label className="form-label">Employee *</label><select required className="filter-select" style={{ width: '100%' }} value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}><option value="">Select employee</option>{(employees.data?.items ?? []).map((x) => <option key={x._id} value={x._id}>{x.firstName} {x.lastName} ({x.empId})</option>)}</select></div>
                <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}><option value="">No project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                <div className="form-row"><label className="form-label">From city</label><input className="form-input" value={form.fromCity} onChange={(e) => setForm({ ...form, fromCity: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">To city</label><input className="form-input" value={form.toCity} onChange={(e) => setForm({ ...form, toCity: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Departure date</label><input type="date" className="form-input" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Return date</label><input type="date" className="form-input" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Mode</label><input className="form-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Hotel</label><input className="form-input" value={form.hotel} onChange={(e) => setForm({ ...form, hotel: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Nights</label><input type="number" min="0" className="form-input" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} /></div>
                <div className="form-row"><label className="form-label">Reason</label><input className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                {create.isError && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{create.error.message}</div>}
                <button className="btn-primary" type="submit" disabled={create.isPending}>Save booking</button>
              </form>
            </Modal>
          )}
        </Panel>
      ) : (
        <Panel title="LA / Cab / Other request log">
          <EmptyState text="Local allowance, cab and other travel requests will appear here when Leave & Travel arrives in Phase 4." />
        </Panel>
      )}
    </div>
  );
}
