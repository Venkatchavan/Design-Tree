import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meApi, projectsApi } from '../lib/api.js';
import { SUPER_ROLES } from '../lib/session.js';
import { allowanceApi, holidaysApi, leaveApi, travelApi } from '../lib/phase4bApi.js';
import { docsApi, fileUrl } from '../lib/docsApi.js';
import { employeesApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
function empIdOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}
function isPending(s) {
  return String(s ?? '').toLowerCase() === 'pending';
}
function quarterStart() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), q, 1);
}

const LEAVE_TYPES = ['Casual leave', 'Sick leave', 'Earned leave', 'Unpaid leave', 'Other'];
const TRAVEL_MODES = ['Train', 'Flight', 'Bus', 'Taxi', 'Car', 'Other'];

export default function LeaveTravelPage({ bootstrap, user, viewKey }) {
  void user;
  void viewKey;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('leave');
  const roleKey = bootstrap?.role?.key ?? '';
  // AssocTD: spec layout — balance / pending / quarterly trips, and the
  // three request tabs only (no Approvals tab, no awaiting card).
  const isAssocTD = roleKey === 'assoc_technical_director';

  // --- queries ---
  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const myEmpId = meQ.data?.user?.employee ?? null;
  const employeeQ = useQuery({
    queryKey: ['employee-self', myEmpId],
    queryFn: () => employeesApi.get(myEmpId),
    enabled: !!myEmpId,
    retry: false,
  });
  const selfEmployee = employeeQ.data?.item ?? employeeQ.data?.employee ?? employeeQ.data ?? null;
  const leaveMineQ = useQuery({ queryKey: ['leave-mine'], queryFn: leaveApi.mine });
  const travelMineQ = useQuery({ queryKey: ['travel-mine'], queryFn: travelApi.mine });
  const allowMineQ = useQuery({ queryKey: ['allowance-mine'], queryFn: allowanceApi.mine });
  const queueQ = useQuery({ queryKey: ['lt-queue'], queryFn: leaveApi.queue });
  const scopeQ = useQuery({ queryKey: ['lt-scope'], queryFn: leaveApi.scopeIds });
  const holidaysQ = useQuery({ queryKey: ['holidays'], queryFn: () => holidaysApi.list({}) });
  const projectsQ = useQuery({ queryKey: ['projects', 'lt'], queryFn: () => projectsApi.list({ status: 'Active' }) });

  const leaveMine = leaveMineQ.data?.items ?? [];
  const travelMine = travelMineQ.data?.items ?? [];
  const allowMine = allowMineQ.data?.items ?? [];
  const projects = projectsQ.data?.items ?? [];

  const scopeIds = useMemo(() => {
    const d = scopeQ.data;
    if (!d) return null;
    if (Array.isArray(d)) return new Set(d.map(String));
    const arr = d.employeeIds ?? d.ids ?? d.scope ?? d.items ?? [];
    if (Array.isArray(arr)) return new Set(arr.map((v) => String(v?._id ?? v?.id ?? v)));
    return null;
  }, [scopeQ.data]);

  const queue = queueQ.data ?? {};
  const qLeave = queue.leave ?? queue.leaves ?? [];
  const qTravel = queue.travel ?? queue.travels ?? [];
  const qAllow = queue.allowance ?? queue.allowances ?? [];

  const canSeeFullQueue = useMemo(() => {
    if (SUPER_ROLES.includes(roleKey)) return true;
    return ['hr', 'finance', 'admin_billing', 'admin'].includes(roleKey);
  }, [roleKey]);
  const isScopedApprover = ['team_lead', 'assoc_technical_director', 'technical_director'].includes(roleKey);

  function inScope(item) {
    if (canSeeFullQueue) return true;
    if (!isScopedApprover) return false;
    if (!scopeIds) return true;
    const eid = empIdOf(item.employee ?? item.emp ?? item.requestedBy);
    if (!eid) return true;
    return scopeIds.has(eid);
  }

  const filteredQueue = useMemo(
    () => ({
      leave: qLeave.filter(inScope),
      travel: qTravel.filter(inScope),
      allowance: qAllow.filter(inScope),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qLeave, qTravel, qAllow, scopeIds, roleKey],
  );
  const awaitingCount = filteredQueue.leave.length + filteredQueue.travel.length + filteredQueue.allowance.length;

  const myPending = useMemo(
    () => [...leaveMine, ...travelMine, ...allowMine].filter((r) => isPending(r.status)).length,
    [leaveMine, travelMine, allowMine],
  );
  // Balance = upcoming holidays on this year's HR calendar minus approved
  // personal leave taken this year (floored at 0). No quota anywhere.
  const leaveBalance = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const year = String(new Date().getFullYear());
    const upcomingHolidays = (holidaysQ.data?.items ?? []).filter((h) => {
      const d = String(h.date ?? '').slice(0, 10);
      return d && d.slice(0, 4) === year && d >= today;
    }).length;
    const used = leaveMine
      .filter((r) => String(r.status ?? '').toLowerCase() === 'approved' && new Date(r.from ?? r.createdAt).getFullYear() === Number(year))
      .reduce((s, r) => s + (Number(r.days) || 0), 0);
    return Math.max(0, upcomingHolidays - used);
  }, [holidaysQ.data, leaveMine]);
  const travelQuarter = useMemo(() => {
    const qs = quarterStart();
    return travelMine.filter((t) => {
      const d = t.departureDate ?? t.fromDate ?? t.date ?? t.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      return !Number.isNaN(dt.getTime()) && dt >= qs;
    }).length;
  }, [travelMine]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['leave-mine'] });
    queryClient.invalidateQueries({ queryKey: ['travel-mine'] });
    queryClient.invalidateQueries({ queryKey: ['allowance-mine'] });
    queryClient.invalidateQueries({ queryKey: ['lt-queue'] });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Leave & Travel</div>
        <div className="page-sub">Submit and track your own leave and travel requests</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="My leave balance" value={`${leaveBalance} days`} accent="forest" />
        <KpiCard label="My pending requests" value={leaveMineQ.isLoading ? '…' : myPending} accent="amber" />
        {!isAssocTD && (
          <KpiCard label="Awaiting my approval" value={queueQ.isLoading ? '…' : awaitingCount} accent="rust" />
        )}
        <KpiCard label="Travel this quarter" value={travelMineQ.isLoading ? '…' : `${travelQuarter} trips`} accent="blueprint" />
      </div>
      <Tabs
        tabs={[
          { key: 'leave', label: 'Leave request' },
          { key: 'travel', label: 'Travel request' },
          { key: 'allowance', label: 'LA / Cab / Other requests' },
          ...(!isAssocTD ? [{ key: 'approvals', label: 'Approvals' }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'leave' && (
        <LeaveTab
          mine={leaveMine}
          loading={leaveMineQ.isLoading}
          error={leaveMineQ.error}
          holidays={holidaysQ.data?.items ?? []}
          employee={selfEmployee}
          onDone={invalidateAll}
        />
      )}
      {tab === 'travel' && (
        <TravelTab mine={travelMine} loading={travelMineQ.isLoading} error={travelMineQ.error} projects={projects} onDone={invalidateAll} />
      )}
      {tab === 'allowance' && (
        <AllowanceTab mine={allowMine} loading={allowMineQ.isLoading} error={allowMineQ.error} projects={projects} onDone={invalidateAll} />
      )}
      {tab === 'approvals' && !isAssocTD && (
        <ApprovalsTab
          queue={filteredQueue}
          loading={queueQ.isLoading}
          error={queueQ.error}
          roleKey={roleKey}
          meName={meQ.data?.user?.name ?? ''}
          onDone={invalidateAll}
        />
      )}
    </>
  );
}

function LeaveTab({ mine, loading, error, holidays, employee, onDone }) {
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState('Casual leave');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: (body) => leaveApi.create(body),
    onSuccess: () => {
      onDone();
      setFrom('');
      setTo('');
      setReason('');
      setErr('');
      queryClient.invalidateQueries({ queryKey: ['leave-mine'] });
    },
    onError: (e) => setErr(e.message),
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    if (!from || !to) {
      setErr('From and To dates are required.');
      return;
    }
    create.mutate({ leaveType, from, to, reason: reason || undefined });
  }

  const empName = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || employee?.empId || '';

  return (
    <>
      <Panel title="New leave request">
        <form onSubmit={submit}>
          <div className="field-grid">
            {empName && (
              <div className="form-row"><label className="form-label">Employee</label><div style={{ fontSize: 13.5 }}>{empName}{employee?.designation ? ` · ${employee.designation}` : ''}</div></div>
            )}
            {employee?.reportingManager && (
              <div className="form-row"><label className="form-label">Reporting manager / PTL</label><div style={{ fontSize: 13.5 }}>{employee.reportingManager}</div></div>
            )}
            <div className="form-row">
              <label className="form-label">Leave type</label>
              <select className="filter-select" style={{ width: '100%' }} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">From date</label>
              <input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">To date</label>
              <input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Reason</label>
            <textarea className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for leave" />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit leave request'}
          </button>
        </form>
      </Panel>
      <Panel title="My leave history">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'leaveType', label: 'Type' },
              { key: 'from', label: 'From', render: (r) => fmtDate(r.from) },
              { key: 'to', label: 'To', render: (r) => fmtDate(r.to) },
              { key: 'days', label: 'Days', render: (r) => r.days ?? '—' },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'approver', label: 'Approver', render: (r) => r.decidedBy?.name ?? r.decidedBy?.email ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={mine}
            emptyText="No leave requests yet."
          />
        )}
      </Panel>
      <Panel title="Holidays">
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'name', label: 'Holiday', render: (r) => r.name ?? '—' },
          ]}
          rows={holidays}
          emptyText="No holidays published."
        />
      </Panel>
    </>
  );
}

