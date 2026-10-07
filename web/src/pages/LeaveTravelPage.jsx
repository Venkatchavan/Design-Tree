import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { SUPER_ROLES } from '../lib/session.js';
import { allowanceApi, holidaysApi, leaveApi, travelApi } from '../lib/phase4bApi.js';
import { docsApi, fileUrl } from '../lib/docsApi.js';
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
function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
}
function empIdOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}
function isPending(s) {
  return String(s ?? '').toLowerCase() === 'pending';
}
function isDecided(s) {
  const t = String(s ?? '').toLowerCase();
  return ['approved', 'rejected', 'cancelled', 'canceled'].includes(t);
}
function quarterStart() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), q, 1);
}

const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid', 'Other'];
const TRAVEL_MODES = ['Train', 'Flight', 'Bus', 'Car', 'Other'];
const REQ_TYPES = ['LA', 'Cab', 'Other'];

export default function LeaveTravelPage({ bootstrap, user, viewKey }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('leave');
  const roleKey = bootstrap?.role?.key ?? '';

  // --- queries ---
  const leaveMineQ = useQuery({ queryKey: ['leave-mine'], queryFn: leaveApi.mine });
  const travelMineQ = useQuery({ queryKey: ['travel-mine'], queryFn: travelApi.mine });
  const allowMineQ = useQuery({ queryKey: ['allowance-mine'], queryFn: allowanceApi.mine });
  const queueQ = useQuery({ queryKey: ['lt-queue'], queryFn: leaveApi.queue });
  const scopeQ = useQuery({ queryKey: ['lt-scope'], queryFn: leaveApi.scopeIds });
  const leaveListQ = useQuery({ queryKey: ['leave-list'], queryFn: () => leaveApi.list({}) });
  const travelListQ = useQuery({ queryKey: ['travel-list'], queryFn: () => travelApi.list({}) });
  const allowListQ = useQuery({ queryKey: ['allowance-list'], queryFn: () => allowanceApi.list({}) });
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
    () => leaveMine.filter((r) => isPending(r.status)).length,
    [leaveMine],
  );
  const travelQuarter = useMemo(() => {
    const qs = quarterStart();
    return travelMine.filter((t) => {
      const d = t.departureDate ?? t.fromDate ?? t.date ?? t.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      return !Number.isNaN(dt.getTime()) && dt >= qs;
    }).length;
  }, [travelMine]);

  const recentDecisions = useMemo(() => {
    const all = [
      ...(leaveListQ.data?.items ?? []).filter((r) => isDecided(r.status)).map((r) => ({ kind: 'Leave', ...r })),
      ...(travelListQ.data?.items ?? []).filter((r) => isDecided(r.status)).map((r) => ({ kind: 'Travel', ...r })),
      ...(allowListQ.data?.items ?? []).filter((r) => isDecided(r.status)).map((r) => ({ kind: 'LA/Cab', ...r })),
    ];
    return all.slice(0, 20);
  }, [leaveListQ.data, travelListQ.data, allowListQ.data]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['leave-mine'] });
    queryClient.invalidateQueries({ queryKey: ['travel-mine'] });
    queryClient.invalidateQueries({ queryKey: ['allowance-mine'] });
    queryClient.invalidateQueries({ queryKey: ['lt-queue'] });
    queryClient.invalidateQueries({ queryKey: ['leave-list'] });
    queryClient.invalidateQueries({ queryKey: ['travel-list'] });
    queryClient.invalidateQueries({ queryKey: ['allowance-list'] });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Leave & travel</div>
        <div className="page-sub">Requests, settlements and approvals — live from the leave-travel API.</div>
      </div>
      <div className="kpi-grid">
        <KpiCard label="My pending leave" value={leaveMineQ.isLoading ? '…' : myPending} accent="amber" />
        <KpiCard label="Awaiting my approval" value={queueQ.isLoading ? '…' : awaitingCount} accent="rust" />
        <KpiCard label="Travel this quarter" value={travelMineQ.isLoading ? '…' : travelQuarter} accent="blueprint" />
        <KpiCard label="Leave balance" value="Per request" accent="neutral">
        </KpiCard>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: '0 0 12px' }}>
        Leave balance is tracked per request — no repository balance is maintained; each request shows auto-computed days.
      </p>
      <Tabs
        tabs={[
          { key: 'leave', label: 'Leave request' },
          { key: 'travel', label: 'Travel request' },
          { key: 'allowance', label: 'LA / Cab / Other' },
          { key: 'approvals', label: 'Approvals' },
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
          onDone={invalidateAll}
        />
      )}
      {tab === 'travel' && (
        <TravelTab mine={travelMine} loading={travelMineQ.isLoading} error={travelMineQ.error} projects={projects} onDone={invalidateAll} />
      )}
      {tab === 'allowance' && (
        <AllowanceTab mine={allowMine} loading={allowMineQ.isLoading} error={allowMineQ.error} projects={projects} onDone={invalidateAll} />
      )}
      {tab === 'approvals' && (
        <ApprovalsTab
          queue={filteredQueue}
          queueError={queueQ.error}
          queueLoading={queueQ.isLoading}
          recent={recentDecisions}
          onDone={invalidateAll}
        />
      )}
    </>
  );
}

