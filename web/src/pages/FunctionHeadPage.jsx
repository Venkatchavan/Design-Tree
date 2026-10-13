import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi, request, toQuery, workEntriesApi } from '../lib/api.js';
import { areaApi, bimApi, boqApi, discApi, peerApi, visitsApi, weeklyReportApi } from '../lib/functionsApi.js';
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
  { key: 'qs-head', label: 'QS' },
];

function fmtShortDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function weekLabelOf(r) {
  if (r.weekLabel) return r.weekLabel;
  const a = r.weekStart ? new Date(r.weekStart) : null;
  const b = r.weekEnd ? new Date(r.weekEnd) : null;
  if (a && !Number.isNaN(a) && b && !Number.isNaN(b)) {
    const mon = a.toLocaleString('en-GB', { month: 'short' });
    return `${mon} ${a.getDate()}-${b.getDate()}`;
  }
  return a && !Number.isNaN(a) ? fmtShortDate(a) : '—';
}

// Weekly report rows with visit counts derived from site visits
// (project + week window). Shared by the workspace panel and the AssocTD view.
function weeklyReportRows(reports, visits, projectName) {
  return reports.map((r) => {
    const pid = String(r.project?._id ?? r.project ?? '');
    const start = r.weekStart ? new Date(r.weekStart) : null;
    const end = r.weekEnd ? new Date(r.weekEnd) : null;
    const count = visits.filter((v) => {
      if (String(v.project?._id ?? v.project ?? '') !== pid) return false;
      const d = new Date(v.visitDate ?? v.date ?? v.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      if (start && !Number.isNaN(start) && d < start) return false;
      if (end && !Number.isNaN(end) && d > end) return false;
      return true;
    }).length;
    return {
      id: String(r._id ?? r.id),
      week: weekLabelOf(r),
      project: r.project?.name ?? projectName(r.project),
      visits: count,
      status: r.status ?? 'Submitted',
      submitted: r.submittedAt ?? r.createdAt,
      approved: r.approvedAt,
    };
  });
}

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
  const role = bootstrap?.role?.key ?? '';
  const isDirector = new Set(['founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director']).has(role);
  const isAssocTD = role === 'assoc_technical_director';
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
    retry: false,
  });
  const boq = useQuery({
    queryKey: ['function-boq'],
    queryFn: () => boqApi.list({}),
    enabled: false,
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
  const weeklyQ = useQuery({
    queryKey: ['function-weekly-reports'],
    queryFn: () => weeklyReportApi.list({}),
    enabled: active === 'qaqc-specs',
    retry: false,
  });
  const assocWorkQ = useQuery({
    queryKey: ['function-work-entries-all'],
    queryFn: () => workEntriesApi.list({}),
    enabled: isAssocTD && ['bim-head', 'gbs-head'].includes(active),
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
  const approveWeekly = useMutation({
    mutationFn: ({ id, status }) => weeklyReportApi.approve(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-weekly-reports'] }),
  });
  const approvePeer = useMutation({
    mutationFn: ({ id, body }) => peerApi.setFinal(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-peers'] }),
  });
  const reviewArea = useMutation({
    mutationFn: ({ id, body }) => areaApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-areas'] }),
  });
  const reviewBoq = useMutation({
    mutationFn: ({ id, body }) => boqApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['function-boq'] }),
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
  const qsLeaveRows = leaveRows.filter((l) =>
    qsEmpIds.has(String(l.employee?._id ?? l.employee ?? l.employeeId ?? '')),
  );

  const actionError =
    approveVisit.error?.message ??
    approvePeer.error?.message ??
    reviewArea.error?.message ??
    reviewBoq.error?.message;

  if (isDirector && active === 'qaqc-specs') {
    return (
      <div id={`view-${active}`}>
        <DirectorQaqcView
          visits={arr(visits.data)}
          discs={arr(discs.data)}
          projects={projectRows}
          loading={visits.isLoading || discs.isLoading}
          loadError={visits.error?.message ?? discs.error?.message}
        />
      </div>
    );
  }

  if (isDirector && active === 'bim-head') {
    return (
      <div id={`view-${active}`}>
        <DirectorBimView
          orders={bimRows}
          teamLogCount={bimLog.data?.length ?? 0}
          scopeCount={bimScopeIds.length}
          loading={bimOrders.isLoading}
          loadError={bimOrders.error?.message ?? bimLog.error?.message}
        />
      </div>
    );
  }

  if (isDirector && active === 'gbs-head') {
    return (
      <div id={`view-${active}`}>
        <DirectorGbsView
          items={gbs.data ?? []}
          teamLogCount={gbsLog.data?.length ?? 0}
          loading={gbs.isLoading}
          loadError={gbs.error?.message}
        />
      </div>
    );
  }

  if (isDirector && active === 'peer-review-head') {
    return (
      <div id={`view-${active}`}>
        <DirectorPeerView
          reviews={peerRows}
          openComments={openPeerComments}
        />
      </div>
    );
  }

  if (isDirector && active === 'qs-head') {
    return (
      <div id={`view-${active}`}>
        <DirectorQsView
          teamLogCount={qsLog.data?.length ?? 0}
          areas={areaRows}
          leaves={qsLeaveRows}
          loading={areas.isLoading || qsLeave.isLoading}
          loadError={areas.error?.message}
        />
      </div>
    );
  }

  if (isAssocTD && active === 'qaqc-specs') {
    return (
      <div id={`view-${active}`}>
        <AssocTDQaqcView
          visits={arr(visits.data)}
          discs={arr(discs.data)}
          reports={arr(weeklyQ.data)}
          projects={projectRows}
          loading={visits.isLoading || discs.isLoading || weeklyQ.isLoading}
          loadError={visits.error?.message ?? discs.error?.message ?? weeklyQ.error?.message}
        />
      </div>
    );
  }

  if (isAssocTD && active === 'bim-head') {
    return (
      <div id={`view-${active}`}>
        <AssocTDBimView
          orders={bimRows}
          log={assocWorkQ.data?.items ?? []}
          scopeIds={bimScopeIds}
          loading={bimOrders.isLoading || assocWorkQ.isLoading}
          loadError={bimOrders.error?.message ?? assocWorkQ.error?.message}
        />
      </div>
    );
  }

  if (isAssocTD && active === 'gbs-head') {
    return (
      <div id={`view-${active}`}>
        <AssocTDGbsView
          items={gbs.data ?? []}
          log={assocWorkQ.data?.items ?? []}
          loading={gbs.isLoading || assocWorkQ.isLoading}
          loadError={gbs.error?.message ?? assocWorkQ.error?.message}
        />
      </div>
    );
  }

  if (isAssocTD && active === 'peer-review-head') {
    return (
      <div id={`view-${active}`}>
        <AssocTDPeerView
          reviews={peerRows}
          openComments={openPeerComments}
          projects={projectRows}
        />
      </div>
    );
  }

  if (isAssocTD && active === 'qs-head') {
    return (
      <div id={`view-${active}`}>
        <AssocTDQsView
          areas={areaRows}
          log={assocWorkQ.data?.items ?? []}
          scopeIds={qsScopeIds}
          leaves={qsLeaveRows}
          loading={areas.isLoading || qsLeave.isLoading || assocWorkQ.isLoading}
          loadError={areas.error?.message ?? assocWorkQ.error?.message}
        />
      </div>
    );
  }

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
          <Panel title="Weekly reports" sub="Submitted by the QA/QC team for approval">
            {weeklyQ.isLoading ? <EmptyState text="Loading…" /> : weeklyQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{weeklyQ.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'week', label: 'Week' },
                  { key: 'project', label: 'Project' },
                  { key: 'visits', label: 'Visits' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  { key: 'submitted', label: 'Submitted', render: (r) => fmtShortDate(r.submitted) },
                  { key: 'approved', label: 'Approved', render: (r) => fmtShortDate(r.approved) },
                  {
                    key: 'action', label: '', render: (r) => (r.status === 'Submitted' && role === 'qaqc_head' ? (
                      <button type="button" className="approve-btn" disabled={approveWeekly.isPending} onClick={() => approveWeekly.mutate({ id: r.id, status: 'Approved' })}>Approve</button>
                    ) : '—'),
                  },
                ]}
                rows={weeklyReportRows(arr(weeklyQ.data), visitRows, projectName)}
                emptyText="No weekly reports yet."
              />
            )}
            {approveWeekly.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{approveWeekly.error.message}</div>}
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
          <Panel title="QS leave requests">
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
                ]}
                rows={qsLeaveRows}
                emptyText="No QS leave requests found."
              />
            )}
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              Read-only. Leave approvals now flow Team Lead → HR → Finance in Leave &amp; Travel → Approvals.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

