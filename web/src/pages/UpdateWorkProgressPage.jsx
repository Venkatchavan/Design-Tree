import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  bootstrapApi,
  projectsApi,
  workEntriesApi,
} from '../lib/api.js';
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

export default function UpdateWorkProgressPage({ bootstrap: bootstrapProp }) {
  useBootstrapProp(bootstrapProp);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('Assigned Daily Work');
  const [deliverable, setDeliverable] = useState('');
  const [taskActivity, setTaskActivity] = useState('');
  const [drawing, setDrawing] = useState('');
  const [stage, setStage] = useState('');
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

  const projectsQ = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const projectOptions = projectsQ.data?.items ?? [];

  const previewQ = useQuery({
    queryKey: ['project', project],
    queryFn: () => projectsApi.get(project),
    enabled: !!project,
  });
  const preview = previewQ.data?.project ?? previewQ.data?.item ?? previewQ.data ?? null;

  const mineQ = useQuery({
    queryKey: ['my-work-entries'],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  const myEntries = mineQ.data?.items ?? [];

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setOk(
        variables?._leadAction
          ? 'Submitted for team lead action.'
          : "Today's update submitted.",
      );
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

  function buildBody(leadAction) {
    if (!project) {
      setErr('Select a project.');
      return null;
    }
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      setErr('Hours must be greater than 0.');
      return null;
    }
    const pct = progressPct === '' ? undefined : Number(progressPct);
    if (pct !== undefined && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      setErr('Progress % must be between 0 and 100.');
      return null;
    }
    const total = h + otherRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    if (total > EXTRA_HOURS_AT && !extraHoursReason.trim()) {
      setErr(`A reason is required for extra hours (over ${EXTRA_HOURS_AT}h in a day).`);
      return null;
    }
    return {
      project,
      date: todayISO(),
      hours: h,
      stage: stage || undefined,
      notes: notes || undefined,
      extraHoursReason: total > EXTRA_HOURS_AT ? extraHoursReason.trim() : undefined,
      category,
      deliverable:
        category === 'Assigned Daily Work' || category === 'Task'
          ? deliverable || undefined
          : undefined,
      taskActivity: category === 'Task' ? taskActivity || undefined : undefined,
      drawing: category === 'Drawing' ? drawing || undefined : undefined,
      progressPct: pct,
      otherHours: otherRows
        .filter((r) => r.project && Number(r.hours) > 0)
        .map((r) => ({ project: r.project, hours: Number(r.hours) })),
      _leadAction: leadAction || undefined,
    };
  }

  function handleSubmit(e, leadAction) {
    e.preventDefault();
    setErr('');
    setOk('');
    const body = buildBody(leadAction);
    if (!body) return;
    const payload = { ...body };
    delete payload._leadAction;
    create.mutate(leadAction ? { ...payload, _leadAction: true } : payload);
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Update work progress</div>
        <div className="page-sub">Daily progress form — both buttons create work entries only.</div>
      </div>

      <Panel title="Log work">
        {pendingLogout && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            Mandatory hours pending: submitting today&apos;s update will complete sign-out.
          </div>
        )}
        <form>
          <div className="form-row">
            <label className="form-label">Project *</label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={project}
              onChange={(e) => setProject(e.target.value)}
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
              <Field label="Job / client" value={preview?.clientName ?? preview?.client ?? preview?.job ?? '—'} />
              <Field label="Branch" value={preview?.branch ?? '—'} />
              <Field label="Stage" value={preview?.currentStage ?? preview?.stage ?? '—'} />
              <Field label="Team" value={preview?.team?.name ?? preview?.team ?? '—'} />
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Log against *</label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {['Assigned Daily Work', 'Hourly', 'Drawing', 'Task'].map((c) => (
                <label key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="radio"
                    name="uwp-category"
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
              <label className="form-label">Stage</label>
              <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
            </div>
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
                {projectOptions.map((p) => (
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="approve-btn" disabled={create.isPending} onClick={(e) => handleSubmit(e, false)}>
              {create.isPending ? 'Submitting…' : "Submit today's update"}
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending} onClick={(e) => handleSubmit(e, true)}>
              {create.isPending ? 'Submitting…' : 'Submit for team lead action'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8 }}>
            Both buttons create work entries only (no task status change).
          </p>
        </form>
      </Panel>

      <Panel title="My submissions">
        {mineQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
              { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
              { key: 'progressPct', label: 'Progress %', render: (e) => e.progressPct ?? '—' },
              {
                key: 'status',
                label: 'Status',
                render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
              },
            ]}
            rows={myEntries}
            emptyText="No submissions yet."
          />
        )}
      </Panel>
    </>
  );
}