function LeaveTab({ mine, loading, error, holidays, onDone }) {
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState('Casual');
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

  return (
    <>
      <Panel title="New leave request (employee auto-resolved)">
        <form onSubmit={submit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Leave type</label>
              <select className="filter-select" style={{ width: '100%' }} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Reason</label>
            <textarea className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit leave'}
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
              { key: 'days', label: 'Days (auto)' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? r.decisionRemarks ?? '—' },
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
            <div className="form-row"><label className="form-label">Purpose</label><input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">From city</label><input className="form-input" value={fromCity} onChange={(e) => setFromCity(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">To city</label><input className="form-input" value={toCity} onChange={(e) => setToCity(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Departure</label><input className="form-input" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Return</label><input className="form-input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
            <div className="form-row">
              <label className="form-label">Mode</label>
              <select className="filter-select" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">Select mode</option>
                {TRAVEL_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Est. expense</label><input className="form-input" type="number" min="0" value={estExpense} onChange={(e) => setEstExpense(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Advance requested</label><input className="form-input" type="number" min="0" value={advanceRequested} onChange={(e) => setAdvanceRequested(e.target.value)} /></div>
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit travel'}
          </button>
        </form>
      </Panel>
      <Panel title="My travel history">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? ''} → ${r.toCity ?? ''}` },
              { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.departureDate)} / ${fmtDate(r.returnDate)}` },
              { key: 'estExpense', label: 'Est.', render: (r) => r.estExpense ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              {
                key: 'settle',
                label: 'Settle',
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
          onClose={() => { setSettleId(null); setSettleResult(null); }}
          onDone={onDone}
        />
      )}
    </>
  );
}

function SettleModal({ travelId, initialResult, onClose, onDone }) {
  const [advanceReceived, setAdvanceReceived] = useState('');
  const [fare, setFare] = useState('');
  const [hotel, setHotel] = useState('');
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [nights, setNights] = useState('');
  const [foodPerDiem, setFoodPerDiem] = useState('');
  const [localConveyance, setLocalConveyance] = useState('');
  const [misc, setMisc] = useState('');
  const [hospitality, setHospitality] = useState('');
  const [err, setErr] = useState('');
  const [result, setResult] = useState(initialResult);

  const settle = useMutation({
    mutationFn: (body) => travelApi.settle(travelId, body),
    onSuccess: (data) => {
      setResult(data?.item ?? data ?? null);
      setErr('');
      onDone();
    },
    onError: (e) => setErr(e.message),
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    const num = (v) => (v === '' ? undefined : Number(v));
    settle.mutate({
      advanceReceived: num(advanceReceived),
      fare: num(fare),
      lodging: {
        hotel: hotel || undefined,
        location: location || undefined,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        nights: nights === '' ? undefined : Number(nights),
      },
      foodPerDiem: num(foodPerDiem),
      localConveyance: num(localConveyance),
      misc: num(misc),
      hospitality: num(hospitality),
    });
  }

  return (
    <Modal title="Travel settlement (own trip)" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row"><label className="form-label">Advance received</label><input className="form-input" type="number" min="0" value={advanceReceived} onChange={(e) => setAdvanceReceived(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Fare</label><input className="form-input" type="number" min="0" value={fare} onChange={(e) => setFare(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Hotel</label><input className="form-input" value={hotel} onChange={(e) => setHotel(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Check-in</label><input className="form-input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Check-out</label><input className="form-input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Nights</label><input className="form-input" type="number" min="0" value={nights} onChange={(e) => setNights(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Food per diem</label><input className="form-input" type="number" min="0" value={foodPerDiem} onChange={(e) => setFoodPerDiem(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Local conveyance</label><input className="form-input" type="number" min="0" value={localConveyance} onChange={(e) => setLocalConveyance(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Misc</label><input className="form-input" type="number" min="0" value={misc} onChange={(e) => setMisc(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Hospitality</label><input className="form-input" type="number" min="0" value={hospitality} onChange={(e) => setHospitality(e.target.value)} /></div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {result && (
          <p style={{ fontSize: 13.5 }}>
            Actual expense: <b className="mono">{result.actualExpense ?? result?.item?.actualExpense ?? '—'}</b>
            {' '}· Balance: <b className="mono">{result.balance ?? result?.item?.balance ?? '—'}</b>
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={settle.isPending}>
          {settle.isPending ? 'Settling…' : 'Submit settlement'}
        </button>
      </form>
    </Modal>
  );
}

function AllowanceTab({ mine, loading, error, projects, onDone }) {
  const [reqType, setReqType] = useState('LA');
  const [date, setDate] = useState('');
  const [project, setProject] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [route, setRoute] = useState('');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [passengers, setPassengers] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [billFile, setBillFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function resetForm() {
    setDate('');
    setProject('');
    setAmount('');
    setDays('');
    setRoute('');
    setPickup('');
    setDrop('');
    setMeetingTime('');
    setVehicle('');
    setPassengers('');
    setDescription('');
    setPurpose('');
    setBillFile(null);
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
        route: route || undefined,
        pickup: pickup || undefined,
        drop: drop || undefined,
        meetingTime: meetingTime || undefined,
        vehicle: vehicle || undefined,
        passengers: passengers === '' ? undefined : Number(passengers),
        description: description || undefined,
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
      <Panel title="New LA / Cab / Other request">
        <form onSubmit={submit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Type</label>
              <select className="filter-select" style={{ width: '100%' }} value={reqType} onChange={(e) => setReqType(e.target.value)}>
                {REQ_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Amount</label><input className="form-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Days</label><input className="form-input" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Route</label><input className="form-input" value={route} onChange={(e) => setRoute(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Pickup</label><input className="form-input" value={pickup} onChange={(e) => setPickup(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Drop</label><input className="form-input" value={drop} onChange={(e) => setDrop(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Meeting time</label><input className="form-input" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Vehicle</label><input className="form-input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Passengers</label><input className="form-input" type="number" min="0" value={passengers} onChange={(e) => setPassengers(e.target.value)} /></div>
          </div>
          <div className="form-row"><label className="form-label">Description</label><input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Purpose</label><input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Bill / invoice (attachment)</label><input type="file" onChange={(e) => setBillFile(e.target.files?.[0] ?? null)} /></div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </Panel>
      <Panel title="My LA / Cab / Other history">
        {loading ? <EmptyState text="Loading…" /> : error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'reqType', label: 'Type' },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'amount', label: 'Amount' },
              { key: 'bill', label: 'Bill', render: (r) => (r.bill ? <a href={fileUrl(r.bill)} download>Download</a> : '—') },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={mine}
            emptyText="No allowance requests yet."
          />
        )}
      </Panel>
    </>
  );
}

function ApprovalsTab({ queue, queueLoading, queueError, recent, onDone }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState({});

  const decideLeave = useMutation({
    mutationFn: ({ id, body }) => leaveApi.decide(id, body),
    onSuccess: () => { onDone(); queryClient.invalidateQueries({ queryKey: ['lt-queue'] }); },
  });
  const decideTravel = useMutation({
    mutationFn: ({ id, body }) => travelApi.decide(id, body),
    onSuccess: () => { onDone(); queryClient.invalidateQueries({ queryKey: ['lt-queue'] }); },
  });
  const decideAllow = useMutation({
    mutationFn: ({ id, body }) => allowanceApi.decide(id, body),
    onSuccess: () => { onDone(); queryClient.invalidateQueries({ queryKey: ['lt-queue'] }); },
  });

  function remarkFor(id) {
    return remarks[id] ?? '';
  }

  function decideRow(kind, id, status) {
    const body = { status, remarks: remarkFor(id) || undefined };
    if (kind === 'leave') decideLeave.mutate({ id, body });
    else if (kind === 'travel') decideTravel.mutate({ id, body });
    else decideAllow.mutate({ id, body });
  }

  function approvalTable(kind, rows, labelCols) {
    if (rows.length === 0) return <EmptyState text={`No pending ${labelCols} approvals.`} />;
    return (
      <DataTable
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
          ...labelCols,
          { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
          {
            key: 'remarks',
            label: 'Remarks',
            render: (r) => {
              const id = String(r._id ?? r.id);
              return (
                <input
                  className="form-input"
                  placeholder="Remarks"
                  value={remarkFor(id)}
                  onChange={(e) => setRemarks((p) => ({ ...p, [id]: e.target.value }))}
                />
              );
            },
          },
          {
            key: 'actions',
            label: 'Decision',
            render: (r) => {
              const id = String(r._id ?? r.id);
              return (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="approve-btn" onClick={() => decideRow(kind, id, 'Approved')}>Approve</button>
                  <button type="button" className="approve-btn" onClick={() => decideRow(kind, id, 'Rejected')}>Reject</button>
                </span>
              );
            },
          },
        ]}
        rows={rows}
        emptyText="No pending approvals."
      />
    );
  }

  return (
    <>
      <Panel title="Pending approvals (scope-filtered)">
        {queueLoading ? <EmptyState text="Loading…" /> : queueError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{queueError.message}</div>
        ) : (
          <>
            <div className="section-label">Leave ({queue.leave.length})</div>
            {approvalTable('leave', queue.leave, [
              { key: 'leaveType', label: 'Type' },
              { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.from)} → ${fmtDate(r.to)}${r.days != null ? ` (${r.days}d)` : ''}` },
            ])}
            <div className="section-label" style={{ marginTop: 16 }}>Travel ({queue.travel.length})</div>
            {approvalTable('travel', queue.travel, [
              { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? ''} → ${r.toCity ?? ''}` },
              { key: 'estExpense', label: 'Est.' },
            ])}
            <div className="section-label" style={{ marginTop: 16 }}>LA / Cab / Other ({queue.allowance.length})</div>
            {approvalTable('allowance', queue.allowance, [
              { key: 'reqType', label: 'Type' },
              { key: 'amount', label: 'Amount' },
            ])}
            {(decideLeave.isError || decideTravel.isError || decideAllow.isError) && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {(decideLeave.error ?? decideTravel.error ?? decideAllow.error)?.message}
              </div>
            )}
          </>
        )}
      </Panel>
      <Panel title="Recent decisions">
        <DataTable
          columns={[
            { key: 'kind', label: 'Kind' },
            { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
            { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? r.decisionRemarks ?? '—' },
          ]}
          rows={recent}
          emptyText="No recent decisions."
        />
      </Panel>
      <Panel title="Team browser (approver scope)">
        <ScopeBrowser />
      </Panel>
    </>
  );
}

function ScopeBrowser() {
  const [search, setSearch] = useState('');
  const empQ = useQuery({
    queryKey: ['employees-scope', search],
    queryFn: () => employeesApi.list({ search }),
    enabled: search.trim().length > 0,
  });
  return (
    <>
      <div className="form-row" style={{ maxWidth: 360 }}>
        <label className="form-label">Search employees</label>
        <input className="form-input" placeholder="Type a name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {(empQ.data?.items ?? []).length > 0 ? (
        <DataTable
          columns={[
            { key: 'name', label: 'Employee', render: empName },
            { key: 'empId', label: 'Emp ID' },
            { key: 'designation', label: 'Designation' },
          ]}
          rows={empQ.data.items}
          emptyText="No matches."
        />
      ) : (
        <EmptyState text={search ? 'No matches.' : 'Type to search the directory for scope reference.'} />
      )}
    </>
  );
}