function TravelTab({ mine, loading, error, projects, onDone }) {
  const [purpose, setPurpose] = useState('');
  const [project, setProject] = useState('');
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [mode, setMode] = useState('');
  const [estExpense, setEstExpense] = useState('');
  const [advanceRequested, setAdvanceRequested] = useState('');
  const [err, setErr] = useState('');
  const [settleId, setSettleId] = useState(null);
  const [settleResult, setSettleResult] = useState(null);

  const create = useMutation({
    mutationFn: (body) => travelApi.create(body),
    onSuccess: () => {
      onDone();
      setPurpose('');
      setProject('');
      setFromCity('');
      setToCity('');
      setDepartureDate('');
      setReturnDate('');
      setMode('');
      setEstExpense('');
      setAdvanceRequested('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    create.mutate({
      purpose: purpose || undefined,
      project: project || undefined,
      fromCity: fromCity || undefined,
      toCity: toCity || undefined,
      departureDate: departureDate || undefined,
      returnDate: returnDate || undefined,
      mode: mode || undefined,
      estExpense: estExpense === '' ? undefined : Number(estExpense),
      advanceRequested: advanceRequested === '' ? undefined : Number(advanceRequested),
    });
  }

  return (
    <>
      <Panel title="New travel request">
        <form onSubmit={submit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Purpose</label><input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Site visit" /></div>
            <div className="form-row"><label className="form-label">From city</label><input className="form-input" value={fromCity} onChange={(e) => setFromCity(e.target.value)} placeholder="Departure city" /></div>
            <div className="form-row"><label className="form-label">To city</label><input className="form-input" value={toCity} onChange={(e) => setToCity(e.target.value)} placeholder="Destination city" /></div>
            <div className="form-row"><label className="form-label">Departure date</label><input className="form-input" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Return date</label><input className="form-input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
            <div className="form-row">
              <label className="form-label">Mode</label>
              <select className="filter-select" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">Select mode</option>
                {TRAVEL_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Estimated expense (₹)</label><input className="form-input" type="number" min="0" value={estExpense} onChange={(e) => setEstExpense(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Advance amount requested (₹)</label><input className="form-input" type="number" min="0" value={advanceRequested} onChange={(e) => setAdvanceRequested(e.target.value)} /></div>
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit travel request'}
          </button>
        </form>
      </Panel>
      <Panel title="My travel history">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? ''} → ${r.toCity ?? ''}` },
              { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.departureDate)} / ${fmtDate(r.returnDate)}` },
              { key: 'mode', label: 'Mode', render: (r) => r.mode ?? '—' },
              { key: 'advanceRequested', label: 'Advance req.', render: (r) => r.advanceRequested ? `₹${Number(r.advanceRequested).toLocaleString('en-IN')}` : '—' },
              { key: 'advanceReceived', label: 'Advance recd.', render: (r) => r.advanceReceived ? `₹${Number(r.advanceReceived).toLocaleString('en-IN')}` : '—' },
              { key: 'actualExpense', label: 'Actual expense', render: (r) => r.actualExpense ? `₹${Number(r.actualExpense).toLocaleString('en-IN')}` : '—' },
              { key: 'hospitality', label: 'Hospitality (client-arr.)', render: (r) => r.hospitalityAmount ? `₹${Number(r.hospitalityAmount).toLocaleString('en-IN')}` : '—' },
              { key: 'balance', label: 'Balance', render: (r) => (r.balance ?? null) != null ? `₹${Number(r.balance).toLocaleString('en-IN')}` : '—' },
              { key: 'settlement', label: 'Settlement', render: (r) => r.settlementStatus ?? '—' },
              { key: 'settledOn', label: 'Settled on', render: (r) => fmtDate(r.settlementDate) },
              { key: 'approval', label: 'Approval', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              {
                key: 'settle',
                label: 'Actions',
                render: (r) => (
                  <button type="button" className="approve-btn" onClick={() => { setSettleId(r._id ?? r.id); setSettleResult(r.balance != null || r.actualExpense != null ? r : null); }}>
                    Settle
                  </button>
                ),
              },
            ]}
            rows={mine}
            emptyText="No travel requests yet."
          />
        )}
      </Panel>
      {settleId && (
        <SettleModal
          travelId={settleId}
          initialResult={settleResult}
          trips={mine}
          onClose={() => { setSettleId(null); setSettleResult(null); }}
          onDone={onDone}
        />
      )}
    </>
  );
}