function DirectorBimView({ orders, teamLogCount, scopeCount, loading, loadError }) {
  const activeOrders = orders.filter(
    (b) => !['completed', 'closed', 'done'].includes(String(b.status ?? '').toLowerCase()),
  );
  return (
    <>
      <div className="page-head">
        <div className="page-title">BIM</div>
        <div className="page-sub">Team overview, BIM work orders and submitted work across every project</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Active BIM work orders" value={activeOrders.length} accent="blueprint" />
        <KpiCard label="Team submissions (log)" value={teamLogCount} accent="teal" />
        <KpiCard label="Projects covered" value={scopeCount} accent="forest" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="BIM summary">
        {loading ? <EmptyState text="Loading…" /> : (
          <EmptyState text="Showing summary KPIs for BIM above. Work orders and the team work log are available in the BIM Head's own workspace." />
        )}
      </Panel>
    </>
  );
}

function gbsPhases(item) {
  const cert = item?.data?.item ?? item?.data?.cert ?? item?.data;
  const phases = cert?.phases ?? cert?.stages ?? [];
  return Array.isArray(phases) ? phases : [];
}

function DirectorGbsView({ items, teamLogCount, loading, loadError }) {
  const withPhases = items.map((r) => ({ ...r, phases: gbsPhases(r) }));
  const isComplete = (p) =>
    ['completed', 'approved', 'done', 'certified', 'issued'].includes(String(p.status ?? '').toLowerCase());
  const inProgress = withPhases.filter((r) => r.phases.length === 0 || r.phases.some((p) => !isComplete(p)));
  const phasesDone = withPhases.reduce((s, r) => s + r.phases.filter(isComplete).length, 0);
  return (
    <>
      <div className="page-head">
        <div className="page-title">GBS</div>
        <div className="page-sub">Green building certification progress across every project pursuing certification</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Projects in progress" value={inProgress.length} accent="blueprint" />
        <KpiCard label="Phases completed" value={phasesDone} accent="forest" />
        <KpiCard label="Team submissions (log)" value={teamLogCount} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="GBS summary">
        {loading ? <EmptyState text="Loading…" /> : (
          <EmptyState text="Showing summary KPIs for GBS above. The certification workflow and team work log are available in the GBS Head's own workspace." />
        )}
      </Panel>
    </>
  );
}

