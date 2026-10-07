import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi, projectsApi, request, toQuery } from '../lib/api.js';
import { spocApi } from '../lib/spocApi.js';
import {
  SUPER_ROLES,
  isPendingLogout,
  performLogout,
  takePendingLogout,
} from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import { MAN_HOUR_NOTE } from '../components/SignOutButton.jsx';
import { meetingsApi } from '../lib/phase4bApi.js';
import {
  MeetingDetailModal,
  ScheduleMeetingModal,
  empName as mtgEmpName,
  fmtDate as mtgFmtDate,
  idOf as mtgIdOf,
  isOverdueAction,
  projLabel as mtgProjLabel,
} from '../components/MeetingsCommon.jsx';

const SERVICES = [
  'Structure',
  'Architecture',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'BIM',
  'Other',
];

const AREA_KEYS = [
  'Project Directory',
  'Meetings',
  'Meeting Scheduling & Coordination',
  'Drawings Sharing / Issuing',
  'RFI',
  'Architectural Updates',
  'Client Updates',
  'Revision Status',
  'Project Status',
  'Other',
];

const REVISION_STATUSES = [
  'Addressed',
  'In Progress',
  'Pending',
  'Awaiting Client',
  'Awaiting Architect',
  'Awaiting Internal Team',
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return (
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    e.empId ||
    e.email ||
    '—'
  );
}

function allocProjectId(a) {
  const p = a?.project;
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p._id ?? p.id ?? null;
}

function allocProjectLabel(a) {
  const p = a?.project;
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}

function PendingLogoutCallout() {
  if (!isPendingLogout()) return null;
  return (
    <div className="login-error" role="alert" style={{ display: 'block' }}>
      {MAN_HOUR_NOTE} Save today&apos;s entry to complete sign-out.
    </div>
  );
}

