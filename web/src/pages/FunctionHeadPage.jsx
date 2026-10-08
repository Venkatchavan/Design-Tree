import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi, request, toQuery, workEntriesApi } from '../lib/api.js';
import { areaApi, bimApi, boqApi, discApi, peerApi, visitsApi } from '../lib/functionsApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const weekKey = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'Undated';
  const monday = new Date(dt);
  const day = (dt.getDay() + 6) % 7;
  monday.setDate(dt.getDate() - day);
  return `Week of ${monday.toLocaleDateString()}`;
};

const HEAD_TABS = [
  { key: 'qaqc-specs', label: 'QA/QC' },
  { key: 'bim-head', label: 'BIM' },
  { key: 'gbs-head', label: 'GBS' },
  { key: 'peer-review-head', label: 'Peer review' },
  { key: 'qs-head', label: 'QS / BOQ' },
];

function useTeamLog(projectIds, serviceLabel, enabled) {
  return useQuery({
    queryKey: ['function-team-log', serviceLabel, (projectIds ?? []).join(',')],
    queryFn: () => workEntriesApi.list({}),
    enabled: enabled && (projectIds ?? []).length > 0,
    retry: false,
    select: (data) =>
      arr(data).filter((e) => {
        const pid = e.project?._id ?? e.project;
        return (projectIds ?? []).includes(String(pid));
      }),
  });
}