function DirectorPeerView({ reviews, openComments }) {
  const norm = (v) => String(v ?? '').toLowerCase();
  const inProgress = reviews.filter((p) =>
    ['in progress', 'inprogress', 'ongoing', 'open'].includes(norm(p.status)),
  );
  const finalised = reviews.filter((p) =>
    ['final', 'finalised', 'finalized', 'completed', 'approved'].includes(norm(p.status)),
  );
  const pendingApproval = reviews.filter((p) => !inProgress.includes(p) && !finalised.includes(p));
  return (
    <>
      <div className="page-head">
        <div className="page-title">Peer Review</div>
        <div className="page-sub">Overview of every peer review submission, checklist progress and open comments</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Reviews in progress" value={inProgress.length} accent="blueprint" />
        <KpiCard label="Pending approval" value={pendingApproval.length} accent="amber" />
        <KpiCard label="Open comments" value={openComments.length} accent="rust" />
      </div>
      <Panel title="Peer review summary">
        <EmptyState text="Showing summary KPIs for Peer Review above. The full review log is available in the Peer Review Head's own workspace." />
      </Panel>
    </>
  );
}

function DirectorQsView({ teamLogCount, areas, leaves, loading, loadError }) {
  const pendingAreas = areas.filter((a) =>
    ['pending', 'submitted', 'open'].includes(String(a.status ?? a.reviewStatus ?? '').toLowerCase()),
  );
  const pendingLeaves = leaves.filter((l) => String(l.status ?? '').toLowerCase() === 'pending');
  return (
    <>
      <div className="page-head">
        <div className="page-title">QS</div>
        <div className="page-sub">BOQ-related work across the QS team, area settlements, and leave approvals for the QS department</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Team submissions (log)" value={teamLogCount} accent="blueprint" />
        <KpiCard label="Area settlements needing review" value={pendingAreas.length} accent="amber" />
        <KpiCard label="Pending leave approvals" value={pendingLeaves.length} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="QS summary">
        {loading ? <EmptyState text="Loading…" /> : (
          <EmptyState text="Showing summary KPIs for QS above. Area settlements, the team work log and leave approvals are available in the QS Head's own workspace." />
        )}
      </Panel>
    </>
  );
}

