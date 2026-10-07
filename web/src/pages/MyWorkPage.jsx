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
import {
  MeetingDetailModal,
  ResponseBox,
  actionLabel,
  fmtDate as mtgFmtDate,
  idOf as mtgIdOf,
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
  const [otherRows, setOtherRows] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const pendingLogout = isPendingLogout();

  const projectOptions = hasPtl ? ptlProjects : activeProjects;
  const projectLabel = hasPtl ? 'Projects under my PTL' : 'Active projects (no PTL projects found)';

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setOk('Submitted for team lead action.');
      setErr('');
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
    create.mutate({
      project,
      date: todayISO(),
      hours: h,
      notes: notes || undefined,
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = items.filter((m) => {
    const s = String(m.status ?? '').toLowerCase();
    if (s !== 'scheduled') return false;
    if (!m.date) return true;
    const d = new Date(m.date);
    return Number.isNaN(d.getTime()) || d >= today;
  });
  const log = items.filter((m) => {
    const s = String(m.status ?? '').toLowerCase();
    if (['held', 'cancelled', 'canceled'].includes(s)) return true;
    if (m.date) {
      const d = new Date(m.date);
      if (!Number.isNaN(d.getTime()) && d < today) return true;
    }
    return false;
  });
  const withMom = items.filter((m) => m.mom);
  const momMeeting = momId ? items.find((m) => String(m._id ?? m.id) === String(momId)) : null;

  const myActions = useMemo(() => {
    const out = [];
    for (const m of items) {
      for (const a of m.actions ?? []) {
        const ownerId = mtgIdOf(a.owner);
        if (myEmpId && ownerId && ownerId === String(myEmpId)) {
          out.push({ ...a, meetingId: m._id ?? m.id, meetingTitle: m.title, meetingDate: m.date });
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

  return (
    <>
      <Panel title="My invitations (upcoming scheduled)">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : upcoming.length === 0 ? (
          <EmptyState text="No upcoming invitations." />
        ) : (
          upcoming.map((m) => (
            <div key={String(m._id ?? m.id)} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{m.title ?? '—'}</b>
                <StatusPill tone={statusTone(m.status)}>{m.status ?? '—'}</StatusPill>
                <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{mtgProjLabel(m.project)} · {mtgFmtDate(m.date)} {m.startTime ?? ''}</span>
                <button type="button" className="approve-btn" onClick={() => setDetailId(m._id ?? m.id)}>Details</button>
              </div>
              <ResponseBox meeting={m} myEmpId={myEmpId} />
            </div>
          ))
        )}
      </Panel>
      <Panel title="Meeting log (held / cancelled / past)">
        <DataTable
          columns={[
            { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
            { key: 'project', label: 'Project', render: (r) => mtgProjLabel(r.project) },
            { key: 'date', label: 'Date', render: (r) => mtgFmtDate(r.date) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
          ]}
          rows={log}
          emptyText="No past meetings."
          onRowClick={(r) => setDetailId(r._id ?? r.id)}
        />
      </Panel>
      <Panel title="MOM view">
        {withMom.length === 0 ? <EmptyState text="No MOM published yet." /> : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {withMom.map((m) => (
                <button key={String(m._id ?? m.id)} type="button" className={`tab-btn${String(momId) === String(m._id ?? m.id) ? ' active' : ''}`} onClick={() => setMomId(m._id ?? m.id)}>
                  {m.title ?? '—'}
                </button>
              ))}
            </div>
            {!momMeeting ? <EmptyState text="Select a meeting to read its MOM." /> : (
              <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{momMeeting.mom}</p>
            )}
          </>
        )}
      </Panel>
      <Panel title={`My action items (${myActions.length})`}>
        <DataTable
          columns={[
            { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
            { key: 'meeting', label: 'Meeting', render: (a) => `${a.meetingTitle ?? '—'} · ${mtgFmtDate(a.meetingDate)}` },
            { key: 'due', label: 'Due', render: (a) => `${mtgFmtDate(a.due)} · ${actionLabel(a)}` },
            { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
            {
              key: 'flip',
              label: 'Update',
              render: (a) => (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="approve-btn" onClick={() => flip.mutate({ meetingId: a.meetingId, actionId: a._id ?? a.id, status: 'Completed' })}>Complete</button>
                  <button type="button" className="approve-btn" onClick={() => flip.mutate({ meetingId: a.meetingId, actionId: a._id ?? a.id, status: 'Open' })}>Reopen</button>
                </span>
              ),
            },
          ]}
          rows={myActions}
          emptyText="No action items assigned to you."
        />
      </Panel>
      {detailId && <MeetingDetailModal meetingId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
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
            <EmptyState text="Transmittal details arrive in Phase 3." />
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