export default function FunctionHeadPage({ bootstrap, user, viewKey }) {
  void user;
  void bootstrap;
  const qc = useQueryClient();
  // viewKey selects the function; fall back to local tabs when absent/unknown.
  const known = HEAD_TABS.some((t) => t.key === viewKey);
  const [localKey, setLocalKey] = useState('qaqc-specs');
  const active = known ? viewKey : localKey;

  const [qsLeaveFilter, setQsLeaveFilter] = useState('');

  const projects = useQuery({
    queryKey: ['projects-function-head'],
    queryFn: () => projectsApi.list({}),
  });
  const projectRows = arr(projects.data);
  const projectName = (id) =>
    projectRows.find((p) => String(p._id) === String(id))?.name ?? '—';

  const visits = useQuery({
    queryKey: ['function-visits'],
    queryFn: () => visitsApi.list({}),
    enabled: active === 'qaqc-specs',
  });
  const discs = useQuery({
    queryKey: ['function-discs'],
    queryFn: () => discApi.list({}),
    enabled: active === 'qaqc-specs',
  });
  const bimOrders = useQuery({
    queryKey: ['function-bim'],
    queryFn: () => bimApi.list({}),
    enabled: active === 'bim-head',
  });
  const peers = useQuery({
    queryKey: ['function-peers'],
    queryFn: () => peerApi.list({}),
    enabled: active === 'peer-review-head',
  });
  const areas = useQuery({
    queryKey: ['function-areas'],
    queryFn: () => areaApi.list({}),
    enabled: active === 'qs-head',
  });
  const boq = useQuery({
    queryKey: ['function-boq'],
    queryFn: () => boqApi.list({}),
    enabled: active === 'qs-head',
    retry: false,
  });
  const employees = useQuery({
    queryKey: ['function-employees'],
    queryFn: () => employeesApi.list({}),
    enabled: active === 'qs-head',
    retry: false,
  });
  const qsLeave = useQuery({
    queryKey: ['function-qs-leave', qsLeaveFilter],
    queryFn: () =>
      request(`/api/leave-travel/leave${toQuery({ status: qsLeaveFilter || undefined })}`),
    enabled: active === 'qs-head',
    retry: false,
  });

  const activeProjects = useMemo(
    () => projectRows.filter((p) => String(p.status ?? '').toLowerCase() !== 'completed'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const gbsTargets = useMemo(() => activeProjects.slice(0, 10), [activeProjects]);
  const gbs = useQuery({
    queryKey: ['function-gbs', gbsTargets.map((p) => p._id).join(',')],
    queryFn: async () => {
      const out = await Promise.allSettled(
        gbsTargets.map((p) =>
          request(`/api/functions/gbs-cert${toQuery({ project: p._id })}`).then((d) => ({
            projectId: p._id,
            project: p.name,
            data: d,
          })),
        ),
      );
      return out.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    },
    enabled: active === 'gbs-head' && gbsTargets.length > 0,
    retry: false,
  });

  const bimScopeIds = useMemo(
    () =>
      projectRows
        .filter((p) =>
          (p.scope ?? []).some((s) => String(s.service ?? '').toLowerCase().includes('bim')),
        )
        .map((p) => String(p._id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const bimLog = useTeamLog(bimScopeIds, 'bim', active === 'bim-head');
  const gbsLog = useTeamLog(
    gbsTargets.map((p) => String(p._id)),
    'gbs',
    active === 'gbs-head',
  );
  const qsScopeIds = useMemo(
    () =>
      projectRows
        .filter((p) =>
          (p.scope ?? []).some((s) =>
            ['qs', 'quantity', 'estimation'].some((k) =>
              String(s.service ?? '').toLowerCase().includes(k),
            ),
          ),
        )
        .map((p) => String(p._id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const qsLog = useTeamLog(qsScopeIds.length > 0 ? qsScopeIds : activeProjects.map((p) => String(p._id)), 'qs', active === 'qs-head');

  const approveVisit = useMutation({
    mutationFn: ({ id, status }) =>
      request(`/api/functions/site-visits/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-visits'] }),
  });
  const approvePeer = useMutation({
    mutationFn: ({ id, body }) => peerApi.setFinal(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-peers'] }),
  });
  const reviewArea = useMutation({
    mutationFn: ({ id, body }) => areaApi.review(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-areas'] }),
  });
  const reviewBoq = useMutation({
    mutationFn: ({ id, body }) => boqApi.review(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-boq'] }),
  });
  const decideLeave = useMutation({
    mutationFn: ({ id, status }) =>
      request(`/api/leave-travel/leave/${id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-qs-leave'] }),
  });

  const visitRows = arr(visits.data);
  const discRows = arr(discs.data);
  const peerRows = arr(peers.data);
  const areaRows = arr(areas.data);
  const boqRows = arr(boq.data);
  const bimRows = arr(bimOrders.data);
  const empRows = arr(employees.data);
  const leaveRows = arr(qsLeave.data);

  const visitsByProject = useMemo(() => {
    const groups = {};
    for (const v of visitRows) {
      const key = v.project?.name ?? projectName(v.project) ?? 'Unassigned';
      (groups[key] ??= []).push(v);
    }
    return Object.entries(groups).map(([name, items]) => ({
      name,
      visits: items.length,
      open: items.filter((x) => !['approved', 'completed', 'closed'].includes(String(x.status ?? '').toLowerCase())).length,
    }));
  }, [visits.data, projects.data]);

  const visitsByWeek = useMemo(() => {
    const groups = {};
    for (const v of visitRows) {
      const k = weekKey(v.visitDate ?? v.date ?? v.createdAt);
      (groups[k] ??= []).push(v);
    }
    return Object.entries(groups).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  }, [visits.data]);

  const openPeerComments = peerRows.flatMap((p) =>
    (Array.isArray(p.comments) ? p.comments : [])
      .filter((c) => ['open', 'pending', 'unresolved'].includes(String(c.status ?? 'open').toLowerCase()))
      .map((c) => ({ ...c, reviewId: p._id ?? p.id, review: p.title ?? p.subject ?? '—' })),
  );

  const qsEmpIds = useMemo(() => {
    const ids = new Set();
    for (const e of empRows) {
      if (String(e.department ?? '').toLowerCase().includes('qs')) {
        ids.add(String(e._id ?? e.id));
      }
    }
    return ids;
  }, [employees.data]);
  const qsLeaveRows = useMemo(() => {
    if (qsEmpIds.size === 0) return leaveRows;
    return leaveRows.filter((l) =>
      qsEmpIds.has(String(l.employee?._id ?? l.employee ?? l.employeeId ?? '')),
    );
  }, [leaveRows, qsEmpIds]);

  const actionError =
    approveVisit.error?.message ??
    approvePeer.error?.message ??
    reviewArea.error?.message ??
    reviewBoq.error?.message ??
    decideLeave.error?.message;

  return (
    <div id={`view-${active}`}>
      <div className="page-head">
        <div className="page-title">Function Head Dashboard</div>
        <div className="page-sub">
          Headline figures and review panels for QA/QC, BIM, GBS, peer review and QS.
        </div>
      </div>

      {!known && (
        <Tabs tabs={HEAD_TABS} active={localKey} onChange={setLocalKey} />
      )}

      {actionError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {actionError}
        </div>
      )}

      {active === 'qaqc-specs' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Site visits" value={visitRows.length} accent="blueprint" />
            <KpiCard label="Open discrepancies" value={discRows.filter((d) => !['closed', 'resolved', 'completed'].includes(String(d.status ?? '').toLowerCase())).length} accent="rust" />
            <KpiCard label="Projects visited" value={visitsByProject.length} accent="forest" />
            <KpiCard label="Pending visit approval" value={visitRows.filter((v) => ['pending', 'submitted', 'open'].includes(String(v.status ?? '').toLowerCase())).length} accent="amber" />
          </div>
          <Panel title="Project-wise visit summary">
            <DataTable
              columns={[
                { key: 'name', label: 'Project' },
                { key: 'visits', label: 'Visits' },
                { key: 'open', label: 'Awaiting approval / open' },
              ]}
              rows={visitsByProject}
              emptyText="No site visits yet."
            />
          </Panel>
          {visitsByWeek.map(([week, items]) => (
            <Panel key={week} title={week}>
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.visitDate ?? r.date ?? r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  {
                    key: 'approve',
                    label: 'Approve',
                    render: (r) => (
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={approveVisit.isPending}
                        onClick={() => approveVisit.mutate({ id: r._id ?? r.id, status: 'Approved' })}
                      >
                        Approve
                      </button>
                    ),
                  },
                ]}
                rows={items}
                emptyText="No visits this week."
              />
            </Panel>
          ))}
          <Panel title="Recent visits">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.visitDate ?? r.date ?? r.createdAt) },
                { key: 'notes', label: 'Notes', render: (r) => r.notes ?? r.remarks ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={visitRows.slice(0, 20)}
              emptyText="No site visits yet."
            />
          </Panel>
          <Panel title="Discrepancy log">
            <DataTable
              columns={[
                { key: 'title', label: 'Discrepancy', render: (r) => r.title ?? r.description ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={discRows.slice(0, 20)}
              emptyText="No discrepancies logged."
            />
          </Panel>
        </>
      )}

      {active === 'bim-head' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="BIM work orders" value={bimRows.length} accent="blueprint" />
            <KpiCard label="Open orders" value={bimRows.filter((b) => !['completed', 'closed', 'done'].includes(String(b.status ?? '').toLowerCase())).length} accent="amber" />
            <KpiCard label="BIM-scope projects" value={bimScopeIds.length} accent="forest" />
            <KpiCard label="Team log entries (derived)" value={bimLog.data?.length ?? 0} accent="teal" />
          </div>
          <Panel title="BIM work-order register">
            <DataTable
              columns={[
                { key: 'title', label: 'Order', render: (r) => r.title ?? r.subject ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'assignedTo', label: 'Assigned to', render: (r) => r.assignedTo?.name ?? r.assignedTo ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={bimRows}
              emptyText="No BIM work orders yet."
            />
          </Panel>
          <Panel title="Team work log (derived: recent entries on BIM-scope projects)">
            {bimScopeIds.length === 0 ? (
              <EmptyState text="No BIM-scope projects found, so no derived team log is available." />
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                  { key: 'task', label: 'Task', render: (r) => r.task ?? r.title ?? r.description ?? '—' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={(bimLog.data ?? []).slice(0, 20)}
                emptyText="No work entries on BIM-scope projects yet."
              />
            )}
          </Panel>
        </>
      )}

      {active === 'gbs-head' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Projects checked" value={gbs.data?.length ?? 0} accent="blueprint" />
            <KpiCard label="Team log entries (derived)" value={gbsLog.data?.length ?? 0} accent="teal" />
            <KpiCard label="Active projects" value={activeProjects.length} accent="forest" />
            <KpiCard label="Scope note" value="First 10 active" accent="neutral" />
          </div>
          <Panel title="GBS certification workflows (first 10 active projects)">
            {gbs.isLoading ? (
              <EmptyState text="Loading GBS certifications…" />
            ) : gbs.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{gbs.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  {
                    key: 'phases',
                    label: 'Phases',
                    render: (r) => {
                      const cert = r.data?.item ?? r.data?.cert ?? r.data;
                      const phases = cert?.phases ?? cert?.stages ?? [];
                      if (!Array.isArray(phases) || phases.length === 0) return 'No workflow yet';
                      return phases.map((p) => `${p.name ?? p.phase ?? 'Phase'}: ${p.status ?? '—'}`).join(' · ');
                    },
                  },
                ]}
                rows={gbs.data ?? []}
                emptyText="No GBS certification workflows yet."
              />
            )}
          </Panel>
          <Panel title="Team work log (derived: recent entries on these projects)">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'task', label: 'Task', render: (r) => r.task ?? r.title ?? r.description ?? '—' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={(gbsLog.data ?? []).slice(0, 20)}
              emptyText="No work entries on these projects yet."
            />
          </Panel>
        </>
      )}

      {active === 'peer-review-head' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Total reviews" value={peerRows.length} accent="blueprint" />
            <KpiCard label="In progress" value={peerRows.filter((p) => ['in progress', 'inprogress', 'ongoing', 'open'].includes(String(p.status ?? '').toLowerCase())).length} accent="amber" />
            <KpiCard label="Open comments" value={openPeerComments.length} accent="rust" />
            <KpiCard label="Finalised" value={peerRows.filter((p) => ['final', 'finalised', 'finalized', 'completed', 'approved'].includes(String(p.status ?? '').toLowerCase())).length} accent="forest" />
          </div>
          <Panel title="Peer reviews">
            <DataTable
              columns={[
                { key: 'title', label: 'Review', render: (r) => r.title ?? r.subject ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                {
                  key: 'final',
                  label: 'Final approval',
                  render: (r) => (
                    <button
                      type="button"
                      className="approve-btn"
                      disabled={approvePeer.isPending}
                      onClick={() => approvePeer.mutate({ id: r._id ?? r.id, body: { status: 'Approved for Issue', finalApproved: true } })}
                    >
                      Approve final
                    </button>
                  ),
                },
              ]}
              rows={peerRows}
              emptyText="No peer reviews yet."
            />
          </Panel>
          <Panel title="Open comments">
            <DataTable
              columns={[
                { key: 'review', label: 'Review' },
                { key: 'comment', label: 'Comment', render: (r) => r.text ?? r.comment ?? r.remark ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status ?? 'open'}>{r.status ?? 'open'}</StatusPill> },
              ]}
              rows={openPeerComments.slice(0, 30)}
              emptyText="No open review comments."
            />
          </Panel>
        </>
      )}

      {active === 'qs-head' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="QS / BOQ — Area settlements" value={areaRows.length} accent="blueprint" />
            <KpiCard label="QS / BOQ — BOQ items" value={boqRows.length} accent="forest" />
            <KpiCard label="Pending review" value={areaRows.filter((a) => ['pending', 'submitted', 'open'].includes(String(a.status ?? a.reviewStatus ?? '').toLowerCase())).length + boqRows.filter((b) => String(b.status ?? '').toLowerCase() !== 'approved').length} accent="amber" />
            <KpiCard label="QS leave requests" value={qsLeaveRows.length} accent="teal" />
            <KpiCard label="Team log entries (derived)" value={qsLog.data?.length ?? 0} accent="violet" />
          </div>
          <Panel title="QS / BOQ — Area settlements">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'area', label: 'Area', render: (r) => r.area ?? r.plotArea ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status ?? r.reviewStatus}>{r.status ?? r.reviewStatus}</StatusPill> },
                {
                  key: 'review',
                  label: 'Review',
                  render: (r) => (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="approve-btn" disabled={reviewArea.isPending} onClick={() => reviewArea.mutate({ id: r._id ?? r.id, body: { status: 'Approved' } })}>
                        Approve
                      </button>
                      <button type="button" className="approve-btn" disabled={reviewArea.isPending} onClick={() => reviewArea.mutate({ id: r._id ?? r.id, body: { status: 'Rejected' } })}>
                        Reject
                      </button>
                    </span>
                  ),
                },
              ]}
              rows={areaRows}
              emptyText="No area settlements yet."
            />
          </Panel>
          <Panel title="QS / BOQ — BOQ items (QS Head review)">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'itemNo', label: 'Item', render: (r) => r.itemNo ?? '—' },
                { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
                { key: 'qty', label: 'Qty', render: (r) => r.qty ?? '—' },
                { key: 'rate', label: 'Rate', render: (r) => r.rate ?? '—' },
                { key: 'amount', label: 'Amount', render: (r) => r.amount ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                {
                  key: 'review',
                  label: 'Review',
                  render: (r) => (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="approve-btn" disabled={reviewBoq.isPending} onClick={() => reviewBoq.mutate({ id: r._id ?? r.id, body: { status: 'Submitted' } })}>
                        Submit
                      </button>
                      <button type="button" className="approve-btn" disabled={reviewBoq.isPending} onClick={() => reviewBoq.mutate({ id: r._id ?? r.id, body: { status: 'Approved' } })}>
                        Approve
                      </button>
                    </span>
                  ),
                },
              ]}
              rows={boqRows}
              emptyText="No BOQ items yet."
            />
          </Panel>
          <Panel title="Team work log (derived: entries on QS-scope projects)">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
                { key: 'task', label: 'Task', render: (r) => r.task ?? r.title ?? r.description ?? '—' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={(qsLog.data ?? []).slice(0, 20)}
              emptyText="No work entries on QS-scope projects yet."
            />
          </Panel>
          <Panel title="QS leave approvals">
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <select className="filter-select" value={qsLeaveFilter} onChange={(e) => setQsLeaveFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            {qsLeave.isLoading ? (
              <EmptyState text="Loading leave requests…" />
            ) : qsLeave.error && qsLeave.error.status === 403 ? (
              <EmptyState text="Leave data is not shared with your role." />
            ) : qsLeave.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{qsLeave.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                  { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.from ?? r.startDate)} → ${fmtDate(r.to ?? r.endDate)}` },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  {
                    key: 'decision',
                    label: 'Decision',
                    render: (r) => (
                      <span style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => decideLeave.mutate({ id: r._id ?? r.id, status: 'Approved' })}>
                          Approve
                        </button>
                        <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => decideLeave.mutate({ id: r._id ?? r.id, status: 'Rejected' })}>
                          Reject
                        </button>
                      </span>
                    ),
                  },
                ]}
                rows={qsLeaveRows}
                emptyText="No QS leave requests found."
              />
            )}
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              Filtered client-side to the QS department via the employee directory; when no department link exists, all fetched requests are shown.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
