import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  bootstrapApi,
  projectsApi,
  workEntriesApi,
} from '../lib/api.js';
import { teamsMineApi, tasksApi } from '../lib/workApi.js';
import {
  isPendingLogout,
  performLogout,
  takePendingLogout,
} from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import DesignHeadWorkUpdatePage from './DesignHeadWorkUpdatePage.jsx';

export default function UpdateWorkProgressPage({ bootstrap, user }) {
  if (bootstrap?.role?.key === 'design_mgmt_head') {
    return <DesignHeadWorkUpdatePage bootstrap={bootstrap} user={user} />;
  }
  return <StandardUpdateWorkProgressPage bootstrap={bootstrap} user={user} />;
}

function toneFor(status) {
  const s = String(status ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'open') return 'amber';
  if (s === 'submitted') return 'teal';
  return statusTone(status);
}
function wuDisplay(e) {
  return e?.wuNo ?? e?.refNo ?? '—';
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
function useBootstrapProp(prop) {
  const q = useQuery({ queryKey: ['bootstrap'], queryFn: bootstrapApi, enabled: !prop });
  return prop ?? q.data ?? null;
}

function StandardUpdateWorkProgressPage({ bootstrap: bootstrapProp, user }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const roleKey = bootstrap?.role?.key ?? '';
  const isPTL = roleKey === 'team_lead';
  const userName = user?.name ?? user?.email ?? '';
  const userDesig = user?.designation ?? bootstrap?.role?.label ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [project, setProject] = useState('');
  const [assignedId, setAssignedId] = useState('');
  const [taskActivity, setTaskActivity] = useState('');
  const [drawing, setDrawing] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());
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

  const projectsQ = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const teamsQ = useQuery({
    queryKey: ['teams-mine-uwp'],
    queryFn: teamsMineApi.list,
    enabled: isPTL,
    retry: false,
  });
  const myTeams = useMemo(() => {
    const d = teamsQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.items ?? d.teams ?? [];
  }, [teamsQ.data]);
  const teamProjectIds = useMemo(() => {
    const ids = new Set();
    for (const t of myTeams) {
      for (const p of t.projects ?? []) ids.add(String(p?._id ?? p?.id ?? p ?? ''));
    }
    return ids;
  }, [myTeams]);
  const projectOptions = useMemo(() => {
    const all = projectsQ.data?.items ?? [];
    if (!isPTL || teamProjectIds.size === 0) return all;
    return all.filter((p) => teamProjectIds.has(String(p._id ?? p.id ?? '')));
  }, [projectsQ.data, isPTL, teamProjectIds]);

  const previewQ = useQuery({
    queryKey: ['project', project],
    queryFn: () => projectsApi.get(project),
    enabled: !!project,
  });
  const preview = previewQ.data?.project ?? previewQ.data?.item ?? previewQ.data ?? null;

  const tasksQ = useQuery({
    queryKey: ['tasks-mine-uwp'],
    queryFn: tasksApi.mine,
    retry: false,
  });
  const projectTasks = useMemo(
    () => (tasksQ.data?.items ?? tasksQ.data?.tasks ?? []).filter(
      (t) => String(t.project?._id ?? t.project?.id ?? t.project ?? '') === project,
    ),
    [tasksQ.data, project],
  );
  const selectedTask = projectTasks.find((t) => String(t._id ?? t.id) === assignedId) ?? null;

  const mineQ = useQuery({
    queryKey: ['my-work-entries'],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  const myEntries = mineQ.data?.items ?? [];
  const teamEntriesQ = useQuery({
    queryKey: ['team-work-entries-uwp'],
    queryFn: () => workEntriesApi.list({}),
    enabled: isPTL,
    retry: false,
  });
  const teamEntries = useMemo(() => {
    const items = teamEntriesQ.data?.items ?? [];
    if (teamProjectIds.size === 0) return items;
    return items.filter((e) => {
      const pid = e?.project?._id ?? e?.project?.id ?? (typeof e?.project === 'string' ? e.project : '');
      return teamProjectIds.has(String(pid ?? ''));
    });
  }, [teamEntriesQ.data, teamProjectIds]);
  const submissionRows = isPTL ? [...teamEntries].sort((a, b) =>
    String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))) : myEntries;

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
    const total = h + otherRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    if (total > EXTRA_HOURS_AT && !extraHoursReason.trim()) {
      setErr(`A reason is required for extra hours (over ${EXTRA_HOURS_AT}h in a day).`);
      return null;
    }
    return {
      project,
      date,
      hours: h,
      stage: selectedTask?.stage || undefined,
      notes: notes || undefined,
      extraHoursReason: total > EXTRA_HOURS_AT ? extraHoursReason.trim() : undefined,
      category: selectedTask ? 'Assigned Daily Work' : 'Hourly',
      deliverable: selectedTask?.deliverable || undefined,
      taskActivity: taskActivity || undefined,
      drawing: drawing || undefined,
      otherHours: otherRows
        .filter((r) => r.project && Number(r.hours) > 0)
        .map((r) => ({ project: r.project, hours: Number(r.hours) })),
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
        <div className="page-sub">Daily progress form — both buttons create work entries only.</div>
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
        <div className="form-row" style={{ maxWidth: 420 }}>
          <label className="form-label">Project</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={project}
            onChange={(e) => { setProject(e.target.value); setAssignedId(''); }}
          >
            <option value="">Select project</option>
            {projectOptions.map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.name} ({p.code ?? ''})
              </option>
            ))}
          </select>
        </div>
        {project && (
          <div className="field-grid" style={{ marginBottom: 12 }}>
            <Field label="Job no." value={preview?.jobNumber ?? preview?.job ?? '—'} />
            <Field label="Client" value={preview?.clientName ?? preview?.client ?? '—'} />
            <Field label="Branch" value={preview?.branch ?? '—'} />
            <Field label="Current stage" value={preview?.currentStage ?? preview?.stage ?? '—'} />
            <Field
              label="Project team"
              value={((preview?.principalTeamLeads ?? []).map((t) => `${t.name ?? ''}${t.service ? ` · ${t.service}` : ''}`.trim()).filter((s) => s && s !== '·').join(', ')) || (preview?.team?.name ?? preview?.team ?? '—')}
            />
          </div>
        )}
      </Panel>

      <Panel title="2. What are you logging work against?">
        <div className="form-row" style={{ maxWidth: 420, marginBottom: 0 }}>
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
              <input type="number" min="0" max="16" step="0.5" className="form-input" placeholder="e.g. 4.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Drawing</label>
              <input className="form-input" placeholder="e.g. S-302 Column layout, R01" value={drawing} onChange={(e) => setDrawing(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Task / Activity</label>
            <input className="form-input" placeholder="e.g. Column layout detailing" value={taskActivity} onChange={(e) => setTaskActivity(e.target.value)} />
          </div>
          <div className="section-label">Worked on other projects too? Add their hours{isPTL ? ' — lists every project under your PTL' : ''}</div>
          {otherRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                className="filter-select"
                style={{ flex: 2 }}
                value={r.project}
                onChange={(e) => setOtherRows((rs) => rs.map((x, j) => (j === i ? { ...x, project: e.target.value } : x)))}
              >
                <option value="">Select project</option>
                {projectOptions.filter((p) => String(p._id ?? p.id) !== project).map((p) => (
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
            Add other project hours
          </button>
          <div className="form-row">
            <label className="form-label">Remarks</label>
            <textarea className="form-input" placeholder="Describe the work completed in this update" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          {ok && <div style={{ color: 'var(--forest-dark)', fontSize: 13, marginBottom: 10 }}>{ok}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit for team lead action'}
          </button>
        </form>
      </Panel>

      <Panel title="My submissions" sub="Everyone's updates logged from this page, most recent first">
        {mineQ.isLoading || (isPTL && teamEntriesQ.isLoading) ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'wu', label: 'WU no.', render: (e) => wuDisplay(e) },
              { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
              ...(isPTL ? [{ key: 'employee', label: 'Employee', render: (e) => empName(e.employee) }] : []),
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'stage', label: 'Stage', render: (e) => e.stage ?? '—' },
              { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
              { key: 'task', label: 'Task / Activity', render: (e) => e.taskActivity ?? '—' },
              { key: 'drawing', label: 'Drawing', render: (e) => e.drawing ?? '—' },
              { key: 'hours', label: 'Hourly work handled', render: (e) => e.hours ?? '—' },
              {
                key: 'status',
                label: 'Status',
                render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
              },
            ]}
            rows={submissionRows}
            emptyText="No work progress submitted yet."
          />
        )}
      </Panel>
    </>
  );
}
