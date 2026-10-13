import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, workEntriesApi } from '../lib/api.js';
import { tasksApi, teamsMineApi } from '../lib/workApi.js';
import {
  isPendingLogout,
  performLogout,
  takePendingLogout,
} from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';

// Day's extra-hours threshold (mirrors EXTRA_HOURS_THRESHOLD in
// api/src/config/attendance.js; the server enforces it as well).
const EXTRA_HOURS_AT = 8;
const PTL_LABEL = 'Principal team lead';
const GENERAL_WORK_LABEL = 'General / other work — no specific daily assignment for this project';

function idOf(v) {
  return String(v?._id ?? v?.id ?? v ?? '');
}
function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}
function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
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

export default function DesignHeadWorkUpdatePage({ bootstrap, user }) {
  const userName = user?.name ?? user?.email ?? '';
  const userDesig = user?.designation ?? bootstrap?.role?.label ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pendingLogout = isPendingLogout();

  const [project, setProject] = useState('');
  const [taskId, setTaskId] = useState('');
  const [hours, setHours] = useState('');
  const [drawing, setDrawing] = useState('');
  const [taskActivity, setTaskActivity] = useState('');
  const [otherRows, setOtherRows] = useState([]);
  const [notes, setNotes] = useState('');
  const [extraHoursReason, setExtraHoursReason] = useState('');
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const totalHours =
    (Number(hours) || 0) +
    otherRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const needsExtraReason = totalHours > EXTRA_HOURS_AT;

  const projectsQ = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const teamsQ = useQuery({
    queryKey: ['teams-mine-uwp'],
    queryFn: teamsMineApi.list,
    retry: false,
  });
  const tasksQ = useQuery({
    queryKey: ['tasks-mine-uwp'],
    queryFn: tasksApi.mine,
    retry: false,
  });
  const previewQ = useQuery({
    queryKey: ['project', project],
    queryFn: () => projectsApi.get(project),
    enabled: !!project,
  });
  const entriesQ = useQuery({
    queryKey: ['work-entries', 'design-head-uwp'],
    queryFn: () => workEntriesApi.list({}),
  });

  const myProjectIds = useMemo(() => {
    const ids = new Set();
    for (const t of teamsQ.data?.items ?? []) {
      for (const p of t.projects ?? []) ids.add(idOf(p));
    }
    for (const t of tasksQ.data?.items ?? []) ids.add(idOf(t.project));
    ids.delete('');
    return ids;
  }, [teamsQ.data, tasksQ.data]);

  const projects = useMemo(
    () => (projectsQ.data?.items ?? []).filter((p) => myProjectIds.has(idOf(p))),
    [projectsQ.data, myProjectIds],
  );

  const myTasks = useMemo(
    () =>
      (tasksQ.data?.items ?? []).filter(
        (t) => idOf(t.project) === project && t.status !== 'Approved',
      ),
    [tasksQ.data, project],
  );
  const selectedTask = myTasks.find((t) => idOf(t) === taskId) ?? null;

  const preview = previewQ.data?.project ?? previewQ.data?.item ?? previewQ.data ?? null;
  const projectTeam = useMemo(
    () =>
      (preview?.principalTeamLeads ?? []).flatMap((t) => {
        const names = (t.names ?? []).filter(Boolean);
        return (names.length > 0 ? names : [t.name]).filter(Boolean).map((n) => `${n} · ${PTL_LABEL}`);
      }),
    [preview],
  );

  const entries = useMemo(
    () =>
      [...(entriesQ.data?.items ?? [])].sort((a, b) =>
        String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))),
    [entriesQ.data],
  );

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setOk('Submitted for team lead action.');
      setErr('');
      setTaskId('');
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

  function buildBody() {
    if (!project) {
      setErr('Select a project.');
      return null;
    }
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      setErr('Hourly work handled must be greater than 0.');
      return null;
    }
    if (!date) {
      setErr('Select a date.');
      return null;
    }
    const otherHours = otherRows
      .filter((r) => r.project && Number(r.hours) > 0)
      .map((r) => ({ project: r.project, hours: Number(r.hours) }));
    const total = h + otherHours.reduce((s, r) => s + r.hours, 0);
    if (total > EXTRA_HOURS_AT && !extraHoursReason.trim()) {
      setErr(`A reason is required for extra hours (over ${EXTRA_HOURS_AT}h in a day).`);
      return null;
    }
    return {
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
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    const body = buildBody();
    if (!body) return;
    create.mutate(body);
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Update work progress</div>
        <div className="page-sub">Daily progress form — submissions go to your team lead for action.</div>
        {userName && (
          <div className="page-sub" style={{ marginTop: 4 }}>
            {userName}{userDesig ? ` · ${userDesig}` : ''}
          </div>
        )}
      </div>

      <Panel title="1. Select project" sub="Showing only the projects you're on">
        {pendingLogout && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            Mandatory hours pending: submitting today&apos;s update will complete sign-out.
          </div>
        )}
        {projectsQ.isLoading || teamsQ.isLoading || tasksQ.isLoading ? (
          <EmptyState text="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState text="You are not on any project yet." />
        ) : (
          <>
            <div className="form-row" style={{ maxWidth: 420 }}>
              <label className="form-label">Project</label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setTaskId('');
                }}
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={idOf(p)} value={idOf(p)}>{p.name ?? p.code ?? '—'}</option>
                ))}
              </select>
            </div>
            {project && (
              <>
                <div className="field-grid" style={{ marginBottom: 12 }}>
                  <Field label="Job no." value={preview?.jobNumber ?? '—'} />
                  <Field label="Client" value={preview?.clientName ?? '—'} />
                  <Field label="Branch" value={preview?.branch ?? '—'} />
                  <Field label="Current stage" value={preview?.currentStage ?? '—'} />
                </div>
                <div className="field-label" style={{ marginBottom: 8 }}>Project team</div>
                {projectTeam.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No team data available.</div>
                ) : (
                  projectTeam.map((line) => (
                    <div key={line} style={{ fontSize: 14 }}>{line}</div>
                  ))
                )}
              </>
            )}
          </>
        )}
      </Panel>

      <Panel title="2. What are you logging work against?">
        <div className="form-row" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label className="form-label">Assigned Daily Work from PTL/TL</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={taskId}
            disabled={!project}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">{GENERAL_WORK_LABEL}</option>
            {myTasks.map((t) => (
              <option key={idOf(t)} value={idOf(t)}>
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
                max="24"
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

          <div className="section-label">Worked on other projects too? Add their hours</div>
          <div className="page-sub" style={{ marginBottom: 8 }}>Lists every project under your PTL</div>
          {otherRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                className="filter-select"
                style={{ flex: 2 }}
                value={r.project}
                onChange={(e) => setOtherRows((rs) => rs.map((x, j) => (j === i ? { ...x, project: e.target.value } : x)))}
              >
                <option value="">Select project</option>
                {projects.filter((p) => idOf(p) !== project).map((p) => (
                  <option key={idOf(p)} value={idOf(p)}>{p.name ?? p.code ?? '—'}</option>
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
              <button
                type="button"
                className="approve-btn"
                onClick={() => setOtherRows((rs) => rs.filter((_, j) => j !== i))}
              >
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
            Add other project hours
          </button>

          <div className="form-row">
            <label className="form-label">Remarks</label>
            <textarea
              className="form-input"
              rows={3}
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

      <Panel title="My submissions" sub="Everyone's updates logged from this page, most recent first">
        {entriesQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'wu', label: 'WU no.', render: (e) => e.wuNo ?? e.refNo ?? '—' },
              { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
              { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'stage', label: 'Stage', render: (e) => e.stage ?? '—' },
              { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? '—' },
              { key: 'task', label: 'Task / Activity', render: (e) => e.taskActivity ?? '—' },
              { key: 'drawing', label: 'Drawing', render: (e) => e.drawing ?? '—' },
              { key: 'hours', label: 'Hourly work handled', render: (e) => e.hours ?? '—' },
              {
                key: 'status',
                label: 'Status',
                render: (e) => <StatusPill tone={statusTone(e.status)}>{e.status ?? '—'}</StatusPill>,
              },
            ]}
            rows={entries}
            emptyText="No work progress submitted yet."
          />
        )}
      </Panel>
    </>
  );
}
