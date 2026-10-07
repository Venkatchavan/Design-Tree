import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/phase4aApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const SERVICE_BY_VIEW = {
  structural: 'Structural',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  phe: 'PHE',
  fire: 'Fire',
};
const SERVICES = Object.values(SERVICE_BY_VIEW);
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

export default function DeptDashboardPage({ bootstrap, user, viewKey }) {
  void bootstrap;
  void user;
  const known = SERVICE_BY_VIEW[viewKey];
  const [localService, setLocalService] = useState('Structural');
  const service = known ?? localService;
  const [tab, setTab] = useState('stages');

  const dept = useQuery({
    queryKey: ['reports-department', service],
    queryFn: () => reportsApi.department(service),
  });
  const d = dept.data ?? {};
  const stages = arr(d.stages);
  const drawings = arr(d.drawings);
  const gfc = arr(d.gfc);
  const revisions = arr(d.revisions);
  const awaiting = arr(d.awaiting);
  const transmittals = arr(d.transmittals);

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
    <div id={`view-dept-${service.toLowerCase()}`}>
      <div className="page-head">
        <div className="page-title">{service} Department Dashboard</div>
        <div className="page-sub">
          Stage completion, drawing submissions, GFC register, revisions, awaiting responses and transmittals for {service}.
        </div>
      </div>

      {!known && (
        <Panel title="Service">
          <div className="form-row">
            <label className="form-label">Service</label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={localService}
              onChange={(e) => { setLocalService(e.target.value); }}
            >
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </Panel>
      )}

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
            Derived: on-time counts stages whose timing/status mentions on-track, on-time or completed.
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
                    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                    { key: 'stage', label: 'Stage' },
                    { key: 'completion', label: 'Completion', render: (r) => (r.completion ?? r.completionPct ?? '—') },
                    { key: 'planned', label: 'Planned', render: (r) => fmtDate(r.plannedCompletion ?? r.planned) },
                    { key: 'actual', label: 'Actual', render: (r) => fmtDate(r.actualCompletion ?? r.actual) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={stages}
                  emptyText={`No ${service} stages reported yet.`}
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
                    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                    { key: 'submittedOn', label: 'Submitted', render: (r) => fmtDate(r.submittedOn ?? r.submissionDate ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={drawings}
                  emptyText={`No ${service} drawing submissions yet.`}
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
                    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                    { key: 'revision', label: 'Revision', render: (r) => r.revision ?? r.rev ?? '—' },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={gfc}
                  emptyText={`No ${service} GFC drawings yet.`}
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
                  emptyText={`No ${service} revisions yet.`}
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
                    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                    { key: 'awaitingFrom', label: 'Awaiting from', render: (r) => r.awaitingFrom ?? r.from ?? r.owner ?? '—' },
                    { key: 'since', label: 'Since', render: (r) => fmtDate(r.since ?? r.raisedOn ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={awaiting}
                  emptyText={`Nothing awaiting response for ${service}.`}
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
                    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={transmittals}
                  emptyText={`No ${service} transmittals yet.`}
                />
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
