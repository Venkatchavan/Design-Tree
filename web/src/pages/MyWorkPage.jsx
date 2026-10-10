import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  bootstrapApi,
  meApi,
  projectsApi,
  workEntriesApi,
} from '../lib/api.js';
import {
  drawingsApi,
  revisionsApi,
  tasksApi,
  teamsMineApi,
} from '../lib/workApi.js';
import { meetingsApi } from '../lib/phase4bApi.js';
import { transmittalsApi } from '../lib/phase3Api.js';
import {
  MeetingDetailModal,
  ResponseBox,
  actionLabel,
  fmtDate as mtgFmtDate,
  idOf as mtgIdOf,
  isDueSoonAction,
  isOverdueAction,
  projLabel as mtgProjLabel,
} from '../components/MeetingsCommon.jsx';
import {
  SUPER_ROLES,
  isPendingLogout,
  performLogout,
  takePendingLogout,
} from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import KpiCard from '../components/KpiCard.jsx';

function toneFor(status) {
  const s = String(status ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'open') return 'amber';
  if (s === 'resubmitted') return 'teal';
  if (s === 'cleared') return 'forest';
  if (s === 'submitted') return 'teal';
  if (s === 'inprogress' || s === 'in-progress') return 'blueprint';
  return statusTone(status);
}
function wuDisplay(e) {
  return e?.wuNo ?? e?.refNo ?? '—';
}
function isSuperRole(r) {
  return SUPER_ROLES.includes(r);
}
function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function idOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}
function useBootstrapProp(prop) {
  const q = useQuery({ queryKey: ['bootstrap'], queryFn: bootstrapApi, enabled: !prop });
  return prop ?? q.data ?? null;
}

