import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, request } from '../lib/api.js';
import { designApi } from '../lib/phase4aApi.js';
import { deliverablesApi, revisionsApi } from '../lib/workApi.js';
import { rfiApi } from '../lib/functionsApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { DesignKpiRow, TeamClientUpdates } from '../components/design/DesignHeadUpdates.jsx';

const SUPER = new Set(['founding_director', 'working_director', 'executive_director']);
const STEP_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const TEAM_SERVICES = [
  'SMEPF',
  'SMEP',
  'MEP',
  'STR',
  'PHE',
  'ELE',
  'HVAC',
  'FIRE',
  'BIM',
  'GBS',
];
const MATRIX_KEYS = ['discipline', 'spoc', 'td', 'channel', 'frequency'];

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director', 'associate_director']);
const STAGE_ORDER = { CD: 0, SD: 1, DD: 2, TD: 3, GFC: 4 };
const ON_TRACK_STATUSES = ['in progress', 'submitted', 'approved'];

function normStatus(v) {
  return String(v ?? '').toLowerCase();
}

function DirectorDesignView() {
  const [fProject, setFProject] = useState('');
  const [fService, setFService] = useState('');
  const [fStage, setFStage] = useState('');

  const projectsQ = useQuery({ queryKey: ['design-dir-projects'], queryFn: () => projectsApi.list({}) });
  const delsQ = useQuery({ queryKey: ['design-dir-deliverables'], queryFn: () => deliverablesApi.list({}) });
  const rfisQ = useQuery({ queryKey: ['design-dir-rfis'], queryFn: () => rfiApi.list({}) });
  const revsQ = useQuery({ queryKey: ['design-dir-revisions'], queryFn: () => revisionsApi.list({}) });
  const meetsQ = useQuery({ queryKey: ['design-dir-meetings'], queryFn: () => request('/api/meetings'), retry: false });

  const projectRows = arr(projectsQ.data);
  const delRows = useMemo(() => arr(delsQ.data), [delsQ.data]);
  const rfiRows = useMemo(() => arr(rfisQ.data), [rfisQ.data]);
  const revRows = useMemo(() => arr(revsQ.data), [revsQ.data]);
  const meetRows = useMemo(() => arr(meetsQ.data), [meetsQ.data]);

  const projIdOf = (p) => String(p?._id ?? p ?? '');
  const projectStageOf = useMemo(() => {
    const m = new Map();
    for (const p of projectRows) m.set(String(p._id), p.currentStage ?? '');
    return m;
  }, [projectsQ.data]);

  // ---- Function-wide KPIs (unfiltered) ----
  const onTrackDels = delRows.filter((d) => ON_TRACK_STATUSES.includes(normStatus(d.status)));
  const openRfis = rfiRows.filter((r) => normStatus(r.status) === 'open');
  const closedRfis = rfiRows.filter((r) => normStatus(r.status) === 'closed');
  const submittedDels = delRows.filter((d) => normStatus(d.status) === 'submitted');
  const pendingTd = submittedDels.length + openRfis.length;
  const periodStart = new Date(new Date().toISOString().slice(0, 10));
  periodStart.setDate(periodStart.getDate() - 30);
  const inPeriod = (v) => {
    if (!v) return false;
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d >= periodStart;
  };
  const closedPeriod =
    rfiRows.filter((r) => normStatus(r.status) === 'closed' && inPeriod(r.updatedAt)).length +
    revRows.filter((r) => normStatus(r.status) === 'cleared' && inPeriod(r.clearedAt ?? r.updatedAt)).length +
    delRows.filter((d) => normStatus(d.status) === 'approved' && inPeriod(d.updatedAt)).length;

  const delPct = delRows.length > 0 ? Math.round((onTrackDels.length / delRows.length) * 100) : 0;
  const rfiPct = rfiRows.length > 0 ? Math.round((closedRfis.length / rfiRows.length) * 100) : 0;

  // ---- Coordinators panel (filters apply where fields exist) ----
  const matchProject = (pid) => !fProject || pid === fProject;
  const rfiF = rfiRows.filter((r) => matchProject(projIdOf(r.project)));
  const meetF = meetRows.filter(
    (m) => matchProject(projIdOf(m.project)) && (!fService || (m.service ?? '') === fService),
  );
  const revF = revRows.filter(
    (r) => matchProject(projIdOf(r.project)) && (!fStage || String(r.stage ?? '').trim().toUpperCase() === fStage),
  );

  const pendingItems = meetF.reduce((s, m) => {
    const actions = Array.isArray(m.actions) ? m.actions : [];
    return s + actions.filter((a) => !['completed', 'closed'].includes(normStatus(a.status))).length;
  }, 0);
  const rfiOpenF = rfiF.filter((r) => normStatus(r.status) === 'open').length;
  const rfiClosedF = rfiF.filter((r) => normStatus(r.status) === 'closed').length;
  const meetOnlineF = meetF.filter((m) => normStatus(m.mode) === 'online').length;
  const meetOfflineF = meetF.length - meetOnlineF;
  const stageIdx = (s) => STAGE_ORDER[String(s ?? '').trim().toUpperCase()];
  const revWithinF = revF.filter((r) => {
    const ri = stageIdx(r.stage);
    const pi = stageIdx(projectStageOf.get(projIdOf(r.project)));
    if (ri == null || pi == null) return true;
    return ri <= pi;
  }).length;
  const revAfterF = revF.length - revWithinF;

  const loadError = delsQ.error?.message ?? rfisQ.error?.message ?? revsQ.error?.message ?? meetsQ.error?.message ?? projectsQ.error?.message;

  return (
    <div id="view-design-mgmt">
      <div className="page-head">
        <div className="page-title">Design Management</div>
        <div className="page-sub">Design Management Coordinator Head (SPOC Head) workflow — coordination, deliverables and RFI tracking across disciplines</div>
      </div>
      <Panel title="About this workflow">
        <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', margin: 0 }}>
          Coordinators (SPOCs) work under Design Management and report into this workflow through the
          Technical Director – Design Management, Suresh Iyengar. Deliverable submissions, RFIs, queries
          and escalations raised by a SPOC are reviewed and actioned by the Technical Director before
          they can be closed.
        </p>
      </Panel>
      <div className="kpi-grid cols-5">
        <KpiCard label="Deliverables tracked" value={delRows.length} accent="blueprint" />
        <KpiCard label="On track / submitted" value={onTrackDels.length} accent="forest" />
        <KpiCard label="RFIs / queries open" value={openRfis.length} accent="amber" />
        <KpiCard label="Pending Technical Director action" value={pendingTd} accent="rust" />
        <KpiCard label="Closed this period" value={closedPeriod} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="Performance overview" sub="Summary for the entire Design Management function — full workflow, RFI and deliverable detail is available in the Design Management Head's workspace">
        <div className="perf-row">
          <span className="perf-label">{onTrackDels.length} of {delRows.length} deliverables on track ({delPct}%)</span>
          <div className="perf-track"><div className="perf-fill forest" style={{ width: `${delPct}%` }} /></div>
        </div>
        <div className="perf-row">
          <span className="perf-label">{closedRfis.length} of {rfiRows.length} RFIs closed ({rfiPct}%)</span>
          <div className="perf-track"><div className="perf-fill teal" style={{ width: `${rfiPct}%` }} /></div>
        </div>
      </Panel>
      <Panel title="Coordinators' work — Project / Service / Stage-wise" sub="Overview of every coordinator's pending items, RFIs, meetings and revisions">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <select className="filter-select" value={fProject} onChange={(e) => setFProject(e.target.value)}>
            <option value="">All projects</option>
            {projectRows.map((p) => <option key={p._id} value={String(p._id)}>{p.name} ({p.code})</option>)}
          </select>
          <select className="filter-select" value={fService} onChange={(e) => setFService(e.target.value)}>
            <option value="">All services</option>
            {TEAM_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={fStage} onChange={(e) => setFStage(e.target.value)}>
            <option value="">All stages</option>
            {Object.keys(STAGE_ORDER).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Pending items & follow-ups" value={pendingItems} accent="rust" />
          <KpiCard label="RFIs open" value={rfiOpenF} accent="amber" />
          <KpiCard label="RFIs closed" value={rfiClosedF} accent="forest" />
          <KpiCard label="Meetings — online" value={meetOnlineF} accent="teal" />
          <KpiCard label="Meetings — offline" value={meetOfflineF} accent="blueprint" />
          <KpiCard label="Revisions — within stage" value={revWithinF} accent="forest" />
          <KpiCard label="Revisions — after stage completion" value={revAfterF} accent="rust" />
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Filters apply where records carry that field: deliverables carry project and stage only;
          RFIs carry project only; meetings carry project and service; revisions carry project and stage.
        </p>
      </Panel>
    </div>
  );
}

const TABS = [
  { key: 'workflow', label: 'Workflow' },
  { key: 'matrix', label: 'Responsibility & communication matrix' },
  { key: 'deliverables', label: 'Deliverables tracker' },
  { key: 'rfis', label: 'RFIs' },
  { key: 'updates', label: 'Team & client updates' },
];

const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function DesignMgmtPage({ bootstrap, user, viewKey }) {
  void user;
  void viewKey;
  const role = bootstrap?.role?.key ?? '';
  const canEdit = SUPER.has(role) || role === 'design_mgmt_head';
  const qc = useQueryClient();

  const [tab, setTab] = useState('workflow');
  const [project, setProject] = useState('');
  const [steps, setSteps] = useState([]);
  const [matrix, setMatrix] = useState([]);

  const projects = useQuery({
    queryKey: ['projects-design-mgmt'],
    queryFn: () => projectsApi.list({}),
  });
  const projectRows = arr(projects.data);
  const activeProject = project || projectRows[0]?._id || '';

  const meta = useQuery({ queryKey: ['design-meta'], queryFn: designApi.meta });
  const design = useQuery({
    queryKey: ['design', activeProject],
    queryFn: () => designApi.get(activeProject),
    enabled: !!activeProject,
  });

  const deliverables = useQuery({
    queryKey: ['design-deliverables', activeProject],
    queryFn: () => deliverablesApi.list({ project: activeProject }),
    enabled: !!activeProject,
  });
  const rfis = useQuery({
    queryKey: ['design-rfis', activeProject],
    queryFn: () => rfiApi.list({ project: activeProject }),
    enabled: !!activeProject,
  });

  useEffect(() => {
    const item = design.data?.item;
    if (!item) {
      setSteps([]);
      setMatrix([]);
      return;
    }
    setSteps(Array.isArray(item.steps) ? item.steps : []);
    setMatrix(Array.isArray(item.matrix) ? item.matrix : []);
  }, [design.data]);

  const metaSteps = meta.data?.steps ?? [];
  const metaOwners = meta.data?.owners ?? [];
  const tableSteps = useMemo(() => {
    if (steps.length > 0) return steps;
    return metaSteps.map((label, i) => ({
      n: i + 1,
      label,
      owner: metaOwners[i] ?? '—',
      status: 'Not Started',
      remarks: '',
      date: '',
    }));
  }, [steps, metaSteps, metaOwners]);

  const save = useMutation({
    mutationFn: designApi.save,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['design', activeProject] }),
  });
  const delRows = useMemo(() => arr(deliverables.data), [deliverables.data]);
  const rfiRows = useMemo(() => arr(rfis.data), [rfis.data]);

  function patchStep(n, field, value) {
    setSteps((prev) => {
      const base = prev.length > 0 ? prev : tableSteps;
      return base.map((s) => (s.n === n ? { ...s, [field]: value } : s));
    });
  }

  function patchMatrix(idx, field, value) {
    setMatrix((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function addMatrixRow() {
    setMatrix((prev) => [...prev, { discipline: '', spoc: '', td: '', channel: '', frequency: '' }]);
  }

  function removeMatrixRow(idx) {
    setMatrix((prev) => prev.filter((_, i) => i !== idx));
  }

  function submitSteps(e) {
    e.preventDefault();
    const base = steps.length > 0 ? steps : tableSteps;
    save.mutate({
      project: activeProject,
      steps: base.map((s) => ({
        n: s.n,
        status: s.status,
        remarks: s.remarks,
        date: s.date || undefined,
      })),
      matrix: matrix
        .filter((r) => MATRIX_KEYS.some((k) => String(r[k] ?? '').trim()))
        .map((r) => Object.fromEntries(MATRIX_KEYS.map((k) => [k, r[k] ?? ''])))
    });
  }

  const saveError = save.error?.message;
  const loadError =
    design.error?.message ?? meta.error?.message ?? projects.error?.message;

  if (DIRECTOR_ROLES.has(role)) {
    return <DirectorDesignView />;
  }

  return (
    <div id="view-design-mgmt">
      <div className="page-head">
        <div className="page-title">Design Management</div>
        <div className="page-sub">
          16-step design workflow, responsibility matrix, deliverables and RFIs per project.
          {canEdit ? '' : ' Read-only for your role.'}
        </div>
      </div>

      <Panel title="Project">
        <div className="form-row">
          <label className="form-label">Project *</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={activeProject}
            onChange={(e) => setProject(e.target.value)}
          >
            {projectRows.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
        {design.data?.item?.updatedAt && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            Last updated: {fmtDate(design.data.item.updatedAt)}
          </p>
        )}
      </Panel>

      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {loadError}
        </div>
      )}

      <DesignKpiRow />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'workflow' && (
        <>
          <Panel title="16-step design workflow">
            {design.isLoading ? (
              <EmptyState text="Loading design workflow…" />
            ) : tableSteps.length === 0 ? (
              <EmptyState text="No design workflow found for this project yet." />
            ) : (
              <form onSubmit={submitSteps}>
                <DataTable
                  columns={[
                    { key: 'n', label: '#' },
                    { key: 'label', label: 'Step' },
                    { key: 'owner', label: 'Owner' },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (r) =>
                        canEdit ? (
                          <select
                            className="filter-select"
                            value={r.status ?? 'Not Started'}
                            onChange={(e) => patchStep(r.n, 'status', e.target.value)}
                          >
                            {STEP_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <StatusPill status={r.status}>{r.status}</StatusPill>
                        ),
                    },
                    {
                      key: 'remarks',
                      label: 'Remarks',
                      render: (r) =>
                        canEdit ? (
                          <input
                            className="form-input"
                            value={r.remarks ?? ''}
                            onChange={(e) => patchStep(r.n, 'remarks', e.target.value)}
                          />
                        ) : (
                          (r.remarks || '—')
                        ),
                    },
                    {
                      key: 'date',
                      label: 'Date',
                      render: (r) =>
                        canEdit ? (
                          <input
                            type="date"
                            className="form-input"
                            value={r.date ? String(r.date).slice(0, 10) : ''}
                            onChange={(e) => patchStep(r.n, 'date', e.target.value)}
                          />
                        ) : (
                          fmtDate(r.date)
                        ),
                    },
                  ]}
                  rows={tableSteps}
                  emptyText="No workflow steps yet."
                />
                {canEdit && (
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={save.isPending || !activeProject}
                  >
                    {save.isPending ? 'Saving…' : 'Save workflow'}
                  </button>
                )}
              </form>
            )}
            {saveError && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {saveError}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'matrix' && (
        <Panel title="Responsibility & Communication Matrix">
          {design.isLoading ? (
            <EmptyState text="Loading matrix…" />
          ) : (
            <form onSubmit={submitSteps}>
              <DataTable
                columns={[
                  {
                    key: 'discipline',
                    label: 'Discipline / team',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.discipline ?? ''}
                          onChange={(e) => patchMatrix(r._rowKey, 'discipline', e.target.value)}
                        />
                      ) : (
                        (r.discipline || '—')
                      ),
                  },
                  {
                    key: 'spoc',
                    label: 'SPOC / Coordinator',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.spoc ?? ''}
                          onChange={(e) => patchMatrix(r._rowKey, 'spoc', e.target.value)}
                        />
                      ) : (
                        (r.spoc || '—')
                      ),
                  },
                  {
                    key: 'td',
                    label: 'Technical Director',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.td ?? ''}
                          onChange={(e) => patchMatrix(r._rowKey, 'td', e.target.value)}
                        />
                      ) : (
                        (r.td || '—')
                      ),
                  },
                  {
                    key: 'channel',
                    label: 'Communication channel',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.channel ?? ''}
                          onChange={(e) => patchMatrix(r._rowKey, 'channel', e.target.value)}
                        />
                      ) : (
                        (r.channel || '—')
                      ),
                  },
                  {
                    key: 'frequency',
                    label: 'Frequency',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.frequency ?? ''}
                          onChange={(e) => patchMatrix(r._rowKey, 'frequency', e.target.value)}
                        />
                      ) : (
                        (r.frequency || '—')
                      ),
                  },
                  ...(canEdit
                    ? [
                        {
                          key: 'actions',
                          label: '',
                          render: (r) => (
                            <button
                              type="button"
                              className="back-link"
                              onClick={() => removeMatrixRow(r._rowKey)}
                            >
                              Remove
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
                rows={matrix.map((r, i) => ({ ...r, _rowKey: i }))}
                emptyText={
                  canEdit
                    ? 'No rows yet — click “Add row” to start the matrix.'
                    : 'No responsibility & communication matrix recorded for this project yet.'
                }
              />
              {canEdit && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="approve-btn" onClick={addMatrixRow}>
                    + Add row
                  </button>
                </div>
              )}
              {canEdit && (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={save.isPending || !activeProject}
                  style={{ marginTop: 12 }}
                >
                  {save.isPending ? 'Saving…' : 'Save matrix'}
                </button>
              )}
            </form>
          )}
          {saveError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {saveError}
            </div>
          )}
        </Panel>
      )}

      {tab === 'deliverables' && (
        <Panel title="Deliverables tracker">
          {deliverables.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {deliverables.error.message}
            </div>
          ) : deliverables.isLoading ? (
            <EmptyState text="Loading deliverables…" />
          ) : (
            <DataTable
              columns={[
                { key: 'title', label: 'Deliverable', render: (r) => r.title ?? r.name ?? '—' },
                { key: 'stage', label: 'Stage' },
                { key: 'dueDate', label: 'Due', render: (r) => fmtDate(r.dueDate) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                { key: 'owner', label: 'Owner', render: (r) => r.owner?.name ?? r.owner ?? '—' },
              ]}
              rows={delRows}
              emptyText="No deliverables tracked for this project yet."
            />
          )}
        </Panel>
      )}

      {tab === 'rfis' && (
        <Panel title="RFIs">
          {rfis.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {rfis.error.message}
            </div>
          ) : rfis.isLoading ? (
            <EmptyState text="Loading RFIs…" />
          ) : (
            <DataTable
              columns={[
                { key: 'subject', label: 'Subject', render: (r) => r.subject ?? r.title ?? '—' },
                { key: 'raisedBy', label: 'Raised by' },
                { key: 'raisedOn', label: 'Raised on', render: (r) => fmtDate(r.raisedOn ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                { key: 'response', label: 'Response', render: (r) => r.response ?? '—' },
              ]}
              rows={rfiRows}
              emptyText="No RFIs for this project yet."
            />
          )}
        </Panel>
      )}

      {tab === 'updates' && <TeamClientUpdates />}
    </div>
  );
}