function OverviewTab({ myAllocs, activeProjects, activeLoading }) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? allocProjectId(myAllocs[0]) ?? null;

  const detail = useQuery({
    queryKey: ['project', effectiveId],
    queryFn: () => projectsApi.get(effectiveId),
    enabled: !!effectiveId,
  });
  const revisions = useQuery({
    queryKey: ['work-revisions-open'],
    queryFn: () => request(`/api/work/revisions${toQuery({ status: 'Open' })}`),
  });
  const meetingsQ = useQuery({
    queryKey: ['meetings-week'],
    queryFn: () => meetingsApi.list({}),
  });
  const weekMeetings = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return (meetingsQ.data?.items ?? []).filter((m) => {
      if (m.status === 'Cancelled') return false;
      if (myIds.size > 0) {
        const pid = String(m.project?._id ?? m.project ?? '');
        if (!myIds.has(pid)) return false;
      }
      const d = m.date ? new Date(m.date) : null;
      return d && d >= start && d < end;
    });
  }, [meetingsQ.data, myIds]);

  const revItems = revisions.data?.items ?? [];
  const myRevisions = useMemo(() => {
    if (myIds.size === 0) return [];
    return revItems.filter((r) => {
      const pid =
        r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId ?? null;
      return pid != null && myIds.has(String(pid));
    });
  }, [revItems, myIds]);

  const overdue = useMemo(() => {
    const now = Date.now();
    return myRevisions.filter((r) => {
      const d = r?.due ?? r?.dueDate ?? r?.targetDate ?? null;
      return d != null && Number.isNaN(Date.parse(d)) === false && Date.parse(d) < now;
    });
  }, [myRevisions]);

  const proj = detail.data?.item ?? detail.data?.project ?? detail.data ?? {};
  const team = proj?.team ?? proj?.members ?? proj?.assignedTeam ?? null;
  const teamText = Array.isArray(team)
    ? team.map((m) => (typeof m === 'string' ? m : (m?.name ?? empName(m)))).join(', ')
    : (team?.name ?? team ?? null);

  return (
    <>
      <div className="kpi-grid cols-5">
        <KpiCard label="My projects" value={myAllocs.length} accent="blueprint" />
        <KpiCard label="Open revisions" value={myRevisions.length} accent="amber" />
        <KpiCard label="Overdue revisions" value={overdue.length} accent="rust" />
        <KpiCard label="Meetings this week" value={meetingsQ.isLoading ? '…' : weekMeetings.length} accent="teal" />
      </div>
      <Panel title="Meetings this week">
        {meetingsQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'title', label: 'Meeting' },
              { key: 'project', label: 'Project', render: (m) => m.project?.name ?? '—' },
              { key: 'date', label: 'Date', render: (m) => (m.date ? String(m.date).slice(0, 10) : '—') },
              { key: 'time', label: 'Time', render: (m) => [m.startTime, m.endTime].filter(Boolean).join('–') || '—' },
              { key: 'status', label: 'Status', render: (m) => <StatusPill status={m.status}>{m.status}</StatusPill> },
            ]}
            rows={weekMeetings}
            emptyText="No meetings scheduled for your projects this week. Schedule one in the Meetings tab."
          />
        )}
      </Panel>

      {myAllocs.length === 0 ? (
        <Panel title="My projects">
          <EmptyState text="No allocations yet. Allocation is recorded in the Project Directory tab." />
          <div className="section-label">All active projects</div>
          {activeLoading ? (
            <EmptyState text="Loading…" />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Project', render: (r) => r.name ?? '—' },
                { key: 'code', label: 'Code' },
                { key: 'branch', label: 'Branch' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill>,
                },
              ]}
              rows={activeProjects}
              emptyText="No active projects."
            />
          )}
        </Panel>
      ) : (
        <>
          <Panel title="My projects">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {myAllocs.map((a, i) => {
                const pid = allocProjectId(a);
                const active = String(pid) === String(effectiveId);
                return (
                  <button
                    key={pid ?? i}
                    type="button"
                    className={`tab-btn${active ? ' active' : ''}`}
                    onClick={() => setSelectedId(pid)}
                  >
                    {allocProjectLabel(a)}
                  </button>
                );
              })}
            </div>
            {detail.isLoading ? (
              <EmptyState text="Loading…" />
            ) : detail.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {detail.error.message}
              </div>
            ) : (
              <div className="field-grid">
                <Field label="Client" value={proj?.clientName ?? proj?.client} />
                <Field label="Stage" value={proj?.currentStage ?? proj?.stage} />
                <Field
                  label="Progress"
                  value={proj?.completion != null ? `${proj.completion}%` : proj?.progress}
                />
                <Field label="Team" value={teamText} />
                <Field label="Status" value={proj?.status} />
                <Field label="Branch" value={proj?.branch} />
              </div>
            )}
          </Panel>
          <Panel title="Alerts">
            {revisions.isLoading ? (
              <EmptyState text="Loading…" />
            ) : revisions.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {revisions.error.message}
              </div>
            ) : myRevisions.length === 0 ? (
              <EmptyState text="No open revisions on your projects." />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Revision', render: (r) => r.title ?? r.refNo ?? r._id ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => <StatusPill tone={statusTone(r.revisionStatus ?? r.status)}>{r.revisionStatus ?? r.status ?? '—'}</StatusPill>,
                  },
                  { key: 'due', label: 'Due', render: (r) => r.due ?? r.dueDate ?? '—' },
                ]}
                rows={myRevisions}
                emptyText="No open revisions on your projects."
              />
            )}
            {overdue.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-danger, #a33)' }}>
                {overdue.length} overdue revision(s) need attention.
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function OtherProjectsTab({ myAllocs, activeProjects, activeLoading }) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const others = useMemo(() => {
    if (myIds.size === 0) return activeProjects;
    return activeProjects.filter((p) => !myIds.has(String(p._id ?? p.id ?? '')));
  }, [activeProjects, myIds]);

  return (
    <Panel title="Other projects (view only)">
      {activeLoading ? (
        <EmptyState text="Loading…" />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Project', render: (r) => r.name ?? '—' },
            { key: 'code', label: 'Code' },
            { key: 'branch', label: 'Branch' },
            { key: 'currentStage', label: 'Stage' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill>,
            },
          ]}
          rows={others}
          emptyText="No other active projects."
        />
      )}
    </Panel>
  );
}