function DirectorQaqcView({ visits, discs, projects, loading, loadError }) {
  const [fProject, setFProject] = useState('');
  const pidOf = (p) => String(p?._id ?? p ?? '');
  const pnameOf = (p) => {
    const id = pidOf(p);
    return projects.find((x) => String(x._id) === id)?.name ?? (p?.name ?? '—');
  };
  const isOpenDisc = (d) => String(d.status ?? 'Open').toLowerCase() !== 'closed';
  const fVisits = visits.filter((v) => !fProject || pidOf(v.project) === fProject);
  const fDiscs = discs.filter((d) => !fProject || pidOf(d.project) === fProject);
  const openDiscs = fDiscs.filter(isOpenDisc);
  const pending = fVisits.filter((v) => v.status !== 'Approved');
  const additional = fVisits.filter((v) => v.additionalVisit);
  const structural = openDiscs.filter(
    (d) => String(d.discipline ?? '').toLowerCase() === 'structural',
  );

  return (
    <>
      <div className="page-head">
        <div className="page-title">QA/QC Specifications</div>
        <div className="page-sub">Overview and approval of site visits and weekly reports submitted by the QA/QC team</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Total site visits" value={fVisits.length} accent="blueprint" />
        <KpiCard label="Pending report approval" value={pending.length} accent="amber" />
        <KpiCard label="Drawing issues flagged" value={openDiscs.length} accent="rust" />
        <KpiCard label="Additional visits" value={additional.length} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel
        title="Project-wise QA/QC summary"
        sub="Weekly reports and the full visit/discrepancy log are available in the Specification Head's own workspace"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="filter-select" value={fProject} onChange={(e) => setFProject(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p._id} value={String(p._id)}>{p.name}</option>)}
          </select>
        </div>
        <div className="kpi-grid cols-3">
          <KpiCard label="Site visits" value={fVisits.length} accent="blueprint" />
          <KpiCard label="Discrepancies during construction" value={openDiscs.length} accent="rust" />
          <KpiCard label="Drawing discrepancies — Structural" value={structural.length} accent="amber" />
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Drawing discrepancy tracking applies to the Structural department only — Mechanical,
          Electrical, PHE and Fire are not tracked here.
        </p>
        {loading ? <EmptyState text="Loading…" /> : (
          <>
            <div className="section-label">Site visits</div>
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => pnameOf(r.project) },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.visitDate ?? r.date ?? r.createdAt) },
                { key: 'visitType', label: 'Visit type', render: (r) => r.visitType ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                { key: 'additional', label: 'Additional', render: (r) => (r.additionalVisit ? 'Yes' : '—') },
                { key: 'discrepancy', label: 'Discrepancy found', render: (r) => (r.discrepancyFound ? 'Yes' : '—') },
              ]}
              rows={fVisits}
              emptyText="No site visits yet."
            />
            <div className="section-label" style={{ marginTop: 14 }}>Discrepancy log</div>
            <DataTable
              columns={[
                { key: 'issue', label: 'Issue', render: (r) => r.issue ?? '—' },
                { key: 'project', label: 'Project', render: (r) => pnameOf(r.project) },
                { key: 'discipline', label: 'Discipline', render: (r) => r.discipline ?? '—' },
                { key: 'severity', label: 'Severity', render: (r) => r.severity ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={fDiscs}
              emptyText="No discrepancies logged."
            />
          </>
        )}
      </Panel>
    </>
  );
}

function discDisplayStatus(d) {
  const s = String(d.status ?? '');
  if (s === 'Closed') return 'Closed';
  if (d.due) {
    const due = new Date(d.due);
    if (!Number.isNaN(due.getTime()) && due < new Date(new Date().toISOString().slice(0, 10))) return 'Overdue';
  }
  return s || 'Open';
}

