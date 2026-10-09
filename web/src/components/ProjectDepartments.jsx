import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/phase4aApi.js';
import Panel from './Panel.jsx';
import KpiCard from './KpiCard.jsx';
import Tabs from './Tabs.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';

const SERVICES = ['Structural', 'Mechanical', 'Electrical', 'PHE', 'Fire'];
const TABS = [
  { key: 'stages', label: 'Stage-wise completion & timing' },
  { key: 'drawings', label: 'Drawing submission log' },
  { key: 'gfc', label: 'GFC drawing register' },
  { key: 'revisions', label: 'Revision log' },
  { key: 'awaiting', label: 'Awaiting response' },
  { key: 'transmittals', label: 'Transmittal log' },
];

const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

function projectIdOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const id = value._id ?? value.id ?? value.project;
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object') return String(id._id ?? id.id ?? '');
    return '';
  }
  return String(value);
}

function rowProjectId(row) {
  // StageStatus / Drawing / Revision / Rfi carry `project` directly.
  const direct = projectIdOf(row?.project ?? row?.projectId);
  if (direct) return direct;
  // Transmittals link via drawing -> project.
  const viaDrawing = projectIdOf(row?.drawing?.project ?? row?.drawing?.projectId);
  if (viaDrawing) return viaDrawing;
  return '';
}

function scopeToProject(rows, projectId) {
  if (!projectId) return rows;
  const want = String(projectId);
  return rows.filter((r) => {
    const got = rowProjectId(r);
    // Keep rows with no project pointer (backward compat with
    // unfiltered API responses) so scoped views never go blank.
    if (!got) return true;
    return got === want;
  });
}

export default function ProjectDepartments({ projectId, defaultService }) {
  const [serviceOverride, setServiceOverride] = useState(null);
  const [tab, setTab] = useState('stages');
  const service =
    serviceOverride ??
    (defaultService && SERVICES.includes(defaultService) ? defaultService : 'Structural');

  const dept = useQuery({
    queryKey: ['reports-department', service, projectId ?? null],
    queryFn: () => reportsApi.department(service, projectId ? { project: projectId } : {}),
  });
  const d = dept.data ?? {};
  const stages = scopeToProject(arr(d.stages), projectId);
  const drawings = scopeToProject(arr(d.drawings), projectId);
  const gfc = scopeToProject(arr(d.gfc), projectId);
  const revisions = scopeToProject(arr(d.revisions), projectId);
  const awaiting = scopeToProject(arr(d.awaiting), projectId);
  const transmittals = scopeToProject(arr(d.transmittals), projectId);

  const activeStages = stages.filter((s) =>
    !['completed', 'complete', 'done', 'closed'].includes(String(s.status ?? '').toLowerCase()),
  );
  const onTimeStages = stages.filter((s) =>
    ['on track', 'ontrack', 'on-track', 'on time', 'ontime', 'completed', 'complete'].includes(
      String(s.timing ?? s.status ?? '').toLowerCase(),
    ),
  );
  const pendingGfc = gfc.filter((g) =>
    !['issued', 'approved', 'completed', 'closed'].includes(String(g.status ?? '').toLowerCase()),
  );

  return (
    <div>
      <Panel title="Service">
        <div className="form-row">
          <label className="form-label">Service</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={service}
            onChange={(e) => { setServiceOverride(e.target.value); }}
          >
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </Panel>

      {dept.error ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {dept.error.message}
        </div>
      ) : (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Active stages" value={dept.isLoading ? '…' : activeStages.length} accent="forest" />
            <KpiCard label="On-time stages (derived)" value={dept.isLoading ? '…' : onTimeStages.length} accent="teal" />
            <KpiCard label="Pending GFC drawings" value={dept.isLoading ? '…' : pendingGfc.length} accent="amber" />
            <KpiCard label="Awaiting responses" value={dept.isLoading ? '…' : awaiting.length} accent="rust" />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            Showing {service} data for this project only.
            {pendingGfc.length > 0 && (
              <> Pending GFC call-outs: {pendingGfc.slice(0, 5).map((g) => g.title ?? g.drawingNo ?? g.name ?? '—').join(', ')}.</>
            )}
          </p>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'stages' && (
            <Panel title="Stage-wise completion & timing">
              {dept.isLoading ? (
                <EmptyState text="Loading stages…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'stage', label: 'Stage' },
                    { key: 'completion', label: 'Completion', render: (r) => (r.completion ?? r.completionPct ?? '—') },
                    { key: 'planned', label: 'Planned', render: (r) => fmtDate(r.plannedCompletion ?? r.planned) },
                    { key: 'actual', label: 'Actual', render: (r) => fmtDate(r.actualCompletion ?? r.actual) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={stages}
                  emptyText={`No ${service} stages reported for this project yet.`}
                />
              )}
            </Panel>
          )}

          {tab === 'drawings' && (
            <Panel title="Drawing submission log">
              {dept.isLoading ? (
                <EmptyState text="Loading drawings…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'drawingNo', label: 'Drawing no.', render: (r) => r.drawingNo ?? r.number ?? '—' },
                    { key: 'title', label: 'Title' },
                    { key: 'submittedOn', label: 'Submitted', render: (r) => fmtDate(r.submittedOn ?? r.submissionDate ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={drawings}
                  emptyText={`No ${service} drawing submissions for this project yet.`}
                />
              )}
            </Panel>
          )}

          {tab === 'gfc' && (
            <Panel title="GFC drawing register">
              {dept.isLoading ? (
                <EmptyState text="Loading GFC register…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'drawingNo', label: 'Drawing no.', render: (r) => r.drawingNo ?? r.number ?? '—' },
                    { key: 'title', label: 'Title' },
                    { key: 'revision', label: 'Revision', render: (r) => r.revision ?? r.rev ?? '—' },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={gfc}
                  emptyText={`No ${service} GFC drawings for this project yet.`}
                />
              )}
            </Panel>
          )}

          {tab === 'revisions' && (
            <Panel title="Revision log">
              {dept.isLoading ? (
                <EmptyState text="Loading revisions…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'drawingNo', label: 'Drawing no.', render: (r) => r.drawingNo ?? r.drawing?.drawingNo ?? '—' },
                    { key: 'revision', label: 'Revision', render: (r) => r.revision ?? r.rev ?? r.revNo ?? '—' },
                    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? r.remarks ?? '—' },
                    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={revisions}
                  emptyText={`No ${service} revisions for this project yet.`}
                />
              )}
            </Panel>
          )}

          {tab === 'awaiting' && (
            <Panel title="Awaiting response">
              {dept.isLoading ? (
                <EmptyState text="Loading awaiting responses…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'subject', label: 'Subject', render: (r) => r.subject ?? r.title ?? r.drawingNo ?? '—' },
                    { key: 'awaitingFrom', label: 'Awaiting from', render: (r) => r.awaitingFrom ?? r.from ?? r.owner ?? '—' },
                    { key: 'since', label: 'Since', render: (r) => fmtDate(r.since ?? r.raisedOn ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={awaiting}
                  emptyText={`Nothing awaiting response for ${service} on this project.`}
                />
              )}
            </Panel>
          )}

          {tab === 'transmittals' && (
            <Panel title="Transmittal log">
              {dept.isLoading ? (
                <EmptyState text="Loading transmittals…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'number', label: 'No.', render: (r) => r.number ?? r.transmittalNo ?? '—' },
                    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={transmittals}
                  emptyText={`No ${service} transmittals for this project yet.`}
                />
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