function DirectoryTab() {
  const queryClient = useQueryClient();
  const [err, setErr] = useState('');
  const [project, setProject] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [services, setServices] = useState([]);

  const empQ = useQuery({
    queryKey: ['employees-dir'],
    queryFn: () => employeesApi.list({}),
  });
  const projQ = useQuery({
    queryKey: ['projects', 'active-dir'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const employees = empQ.data?.items ?? [];
  const projects = projQ.data?.items ?? [];

  const byDept = useMemo(() => {
    const m = new Map();
    for (const e of employees) {
      const k = e.department || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [employees]);

  function toggleService(s) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  const save = useMutation({
    mutationFn: (body) => spocApi.recordAllocation(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-allocations-mine'] });
      setProject('');
      setCoordinator('');
      setServices([]);
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!project) {
      setErr('Project is required.');
      return;
    }
    if (!coordinator) {
      setErr('Coordinator is required.');
      return;
    }
    if (services.length === 0) {
      setErr('Select at least one service.');
      return;
    }
    save.mutate({ project, coordinator, services });
  }

  return (
    <>
      <Panel title="In-house team browser">
        {empQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : empQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {empQ.error.message}
          </div>
        ) : byDept.length === 0 ? (
          <EmptyState text="No employees found." />
        ) : (
          byDept.map(([dept, list]) => (
            <div key={dept} style={{ marginBottom: 16 }}>
              <div className="section-label">
                {dept} ({list.length})
              </div>
              <DataTable
                columns={[
                  { key: 'name', label: 'Employee', render: empName },
                  { key: 'empId', label: 'Emp ID', render: (r) => r.empId ?? '—' },
                  { key: 'designation', label: 'Designation' },
                  { key: 'branch', label: 'Branch' },
                ]}
                rows={list}
                emptyText="No employees in this department."
              />
            </div>
          ))
        )}
      </Panel>
      <Panel title="Record allocation">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p._id ?? p.id} value={p._id ?? p.id}>
                    {p.name ?? p.code ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Coordinator</label>
              <select className="filter-select" style={{ width: '100%' }} value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
                <option value="">Select coordinator</option>
                {employees.map((e) => (
                  <option key={e._id ?? e.id} value={e._id ?? e.id}>
                    {empName(e)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label className="form-label">Services</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {SERVICES.map((s) => (
                <label key={s} className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={services.includes(s)} onChange={() => toggleService(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending} style={{ marginTop: 8 }}>
            {save.isPending ? 'Saving…' : 'Record allocation'}
          </button>
        </form>
      </Panel>
    </>
  );
}

function blankAreas() {
  return AREA_KEYS.map((key) => ({ key, update: '', hours: '' }));
}

function DailyEntryTab({ myAllocs, activeProjects }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [areas, setAreas] = useState(blankAreas);
  const [revisionNo, setRevisionNo] = useState('');
  const [revisionStatus, setRevisionStatus] = useState('');
  const [revisionRemarks, setRevisionRemarks] = useState('');
  const [err, setErr] = useState('');

  const projectOptions = myAllocs.length > 0
    ? myAllocs.map((a) => ({ id: allocProjectId(a), label: allocProjectLabel(a) })).filter((o) => o.id)
    : (activeProjects ?? []).map((p) => ({ id: p._id ?? p.id, label: p.name ?? p.code ?? '—' }));

  const listQ = useQuery({
    queryKey: ['spoc-entries', { mine: true, date }],
    queryFn: () => spocApi.entriesList({ mine: true, date }),
  });
  const dayItems = listQ.data?.items ?? [];

  const total = useMemo(
    () => areas.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0),
    [areas],
  );

  function setArea(i, patch) {
    setAreas((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  function handleClear() {
    setAreas(blankAreas());
    setRevisionNo('');
    setRevisionStatus('');
    setRevisionRemarks('');
    setService('');
    setErr('');
  }

  const save = useMutation({
    mutationFn: (body) => spocApi.entriesCreate(body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-entries'] });
      handleClear();
      if (takePendingLogout()) {
        await performLogout(queryClient);
        navigate('/');
      }
    },
    onError: (e) => setErr(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!project) {
      setErr('Project is required.');
      return;
    }
    if (!service) {
      setErr('Service is required.');
      return;
    }
    save.mutate({
      date,
      project,
      service,
      areas: areas.map((a) => ({
        key: a.key,
        update: a.update || undefined,
        hours: a.hours === '' ? undefined : Number(a.hours),
      })),
      revisionNo: revisionNo || undefined,
      revisionStatus: revisionStatus || undefined,
      revisionRemarks: revisionRemarks || undefined,
    });
  }

  return (
    <>
      <PendingLogoutCallout />
      <Panel title="Daily work update">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projectOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Service</label>
              <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Select service</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="section-label">Work areas</div>
          <table className="data">
            <thead>
              <tr>
                <th>Area</th>
                <th>Update</th>
                <th style={{ width: 110 }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a, i) => (
                <tr key={a.key}>
                  <td>{a.key}</td>
                  <td>
                    <input
                      className="form-input"
                      value={a.update}
                      onChange={(e) => setArea(i, { update: e.target.value })}
                      placeholder="Update"
                      aria-label={`${a.key} update`}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={a.hours}
                      onChange={(e) => setArea(i, { hours: e.target.value })}
                      aria-label={`${a.key} hours`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="field-grid" style={{ marginTop: 12 }}>
            <div className="form-row">
              <label className="form-label">Revision no</label>
              <input className="form-input" value={revisionNo} onChange={(e) => setRevisionNo(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Revision status</label>
              <select className="filter-select" style={{ width: '100%' }} value={revisionStatus} onChange={(e) => setRevisionStatus(e.target.value)}>
                <option value="">Select status</option>
                {REVISION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Revision remarks</label>
              <input className="form-input" value={revisionRemarks} onChange={(e) => setRevisionRemarks(e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: 13.5, marginTop: 12 }}>
            Total: <b className="mono">{total}</b> hrs · {MAN_HOUR_NOTE}
          </p>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save entry'}
            </button>
            <button type="button" className="approve-btn" onClick={handleClear}>
              Clear
            </button>
          </div>
        </form>
      </Panel>
      <Panel title={`My entries — ${date}`}>
        {listQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {listQ.error.message}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project?.code ?? '—' },
              { key: 'service', label: 'Service' },
              { key: 'totalHours', label: 'Hours', render: (r) => r.totalHours ?? '—' },
              { key: 'revisionNo', label: 'Rev no' },
              {
                key: 'revisionStatus',
                label: 'Rev status',
                render: (r) => (r.revisionStatus ? <StatusPill tone={statusTone(r.revisionStatus)}>{r.revisionStatus}</StatusPill> : '—'),
              },
            ]}
            rows={dayItems}
            emptyText="No entries for this date yet."
          />
        )}
      </Panel>
    </>
  );
}

function CoordinationMeetingsTab() {
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSudden, setShowSudden] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');

  const listQ = useQuery({ queryKey: ['meetings'], queryFn: () => meetingsApi.list({}) });
  const absenceQ = useQuery({ queryKey: ['absence-log'], queryFn: () => meetingsApi.absenceLog({}) });

  const items = listQ.data?.items ?? [];
  const absenceItems = absenceQ.data?.items ?? [];

  const scheduled = items.filter((m) => String(m.status ?? '').toLowerCase() === 'scheduled');
  const held = items.filter((m) => String(m.status ?? '').toLowerCase() === 'held');
  const overdueActions = useMemo(() => {
    let n = 0;
    for (const m of items) for (const a of m.actions ?? []) if (isOverdueAction(a)) n += 1;
    return n;
  }, [items]);

  const filteredHistory = projectFilter
    ? items.filter((m) => mtgIdOf(m.project) === projectFilter)
    : items;

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label="Scheduled" value={scheduled.length} accent="blueprint" />
        <KpiCard label="Held" value={held.length} accent="forest" />
        <KpiCard label="Overdue actions" value={overdueActions} accent="rust" />
        <KpiCard label="Total meetings" value={items.length} accent="neutral" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={() => setShowSchedule(true)}>+ Schedule Meeting</button>
        <button type="button" className="btn-primary" onClick={() => setShowSudden(true)}>+ Add Sudden Meeting</button>
      </div>
      <Panel title="All meetings">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project) },
              { key: 'date', label: 'Date', render: (r) => `${mtgFmtDate(r.date)} ${r.startTime ?? ''}` },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
              { key: 'actions', label: 'Actions', render: (r) => `${(r.actions ?? []).length}` },
            ]}
            rows={items}
            emptyText="No meetings yet."
            onRowClick={(r) => setDetailId(r._id ?? r.id)}
          />
        )}
      </Panel>
      <Panel title="Absence log">
        {absenceQ.isLoading ? <EmptyState text="Loading…" /> : absenceQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{absenceQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'meeting', label: 'Meeting', render: (r) => r.meeting?.title ?? r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project ?? r.meeting?.project) },
              { key: 'employee', label: 'Employee', render: (r) => mtgEmpName(r.employee) },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'date', label: 'Date', render: (r) => mtgFmtDate(r.date ?? r.respondedAt) },
            ]}
            rows={absenceItems}
            emptyText="No absence entries."
          />
        )}
      </Panel>
      <Panel title="Project history">
        <div className="form-row" style={{ maxWidth: 320 }}>
          <label className="form-label">Filter by project</label>
          <select className="filter-select" style={{ width: '100%' }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {[...new Map(items.map((m) => [mtgIdOf(m.project), m.project])).entries()].filter(([k]) => k).map(([k, p]) => (
              <option key={k} value={k}>{mtgProjLabel(p)}</option>
            ))}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
            { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project) },
            { key: 'date', label: 'Date', render: (r) => mtgFmtDate(r.date) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
          ]}
          rows={filteredHistory}
          emptyText="No meetings for this filter."
          onRowClick={(r) => setDetailId(r._id ?? r.id)}
        />
      </Panel>
      {showSchedule && <ScheduleMeetingModal onClose={() => setShowSchedule(false)} />}
      {showSudden && <ScheduleMeetingModal sudden onClose={() => setShowSudden(false)} />}
      {detailId && <MeetingDetailModal meetingId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

export default function MyCoordinationPage({ bootstrap }) {
  const [tab, setTab] = useState('overview');
  const roleKey = bootstrap?.role?.key;
  const isSuper = SUPER_ROLES.includes(roleKey);

  const allocQ = useQuery({
    queryKey: ['spoc-allocations-mine'],
    queryFn: spocApi.allocationsMine,
  });
  const activeQ = useQuery({
    queryKey: ['projects', 'active-coord'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const myAllocs = allocQ.data?.items ?? [];
  const activeProjects = activeQ.data?.items ?? [];

  return (
    <>
      <div className="page-head">
        <div className="page-title">My Coordination</div>
        <div className="page-sub">
          {allocQ.isLoading ? 'Loading…' : `${myAllocs.length} allocated project(s)`}
        </div>
      </div>
      {isSuper && (
        <Panel title="Role note">
          <EmptyState text={`Previewing the coordinator workspace as ${bootstrap?.role?.label ?? roleKey}.`} />
        </Panel>
      )}
      {allocQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {allocQ.error.message}
        </div>
      )}
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'other', label: 'Other Projects' },
          { key: 'directory', label: 'Project Directory' },
          { key: 'daily', label: 'Daily work update' },
          { key: 'meetings', label: 'Meetings' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && (
        <OverviewTab myAllocs={myAllocs} activeProjects={activeProjects} activeLoading={activeQ.isLoading} />
      )}
      {tab === 'other' && (
        <OtherProjectsTab myAllocs={myAllocs} activeProjects={activeProjects} activeLoading={activeQ.isLoading} />
      )}
      {tab === 'directory' && <DirectoryTab />}
      {tab === 'daily' && <DailyEntryTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'meetings' && <CoordinationMeetingsTab />}
    </>
  );
}