function logWorkRow(e, projectName) {
  return {
    id: String(e._id ?? e.id),
    date: e.date ?? e.createdAt,
    project: e.project?.name ?? projectName(e.project),
    workType: e.taskActivity ?? e.category ?? '—',
    notes: e.notes ?? e.description ?? '—',
    hours: e.hours ?? '—',
    status: e.status ?? 'Logged',
  };
}

function AssocTDQaqcView({ visits, discs, reports, projects, loading, loadError }) {
  const pnameOf = (p) => {
    const id = String(p?._id ?? p ?? '');
    return projects.find((x) => String(x._id) === id)?.name ?? (p?.name ?? '—');
  };
  const openDiscs = discs.filter((d) => String(d.status ?? '') !== 'Closed');
  const pending = visits.filter((v) => String(v.status ?? '') !== 'Approved');
  const additional = visits.filter((v) => v.additionalVisit);
  return (
    <>
      <div className="page-head">
        <div className="page-title">QA/QC Specifications</div>
        <div className="page-sub">Overview and approval of site visits and weekly reports submitted by the QA/QC team</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Total site visits" value={visits.length} accent="blueprint" />
        <KpiCard label="Pending report approval" value={pending.length} accent="amber" />
        <KpiCard label="Drawing issues flagged" value={openDiscs.length} accent="rust" />
        <KpiCard label="Additional visits" value={additional.length} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="Weekly reports" sub="Submitted by the QA/QC team for approval">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'week', label: 'Week' },
              { key: 'project', label: 'Project' },
              { key: 'visits', label: 'Visits' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'submitted', label: 'Submitted', render: (r) => fmtShortDate(r.submitted) },
              { key: 'approved', label: 'Approved', render: (r) => fmtShortDate(r.approved) },
              { key: 'action', label: '', render: (r) => (r.status === 'Submitted' ? 'Awaiting QA/QC Specs Head' : '—') },
            ]}
            rows={weeklyReportRows(reports, visits, pnameOf)}
            emptyText="No weekly reports yet."
          />
        )}
      </Panel>
      <Panel title="Recent site visits">
        <DataTable
          columns={[
            { key: 'visitId', label: 'Visit no.', render: (r) => r.visitId ?? String(r._id ?? r.id ?? '').slice(-6) },
            { key: 'project', label: 'Project', render: (r) => pnameOf(r.project) },
            { key: 'phase', label: 'Phase', render: (r) => r.phase ?? '—' },
            { key: 'visitType', label: 'Type', render: (r) => r.visitType ?? '—' },
            { key: 'date', label: 'Date', render: (r) => fmtShortDate(r.visitDate ?? r.date ?? r.createdAt) },
            { key: 'drawingIssue', label: 'Drawing issue?', render: (r) => (r.discrepancyFound ? 'Yes' : 'No') },
          ]}
          rows={[...visits].sort((a, b) => String(b.visitDate ?? b.date ?? b.createdAt ?? '').localeCompare(String(a.visitDate ?? a.date ?? a.createdAt ?? '')))}
          emptyText="No site visits yet."
        />
      </Panel>
      <Panel title="Discrepancy Log" sub="Read-only summary — use QA/QC's own dashboard to mark items resolved">
        <DataTable
          columns={[
            { key: 'discId', label: 'ID', render: (r) => r.discId ?? String(r._id ?? r.id ?? '').slice(-6) },
            { key: 'project', label: 'Project', render: (r) => pnameOf(r.project) },
            { key: 'discipline', label: 'Discipline', render: (r) => r.discipline ?? '—' },
            { key: 'severity', label: 'Severity', render: (r) => r.severity ?? '—' },
            { key: 'issue', label: 'Issue', render: (r) => r.issue ?? '—' },
            { key: 'raised', label: 'Raised', render: (r) => fmtShortDate(r.raised ?? r.createdAt) },
            { key: 'due', label: 'Due', render: (r) => fmtShortDate(r.due) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={discDisplayStatus(r)}>{discDisplayStatus(r)}</StatusPill> },
          ]}
          rows={discs}
          emptyText="No discrepancies logged."
        />
      </Panel>
    </>
  );
}

