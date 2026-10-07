import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, request, toQuery } from '../lib/api.js';
import { designApi } from '../lib/phase4aApi.js';
import { deliverablesApi } from '../lib/workApi.js';
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

const TABS = [
  { key: 'workflow', label: 'Workflow' },
  { key: 'matrix', label: 'Responsibility matrix' },
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