export function UpdateProgressForm({ ptlProjects, activeProjects, compact }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasPtl = (ptlProjects ?? []).length > 0;
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('Assigned Daily Work');
  const [deliverable, setDeliverable] = useState('');
  const [taskActivity, setTaskActivity] = useState('');
  const [drawing, setDrawing] = useState('');
  const [hours, setHours] = useState('');
  const [progressPct, setProgressPct] = useState('');
  const [notes, setNotes] = useState('');
  const [extraHoursReason, setExtraHoursReason] = useState('');
  const [otherRows, setOtherRows] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const pendingLogout = isPendingLogout();
  // Day's extra-hours threshold (mirrors EXTRA_HOURS_THRESHOLD in
  // api/src/config/attendance.js; the server enforces it as well).
  const EXTRA_HOURS_AT = 8;
  const totalHours =
    (Number(hours) || 0) +
    otherRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const needsExtraReason = totalHours > EXTRA_HOURS_AT;

  const projectOptions = hasPtl ? ptlProjects : activeProjects;
  const projectLabel = hasPtl ? 'Projects under my PTL' : 'Active projects (no PTL projects found)';

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setOk('Submitted for team lead action.');
      setErr('');
      setExtraHoursReason('');
      if (takePendingLogout()) {
        performLogout(queryClient).finally(() => navigate('/'));
      }
    },
    onError: (e) => {
      setErr(e.message);
      setOk('');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!project) {
      setErr('Select a project.');
      return;
    }
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      setErr('Hours must be greater than 0.');
      return;
    }
    const pct = progressPct === '' ? undefined : Number(progressPct);
    if (pct !== undefined && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      setErr('Progress % must be between 0 and 100.');
      return;
    }
    const total = h + otherRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    if (total > EXTRA_HOURS_AT && !extraHoursReason.trim()) {
      setErr(`A reason is required for extra hours (over ${EXTRA_HOURS_AT}h in a day).`);
      return;
    }
    create.mutate({
      project,
      date: todayISO(),
      hours: h,
      notes: notes || undefined,
      extraHoursReason: total > EXTRA_HOURS_AT ? extraHoursReason.trim() : undefined,
      category,
      deliverable: category === 'Assigned Daily Work' || category === 'Task' ? deliverable || undefined : undefined,
      taskActivity: category === 'Task' ? taskActivity || undefined : undefined,
      drawing: category === 'Drawing' ? drawing || undefined : undefined,
      progressPct: pct,
      otherHours: otherRows
        .filter((r) => r.project && Number(r.hours) > 0)
        .map((r) => ({ project: r.project, hours: Number(r.hours) })),
    });
  }

  return (
    <Panel title={compact ? 'Update progress' : 'Update progress — submit for team lead action'}>
      {pendingLogout && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          Mandatory hours pending: submitting today&apos;s update will complete sign-out.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">{projectLabel} *</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select project</option>
            {(projectOptions ?? []).map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.name} ({p.code ?? ''})
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Log against *</label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {['Assigned Daily Work', 'Hourly', 'Drawing', 'Task'].map((c) => (
              <label key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="radio"
                  name="mw-category"
                  checked={category === c}
                  onChange={() => setCategory(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
        {(category === 'Assigned Daily Work' || category === 'Task') && (
          <div className="form-row">
            <label className="form-label">Deliverable</label>
            <input className="form-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
          </div>
        )}
        {category === 'Task' && (
          <div className="form-row">
            <label className="form-label">Task activity</label>
            <input className="form-input" value={taskActivity} onChange={(e) => setTaskActivity(e.target.value)} />
          </div>
        )}
        {category === 'Drawing' && (
          <div className="form-row">
            <label className="form-label">Drawing</label>
            <input className="form-input" value={drawing} onChange={(e) => setDrawing(e.target.value)} />
          </div>
        )}
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Hours *</label>
            <input type="number" min="0" step="0.5" className="form-input" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Progress %</label>
            <input type="number" min="0" max="100" className="form-input" value={progressPct} onChange={(e) => setProgressPct(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Remarks</label>
          <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">
            Extra hours reason{needsExtraReason ? ' *' : ''}
          </label>
          <textarea
            className="form-input"
            value={extraHoursReason}
            onChange={(e) => setExtraHoursReason(e.target.value)}
            placeholder={needsExtraReason ? `Required — total ${totalHours.toFixed(1)}h exceeds ${EXTRA_HOURS_AT}h` : `Only needed when the day's total exceeds ${EXTRA_HOURS_AT}h`}
          />
        </div>
        <div className="section-label">Other project hours</div>
        {otherRows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              className="filter-select"
              style={{ flex: 2 }}
              value={r.project}
              onChange={(e) => setOtherRows((rs) => rs.map((x, j) => (j === i ? { ...x, project: e.target.value } : x)))}
            >
              <option value="">Select project</option>
              {(activeProjects ?? []).map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.5"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Hours"
              value={r.hours}
              onChange={(e) => setOtherRows((rs) => rs.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))}
            />
            <button type="button" className="approve-btn" onClick={() => setOtherRows((rs) => rs.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="approve-btn"
          style={{ marginBottom: 12 }}
          onClick={() => setOtherRows((rs) => [...rs, { project: '', hours: '' }])}
        >
          Add other-project row
        </button>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {ok && <div style={{ color: 'var(--forest-dark)', fontSize: 13, marginBottom: 10 }}>{ok}</div>}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Submitting…' : 'Submit for team lead action'}
        </button>
      </form>
    </Panel>
  );
}

function MyMeetingsTab() {
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState(null);
  const [momId, setMomId] = useState(null);

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const myEmpId = meQ.data?.user?.employee
    ? String(typeof meQ.data.user.employee === 'object' ? (meQ.data.user.employee._id ?? meQ.data.user.employee.id ?? '') : meQ.data.user.employee)
    : '';
  const listQ = useQuery({ queryKey: ['meetings', 'mine'], queryFn: () => meetingsApi.list({ mine: true }) });
  const items = listQ.data?.items ?? [];

  const momList = items.filter((m) => {
    const mom = m.mom && typeof m.mom === 'object' ? m.mom : {};
    return !!((mom.discussion ?? '').trim() || (mom.decisions ?? '').trim() || m.momDoc);
  });
  const momMeeting = momId ? items.find((m) => String(m._id ?? m.id) === String(momId)) : null;

  const myActions = useMemo(() => {
    const out = [];
    for (const m of items) {
      for (const a of m.actions ?? []) {
        const ownerId = mtgIdOf(a.owner);
        if (myEmpId && ownerId && ownerId === String(myEmpId)) {
          out.push({
            ...a,
            meetingId: m._id ?? m.id,
            meetingTitle: m.title,
            meetingDate: m.date,
            meetingMomNo: m.momNo,
            meetingProject: mtgProjLabel(m.project),
          });
        }
      }
    }
    return out;
  }, [items, myEmpId]);

  const flip = useMutation({
    mutationFn: ({ meetingId, actionId, status }) => meetingsApi.actionStatus(meetingId, actionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const saveNote = useMutation({
    mutationFn: ({ meetingId, actionId, note }) => meetingsApi.actionNote(meetingId, actionId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  // ---- Employee-dashboard derivations (§5, §11) ----
  const dayKey = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };
  const todayKey = dayKey(new Date());
  const myInviteOf = (m) => (m.invites ?? []).find((v) => mtgIdOf(v.employee) === String(myEmpId)) ?? null;
  const momAvailable = (m) => {
    const mom = m.mom && typeof m.mom === 'object' ? m.mom : {};
    return !!((mom.discussion ?? '').trim() || (mom.decisions ?? '').trim() || m.momDoc);
  };
  // Employee-facing status (§11.1): Upcoming / Rescheduled / Awaiting update /
  // Completed · MOM pending / Completed / Cancelled.
  const empStatus = (m) => {
    const s = String(m.status ?? '').toLowerCase();
    if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
    if (s === 'held') return momAvailable(m) ? 'Completed' : 'Completed · MOM pending';
    const dk = dayKey(m.date);
    if (m.originalDate && dk && dk >= todayKey) return 'Rescheduled';
    if (dk && dk < todayKey) return 'Awaiting update';
    return 'Upcoming';
  };
  const isUpcoming = (m) => ['Upcoming', 'Rescheduled'].includes(empStatus(m));
  const inLog = (m) => !isUpcoming(m);

  const upcoming = items.filter(isUpcoming);
  const log = items.filter(inLog);
  const todayMeetings = upcoming.filter((m) => dayKey(m.date) === todayKey);
  const pendingResponses = upcoming.filter((m) => {
    const inv = myInviteOf(m);
    return !inv || (inv.response !== 'Available' && inv.response !== 'Not Available');
  });
  const openActions = myActions.filter((a) => ['Pending', 'Open', 'In Progress'].includes(a.status));
  const overdueActions = openActions.filter((a) => isOverdueAction(a));
  const attendedCount = log.filter((m) => {
    const att = (m.attendance ?? []).find((x) => mtgIdOf(x.employee) === String(myEmpId));
    return att?.present;
  }).length;

  const [inviteFilter, setInviteFilter] = useState('all');
  const [logProject, setLogProject] = useState('');
  const [logMom, setLogMom] = useState('all');
  const [actionFilter, setActionFilter] = useState('open');
  const [confirmMsg, setConfirmMsg] = useState('');

  const filteredInvites = upcoming.filter((m) => {
    if (inviteFilter === 'awaiting') return pendingResponses.includes(m);
    if (inviteFilter === 'responded') return !pendingResponses.includes(m);
    return true;
  });
  const projectOptions = useMemo(() => {
    const map = new Map();
    for (const m of log) {
      const id = mtgIdOf(m.project);
      if (id && !map.has(id)) map.set(id, mtgProjLabel(m.project));
    }
    return [...map.entries()];
  }, [log]);
  const filteredLog = log.filter((m) => {
    if (logProject && mtgIdOf(m.project) !== logProject) return false;
    if (logMom === 'available' && !momAvailable(m)) return false;
    if (logMom === 'pending' && !(m.status === 'Held' && !momAvailable(m))) return false;
    return true;
  });
  const filteredActions = myActions.filter((a) => {
    if (actionFilter === 'open') return ['Pending', 'In Progress'].includes(a.status);
    if (actionFilter === 'overdue') return isOverdueAction(a);
    if (actionFilter === 'completed') return a.status === 'Completed';
    return true;
  });

  function setStatusWithConfirm(meetingId, actionId, status) {
    flip.mutate(
      { meetingId, actionId, status },
      { onSuccess: () => setConfirmMsg(`Status set to ${status}.`) },
    );
  }

  return (
    <>
      <div className="kpi-grid cols-6">
        <KpiCard label="Today's meetings" value={todayMeetings.length} accent="blueprint" />
        <KpiCard label="Upcoming meetings" value={upcoming.length} accent="teal" />
        <KpiCard label="Pending responses" value={pendingResponses.length} accent={pendingResponses.length > 0 ? 'amber' : 'neutral'} />
        <KpiCard label="Open action items" value={openActions.length} accent="violet" />
        <KpiCard label="Overdue action items" value={overdueActions.length} accent={overdueActions.length > 0 ? 'rust' : 'neutral'} />
        <KpiCard label="Meetings attended" value={attendedCount} accent="forest" />
      </div>
      {listQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
      )}
      <Panel title="Today's meetings">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : todayMeetings.length === 0 ? (
          <EmptyState text="No meetings today." />
        ) : (
          todayMeetings.map((m) => (
            <MeetingCard key={String(m._id ?? m.id)} m={m} myEmpId={myEmpId} onDetails={setDetailId} />
          ))
        )}
      </Panel>
      <Panel title="Upcoming meetings">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => dayLabel(r.date) },
              { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project) },
              { key: 'time', label: 'Time', render: (r) => [r.startTime, r.endTime].filter(Boolean).join('–') || '—' },
              { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
              { key: 'response', label: 'Response', render: (r) => <ResponseLabel meeting={r} myEmpId={myEmpId} /> },
            ]}
            rows={upcoming.filter((m) => dayLabel(m.date) !== 'Today')}
            emptyText="No other upcoming meetings."
            onRowClick={(r) => setDetailId(r._id ?? r.id)}
          />
        )}
      </Panel>
      <Panel title="Pending availability responses">
        {pendingResponses.length === 0 ? (
          <EmptyState text="You have responded to every invitation." />
        ) : (
          pendingResponses.map((m) => (
            <MeetingCard key={String(m._id ?? m.id)} m={m} myEmpId={myEmpId} onDetails={setDetailId} />
          ))
        )}
      </Panel>
      <Panel title="My action items (up to 5 open)">
        <DataTable
          columns={[
            { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
            { key: 'due', label: 'Due', render: (a) => `${mtgFmtDate(a.due)} · ${actionLabel(a)}` },
            { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
            { key: 'project', label: 'Project', render: (a) => a.meetingProject ?? '—' },
          ]}
          rows={[...openActions].sort((a, b) => String(a.due ?? '') < String(b.due ?? '') ? -1 : 1).slice(0, 5)}
          emptyText="No open action items."
        />
      </Panel>
      <Panel title="Meeting invitations">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[
            ['all', 'All upcoming'],
            ['awaiting', 'Awaiting my response'],
            ['responded', 'Responded'],
          ].map(([k, label]) => (
            <button key={k} type="button" className={`tab-btn${inviteFilter === k ? ' active' : ''}`} onClick={() => setInviteFilter(k)}>
              {label}{k === 'awaiting' && pendingResponses.length > 0 ? ` (${pendingResponses.length})` : ''}
            </button>
          ))}
        </div>
        {listQ.isLoading ? <EmptyState text="Loading…" /> : filteredInvites.length === 0 ? (
          <EmptyState text="No invitations in this view." />
        ) : (
          filteredInvites.map((m) => (
            <MeetingCard key={String(m._id ?? m.id)} m={m} myEmpId={myEmpId} onDetails={setDetailId} />
          ))
        )}
      </Panel>
      <Panel title="Meeting log">
        <div className="field-grid" style={{ marginBottom: 10 }}>
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={logProject} onChange={(e) => setLogProject(e.target.value)}>
              <option value="">All my projects</option>
              {projectOptions.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">MOM</label>
            <select className="filter-select" style={{ width: '100%' }} value={logMom} onChange={(e) => setLogMom(e.target.value)}>
              <option value="all">All</option>
              <option value="available">MOM available</option>
              <option value="pending">MOM pending</option>
            </select>
          </div>
        </div>
        <DataTable
          columns={[
            { key: 'datetime', label: 'Date & time', render: (r) => `${mtgFmtDate(r.date)}${r.startTime ? ` ${r.startTime}` : ''}${r.endTime ? `–${r.endTime}` : ''}` },
            { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project) },
            { key: 'meeting', label: 'Meeting', render: (r) => `${r.title ?? '—'} · ${r.type ?? ''}` },
            { key: 'link', label: 'Link', render: (r) => r.mode === 'Online' && r.link ? <a href={r.link} target="_blank" rel="noreferrer">Join</a> : r.mode === 'Online' ? '—' : `Offline: ${r.location ?? '—'}` },
            { key: 'organiser', label: 'Organiser', render: (r) => r.responsible ?? '—' },
            { key: 'invited', label: 'Invited', render: (r) => (r.invites ?? []).length || (r.participants ?? []).length || '—' },
            { key: 'attended', label: 'Attended', render: (r) => attendanceNames(r) },
            { key: 'unavailable', label: 'Unavailable & reason', render: (r) => unavailableList(r) },
            { key: 'you', label: 'You', render: (r) => myAttendance(r, myEmpId) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill tone={empStatusTone(empStatus(r))}>{empStatus(r)}</StatusPill> },
            { key: 'mom', label: 'MOM', render: (r) => momAvailable(r) ? <StatusPill tone="forest">Available</StatusPill> : r.status === 'Held' ? <StatusPill tone="amber">Pending</StatusPill> : '—' },
          ]}
          rows={filteredLog}
          emptyText="Meetings move here automatically once they are held. Open one to read the MOM and your action items."
          onRowClick={(r) => setDetailId(r._id ?? r.id)}
        />
      </Panel>
      <Panel title="MOM view">
        {momList.length === 0 ? <EmptyState text="No MOM published yet." /> : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {momList.map((m) => (
                <button key={String(m._id ?? m.id)} type="button" className={`tab-btn${String(momId) === String(m._id ?? m.id) ? ' active' : ''}`} onClick={() => setMomId(m._id ?? m.id)}>
                  {m.momNo ?? m.title ?? '—'}
                </button>
              ))}
            </div>
            {!momMeeting ? <EmptyState text="Select a meeting to read its MOM." /> : (
              <MomViewer meeting={momMeeting} />
            )}
          </>
        )}
      </Panel>
      <Panel title={`My action items (${myActions.length})`}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[
            ['open', 'Open'],
            ['overdue', 'Overdue'],
            ['completed', 'Completed'],
            ['all', 'All'],
          ].map(([k, label]) => (
            <button key={k} type="button" className={`tab-btn${actionFilter === k ? ' active' : ''}`} onClick={() => setActionFilter(k)}>
              {label}{k === 'overdue' && overdueActions.length > 0 ? ` (${overdueActions.length})` : ''}
            </button>
          ))}
        </div>
        {confirmMsg && <p style={{ fontSize: 12.5, color: 'var(--forest-dark)' }}>{confirmMsg}</p>}
        <DataTable
          columns={[
            { key: 'text', label: 'Action / task', render: (a) => <><div>{a.text ?? '—'}</div><div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{a.note ?? ''}</div></> },
            { key: 'project', label: 'Project', render: (a) => a.meetingProject ?? '—' },
            { key: 'meeting', label: 'From meeting', render: (a) => <button type="button" className="approve-btn" onClick={() => setDetailId(a.meetingId)}>{a.meetingMomNo ?? a.meetingTitle ?? 'Open'}</button> },
            {
              key: 'priority', label: 'Priority', render: (a) => {
                const p = a.priority ?? 'Medium';
                return <StatusPill tone={p === 'High' ? 'rust' : p === 'Low' ? 'neutral' : 'amber'}>{p}</StatusPill>;
              },
            },
            {
              key: 'due', label: 'Due date', render: (a) => {
                const over = isOverdueAction(a);
                const days = over && a.due ? Math.ceil((Date.now() - new Date(a.due).getTime()) / 86400000) : 0;
                return <span style={{ color: over ? 'var(--rust-dark)' : isDueSoonAction(a) ? 'var(--amber-dark)' : undefined }}>
                  {mtgFmtDate(a.due)}{over ? ` · ${days}d overdue` : ''}
                </span>;
              },
            },
            {
              key: 'status', label: 'Status', render: (a) => (
                <select
                  className="filter-select"
                  value={a.status ?? 'Pending'}
                  onChange={(e) => setStatusWithConfirm(a.meetingId, a._id ?? a.id, e.target.value)}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              ),
            },
            { key: 'completed', label: 'Completed', render: (a) => (a.completedAt ? mtgFmtDate(a.completedAt) : '—') },
            {
              key: 'note', label: 'Update note', render: (a) => (
                <input
                  className="form-input"
                  style={{ minWidth: 140 }}
                  placeholder="Progress update for SPOC"
                  defaultValue={a.note ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (a.note ?? '')) {
                      saveNote.mutate(
                        { meetingId: a.meetingId, actionId: a._id ?? a.id, note: v },
                        { onSuccess: () => setConfirmMsg('Update saved.') },
                      );
                    }
                  }}
                />
              ),
            },
          ]}
          rows={filteredActions}
          emptyText="No action items in this view."
        />
      </Panel>
      {detailId && <MeetingDetailModal meetingId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

const SERVICE_CODES = {
  structural: 'S',
  mechanical: 'M',
  electrical: 'E',
  plumbing: 'P',
  fire: 'F',
  'mep coordination': 'MC',
};

function serviceCodes(services) {
  return (services ?? []).map((s) => {
    const key = String(s ?? '').toLowerCase();
    return SERVICE_CODES[key] ?? String(s ?? '').slice(0, 1).toUpperCase();
  });
}

function dayLabel(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const key = dt.toISOString().slice(0, 10);
  const now = new Date();
  const todayK = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (key === todayK) return 'Today';
  if (key === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function empStatusTone(s) {
  const v = String(s ?? '').toLowerCase();
  if (v === 'upcoming') return 'teal';
  if (v === 'rescheduled') return 'amber';
  if (v === 'awaiting update') return 'neutral';
  if (v === 'completed') return 'forest';
  if (v === 'completed · mom pending') return 'amber';
  if (v === 'cancelled') return 'rust';
  return statusTone(s);
}

function ResponseLabel({ meeting, myEmpId }) {
  const inv = (meeting?.invites ?? []).find(
    (v) => String(typeof v.employee === 'object' ? (v.employee?._id ?? v.employee?.id ?? '') : v.employee) === String(myEmpId),
  );
  if (!inv || (inv.response !== 'Available' && inv.response !== 'Not Available')) {
    return <StatusPill tone="amber">Response needed</StatusPill>;
  }
  return inv.response === 'Available'
    ? <StatusPill tone="forest">You: available</StatusPill>
    : <StatusPill tone="rust">You: not available</StatusPill>;
}

function inviteeNames(meeting) {
  const names = [];
  for (const p of meeting?.participants ?? []) {
    if (p.employee) continue;
    if (p.name) names.push(p.name);
  }
  return names;
}

function MeetingCard({ m, myEmpId, onDetails }) {
  const inv = (m.invites ?? []).find(
    (v) => String(typeof v.employee === 'object' ? (v.employee?._id ?? v.employee?.id ?? '') : v.employee) === String(myEmpId),
  );
  const proj = m.project ?? {};
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
        {proj.code ?? ''}{proj.code && proj.name ? ' · ' : ''}{proj.name ?? ''}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0' }}>
        <b style={{ fontSize: 14 }}>{m.title ?? '—'}</b>
        <ResponseLabel meeting={m} myEmpId={myEmpId} />
        <button type="button" className="approve-btn" onClick={() => onDetails(m._id ?? m.id)}>Details</button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
        {dayLabel(m.date)}
        {[m.startTime, m.endTime].filter(Boolean).length > 0 && ` · ${[m.startTime, m.endTime].filter(Boolean).join('–')}`}
        {` · ${m.type ?? ''} · ${m.mode ?? ''}`}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 4 }}>
        Organised by (SPOC): {m.responsible ?? '—'}
        {m.mode === 'Online' && m.link && (
          <> · <a href={m.link} target="_blank" rel="noreferrer">Meeting link</a>{' '}
          <button type="button" className="approve-btn" onClick={() => navigator.clipboard?.writeText(m.link)}>Copy link</button></>
        )}
        {m.mode !== 'Online' && m.location && <> · {m.location}</>}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 4 }}>
        Services: {serviceCodes(m.services).join(', ') || '—'}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 4 }}>
        Participants: {(m.invites ?? []).map((v, i) => {
          const emp = v.employee ?? {};
          const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.empId || '—';
          const you = String(emp._id ?? emp.id ?? '') === String(myEmpId);
          return <span key={i}>{i > 0 ? ', ' : ''}{name}{you ? ' (YOU)' : ''}</span>;
        })}
        {inviteeNames(m).map((n, i) => <span key={`x${i}`}>, {n}</span>)}
      </div>
      {m.agenda && <div style={{ fontSize: 12.5, marginTop: 4 }}><b>Agenda / purpose:</b> {m.agenda}</div>}
      {(m.refDocs ?? []).length > 0 && (
        <div style={{ fontSize: 12.5, marginTop: 4 }}>
          Reference documents: {(m.refDocs ?? []).map((d, i) => <span key={i}>{i > 0 ? ', ' : ''}{String(d).split('/').pop()}</span>)}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
        Invitation received {inv?.invitedAt ? new Date(inv.invitedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        {m.momNo ? ` · ${m.momNo}` : ''}
      </div>
      <ResponseBox meeting={m} myEmpId={myEmpId} organiser={m.responsible} />
    </div>
  );
}

function MomViewer({ meeting }) {
  const mom = meeting?.mom && typeof meeting.mom === 'object' ? meeting.mom : {};
  return (
    <div className="field-grid">
      <div><div className="form-label">Key discussion points</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.discussion?.trim() || '—'}</p></div>
      <div><div className="form-label">Decisions taken</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.decisions?.trim() || '—'}</p></div>
      <div><div className="form-label">Follow-up requirements</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.followUp?.trim() || '—'}</p></div>
      <div><div className="form-label">Next meeting date</div><p style={{ fontSize: 13 }}>{mom.nextMeeting ? new Date(mom.nextMeeting).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div>
      <div>
        <div className="form-label">MOM document</div>
        <p style={{ fontSize: 13 }}>{meeting?.momDoc ?? 'Entered in system'}</p>
      </div>
      <div>
        <div className="form-label">Download</div>
        <a className="approve-btn" style={{ textDecoration: 'none', display: 'inline-block' }} href={meetingsApi.momDownloadUrl(meeting._id ?? meeting.id)} download>
          Download MOM
        </a>
      </div>
    </div>
  );
}

function attendanceNames(m) {
  const att = m.attendance ?? [];
  if (att.length === 0) return 'Not marked';
  return att
    .filter((x) => x.present)
    .map((x) => {
      const e = x.employee ?? {};
      return typeof e === 'string' ? e : ([e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—');
    })
    .join(', ') || '—';
}

function unavailableList(m) {
  const out = [];
  for (const x of m.attendance ?? []) {
    if (x.present) continue;
    const e = x.employee ?? {};
    const name = typeof e === 'string' ? e : ([e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—');
    out.push(`${name}${x.reason ? ` — ${x.reason}` : ''}`);
  }
  if (out.length > 0) return out.join('; ');
  const resp = (m.invites ?? [])
    .filter((v) => v.response === 'Not Available')
    .map((v) => {
      const e = v.employee ?? {};
      const name = typeof e === 'string' ? e : ([e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—');
      return `${name}${v.reason ? ` — ${v.reason}` : ' — Not given'}`;
    });
  return resp.join('; ') || '—';
}

function myAttendance(m, myEmpId) {
  const att = (m.attendance ?? []).find(
    (x) => String(typeof x.employee === 'object' ? (x.employee?._id ?? x.employee?.id ?? '') : x.employee) === String(myEmpId),
  );
  if (!att) return 'Not marked';
  return att.present ? 'Attended' : 'Absent';
}

export default function MyWorkPage({ bootstrap: bootstrapProp }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const role = bootstrap?.role?.key ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [logTaskId, setLogTaskId] = useState('');
  const [revProject, setRevProject] = useState('');
  const [revDetails, setRevDetails] = useState('');
  const [revErr, setRevErr] = useState('');

  const teamsQ = useQuery({ queryKey: ['my-teams'], queryFn: teamsMineApi.list });
  const tasksMineQ = useQuery({ queryKey: ['tasks-mine'], queryFn: tasksApi.mine });
  const revMineQ = useQuery({ queryKey: ['revisions-mine'], queryFn: revisionsApi.mine });
  const drawingsQ = useQuery({ queryKey: ['drawings-recent'], queryFn: () => drawingsApi.list({}) });
  const entriesMineQ = useQuery({
    queryKey: ['my-work-entries'],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  const activeQ = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const teams = teamsQ.data?.items ?? [];
  const ptlProjects = useMemo(() => {
    const out = [];
    for (const t of teams) for (const p of t.projects ?? []) out.push({ ...p, teamName: t.name });
    return out;
  }, [teams]);
  const ptlProjectIds = useMemo(() => new Set(ptlProjects.map((p) => String(p._id ?? p.id))), [ptlProjects]);
  const activeProjects = activeQ.data?.items ?? [];
  const myTasks = tasksMineQ.data?.items ?? tasksMineQ.data?.tasks ?? [];
  const myRevisions = revMineQ.data?.items ?? [];
  const myEntries = entriesMineQ.data?.items ?? [];
  const drawings = drawingsQ.data?.items ?? [];

  const today = todayISO();
  const todayEntries = useMemo(
    () => myEntries.filter((e) => String(e.date ?? '').slice(0, 10) === today),
    [myEntries, today],
  );
  const todayHours = todayEntries.reduce((s, e) => s + Number(e.hours ?? 0), 0);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);
  const weekEntries = useMemo(
    () => myEntries.filter((e) => e.date && new Date(e.date) >= weekStart),
    [myEntries, weekStart],
  );
  const weekHours = weekEntries.reduce((s, e) => s + Number(e.hours ?? 0), 0);
  const byStage = useMemo(() => {
    const m = new Map();
    for (const e of weekEntries) {
      const k = e.stage || '—';
      m.set(k, (m.get(k) ?? 0) + Number(e.hours ?? 0));
    }
    return [...m.entries()];
  }, [weekEntries]);
  const sundayEntries = useMemo(
    () => myEntries.filter((e) => e.date && new Date(e.date).getDay() === 0),
    [myEntries],
  );
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of myEntries) {
      const k = String(e.date ?? '').slice(0, 10);
      if (!k) continue;
      const cur = m.get(k) ?? { date: k, hours: 0, notes: [] };
      cur.hours += Number(e.hours ?? 0);
      if (e.notes) cur.notes.push(e.notes);
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [myEntries]);
  const extraDays = byDay.filter((d) => d.hours > 8);

  const submittedTasks = myTasks.filter((t) => String(t.status ?? '').toLowerCase() === 'submitted');
  const openMyRevisions = myRevisions.filter((r) => String(r.status ?? '').toLowerCase() === 'open');
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return myTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (Number.isNaN(d.getTime())) return false;
      const s = String(t.status ?? '').toLowerCase();
      return d < now && !['completed', 'cleared', 'approved', 'done'].includes(s);
    });
  }, [myTasks]);
  const myProjectDrawings = useMemo(() => {
    if (ptlProjectIds.size === 0) return drawings;
    return drawings.filter((d) => ptlProjectIds.has(idOf(d.project)));
  }, [drawings, ptlProjectIds]);
  const gfcDrawings = myProjectDrawings.filter((d) =>
    String(d.stage ?? '').toLowerCase().includes('gfc'),
  );

  const setTaskStatus = useMutation({
    mutationFn: ({ id, status }) => tasksApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-mine'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  const createRevision = useMutation({
    mutationFn: (body) => revisionsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisions-mine'] });
      queryClient.invalidateQueries({ queryKey: ['revisions'] });
      setRevDetails('');
      setRevErr('');
    },
    onError: (e) => setRevErr(e.message),
  });

  return (
    <>
      <div className="page-head">
        <div className="page-title">My work</div>
        <div className="page-sub">
          Engineer / drafter workspace{role && isSuperRole(role) ? ' · super preview' : ''} — live from the work API.
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn-primary" onClick={() => navigate('/leave-travel')}>
          Leave & travel →
        </button>
      </div>
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'projects', label: 'My Projects' },
          { key: 'progress', label: 'Work Progress' },
          { key: 'deliverables', label: 'Deliverables & Drawings' },
          { key: 'update', label: 'Update progress' },
          { key: 'submissions', label: 'My submissions' },
          { key: 'meetings', label: 'Meetings' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <>
          <div className="kpi-grid">
            <KpiCard label="Assigned tasks" value={myTasks.length} accent="blueprint" />
            <KpiCard label="Today's hours" value={todayHours.toFixed(1)} accent="forest" />
            <KpiCard label="Today's entries" value={todayEntries.length} accent="amber" />
            <KpiCard label="Open revisions" value={openMyRevisions.length} accent="rust" />
          </div>
          <Panel title="Assigned to me">
            {tasksMineQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : (
              <DataTable
                columns={[
                  { key: 'deliverable', label: 'Task', render: (t) => t.deliverable ?? t.notes ?? '—' },
                  { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
                  { key: 'dueDate', label: 'Due', render: (t) => fmtDate(t.dueDate) },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill>,
                  },
                  {
                    key: 'actions',
                    label: 'Update',
                    render: (t) => (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="approve-btn" onClick={() => setTaskStatus.mutate({ id: t._id, status: 'Open' })}>
                          Acknowledge
                        </button>
                        <button type="button" className="approve-btn" onClick={() => setTaskStatus.mutate({ id: t._id, status: 'In Progress' })}>
                          Start
                        </button>
                        <button type="button" className="approve-btn" onClick={() => setTaskStatus.mutate({ id: t._id, status: 'Submitted' })}>
                          Submit
                        </button>
                      </span>
                    ),
                  },
                ]}
                rows={myTasks}
                emptyText="No tasks assigned to you."
              />
            )}
          </Panel>
          <Panel title="Awaiting response with me (derived: my Submitted tasks + my open revisions)">
            <div className="section-label">Submitted tasks ({submittedTasks.length})</div>
            <DataTable
              columns={[
                { key: 'deliverable', label: 'Task', render: (t) => t.deliverable ?? '—' },
                { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
                { key: 'status', label: 'Status', render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill> },
              ]}
              rows={submittedTasks}
              emptyText="Nothing submitted and waiting."
            />
            <div className="section-label" style={{ marginTop: 16 }}>My open revisions ({openMyRevisions.length})</div>
            <DataTable
              columns={[
                { key: 'drawing', label: 'Drawing', render: (r) => r.drawing ?? '—' },
                { key: 'details', label: 'Details', render: (r) => r.details ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill> },
              ]}
              rows={openMyRevisions}
              emptyText="No open revisions."
            />
          </Panel>
          <Panel title="Today's work progress">
            <div className="field-grid">
              <Field label="Hours today" value={todayHours.toFixed(1)} />
              <Field label="Entries today" value={String(todayEntries.length)} />
            </div>
          </Panel>
          <Panel title="Recent updates">
            <DataTable
              columns={[
                { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
                { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                { key: 'hours', label: 'Hours' },
                { key: 'status', label: 'Status', render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill> },
              ]}
              rows={myEntries.slice(0, 10)}
              emptyText="No updates yet."
            />
          </Panel>
          <Panel title="Drawing register (recent)">
            <DataTable
              columns={[
                { key: 'drawingNo', label: 'No', render: (d) => d.drawingNo ?? d.drawing ?? '—' },
                { key: 'title', label: 'Title', render: (d) => d.title ?? '—' },
                { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
              ]}
              rows={drawings.slice(0, 10)}
              emptyText="No drawings yet."
            />
          </Panel>
        </>
      )}

      {tab === 'projects' && (
        <Panel title="My Projects (from my teams)">
          {ptlProjects.length === 0 ? (
            <>
              <EmptyState text="No PTL projects found for you." />
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: '8px 0' }}>
                Honest fallback — pickable Active projects below (not your PTL allocation).
              </p>
              <DataTable
                columns={[
                  { key: 'name', label: 'Project', render: (p) => p.name ?? '—' },
                  { key: 'code', label: 'Code' },
                  { key: 'branch', label: 'Branch' },
                  { key: 'status', label: 'Status', render: (p) => <StatusPill tone={toneFor(p.status)}>{p.status ?? '—'}</StatusPill> },
                ]}
                rows={activeProjects}
                emptyText="No active projects."
              />
            </>
          ) : (
            <div className="teams-grid">
              {ptlProjects.map((p) => (
                <div className="team-card" key={String(p._id ?? p.id)}>
                  <div className="team-card-head">
                    <span className="team-card-name">{p.name ?? '—'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
                    {[p.code, p.branch].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="deliv-label">Job/client: {p.clientName ?? p.client ?? '—'}</div>
                  <div className="deliv-label">Stage: {p.currentStage ?? p.stage ?? '—'}</div>
                  <div className="deliv-label">Team: {p.teamName ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'progress' && (
        <>
          <div className="kpi-grid">
            <KpiCard label="Today (hrs)" value={todayHours.toFixed(1)} accent="forest" />
            <KpiCard label="This week (hrs)" value={weekHours.toFixed(1)} accent="blueprint" />
            <KpiCard label="Sunday entries" value={sundayEntries.length} accent="amber" />
            <KpiCard label="Days over 8h" value={extraDays.length} accent="rust" />
          </div>
          <Panel title="Stage-wise grouping (this week)">
            {byStage.length === 0 ? (
              <EmptyState text="No hours this week." />
            ) : (
              <table className="data">
                <thead><tr><th>Stage</th><th>Hours</th></tr></thead>
                <tbody>
                  {byStage.map(([s, h]) => (
                    <tr key={s}><td>{s}</td><td className="mono">{Number(h).toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="Sunday work (derived by weekday)">
            <DataTable
              columns={[
                { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
                { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                { key: 'hours', label: 'Hours' },
              ]}
              rows={sundayEntries}
              emptyText="No Sunday work."
            />
          </Panel>
          <Panel title="Extra hours (days over 8h, reason = notes)">
            {extraDays.length === 0 ? (
              <EmptyState text="No days over 8 hours." />
            ) : (
              <DataTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'hours', label: 'Hours', render: (d) => Number(d.hours).toFixed(1) },
                  { key: 'notes', label: 'Reason', render: (d) => (d.notes ?? []).join(' · ') || '—' },
                ]}
                rows={extraDays}
                emptyText="No days over 8 hours."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'deliverables' && (
        <>
          <Panel title="My overdue tasks">
            <DataTable
              columns={[
                { key: 'deliverable', label: 'Task', render: (t) => t.deliverable ?? '—' },
                { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
                { key: 'dueDate', label: 'Due', render: (t) => fmtDate(t.dueDate) },
                { key: 'status', label: 'Status', render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill> },
              ]}
              rows={overdueTasks}
              emptyText="No overdue tasks."
            />
          </Panel>
          <Panel title="GFC drawings for my projects">
            <DataTable
              columns={[
                { key: 'drawingNo', label: 'No', render: (d) => d.drawingNo ?? d.drawing ?? '—' },
                { key: 'title', label: 'Title', render: (d) => d.title ?? '—' },
                { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
              ]}
              rows={gfcDrawings}
              emptyText="No GFC drawings for your projects."
            />
          </Panel>
          <Panel title="Log item (set selected task to Submitted)">
            <div className="form-row">
              <label className="form-label">Task</label>
              <select className="filter-select" style={{ width: '100%' }} value={logTaskId} onChange={(e) => setLogTaskId(e.target.value)}>
                <option value="">Select task</option>
                {myTasks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {(t.deliverable ?? '—').slice(0, 60)} · {t.status ?? ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!logTaskId || setTaskStatus.isPending}
              onClick={() => setTaskStatus.mutate({ id: logTaskId, status: 'Submitted' })}
            >
              Log item
            </button>
          </Panel>
          <Panel title="Log revision">
            <div className="form-row">
              <label className="form-label">Project * (your PTL projects, else Active)</label>
              <select className="filter-select" style={{ width: '100%' }} value={revProject} onChange={(e) => setRevProject(e.target.value)}>
                <option value="">Select project</option>
                {(ptlProjects.length > 0 ? ptlProjects : activeProjects).map((p) => (
                  <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Details *</label>
              <textarea className="form-input" value={revDetails} onChange={(e) => setRevDetails(e.target.value)} />
            </div>
            {revErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{revErr}</div>}
            <button
              type="button"
              className="btn-primary"
              disabled={createRevision.isPending}
              onClick={() => {
                setRevErr('');
                if (!revProject) {
                  setRevErr('Select a project.');
                  return;
                }
                if (!revDetails.trim()) {
                  setRevErr('Details are required.');
                  return;
                }
                createRevision.mutate({ project: revProject, details: revDetails.trim() });
              }}
            >
              {createRevision.isPending ? 'Saving…' : 'Log revision'}
            </button>
          </Panel>
          <Panel title="Transmittal details">
            <MyTransmittals />
          </Panel>
        </>
      )}

      {tab === 'update' && (
        <UpdateProgressForm ptlProjects={ptlProjects} activeProjects={activeProjects} />
      )}

      {tab === 'submissions' && (
        <Panel title="My submissions">
          <DataTable
            columns={[
              { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
              { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
              { key: 'progressPct', label: 'Progress %', render: (e) => e.progressPct ?? '—' },
              { key: 'status', label: 'Status', render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill> },
            ]}
            rows={myEntries}
            emptyText="No submissions yet."
          />
        </Panel>
      )}

      {tab === 'meetings' && <MyMeetingsTab />}
    </>
  );
}

function MyTransmittals() {
  const scopeQ = useQuery({
    queryKey: ['transmittals-mine'],
    queryFn: () => transmittalsApi.teamScope(),
  });
  const rows = scopeQ.data?.items ?? [];
  if (scopeQ.isLoading) return <EmptyState text="Loading…" />;
  if (scopeQ.isError) {
    return <EmptyState text="Transmittal details are unavailable for this role." />;
  }
  return (
    <DataTable
      columns={[
        { key: 'trNo', label: 'TR no.', render: (r) => <span className="mono">{r.trNo}</span> },
        { key: 'project', label: 'Project', render: (r) => r.drawing?.project?.name ?? projLabel(r.drawing?.project) },
        { key: 'drawing', label: 'Drawing', render: (r) => r.drawing?.drawingNo ?? '—' },
        { key: 'rev', label: 'Rev', render: (r) => r.rev ?? '—' },
        { key: 'date', label: 'Date', render: (r) => (r.date ? fmtDate(r.date) : '—') },
        { key: 'ack', label: 'Ack. status', render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill> },
      ]}
      rows={rows}
      emptyText="No transmittals for your projects yet."
    />
  );
}