function AssocTDBimView({ orders, log, scopeIds, loading, loadError }) {
  const activeOrders = orders.filter(
    (b) => !['completed', 'closed', 'done'].includes(String(b.status ?? '').toLowerCase()),
  );
  const rows = log.map((e) => logWorkRow(e, (p) => p?.name ?? '—'));
  return (
    <>
      <div className="page-head">
        <div className="page-title">BIM Head</div>
        <div className="page-sub">Team overview, BIM work orders and submitted work across every project</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Active BIM work orders" value={activeOrders.length} accent="blueprint" />
        <KpiCard label="Team submissions (log)" value={rows.length} accent="teal" />
        <KpiCard label="Projects covered" value={scopeIds.length} accent="forest" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="BIM work orders" sub="Issued by Admin, tracked separately from regular project work orders">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'woNo', label: 'BIM WO No.', render: (r) => r.woNo ?? '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'scope', label: 'Scope of work', render: (r) => r.scope ?? '—' },
              { key: 'date', label: 'Date', render: (r) => fmtShortDate(r.date ?? r.createdAt) },
              { key: 'fee', label: 'Fee / value', render: (r) => (r.fee ?? null) != null ? `₹${Number(r.fee).toLocaleString('en-IN')}` : '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={orders}
            emptyText="No BIM work orders yet."
          />
        )}
      </Panel>
      <Panel title="Team work log" sub="Recent submissions from the BIM team">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtShortDate(r.date) },
              { key: 'project', label: 'Project' },
              { key: 'workType', label: 'Work type' },
              { key: 'notes', label: 'Notes' },
              { key: 'hours', label: 'Hours' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
            ]}
            rows={rows}
            emptyText="No BIM team submissions yet."
          />
        )}
      </Panel>
    </>
  );
}

function AssocTDGbsView({ items, log, loading, loadError }) {
  const stepsOf = (item) => {
    const cert = item?.data?.item ?? item?.data?.cert ?? item?.data ?? item;
    const steps = cert?.steps ?? cert?.phases ?? cert?.stages ?? [];
    return Array.isArray(steps) ? steps : [];
  };
  const isDone = (s) => ['completed', 'complete', 'done', 'certified', 'approved'].includes(String(s.status ?? '').toLowerCase());
  const allSteps = items.flatMap((r) => stepsOf(r));
  const doneSteps = allSteps.filter(isDone);
  const rows = log.map((e) => logWorkRow(e, (p) => p?.name ?? '—'));
  return (
    <>
      <div className="page-head">
        <div className="page-title">GBS Head</div>
        <div className="page-sub">Green building certification progress across every project pursuing certification</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Projects in progress" value={items.length} accent="blueprint" />
        <KpiCard label="Phases completed" value={doneSteps.length} accent="forest" />
        <KpiCard label="Team submissions (log)" value={rows.length} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="Certification workflow by project" sub="6-phase progress, same data as each project's GBS tab">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project ?? r.data?.project ?? '—' },
              { key: 'phase', label: 'Phase', render: (r) => r.phase ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
            ]}
            rows={items.flatMap((item) => {
              const steps = stepsOf(item);
              const pname = item.project ?? item.data?.project ?? '—';
              if (steps.length === 0) return [{ project: pname, phase: '—', status: 'Not Started', remarks: '—' }];
              return steps.map((s) => ({ project: pname, phase: s.phase ?? s.name ?? '—', status: s.status ?? 'Not Started', remarks: s.remarks ?? '—' }));
            })}
            emptyText="No certification workflows yet."
          />
        )}
      </Panel>
      <Panel title="Team work log">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtShortDate(r.date) },
              { key: 'project', label: 'Project' },
              { key: 'workType', label: 'Work type' },
              { key: 'notes', label: 'Notes' },
              { key: 'hours', label: 'Hours' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
            ]}
            rows={rows}
            emptyText="No GBS team submissions yet."
          />
        )}
      </Panel>
    </>
  );
}