const SETTLE_LINES = [
  { key: 'fare', label: 'Travel fare' },
  { key: 'lodgingAmount', label: 'Lodging' },
  { key: 'foodPerDiem', label: 'Food & per diem' },
  { key: 'localConveyance', label: 'Local conveyance' },
  { key: 'misc', label: 'Miscellaneous' },
];
const SETTLE_STATUSES = ['Settled', 'Pending'];

function SettleModal({ travelId, initialResult, trips, onClose, onDone }) {
  const [tripId, setTripId] = useState(travelId);
  const trip = (trips ?? []).find((t) => String(t._id ?? t.id) === String(tripId)) ?? initialResult ?? null;
  const advanceReceived = trip?.advanceReceived != null ? String(trip.advanceReceived) : '';
  const [amounts, setAmounts] = useState({ fare: '', lodgingAmount: '', foodPerDiem: '', localConveyance: '', misc: '' });
  const [ticked, setTicked] = useState([]);
  const [hotel, setHotel] = useState('');
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [nights, setNights] = useState('');
  const [status, setStatus] = useState('Settled');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState('');
  const [result, setResult] = useState(initialResult);

  const settle = useMutation({
    mutationFn: (body) => travelApi.settle(tripId, body),
    onSuccess: (data) => {
      setResult(data?.item ?? data ?? null);
      setErr('');
      onDone();
    },
    onError: (e) => setErr(e.message),
  });

  function setAmount(key, v) {
    setAmounts((p) => ({ ...p, [key]: v }));
  }

  function toggleTick(key) {
    setTicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  function onDate(key, v) {
    if (key === 'in') setCheckIn(v);
    else setCheckOut(v);
    const a = key === 'in' ? v : checkIn;
    const b = key === 'out' ? v : checkOut;
    if (a && b) {
      const n = Math.round((new Date(b) - new Date(a)) / 86400000);
      setNights(Number.isFinite(n) && n >= 0 ? String(n) : '');
    }
  }

  const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
  const untickedTotal = SETTLE_LINES.filter((l) => !ticked.includes(l.key)).reduce((s, l) => s + num(amounts[l.key]), 0);
  const tickedTotal = SETTLE_LINES.filter((l) => ticked.includes(l.key)).reduce((s, l) => s + num(amounts[l.key]), 0);
  const previewBalance = num(advanceReceived) - untickedTotal;

  function submit(e) {
    e.preventDefault();
    setErr('');
    const body = {
      advanceReceived: advanceReceived === '' ? undefined : Number(advanceReceived),
      fare: amounts.fare === '' ? undefined : Number(amounts.fare),
      lodging: {
        hotel: hotel || undefined,
        location: location || undefined,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        nights: nights === '' ? undefined : Number(nights),
      },
      lodgingAmount: amounts.lodgingAmount === '' ? undefined : Number(amounts.lodgingAmount),
      foodPerDiem: amounts.foodPerDiem === '' ? undefined : Number(amounts.foodPerDiem),
      localConveyance: amounts.localConveyance === '' ? undefined : Number(amounts.localConveyance),
      misc: amounts.misc === '' ? undefined : Number(amounts.misc),
      hospitalityLines: ticked,
      settlementStatus: status || undefined,
      settlementDate: settlementDate || undefined,
    };
    settle.mutate(body);
  }

  return (
    <Modal title="Settle travel expense" onClose={onClose} wide>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
        Complete this once the trip is done, to reconcile advance vs. actual spend
      </p>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Trip to settle</label>
            <select className="filter-select" style={{ width: '100%' }} value={tripId ?? ''} onChange={(e) => setTripId(e.target.value)}>
              <option value="">Select a trip…</option>
              {(trips ?? []).map((t) => (
                <option key={String(t._id ?? t.id)} value={String(t._id ?? t.id)}>
                  {t.purpose ?? `${t.fromCity ?? ''} → ${t.toCity ?? ''}`} · {fmtDate(t.departureDate)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">Advance amount received?</label><div style={{ fontSize: 13.5 }}>{trip?.advanceReceived ? `₹${Number(trip.advanceReceived).toLocaleString('en-IN')}` : 'No'}</div></div>
        </div>
        <div className="section-label">Expense split</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Hospitality (hotel, food, travel/transport) arranged directly by the client? Tick “Client arranged” on that line — it will be excluded from your reimbursement, but still recorded separately for reporting.
        </p>
        <div className="field-grid">
          {SETTLE_LINES.map((l) => (
            <div className="form-row" key={l.key}>
              <label className="form-label">{l.label} (₹)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="form-input" type="number" min="0" value={amounts[l.key]} onChange={(e) => setAmount(l.key, e.target.value)} style={{ flex: 1 }} />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={ticked.includes(l.key)} onChange={() => toggleTick(l.key)} />
                  Client arranged
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="section-label">Accommodation details (optional — fill in if a hotel stay was involved)</div>
        <div className="field-grid">
          <div className="form-row"><label className="form-label">Hotel name</label><input className="form-input" value={hotel} onChange={(e) => setHotel(e.target.value)} placeholder="e.g. ITC Grand Chola, Chennai" /></div>
          <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state" /></div>
          <div className="form-row"><label className="form-label">Check-in</label><input className="form-input" type="datetime-local" value={checkIn} onChange={(e) => onDate('in', e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Check-out</label><input className="form-input" type="datetime-local" value={checkOut} onChange={(e) => onDate('out', e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Nights</label><input className="form-input" type="number" min="0" value={nights} onChange={(e) => setNights(e.target.value)} /></div>
        </div>
        <div className="field-grid">
          <div className="form-row"><label className="form-label">Actual expense (reimbursable)</label><div style={{ fontSize: 13.5 }} className="mono">₹{untickedTotal.toLocaleString('en-IN')}</div></div>
          <div className="form-row"><label className="form-label">Hospitality (client-arranged)</label><div style={{ fontSize: 13.5 }} className="mono">₹{tickedTotal.toLocaleString('en-IN')}</div></div>
          <div className="form-row"><label className="form-label">Balance</label><div style={{ fontSize: 13.5 }} className="mono">₹{previewBalance.toLocaleString('en-IN')}</div></div>
          <div className="form-row"><label className="form-label">Settlement status</label>
            <select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              {SETTLE_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">Settlement date</label><input className="form-input" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} /></div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {result && (
          <p style={{ fontSize: 13.5 }}>
            Actual expense: <b className="mono">{result.actualExpense ?? result?.item?.actualExpense ?? '—'}</b>
            {' '}· Balance: <b className="mono">{result.balance ?? result?.item?.balance ?? '—'}</b>
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={settle.isPending || !tripId}>
          {settle.isPending ? 'Saving…' : 'Save settlement'}
        </button>
      </form>
    </Modal>
  );
}

function ApprovalsTab({ queue, loading, error, roleKey, meName, onDone }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState({});
  const [err, setErr] = useState('');

  const decidedQ = useQuery({ queryKey: ['leave-decided'], queryFn: () => leaveApi.list({}) });

  function setRemark(id, v) {
    setRemarks((p) => ({ ...p, [id]: v }));
  }

  async function decide(kind, id, status) {
    setErr('');
    const remark = (remarks[id] ?? '').trim() || undefined;
    try {
      if (kind === 'leave') await leaveApi.decide(id, { status, remarks: remark });
      else if (kind === 'travel') await travelApi.decide(id, { status, remarks: remark });
      else await allowanceApi.decide(id, { status, remarks: remark });
      onDone();
      queryClient.invalidateQueries({ queryKey: ['leave-decided'] });
      setRemarks((p) => ({ ...p, [id]: '' }));
    } catch (e) {
      setErr(e.message);
    }
  }

  function decideButtons(kind, r) {
    const id = String(r._id ?? r.id);
    return (
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ minWidth: 140 }}
          value={remarks[id] ?? ''}
          onChange={(e) => setRemark(id, e.target.value)}
          placeholder="Remarks (required to reject leave)"
        />
        <button type="button" className="approve-btn" onClick={() => decide(kind, id, 'Approved')}>Approve</button>
        <button type="button" className="approve-btn" onClick={() => decide(kind, id, 'Rejected')}>Reject</button>
      </span>
    );
  }

  const empNameOf = (e) => (e && typeof e === 'object'
    ? [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—'
    : '—');

  const decisions = useMemo(() => arr(decidedQ.data?.items ?? decidedQ.data)
    .filter((r) => String(r.status ?? '').toLowerCase() !== 'pending')
    .sort((a, b) => String(b.decidedAt ?? b.updatedAt ?? '').localeCompare(String(a.decidedAt ?? a.updatedAt ?? '')))
    .slice(0, 50), [decidedQ.data]);

  const scopeSub = ['hr', 'finance', 'admin_billing', 'admin'].includes(roleKey) || SUPER_ROLES.includes(roleKey)
    ? 'All employees'
    : `Employees in scope for ${meName || 'you'}`;

  return (
    <>
      <Panel title="Leave approvals" sub={scopeSub}>
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : queue.leave.length === 0 ? (
          <EmptyState text="Nothing pending." />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empNameOf(r.employee) },
              { key: 'leaveType', label: 'Type' },
              { key: 'from', label: 'From', render: (r) => fmtDate(r.from) },
              { key: 'to', label: 'To', render: (r) => fmtDate(r.to) },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'decide', label: '', render: (r) => decideButtons('leave', r) },
            ]}
            rows={queue.leave}
            emptyText="Nothing pending."
          />
        )}
      </Panel>
      <Panel title="Travel approvals">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : queue.travel.length === 0 ? (
          <EmptyState text="Nothing pending." />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empNameOf(r.employee) },
              { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? ''} → ${r.toCity ?? ''}` },
              { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.departureDate)} / ${fmtDate(r.returnDate)}` },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'decide', label: '', render: (r) => decideButtons('travel', r) },
            ]}
            rows={queue.travel}
            emptyText="Nothing pending."
          />
        )}
      </Panel>
      <Panel title="LA / Cab / Other approvals">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : queue.allowance.length === 0 ? (
          <EmptyState text="Nothing pending." />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empNameOf(r.employee) },
              { key: 'reqType', label: 'Type' },
              { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'decide', label: '', render: (r) => decideButtons('allowance', r) },
            ]}
            rows={queue.allowance}
            emptyText="Nothing pending."
          />
        )}
      </Panel>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <Panel title="Recent leave decisions" sub="Every approval and rejection across the organisation, with remarks where rejected">
        {decidedQ.isLoading ? <EmptyState text="Loading…" /> : decidedQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{decidedQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empNameOf(r.employee) },
              { key: 'role', label: 'Role', render: (r) => r.employee?.designation ?? '—' },
              { key: 'leaveType', label: 'Leave type' },
              { key: 'status', label: 'Decision', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
              { key: 'decidedBy', label: 'Decided by', render: (r) => r.decidedBy?.name ?? r.decidedBy?.email ?? '—' },
              { key: 'decidedAt', label: 'Date', render: (r) => fmtDate(r.decidedAt) },
            ]}
            rows={decisions}
            emptyText="No decisions recorded yet."
          />
        )}
      </Panel>
    </>
  );
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function AllowanceTab({ mine, loading, error, projects, onDone }) {
  const [reqType, setReqType] = useState('LA');
  const [date, setDate] = useState('');
  const [project, setProject] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [purpose, setPurpose] = useState('');
  const [billFile, setBillFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function resetForm() {
    setDate('');
    setProject('');
    setAmount('');
    setDays('');
    setPurpose('');
    setBillFile(null);
  }

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

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const created = await allowanceApi.create({
        reqType,
        date: date || undefined,
        project: project || undefined,
        amount: amount === '' ? undefined : Number(amount),
        days: days === '' ? undefined : Number(days),
        purpose: purpose || undefined,
      });
      const id = created?.item?._id ?? created?.item?.id;
      if (billFile && id) {
        await docsApi.allowanceBill(id, billFile);
      }
      onDone();
      resetForm();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="New request" sub="Local Allowance, cab booking or any other travel-related expense, with the bill attached">
        <form onSubmit={submit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Request type</label>
              <select className="filter-select" style={{ width: '100%' }} value={reqType} onChange={(e) => setReqType(e.target.value)}>
                <option value="LA">Local Allowance</option>
                <option value="Cab">Cab booking</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Amount (₹)</label><input className="form-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">No. of days</label><input className="form-input" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 1" /></div>
          </div>
          <div className="form-row"><label className="form-label">Purpose / remarks</label><input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Brief purpose for this expense" /></div>
          <div className="form-row"><label className="form-label">Bill / invoice attachment</label><input type="file" onChange={(e) => setBillFile(e.target.files?.[0] ?? null)} /></div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </Panel>
      <Panel title="My LA / Cab / Other requests">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'reqType', label: 'Type', render: (r) => reqTypeLabel(r.reqType) },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'details', label: 'Details', render: (r) => reqDetails(r) },
              { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
              { key: 'bill', label: 'Bill', render: (r) => (r.bill ? <a href={fileUrl(r.bill)} download>Download</a> : 'No bill') },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
              { key: 'submitted', label: 'Submitted', render: (r) => fmtDate(r.createdAt) },
            ]}
            rows={mine}
            emptyText="No requests submitted yet."
          />
        )}
      </Panel>
    </>
  );
}
