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
import { holidaysApi, meetingsApi } from '../lib/phase4bApi.js';
import { transmittalsApi } from '../lib/phase3Api.js';
import { rfiApi } from '../lib/functionsApi.js';
import { docsApi } from '../lib/docsApi.js';
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

const EMPTY_LIST = [];

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
function employeeLabel(employee) {
  if (!employee || typeof employee !== 'object') return String(employee ?? '—');
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empId || '—';
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
function displayDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}
function stageName(stage) {
  return ({
    CD: 'Concept',
    SD: 'Schematic',
    DD: 'Design development',
    TD: 'Tender',
    GFC: 'GFC',
  })[String(stage ?? '').toUpperCase()] ?? stage ?? '—';
}
function projectIdOf(value) {
  return idOf(value?._id ?? value?.id ?? value);
}
function projectTaskOpen(task) {
  return !['approved', 'submitted', 'completed', 'cleared', 'done'].includes(
    String(task.status ?? '').toLowerCase(),
  );
}
function updateStatusLabel(status) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'pending') return 'Pending review';
  if (normalized === 'needs attention') return 'Revise';
  return status ?? '—';
}
function daysSince(v) {
  if (!v) return '—';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return '—';
  return `${Math.max(0, Math.ceil((Date.now() - date.getTime()) / 86400000))}d`;
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

export function UpdateProgressForm({ ptlProjects, activeProjects, myTasks = [], teams = [] }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasPtl = (ptlProjects ?? []).length > 0;
  const [project, setProject] = useState('');
  const [assignedId, setAssignedId] = useState('');
  const [hours, setHours] = useState('');
  const [drawing, setDrawing] = useState('');
  const [taskActivity, setTaskActivity] = useState('');
  const [otherRows, setOtherRows] = useState([]);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());
  const [extraHoursReason, setExtraHoursReason] = useState('');
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
  const selectedOption = (projectOptions ?? []).find((p) => String(p._id ?? p.id) === project)
    ?? (activeProjects ?? []).find((p) => String(p._id ?? p.id) === project);
  const previewQ = useQuery({
    queryKey: ['project', project],
    queryFn: () => projectsApi.get(project),
    enabled: !!project,
  });
  const preview = previewQ.data?.project ?? previewQ.data?.item ?? previewQ.data ?? selectedOption ?? null;
  const projectTasks = (myTasks ?? []).filter((t) => String(t.project?._id ?? t.project?.id ?? t.project ?? '') === project);
  const selectedTask = projectTasks.find((t) => String(t._id ?? t.id) === assignedId) ?? null;
  const projectTeam = useMemo(() => {
    const lines = [];
    const team = (teams ?? []).find((tm) => (tm.projects ?? []).some((p) => String(p?._id ?? p?.id ?? p ?? '') === project));
    if (team) {
      const lead = team.lead && typeof team.lead === 'object'
        ? [team.lead.firstName, team.lead.lastName].filter(Boolean).join(' ')
        : '';
      if (lead) lines.push(`${lead} · ${team.lead?.designation ?? 'Principal team lead'}`);
      for (const m of team.members ?? []) {
        const e = m.employee && typeof m.employee === 'object' ? m.employee : null;
        if (!e) continue;
        const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
        if (!name || name === lead) continue;
        lines.push(`${name}${e.designation ? ` · ${e.designation}` : ''}`);
      }
    }
    if (lines.length === 0) {
      for (const row of preview?.principalTeamLeads ?? []) {
        const names = (row.names ?? []).filter(Boolean);
        for (const n of names.length > 0 ? names : [row.name].filter(Boolean)) {
          lines.push(`${n} · Principal team lead`);
        }
      }
    }
    return lines;
  }, [teams, project, preview]);

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setOk('Submitted for team lead action.');
      setErr('');
      setAssignedId('');
      setHours('');
      setDrawing('');
      setTaskActivity('');
      setOtherRows([]);
      setNotes('');
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

  function pickProject(id) {
    setProject(id);
    setAssignedId('');
  }

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
      setErr('Hourly work handled must be greater than 0.');
      return;
    }
    if (!date) {
      setErr('Select a date.');
      return;
    }
    const otherHours = otherRows
      .filter((r) => r.project && Number(r.hours) > 0)
      .map((r) => ({ project: r.project, hours: Number(r.hours) }));
    const total = h + otherHours.reduce((s, r) => s + r.hours, 0);
    if (total > EXTRA_HOURS_AT && !extraHoursReason.trim()) {
      setErr(`A reason is required for extra hours (over ${EXTRA_HOURS_AT}h in a day).`);
      return;
    }
    create.mutate({
      project,
      date,
      hours: h,
      stage: selectedTask?.stage || undefined,
      category: selectedTask ? 'Assigned Daily Work' : 'Hourly',
      deliverable: selectedTask?.deliverable || undefined,
      taskActivity: taskActivity.trim() || undefined,
      drawing: drawing.trim() || undefined,
      notes: notes.trim() || undefined,
      otherHours: otherHours.length > 0 ? otherHours : undefined,
      extraHoursReason: total > EXTRA_HOURS_AT ? extraHoursReason.trim() : undefined,
    });
  }

  const optionLabel = (p) => `${p.name ?? '—'}${p.jobNumber ?? p.code ? ` (${p.jobNumber ?? p.code})` : ''}`;

  return (
    <>
      {pendingLogout && (
        <div className="login-error" role="alert" style={{ display: 'block', marginBottom: 12 }}>
          Mandatory hours pending: submitting today&apos;s update will complete sign-out.
        </div>
      )}
      <Panel title="Projects under my PTL" sub="Moved to another project on a higher priority? Select it here and log your progress against it.">
        <div className="form-row" style={{ maxWidth: 420, marginBottom: 6 }}>
          <label className="form-label">Project</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => pickProject(e.target.value)}>
            <option value="">Select project</option>
            {(projectOptions ?? []).map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {optionLabel(p)}
              </option>
            ))}
          </select>
        </div>
        {project && selectedOption && (
          <div className="page-sub" style={{ margin: 0 }}>
            Logging against your assigned project {selectedOption.name}.
          </div>
        )}
      </Panel>
      <Panel title="1. Select project">
        <div className="form-row" style={{ maxWidth: 420 }}>
          <label className="form-label">Project</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => pickProject(e.target.value)}>
            <option value="">Select project</option>
            {(projectOptions ?? []).map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.name ?? '—'}
              </option>
            ))}
          </select>
        </div>
        {project && (
          <>
            <div className="field-grid" style={{ marginTop: 14 }}>
              <Field label="Job no." value={preview?.jobNumber ?? preview?.job ?? selectedOption?.jobNumber ?? selectedOption?.code} mono />
              <Field label="Client" value={preview?.clientName ?? preview?.client} />
              <Field label="Branch" value={preview?.branch} />
              <Field label="Current stage" value={preview?.currentStage ?? preview?.stage} />
            </div>
            <div className="field-label" style={{ marginTop: 14, marginBottom: 8 }}>Project team</div>
            {projectTeam.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No team data available.</div>
            ) : (
              projectTeam.map((line) => (
                <div key={line} style={{ fontSize: 14 }}>{line}</div>
              ))
            )}
          </>
        )}
      </Panel>
      <Panel title="2. What are you logging work against?">
        <div className="form-row" style={{ marginBottom: 0, maxWidth: 420 }}>
          <label className="form-label">Assigned Daily Work from PTL/TL</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={assignedId}
            disabled={!project}
            onChange={(e) => setAssignedId(e.target.value)}
          >
            <option value="">General / other work — no specific daily assignment for this project</option>
            {projectTasks.map((t) => (
              <option key={String(t._id ?? t.id)} value={String(t._id ?? t.id)}>
                {[t.stage, t.deliverable].filter(Boolean).join(' · ') || 'Assigned task'} (from PTL/TL)
              </option>
            ))}
          </select>
        </div>
      </Panel>
      <Panel title="3. Update work progress">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Hourly work handled</label>
              <input
                type="number"
                min="0"
                max="16"
                step="0.5"
                className="form-input"
                placeholder="e.g. 4.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Drawing</label>
              <input
                className="form-input"
                placeholder="e.g. S-302 Column layout, R01"
                value={drawing}
                onChange={(e) => setDrawing(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Task / Activity</label>
            <input
              className="form-input"
              placeholder="e.g. Column layout detailing"
              value={taskActivity}
              onChange={(e) => setTaskActivity(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Worked on other projects too? Add their hours</label>
            {otherRows.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select
                  className="filter-select"
                  style={{ flex: 2 }}
                  value={r.project}
                  onChange={(e) => setOtherRows((rs) => rs.map((x, j) => (j === i ? { ...x, project: e.target.value } : x)))}
                >
                  <option value="">Select project</option>
                  {(activeProjects ?? []).filter((p) => String(p._id ?? p.id) !== project).map((p) => (
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
              style={{ marginTop: 2 }}
              onClick={() => setOtherRows((rs) => [...rs, { project: '', hours: '' }])}
            >
              Add other project hours
            </button>
          </div>
          <div className="form-row">
            <label className="form-label">Remarks</label>
            <textarea
              className="form-input"
              rows={3}
              style={{ resize: 'vertical' }}
              placeholder="Describe the work completed in this update"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {needsExtraReason && (
            <div className="form-row">
              <label className="form-label">Extra hours reason *</label>
              <textarea
                className="form-input"
                value={extraHoursReason}
                onChange={(e) => setExtraHoursReason(e.target.value)}
                placeholder={`Required — total ${totalHours.toFixed(1)}h exceeds ${EXTRA_HOURS_AT}h`}
              />
            </div>
          )}
          <div className="form-row" style={{ maxWidth: 250 }}>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          {ok && <div style={{ color: 'var(--forest-dark)', fontSize: 13, marginBottom: 10 }}>{ok}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit for team lead action'}
          </button>
        </form>
      </Panel>
    </>
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

function LeaveTravelCard() {
  const navigate = useNavigate();
  return (
    <Panel title="Leave and travel">
      <p>Leave and travel requests now have their own dedicated section.</p>
      <button type="button" className="btn-primary" onClick={() => navigate('/leave-travel')}>
        Go to Leave &amp; Travel
      </button>
    </Panel>
  );
}

export default function MyWorkPage({ bootstrap: bootstrapProp, user }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const role = bootstrap?.role?.key ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [logTaskId, setLogTaskId] = useState('');
  const [revProject, setRevProject] = useState('');
  const [revStage, setRevStage] = useState('');
  const [revItem, setRevItem] = useState('');
  const [revDetails, setRevDetails] = useState('');
  const [revErr, setRevErr] = useState('');
  const [awaitProject, setAwaitProject] = useState('');
  const [awaitItem, setAwaitItem] = useState('');
  const [awaitingOn, setAwaitingOn] = useState('Client');
  const [awaitErr, setAwaitErr] = useState('');
  const [drawingProject, setDrawingProject] = useState('');
  const [drawingService, setDrawingService] = useState('');
  const [drawingStage, setDrawingStage] = useState('');
  const [drawingNo, setDrawingNo] = useState('');
  const [drawingRev, setDrawingRev] = useState('');
  const [drawingFile, setDrawingFile] = useState(null);
  const [drawingErr, setDrawingErr] = useState('');
  const [taskStage, setTaskStage] = useState('');
  const [subStatus, setSubStatus] = useState('');

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const teamsQ = useQuery({ queryKey: ['my-teams'], queryFn: teamsMineApi.list });
  const tasksMineQ = useQuery({ queryKey: ['tasks-mine'], queryFn: tasksApi.mine });
  const revMineQ = useQuery({ queryKey: ['revisions-mine'], queryFn: revisionsApi.mine });
  const drawingsQ = useQuery({ queryKey: ['drawings-recent'], queryFn: () => drawingsApi.list({ mine: true }) });
  const rfisMineQ = useQuery({ queryKey: ['my-work-rfis'], queryFn: () => rfiApi.list({ mine: true }) });
  const transmittalsMineQ = useQuery({ queryKey: ['my-work-transmittals'], queryFn: transmittalsApi.teamScope });
  const entriesMineQ = useQuery({
    queryKey: ['my-work-entries'],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  const activeQ = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const teams = teamsQ.data?.items ?? EMPTY_LIST;
  const me = meQ.data?.user ?? user ?? {};
  const myEmployeeId = String(me.employee?._id ?? me.employee?.id ?? me.employee ?? '');
  const myTeam = teams.find((team) =>
    String(team.lead?._id ?? team.lead?.id ?? team.lead ?? '') === myEmployeeId
    || (team.members ?? []).some((member) => idOf(member.employee) === myEmployeeId),
  );
  const myEmployee = (myTeam?.members ?? []).find((member) => idOf(member.employee) === myEmployeeId)?.employee;
  const myLead = myTeam?.lead;
  const leadName = typeof myTeam?.lead === 'object'
    ? [myTeam.lead.firstName, myTeam.lead.lastName].filter(Boolean).join(' ')
    : '';
  const ownName = [myEmployee?.firstName, myEmployee?.lastName].filter(Boolean).join(' ')
    || (idOf(myLead) === myEmployeeId ? [myLead?.firstName, myLead?.lastName].filter(Boolean).join(' ') : '')
    || me.name
    || '';
  const ownDesignation = myEmployee?.designation
    ?? (idOf(myLead) === myEmployeeId ? myLead?.designation : '')
    ?? bootstrap?.role?.designation
    ?? '';
  const profileSummary = [
    ownName,
    ownDesignation,
    myTeam ? `${leadName || 'Team lead'}'s team` : '',
  ].filter(Boolean).join(' · ');
  const ptlProjects = useMemo(() => {
    const out = [];
    for (const t of teams) {
      for (const p of t.projects ?? []) {
        const projectId = idOf(p);
        const existing = out.find((entry) => idOf(entry) === projectId);
        if (existing) {
          existing.teamServices = [...new Set([...existing.teamServices, t.service].filter(Boolean))];
          existing.teamLeads = [...new Map(
            [...existing.teamLeads, t.lead].filter(Boolean).map((lead) => [idOf(lead), lead]),
          ).values()];
          continue;
        }
        out.push({
          ...p,
          teamName: t.name,
          teamServices: t.service ? [t.service] : [],
          teamLeads: t.lead ? [t.lead] : [],
        });
      }
    }
    return out;
  }, [teams]);
  const ptlProjectIds = useMemo(() => new Set(ptlProjects.map((p) => String(p._id ?? p.id))), [ptlProjects]);
  const activeProjects = activeQ.data?.items ?? EMPTY_LIST;
  const availableProjects = ptlProjects.length ? ptlProjects : activeProjects;
  const selectedDrawingProject = availableProjects.find(
    (project) => String(project._id ?? project.id) === drawingProject,
  );
  const selectedDrawingServices = [
    ...(selectedDrawingProject?.services ?? []),
    ...(selectedDrawingProject?.scope ?? []),
  ]
    .map((service) => typeof service === 'string' ? service : service.service)
    .filter(Boolean);
  const myTasks = tasksMineQ.data?.items ?? tasksMineQ.data?.tasks ?? EMPTY_LIST;
  const myRevisions = revMineQ.data?.items ?? EMPTY_LIST;
  const myEntries = entriesMineQ.data?.items ?? EMPTY_LIST;
  const drawings = drawingsQ.data?.items ?? EMPTY_LIST;
  const myRfis = rfisMineQ.data?.items ?? EMPTY_LIST;
  const myTransmittals = transmittalsMineQ.data?.items ?? EMPTY_LIST;

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
  const byProject = useMemo(() => {
    const m = new Map();
    for (const e of weekEntries) {
      const k = projLabel(e.project);
      m.set(k, (m.get(k) ?? 0) + Number(e.hours ?? 0));
    }
    return [...m.entries()];
  }, [weekEntries]);
  const holidayYear = new Date().getFullYear();
  const holidaysQ = useQuery({
    queryKey: ['holidays', holidayYear],
    queryFn: () => holidaysApi.list({ year: holidayYear }),
    retry: false,
  });
  const holidayEntries = useMemo(() => {
    const set = new Set(
      (holidaysQ.data?.items ?? []).map((h) => String(h.date ?? '').slice(0, 10)),
    );
    if (set.size === 0) return [];
    return myEntries.filter((e) => {
      const k = String(e.date ?? '').slice(0, 10);
      if (!set.has(k)) return false;
      const d = new Date(e.date);
      if (!Number.isNaN(d.getTime()) && d.getDay() === 0) return false;
      return true;
    });
  }, [myEntries, holidaysQ.data]);
  const pendingTasks = useMemo(
    () => myTasks.filter((t) => !['completed', 'cleared', 'approved', 'done'].includes(String(t.status ?? '').toLowerCase())),
    [myTasks],
  );
  const extraHoursToday = Math.max(0, todayHours - 8);
  const leadFirst = String(leadName ?? '').split(' ')[0] || 'Team lead';

  const openMyRevisions = myRevisions.filter((r) => String(r.status ?? '').toLowerCase() === 'open');
  const myEntryStatuses = entriesMineQ.data?.statusCounts ?? myEntries.reduce((counts, entry) => {
    const status = String(entry.status ?? '').toLowerCase();
    if (status === 'approved') counts.approved += 1;
    else if (status === 'needs attention') counts.needsAttention += 1;
    else if (status === 'pending') counts.pending += 1;
    return counts;
  }, { approved: 0, needsAttention: 0, pending: 0 });
  const stageOptions = [...new Set(myTasks.map((task) => task.stage).filter(Boolean))];
  const visibleTasks = taskStage ? myTasks.filter((task) => task.stage === taskStage) : myTasks;
  const awaitingRfis = myRfis.filter((rfi) => ['open', 'in progress', 'escalated'].includes(String(rfi.status ?? '').toLowerCase()));
  const projectSummaryRows = ptlProjects.map((project) => {
    const projectId = idOf(project);
    const tasks = myTasks.filter((task) => idOf(task.project) === projectId);
    const projectEntries = myEntries.filter((entry) => idOf(entry.project) === projectId);
    const projectRevisions = openMyRevisions.filter((revision) => idOf(revision.project) === projectId);
    const projectRfis = awaitingRfis.filter((rfi) => idOf(rfi.project) === projectId);
    const projectDrawings = drawings.filter((drawing) => idOf(drawing.project) === projectId);
    const projectTransmittals = myTransmittals.filter((transmittal) => idOf(transmittal.drawing?.project) === projectId);
    const openTasks = tasks.filter(projectTaskOpen);
    const overdueProjectTasks = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date());
    const latestUpdate = projectEntries[0];
    const latestTransmittal = projectTransmittals[0];
    const gfcDrawing = projectDrawings.find((drawing) => String(drawing.stage ?? '').toLowerCase() === 'gfc');
    const gfcUpdate = gfcDrawing && projectEntries.find((entry) =>
      String(entry.drawing ?? '').toLowerCase() === String(gfcDrawing.drawingNo ?? '').toLowerCase(),
    );
    const currentStatus = String(project.status ?? '').toLowerCase() === 'active'
      ? 'In progress'
      : project.status ?? '—';
    const completion = project.completion == null ? '—' : `${project.completion}% actual`;
    const plannedDate = project.expectedCompletion ? `Planned by ${displayDate(project.expectedCompletion)}` : 'No planned completion date';
    const leadNames = (project.teamLeads ?? [])
      .map(employeeLabel)
      .filter((name) => name && name !== '—');
    const services = project.teamServices?.length
      ? project.teamServices.join(', ')
      : project.services?.map((service) => typeof service === 'string' ? service : service.service).filter(Boolean).join(', ')
        || project.scope?.map((scope) => scope.service).filter(Boolean).join(', ');
    const roleSummary = [
      myEmployee?.designation ?? ownDesignation,
      leadNames.length ? `under ${[...new Set(leadNames)].join(', ')}` : '',
    ].filter(Boolean).join(' ');
    const clientDetails = [
      project.clientName ?? project.client?.company ?? project.client?.name,
      project.description ?? project.projectType,
    ].filter(Boolean).join(' · ');
    const revisedEntries = projectEntries.filter((entry) => String(entry.status ?? '').toLowerCase() === 'needs attention');
    const transmittalSummary = latestTransmittal
      ? `Last sent ${displayDate(latestTransmittal.createdAt)} · ${latestTransmittal.status ?? 'Sent'}`
      : 'None yet';

    return {
      project,
      projectId,
      clientDetails,
      roleSummary: roleSummary || '—',
      services: services || '—',
      currentStatus,
      plannedActual: `${plannedDate} · ${completion}`,
      pendingTasks: `${openTasks.length} open`,
      submission: latestUpdate
        ? `${updateStatusLabel(latestUpdate.status)}${latestUpdate.deliverable ? ` · ${latestUpdate.deliverable}` : ''}${latestUpdate.progressPct == null ? '' : ` · ${latestUpdate.progressPct}%`}`
        : 'No submissions yet',
      timing: `${revisedEntries.length} item(s) revised${overdueProjectTasks.length ? `, ${overdueProjectTasks.length} overdue` : ', otherwise on time'}`,
      gfc: gfcDrawing
        ? `${gfcDrawing.title || gfcDrawing.drawingNo}${gfcUpdate?.progressPct == null ? '' : ` · ${gfcUpdate.progressPct}% complete`}`
        : 'No GFC drawing recorded',
      revisionStatus: `${projectRevisions.length} open revision${projectRevisions.length === 1 ? '' : 's'}${projectRevisions[0] ? ` (${projectRevisions[0].details ?? projectRevisions[0].drawing ?? 'awaiting update'})` : ''}`,
      awaiting: projectRfis.length
        ? projectRfis.map((rfi) => rfi.description).join('; ')
        : 'None currently with me',
      transmittal: transmittalSummary,
    };
  });
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
      setRevStage('');
      setRevItem('');
      setRevErr('');
    },
    onError: (e) => setRevErr(e.message),
  });
  const createAwaitingItem = useMutation({
    mutationFn: (body) => rfiApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-rfis'] });
      setAwaitProject('');
      setAwaitItem('');
      setAwaitErr('');
    },
    onError: (e) => setAwaitErr(e.message),
  });
  const uploadDrawing = useMutation({
    mutationFn: async (body) => {
      const result = await drawingsApi.create(body);
      const drawing = result?.item ?? result;
      const drawingId = drawing?._id ?? drawing?.id;
      if (!drawingId) throw new Error('Drawing was created, but its ID was not returned.');
      if (drawingFile) {
        try {
          await docsApi.drawingProof(drawingId, drawingFile);
        } catch (error) {
          throw new Error(`Drawing ${body.drawingNo} was registered, but the file upload failed: ${error.message}`, { cause: error });
        }
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings-recent'] });
      setDrawingProject('');
      setDrawingService('');
      setDrawingStage('');
      setDrawingNo('');
      setDrawingRev('');
      setDrawingFile(null);
      setDrawingErr('');
    },
    onError: (e) => setDrawingErr(e.message),
  });

  return (
    <>
      <div className="page-head">
        <div className="page-title">My work</div>
        <div className="page-sub">
          {profileSummary || 'Engineer / drafter workspace'}
          {role && isSuperRole(role) ? ' · super preview' : ''}
        </div>
      </div>
      <div className="kpi-grid">
        <KpiCard label="Total updates" value={entriesMineQ.data?.total ?? myEntries.length} accent="blueprint" />
        <KpiCard label="Approved" value={myEntryStatuses.Approved ?? myEntryStatuses.approved} accent="forest" />
        <KpiCard label="Needs attention" value={myEntryStatuses['Needs Attention'] ?? myEntryStatuses.needsAttention} accent="rust" />
        <KpiCard label="Pending review" value={myEntryStatuses.Pending ?? myEntryStatuses.pending} accent="amber" />
      </div>
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'projects', label: 'My Projects' },
          { key: 'progress', label: 'Work Progress' },
          { key: 'deliverables', label: 'Deliverables & Drawings' },
          { key: 'update', label: 'Update progress' },
          { key: 'submissions', label: 'My submissions' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <>
          <Panel title="Assigned to me" sub={`Tasks from ${leadName || 'your team lead'}, my team lead`}>
            <div className="form-row" style={{ maxWidth: 260 }}>
              <label className="form-label" htmlFor="my-work-stage-filter">Stage</label>
              <select id="my-work-stage-filter" className="filter-select" value={taskStage} onChange={(e) => setTaskStage(e.target.value)}>
                <option value="">All stages</option>
                {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            {tasksMineQ.isLoading ? <EmptyState text="Loading assigned tasks…" /> : tasksMineQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{tasksMineQ.error.message}</div>
            ) : visibleTasks.length === 0 ? <EmptyState text="No tasks assigned to you." /> : (
              <div className="teams-grid">
                {visibleTasks.map((task) => (
                  <article className="team-card" key={task._id ?? task.id}>
                    <div className="team-card-head">
                      <span className="team-card-name">{task.stage ?? 'All stages'}</span>
                      <StatusPill tone={toneFor(task.status)}>{task.status ?? '—'}</StatusPill>
                    </div>
                    <div>{projLabel(task.project)} · {task.deliverable ?? task.notes ?? '—'}</div>
                    <div className="deliv-label">Due {displayDate(task.dueDate)}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      <button type="button" className="approve-btn" disabled={setTaskStatus.isPending} onClick={() => setTaskStatus.mutate({ id: task._id ?? task.id, status: 'Open' })}>Acknowledge</button>
                      <button type="button" className="approve-btn" disabled={setTaskStatus.isPending} onClick={() => setTaskStatus.mutate({ id: task._id ?? task.id, status: 'In Progress' })}>Start</button>
                      <button type="button" className="approve-btn" disabled={setTaskStatus.isPending} onClick={() => setTaskStatus.mutate({ id: task._id ?? task.id, status: 'Submitted' })}>Submit</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {setTaskStatus.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{setTaskStatus.error.message}</div>}
          </Panel>

          <Panel title="Awaiting response - items with me" sub="Logged by you against your own work">
            {rfisMineQ.isLoading ? <EmptyState text="Loading your waiting items…" /> : rfisMineQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{rfisMineQ.error.message}</div>
            ) : awaitingRfis.length === 0 ? <EmptyState text="Nothing is awaiting a response." /> : (
              <div className="teams-grid">
                {awaitingRfis.map((rfi) => (
                  <article className="team-card" key={rfi._id ?? rfi.id}>
                    <div className="team-card-name">{projLabel(rfi.project)} · {rfi.description}</div>
                    <div className="deliv-label">{rfi.assignedTo ?? rfi.raisedBy?.role ?? 'External'} · {daysSince(rfi.createdAt)}</div>
                  </article>
                ))}
              </div>
            )}
            <form className="field-grid" style={{ marginTop: 16 }} onSubmit={(e) => {
              e.preventDefault();
              setAwaitErr('');
              if (!awaitProject || !awaitItem.trim()) {
                setAwaitErr('Select a project and describe the blocked item.');
                return;
              }
              createAwaitingItem.mutate({
                project: awaitProject,
                type: 'Awaiting response',
                description: awaitItem.trim(),
                assignedTo: awaitingOn,
              });
            }}>
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" value={awaitProject} onChange={(e) => setAwaitProject(e.target.value)} required>
                  <option value="">Select project</option>
                  {availableProjects.map((project) => <option key={String(project._id ?? project.id)} value={String(project._id ?? project.id)}>{project.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Item · What&apos;s blocked</label>
                <input className="form-input" value={awaitItem} onChange={(e) => setAwaitItem(e.target.value)} required />
              </div>
              <div className="form-row">
                <label className="form-label">Waiting on</label>
                <select className="filter-select" value={awaitingOn} onChange={(e) => setAwaitingOn(e.target.value)}>
                  <option>Client</option><option>Architect</option><option>PMC</option>
                </select>
              </div>
              {awaitErr && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{awaitErr}</div>}
              <button type="submit" className="btn-primary" disabled={createAwaitingItem.isPending}>{createAwaitingItem.isPending ? 'Saving…' : 'Log item'}</button>
            </form>
          </Panel>

          <Panel title="My revisions" sub="From the team revision log">
            {revMineQ.isLoading ? <EmptyState text="Loading revisions…" /> : revMineQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{revMineQ.error.message}</div>
            ) : openMyRevisions.length === 0 ? <EmptyState text="No revisions awaiting your update." /> : (
              <div className="teams-grid">
                {openMyRevisions.map((revision) => (
                  <article className="team-card" key={revision._id ?? revision.id}>
                    <div className="team-card-name">{projLabel(revision.project)} · {revision.stage ?? '—'} · {revision.details}</div>
                    <div className="deliv-label">Awaiting employee update</div>
                  </article>
                ))}
              </div>
            )}
            <div className="field-grid" style={{ marginTop: 16 }}>
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" value={revProject} onChange={(e) => setRevProject(e.target.value)}>
                  <option value="">Select project</option>
                  {availableProjects.map((project) => <option key={String(project._id ?? project.id)} value={String(project._id ?? project.id)}>{project.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Stage</label>
                <input className="form-input" value={revStage} onChange={(e) => setRevStage(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Item · What&apos;s being revised</label>
                <input className="form-input" value={revItem} onChange={(e) => setRevItem(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Details *</label>
                <textarea className="form-input" value={revDetails} onChange={(e) => setRevDetails(e.target.value)} />
              </div>
            </div>
            {revErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{revErr}</div>}
            <button
              type="button"
              className="btn-primary"
              disabled={createRevision.isPending}
              onClick={() => {
                setRevErr('');
                if (!revProject || !revDetails.trim()) {
                  setRevErr('Select a project and enter revision details.');
                  return;
                }
                createRevision.mutate({
                  project: revProject,
                  stage: revStage || undefined,
                  drawing: revItem || undefined,
                  details: revDetails.trim(),
                  assignedTo: myEmployeeId || undefined,
                });
              }}
            >
              {createRevision.isPending ? 'Saving…' : 'Log revision'}
            </button>
          </Panel>

          <Panel title="Drawing register" sub="Uploaded by you, across the team's projects">
            {drawingsQ.isLoading ? <EmptyState text="Loading drawing register…" /> : drawingsQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{drawingsQ.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (drawing) => projLabel(drawing.project) },
                  { key: 'service', label: 'Service', render: (drawing) => drawing.service ?? '—' },
                  { key: 'stage', label: 'Stage', render: (drawing) => drawing.stage ?? '—' },
                  { key: 'drawingNo', label: 'Drawing no.', render: (drawing) => drawing.drawingNo ?? '—' },
                  { key: 'rev', label: 'Rev', render: (drawing) => drawing.rev ?? '—' },
                  { key: 'date', label: 'Date', render: (drawing) => displayDate(drawing.date ?? drawing.createdAt) },
                ]}
                rows={drawings}
                emptyText="No drawings uploaded by you yet."
              />
            )}
            <form className="field-grid" style={{ marginTop: 16 }} onSubmit={(e) => {
              e.preventDefault();
              setDrawingErr('');
              if (!drawingProject || !drawingService || !drawingStage || !drawingNo.trim()) {
                setDrawingErr('Project, service, stage, and drawing number are required.');
                return;
              }
              uploadDrawing.mutate({
                project: drawingProject,
                service: drawingService,
                stage: drawingStage,
                drawingNo: drawingNo.trim(),
                title: drawingNo.trim(),
                rev: drawingRev || undefined,
                date: todayISO(),
              });
            }}>
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" value={drawingProject} onChange={(e) => { setDrawingProject(e.target.value); setDrawingService(''); }} required>
                  <option value="">Select project</option>
                  {availableProjects.map((project) => <option key={String(project._id ?? project.id)} value={String(project._id ?? project.id)}>{project.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Service</label>
                <select className="filter-select" value={drawingService} onChange={(e) => setDrawingService(e.target.value)} required>
                  <option value="">Select service</option>
                  {(selectedDrawingServices.length ? selectedDrawingServices : ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'BIM']).map((service) => <option key={service} value={service}>{service}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Stage</label>
                <select className="filter-select" value={drawingStage} onChange={(e) => setDrawingStage(e.target.value)} required>
                  <option value="">Select stage</option>
                  {['Preliminary concept', 'Concept', 'Schematic', 'Design development', 'Tender', 'GFC'].map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Drawing no.</label><input className="form-input" placeholder="e.g. S-302" value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} required /></div>
              <div className="form-row"><label className="form-label">Revision</label><input className="form-input" placeholder="e.g. R01" value={drawingRev} onChange={(e) => setDrawingRev(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Drawing file</label><input key={drawingFile ? drawingFile.name : 'no-file'} type="file" onChange={(e) => setDrawingFile(e.target.files?.[0] ?? null)} /></div>
              {drawingErr && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{drawingErr}</div>}
              <button type="submit" className="btn-primary" disabled={uploadDrawing.isPending}>{uploadDrawing.isPending ? 'Uploading…' : 'Upload to register'}</button>
            </form>
          </Panel>

          <Panel title="Today's work progress">
            {todayEntries.length === 0 ? <p>Nothing logged yet today</p> : <p>{todayEntries.length} update(s) logged today</p>}
            <div className="field-grid">
              <Field label="Hours logged today" value={todayHours.toFixed(1)} />
              <Field label="Tasks touched today" value={todayEntries.filter((entry) => entry.category === 'Task').length} />
            </div>
            <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Hours logged against a task in &quot;Update progress&quot; will show up here through the day.</p>
          </Panel>

          <Panel title="Recent updates">
            <DataTable
              columns={[
                { key: 'wu', label: 'WU no.', render: (entry) => wuDisplay(entry) },
                { key: 'project', label: 'Project', render: (entry) => projLabel(entry.project) },
                { key: 'deliverable', label: 'Deliverable', render: (entry) => entry.deliverable ?? entry.taskActivity ?? '—' },
                { key: 'progress', label: '%', render: (entry) => entry.progressPct == null ? '—' : `${entry.progressPct}%` },
                { key: 'status', label: 'Status', render: (entry) => <StatusPill tone={toneFor(entry.status)}>{updateStatusLabel(entry.status)}</StatusPill> },
                { key: 'date', label: 'Date', render: (entry) => displayDate(entry.date) },
              ]}
              rows={myEntries.slice(0, 10)}
              emptyText="No updates yet."
            />
          </Panel>

          <LeaveTravelCard />
        </>
      )}

      {tab === 'projects' && (
        <Panel title="My Projects">
          {ptlProjects.length === 0 ? (
            <>
              <EmptyState text="No PTL projects found for you." />
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: '8px 0' }}>
                Active projects are not shown as assigned projects unless a team allocation exists.
              </p>
            </>
          ) : (
            <div className="teams-grid">
              {projectSummaryRows.map((row) => {
                const { project } = row;
                return (
                <article className="team-card" key={row.projectId}>
                  <div className="team-card-head">
                    <span className="team-card-name">{project.name ?? '—'}</span>
                    <StatusPill tone={toneFor(row.currentStatus)}>{row.currentStatus}</StatusPill>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
                    {[project.code, project.branch].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="deliv-label">Client: {row.clientDetails || project.clientName || '—'}</div>
                  <div className="field-grid" style={{ marginTop: 12 }}>
                    <Field label="My role" value={row.roleSummary} />
                    <Field label="Department / service" value={row.services} />
                    <Field label="Project stage" value={stageName(project.currentStage)} />
                    <Field label="Current status" value={row.currentStatus} />
                    <Field label="Planned vs. actual completion" value={row.plannedActual} />
                    <Field label="Pending tasks" value={row.pendingTasks} />
                    <Field label="Submission status" value={row.submission} />
                    <Field label="Delayed / on-time" value={row.timing} />
                    <Field label="GFC status" value={row.gfc} />
                    <Field label="Revision status" value={row.revisionStatus} />
                    <Field label="Awaiting response" value={row.awaiting} />
                    <Field label="Transmittal status" value={row.transmittal} />
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === 'progress' && (
        <>
          <Panel
            title="Work logged today"
            sub={todayEntries.length === 0 ? 'Nothing logged yet today' : `${todayEntries.length} update(s) logged today`}
          >
            <div className="field-grid">
              <div className="field"><div className="field-label">Hours logged today</div><div className="field-value mono">{todayHours.toFixed(1)}</div></div>
              <div className="field"><div className="field-label">Updates logged today</div><div className="field-value mono">{todayEntries.length}</div></div>
              <div className="field"><div className="field-label">Extra hours (beyond 8h)</div><div className="field-value mono">{extraHoursToday.toFixed(1)}</div></div>
              <div className="field"><div className="field-label">Pending / overdue tasks</div><div className="field-value mono" style={pendingTasks.length > 0 ? { color: 'var(--rust)' } : undefined}>{pendingTasks.length}</div></div>
            </div>
          </Panel>
          <div className="two-col">
            <Panel title="Stage-wise progress">
              {byStage.length === 0 ? (
                <EmptyState text="No hours this week." />
              ) : (
                <table className="data">
                  <thead><tr><th>Stage</th><th>Hours this week</th></tr></thead>
                  <tbody>
                    {byStage.map(([s, h]) => (
                      <tr key={s}><td>{s}</td><td className="mono">{Number(h).toFixed(1)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
            <Panel title="Project-wise progress">
              {byProject.length === 0 ? (
                <EmptyState text="No hours this week." />
              ) : (
                <table className="data">
                  <thead><tr><th>Project</th><th>Hours this week</th></tr></thead>
                  <tbody>
                    {byProject.map(([p, h]) => (
                      <tr key={p}><td>{p}</td><td className="mono">{Number(h).toFixed(1)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
          <div className="two-col">
            <Panel title="Sunday work">
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (e) => displayDate(e.date) },
                  { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                  { key: 'hours', label: 'Hours', render: (e) => (e.hours == null ? '—' : Number(e.hours).toFixed(1)) },
                  { key: 'reason', label: 'Reason', render: (e) => e.notes ?? e.extraHoursReason ?? '—' },
                ]}
                rows={sundayEntries}
                emptyText="No Sunday work logged."
              />
            </Panel>
            <Panel title="Other holiday work">
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (e) => displayDate(e.date) },
                  { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                  { key: 'hours', label: 'Hours', render: (e) => (e.hours == null ? '—' : Number(e.hours).toFixed(1)) },
                  { key: 'reason', label: 'Reason', render: (e) => e.notes ?? e.extraHoursReason ?? '—' },
                ]}
                rows={holidayEntries}
                emptyText="No holiday work logged."
              />
            </Panel>
          </div>
          <Panel
            title="Pending / overdue tasks"
            sub={`Assigned by ${leadName || 'your team lead'}, my team lead — he takes the follow-up action, and ${leadFirst} approves my logged hours`}
          >
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
                { key: 'stage', label: 'Stage', render: (t) => t.stage ?? '—' },
                { key: 'deliverable', label: 'Deliverable', render: (t) => t.deliverable ?? t.notes ?? '—' },
                { key: 'due', label: 'Due', render: (t) => displayDate(t.dueDate) },
                { key: 'priority', label: 'Priority', render: (t) => (t.priority ? <StatusPill tone={String(t.priority).toLowerCase() === 'high' ? 'amber' : 'neutral'}>{t.priority}</StatusPill> : '—') },
                { key: 'status', label: 'Status', render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill> },
              ]}
              rows={pendingTasks}
              emptyText="No pending tasks."
            />
          </Panel>
        </>
      )}

      {tab === 'deliverables' && (
        <>
          <Panel title="Drawing submission status" sub="Stage-wise, across my allotted projects">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
                { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                { key: 'drawingNo', label: 'Drawing no.', render: (d) => d.drawingNo ?? d.drawing ?? '—' },
                { key: 'submission', label: 'Submission status', render: (d) => <StatusPill tone={toneFor(d.status ?? d.submissionStatus)}>{d.status ?? d.submissionStatus ?? '—'}</StatusPill> },
                { key: 'delay', label: 'Delay / on-time', render: (d) => {
                  const v = d.delay ?? d.delayStatus ?? '—';
                  return /late|overdue|blocked/i.test(String(v)) ? <span style={{ color: 'var(--rust)' }}>{v}</span> : v;
                } },
              ]}
              rows={myProjectDrawings}
              emptyText="No drawings for your projects yet."
            />
          </Panel>
          <Panel title="GFC drawing status">
            <DataTable
              columns={[
                { key: 'drawing', label: 'Drawing', render: (d) => d.title ?? d.drawingNo ?? d.drawing ?? '—' },
                { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
                { key: 'status', label: 'Status', render: (d) => (d.progressPct != null && d.status == null ? `${d.progressPct}% complete` : <StatusPill tone={toneFor(d.status)}>{d.status ?? '—'}</StatusPill>) },
              ]}
              rows={gfcDrawings}
              emptyText="No GFC drawings for your projects."
            />
          </Panel>
          <Panel title="Revision details">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                { key: 'item', label: 'Item', render: (r) => r.details ?? r.drawing ?? r.item ?? '—' },
                { key: 'reason', label: 'Reason', render: (r) => r.raisedBy ?? r.reason ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill> },
              ]}
              rows={myRevisions}
              emptyText="No revisions logged."
            />
          </Panel>
          <Panel title="Pending / awaiting responses">
            {rfisMineQ.isLoading ? <EmptyState text="Loading your waiting items…" /> : rfisMineQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{rfisMineQ.error.message}</div>
            ) : awaitingRfis.length === 0 ? <EmptyState text="Nothing is awaiting a response." /> : (
              <div className="teams-grid">
                {awaitingRfis.map((rfi) => (
                  <article className="team-card" key={rfi._id ?? rfi.id}>
                    <div className="team-card-name">{projLabel(rfi.project)} · {rfi.description ?? rfi.item ?? '—'}</div>
                    <div className="deliv-label">{rfi.assignedTo ?? rfi.raisedBy?.role ?? 'External'} · {daysSince(rfi.createdAt)}</div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Transmittal details">
            <MyTransmittals />
          </Panel>
        </>
      )}

      {tab === 'update' && (
        <UpdateProgressForm ptlProjects={ptlProjects} activeProjects={activeProjects} myTasks={myTasks} teams={teams} />
      )}

      {tab === 'submissions' && (
        <Panel title="My submissions">
          <div className="form-row" style={{ maxWidth: 260 }}>
            <label className="form-label" htmlFor="my-submissions-status-filter">Status</label>
            <select
              id="my-submissions-status-filter"
              className="filter-select"
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="revise">Revise</option>
              <option value="awaiting response">Awaiting response</option>
              <option value="pending review">Pending review</option>
            </select>
          </div>
          <DataTable
            columns={[
              { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
              { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
              { key: 'progressPct', label: 'Progress %', render: (e) => e.progressPct ?? '—' },
              { key: 'status', label: 'Status', render: (e) => <StatusPill tone={toneFor(e.status)}>{updateStatusLabel(e.status)}</StatusPill> },
            ]}
            rows={subStatus ? myEntries.filter((e) => {
              const label = String(updateStatusLabel(e.status)).toLowerCase();
              if (subStatus === 'awaiting response') return label.includes('await');
              return label === subStatus;
            }) : myEntries}
            emptyText={subStatus ? 'No submissions in this status.' : 'No submissions yet.'}
          />
        </Panel>
      )}


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
        { key: 'date', label: 'Date', render: (r) => (r.date ? displayDate(r.date) : '—') },
        { key: 'ack', label: 'Ack. status', render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill> },
      ]}
      rows={rows}
      emptyText="No transmittals for your projects yet."
    />
  );
}