function AssocTDPeerView({ reviews, openComments, projects }) {
  const pnameOf = (p) => {
    const id = String(p?._id ?? p ?? '');
    return projects.find((x) => String(x._id) === id)?.name ?? (p?.name ?? '—');
  };
  const norm = (v) => String(v ?? '').toLowerCase();
  const inProgress = reviews.filter((p) => ['in progress', 'inprogress', 'ongoing', 'open'].includes(norm(p.status)));
  const pendingApproval = reviews.filter((p) => ['pending', 'submitted'].includes(norm(p.status)));
  return (
    <>
      <div className="page-head">
        <div className="page-title">Peer Review Head</div>
        <div className="page-sub">Overview of every peer review submission, checklist progress and open comments</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Reviews in progress" value={inProgress.length} accent="blueprint" />
        <KpiCard label="Pending approval" value={pendingApproval.length} accent="amber" />
        <KpiCard label="Open comments" value={openComments.length} accent="rust" />
      </div>
      <Panel title="Peer reviews" sub="Same data as each reviewer's own dashboard">
        <DataTable
          columns={[
            { key: 'jobNo', label: 'ID', render: (r) => r.jobNo ?? String(r._id ?? r.id ?? '').slice(-6) },
            { key: 'project', label: 'Project', render: (r) => pnameOf(r.project) },
            { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
            { key: 'discipline', label: 'Discipline', render: (r) => r.discipline ?? '—' },
            { key: 'reviewer', label: 'Reviewer', render: (r) => r.reviewer ?? '—' },
            { key: 'due', label: 'Due', render: (r) => fmtShortDate(r.dueDate) },
            {
              key: 'status', label: 'Status', render: (r) => {
                const s = norm(r.status);
                const label = (r.finalApproved || s === 'approved for issue') ? 'Completed' : (r.status ?? '—');
                return <StatusPill status={label}>{label}</StatusPill>;
              },
            },
          ]}
          rows={reviews}
          emptyText="No peer reviews yet."
        />
      </Panel>
    </>
  );
}

function AssocTDQsView({ areas, log, scopeIds, leaves, loading, loadError }) {
  const inScope = scopeIds.length === 0
    ? log
    : log.filter((e) => scopeIds.includes(String(e.project?._id ?? e.project ?? '')));
  const rows = inScope.map((e) => logWorkRow(e, (p) => p?.name ?? '—'));
  const pendingAreas = areas.filter((a) =>
    ['pending', 'submitted', 'open'].includes(String(a.status ?? a.reviewStatus ?? '').toLowerCase()),
  );
  const pendingLeaves = leaves.filter((l) => String(l.status ?? '').toLowerCase() === 'pending');
  const statusLabel = (s) => {
    const t = String(s ?? '');
    if (t === 'Pending') return 'Needs review';
    if (t === 'Approved') return 'Settled';
    return t || '—';
  };
  return (
    <>
      <div className="page-head">
        <div className="page-title">QS Head</div>
        <div className="page-sub">BOQ-related work across the QS team, area settlements, and leave approvals for the QS department</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Team submissions (log)" value={rows.length} accent="blueprint" />
        <KpiCard label="Area settlements needing review" value={pendingAreas.length} accent="amber" />
        <KpiCard label="Pending leave approvals" value={pendingLeaves.length} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
      <Panel title="Area settlements">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'zone', label: 'Zone', render: (r) => r.zone ?? '—' },
              { key: 'initial', label: 'Initial (sq.ft)', render: (r) => r.initial ?? '—' },
              { key: 'revised', label: 'Revised (sq.ft)', render: (r) => r.revised ?? '—' },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={statusLabel(r.status ?? r.reviewStatus)}>{statusLabel(r.status ?? r.reviewStatus)}</StatusPill> },
            ]}
            rows={areas}
            emptyText="No area settlements yet."
          />
        )}
      </Panel>
      <Panel title="Team work log">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtShortDate(r.date) },
              { key: 'project', label: 'Project' },
              { key: 'workType', label: 'Work type' },
              { key: 'notes', label: 'Notes' },
              { key: 'hours', label: 'Hours' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
            ]}
            rows={rows}
            emptyText="No QS team submissions yet."
          />
        )}
      </Panel>
      <Panel title="QS leave approvals" sub="Pending leave requests from the QS team">
        {loading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
              { key: 'leaveType', label: 'Type' },
              { key: 'from', label: 'From', render: (r) => fmtShortDate(r.from) },
              { key: 'to', label: 'To', render: (r) => fmtShortDate(r.to) },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={pendingLeaves}
            emptyText="Nothing pending."
          />
        )}
      </Panel>
    </>
  );
}
