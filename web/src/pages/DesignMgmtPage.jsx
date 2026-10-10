import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, request, toQuery } from '../lib/api.js';
import { designApi } from '../lib/phase4aApi.js';
import { deliverablesApi, revisionsApi } from '../lib/workApi.js';
import { rfiApi } from '../lib/functionsApi.js';
import { spocApi } from '../lib/spocApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const SUPER = new Set(['founding_director', 'working_director']);
const STEP_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const TEAM_SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'BIM',
  'QA/QC',
  'Peer Review',
  'QS/BOQ',
  'Other',
];
const TEAM_STATUSES = ['Pending', 'Confirmed'];

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);
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
  { key: 'matrix', label: 'Responsibility matrix' },
  { key: 'team', label: 'Team finalisation' },
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
  const [matrix, setMatrix] = useState({});
  const [teamStatus, setTeamStatus] = useState('Pending');
  const [disciplines, setDisciplines] = useState([]);
  const [sharedToAdmin, setSharedToAdmin] = useState(false);
  const [teamLoadedFor, setTeamLoadedFor] = useState('');

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
  const meetings = useQuery({
    queryKey: ['design-meetings', activeProject],
    queryFn: () => request(`/api/meetings${toQuery({ project: activeProject })}`),
    enabled: !!activeProject,
    retry: false,
  });
  const spocEntries = useQuery({
    queryKey: ['design-spoc', activeProject],
    queryFn: () => spocApi.entriesList({ project: activeProject }),
    enabled: !!activeProject && tab === 'updates',
  });
  const projectDetail = useQuery({
    queryKey: ['project', activeProject],
    queryFn: () => projectsApi.get(activeProject),
    enabled: !!activeProject && tab === 'team',
    retry: false,
  });

  useEffect(() => {
    const item = design.data?.item;
    if (!item) {
      setSteps([]);
      setMatrix({});
      return;
    }
    setSteps(Array.isArray(item.steps) ? item.steps : []);
    setMatrix(item.matrix && typeof item.matrix === 'object' ? item.matrix : {});
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
  const saveTeam = useMutation({
    mutationFn: (body) => projectsApi.saveTeam(activeProject, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', activeProject] });
      qc.invalidateQueries({ queryKey: ['projects-design-mgmt'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  useEffect(() => {
    if (tab !== 'team') return;
    const p = projectDetail.data?.project;
    if (!p || teamLoadedFor === activeProject) return;
    // Prefill editable team form (same pattern as workflow prefill above).
    setTeamStatus(p.teamConfirmation?.status ?? 'Pending');
    setDisciplines(
      Array.isArray(p.teamConfirmation?.disciplines) && p.teamConfirmation.disciplines.length > 0
        ? p.teamConfirmation.disciplines.map((d) => ({
            discipline: d.discipline ?? '',
            spoc: d.spoc ?? '',
            ptlTl: d.ptlTl ?? '',
            detail: d.detail ?? '',
          }))
        : [],
    );
    setSharedToAdmin(Boolean(p.teamConfirmation?.sharedToAdminAt));
    setTeamLoadedFor(activeProject);
  }, [tab, projectDetail.data, activeProject, teamLoadedFor]);

  function patchDiscipline(idx, field, value) {
    setDisciplines((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  }

  function submitTeam(e) {
    e.preventDefault();
    saveTeam.mutate({
      status: teamStatus,
      disciplines: disciplines
        .filter((d) => d.discipline || d.spoc || d.ptlTl || d.detail)
        .map((d) => ({
          discipline: d.discipline,
          spoc: d.spoc || undefined,
          ptlTl: d.ptlTl || undefined,
          detail: d.detail || undefined,
        })),
      sharedToAdmin,
    });
  }

  const delRows = useMemo(() => arr(deliverables.data), [deliverables.data]);
  const onTrack = delRows.filter((d) =>
    String(d.status ?? '').toLowerCase().replace(/[\s_]+/g, '').includes('track'),
  );
  const rfiRows = useMemo(() => arr(rfis.data), [rfis.data]);
  const openRfis = rfiRows.filter((r) =>
    ['open', 'pending', 'raised'].includes(String(r.status ?? '').toLowerCase()),
  );
  const pendingTd = tableSteps.filter(
    (s) =>
      String(s.owner ?? '').toLowerCase().includes('technical director') &&
      String(s.status ?? '').toLowerCase() !== 'completed',
  );
  const meetingRows = useMemo(() => arr(meetings.data), [meetings.data]);
  const onlineMeetings = meetingRows.filter((m) =>
    ['online', 'virtual', 'video'].includes(String(m.mode ?? m.type ?? '').toLowerCase()),
  );

  function patchStep(n, field, value) {
    setSteps((prev) => {
      const base = prev.length > 0 ? prev : tableSteps;
      return base.map((s) => (s.n === n ? { ...s, [field]: value } : s));
    });
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
      matrix,
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

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'workflow' && (
        <>
          <div className="kpi-grid cols-6">
            <KpiCard label="Deliverables tracked" value={delRows.length} accent="blueprint" />
            <KpiCard
              label="Deliverables on-track (derived)"
              value={onTrack.length}
              accent="forest"
            />
            <KpiCard label="Open RFIs" value={openRfis.length} accent="amber" />
            <KpiCard label="Total RFIs" value={rfiRows.length} accent="teal" />
            <KpiCard
              label="Pending TD action (derived)"
              value={pendingTd.length}
              accent="rust"
            />
            <KpiCard
              label="Meetings online / total"
              value={`${onlineMeetings.length} / ${meetingRows.length}`}
              accent="violet"
            />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            Derived figures: on-track counts deliverables whose status mentions
            “track”; pending-TD-action counts steps owned by the Technical
            Director that are not Completed; meeting mode comes from the
            meetings log.
          </p>
          {meetings.error && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              Meetings: {meetings.error.message}
            </div>
          )}
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
        <Panel title="Responsibility matrix">
          {tableSteps.length === 0 ? (
            <EmptyState text="No responsibility matrix yet — it appears once the design workflow loads." />
          ) : (
            <form onSubmit={submitSteps}>
              <DataTable
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'label', label: 'Step' },
                  {
                    key: 'owner',
                    label: 'Owner',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={matrix[r.n] ?? r.owner ?? ''}
                          onChange={(e) =>
                            setMatrix((m) => ({ ...m, [r.n]: e.target.value }))
                          }
                        />
                      ) : (
                        (matrix[r.n] ?? r.owner ?? '—')
                      ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill>,
                  },
                ]}
                rows={tableSteps}
                emptyText="No matrix rows yet."
              />
              {canEdit && (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={save.isPending || !activeProject}
                >
                  {save.isPending ? 'Saving…' : 'Save matrix with steps'}
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

      {tab === 'team' && (
        <Panel title="Project team finalisation — SPOC / PTL / TL per discipline">
          {projectDetail.isLoading ? (
            <EmptyState text="Loading team confirmation…" />
          ) : (
            <form onSubmit={submitTeam}>
              <div className="form-row" style={{ maxWidth: 320 }}>
                <label className="form-label">Team status</label>
                {canEdit ? (
                  <select
                    className="filter-select"
                    value={teamStatus}
                    onChange={(e) => setTeamStatus(e.target.value)}
                  >
                    {TEAM_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <StatusPill status={teamStatus}>{teamStatus}</StatusPill>
                )}
              </div>
              {projectDetail.data?.project?.teamConfirmation?.sharedToAdminAt && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  Shared to Admin: {fmtDate(projectDetail.data.project.teamConfirmation.sharedToAdminAt)}
                </p>
              )}
              <DataTable
                columns={[
                  {
                    key: 'discipline',
                    label: 'Discipline',
                    render: (r) =>
                      canEdit ? (
                        <select
                          className="filter-select"
                          value={r.discipline ?? ''}
                          onChange={(e) => patchDiscipline(r._rowKey, 'discipline', e.target.value)}
                        >
                          <option value="">Select…</option>
                          {TEAM_SERVICES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        (r.discipline || '—')
                      ),
                  },
                  {
                    key: 'spoc',
                    label: 'SPOC',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.spoc ?? ''}
                          onChange={(e) => patchDiscipline(r._rowKey, 'spoc', e.target.value)}
                        />
                      ) : (
                        (r.spoc || '—')
                      ),
                  },
                  {
                    key: 'ptlTl',
                    label: 'PTL / TL',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.ptlTl ?? ''}
                          onChange={(e) => patchDiscipline(r._rowKey, 'ptlTl', e.target.value)}
                        />
                      ) : (
                        (r.ptlTl || '—')
                      ),
                  },
                  {
                    key: 'detail',
                    label: 'Designers / Engineers / Detail',
                    render: (r) =>
                      canEdit ? (
                        <input
                          className="form-input"
                          value={r.detail ?? ''}
                          onChange={(e) => patchDiscipline(r._rowKey, 'detail', e.target.value)}
                        />
                      ) : (
                        (r.detail || '—')
                      ),
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: (r) =>
                      canEdit ? (
                        <button
                          type="button"
                          className="back-link"
                          onClick={() => setDisciplines((prev) => prev.filter((_, j) => j !== r._rowKey))}
                        >
                          Remove
                        </button>
                      ) : null,
                  },
                ]}
                rows={disciplines.map((d, i) => ({ ...d, _rowKey: i }))}
                emptyText="No disciplines yet — add Structural / MEPF / BIM / QA/QC / Peer Review / QS rows."
              />
              {canEdit && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() =>
                      setDisciplines((prev) => [...prev, { discipline: '', spoc: '', ptlTl: '', detail: '' }])
                    }
                  >
                    + Add discipline
                  </button>
                </div>
              )}
              {canEdit && (
                <div className="form-row" style={{ marginTop: 12 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={sharedToAdmin}
                      onChange={(e) => setSharedToAdmin(e.target.checked)}
                    />
                    Share confirmed team to Admin
                  </label>
                </div>
              )}
              {canEdit && (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saveTeam.isPending || !activeProject}
                  style={{ marginTop: 12 }}
                >
                  {saveTeam.isPending ? 'Saving…' : 'Save team confirmation'}
                </button>
              )}
              {saveTeam.isError && (
                <div className="login-error" role="alert" style={{ display: 'block' }}>
                  {saveTeam.error.message}
                </div>
              )}
              {saveTeam.isSuccess && (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                  Team saved. Sharing notifies Admin / Billing.
                </p>
              )}
            </form>
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

      {tab === 'updates' && (
        <>
          <Panel title="Recent SPOC entries">
            {spocEntries.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {spocEntries.error.message}
              </div>
            ) : spocEntries.isLoading ? (
              <EmptyState text="Loading SPOC entries…" />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Entry', render: (r) => r.title ?? r.subject ?? '—' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={arr(spocEntries.data)}
                emptyText="No SPOC entries for this project yet."
              />
            )}
          </Panel>
          <Panel title="Module updates">
            <EmptyState text="PTL progress, QS measurements, QA/QC site notes and client-side updates live in their own modules — see Work Progress, Functions and the Client Portal." />
          </Panel>
        </>
      )}
    </div>
  );
}
