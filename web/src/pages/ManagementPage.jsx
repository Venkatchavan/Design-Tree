import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, request, toQuery, workEntriesApi } from '../lib/api.js';
import { billingApi, bookingsApi, certificatesApi, transmittalsApi } from '../lib/phase3Api.js';
import { reportsApi } from '../lib/phase4aApi.js';
import { bimApi, discApi, peerApi, rfiApi, visitsApi } from '../lib/functionsApi.js';
import { revisionsApi } from '../lib/workApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const countBy = (rows, fn) => {
  const m = {};
  for (const r of rows) {
    const k = fn(r) ?? '—';
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m).map(([name, count]) => ({ name, count }));
};

const LEAVE_STATUSES = ['', 'Pending', 'Approved', 'Rejected'];

export default function ManagementPage({ bootstrap, user, viewKey }) {
  void user;
  void viewKey;
  const role = bootstrap?.role?.key ?? '';
  const hideFinance = role === 'associate_director';

  const [tab, setTab] = useState('projects');
  const [branch, setBranch] = useState('');
  const [service, setService] = useState('');
  const [stage, setStage] = useState('');
  const [project, setProject] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');

  const mgmtParams = useMemo(
    () => ({
      ...(branch ? { branch } : {}),
      ...(service ? { service } : {}),
      ...(stage ? { stage } : {}),
      ...(project ? { project } : {}),
    }),
    [branch, service, stage, project],
  );

  const projects = useQuery({
    queryKey: ['projects-management'],
    queryFn: () => projectsApi.list({}),
  });
  const management = useQuery({
    queryKey: ['reports-management', mgmtParams],
    queryFn: () => reportsApi.management(mgmtParams),
  });

  // Tab-scoped supporting queries (enabled only on their tab).
  const revisions = useQuery({
    queryKey: ['mgmt-revisions'],
    queryFn: () => revisionsApi.list({}),
    enabled: tab === 'projects',
  });
  const transmittals = useQuery({
    queryKey: ['mgmt-transmittals'],
    queryFn: () => transmittalsApi.list({}),
    enabled: tab === 'projects' || tab === 'admin',
  });
  const openRfis = useQuery({
    queryKey: ['mgmt-rfis'],
    queryFn: () => rfiApi.list({}),
    enabled: tab === 'projects',
  });
  const billingStages = useQuery({
    queryKey: ['mgmt-billing-stages'],
    queryFn: () => billingApi.stages({}),
    enabled: tab === 'projects',
  });
  const certs = useQuery({
    queryKey: ['mgmt-certificates'],
    queryFn: () => certificatesApi.list({}),
    enabled: tab === 'projects',
    retry: false,
  });
  const billingOverview = useQuery({
    queryKey: ['mgmt-billing-overview'],
    queryFn: billingApi.overview,
    enabled: tab === 'admin',
  });
  const revenue = useQuery({
    queryKey: ['mgmt-revenue'],
    queryFn: billingApi.revenueByProject,
    enabled: tab === 'finance' && !hideFinance,
  });
  const leave = useQuery({
    queryKey: ['mgmt-leave', leaveStatus],
    queryFn: () =>
      request(`/api/leave-travel/leave${toQuery({ status: leaveStatus || undefined })}`),
    enabled: tab === 'hr',
    retry: false,
  });
  const travel = useQuery({
    queryKey: ['mgmt-travel'],
    queryFn: () => request('/api/leave-travel/travel'),
    enabled: tab === 'travel',
    retry: false,
  });
  const bookingsSummary = useQuery({
    queryKey: ['mgmt-bookings-summary'],
    queryFn: bookingsApi.summary,
    enabled: tab === 'travel',
  });
  const workEntries = useQuery({
    queryKey: ['mgmt-work-entries', from, to],
    queryFn: () =>
      workEntriesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    enabled: tab === 'travel' || tab === 'ptl',
  });
  const bimOrders = useQuery({
    queryKey: ['mgmt-bim'],
    queryFn: () => bimApi.list({}),
    enabled: tab === 'bim',
  });
  const peers = useQuery({
    queryKey: ['mgmt-peers'],
    queryFn: () => peerApi.list({}),
    enabled: tab === 'peer',
  });
  const visits = useQuery({
    queryKey: ['mgmt-visits'],
    queryFn: () => visitsApi.list({}),
    enabled: tab === 'qaqc',
  });
  const discs = useQuery({
    queryKey: ['mgmt-discs'],
    queryFn: () => discApi.list({}),
    enabled: tab === 'qaqc',
  });

  // GBS phase counts across the first 10 active projects (derived).
  const projectRows = arr(projects.data);
  const branchFilterOptions = useMemo(
    () => [...new Set(projectRows.map((p) => p.branch).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const gbsTargets = useMemo(
    () =>
      projectRows
        .filter((p) => String(p.status ?? '').toLowerCase() !== 'completed')
        .slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const gbs = useQuery({
    queryKey: ['mgmt-gbs', gbsTargets.map((p) => p._id).join(',')],
    queryFn: async () => {
      const out = await Promise.allSettled(
        gbsTargets.map((p) =>
          request(`/api/functions/gbs-cert${toQuery({ project: p._id })}`).then((d) => ({
            project: p.name,
            data: d,
          })),
        ),
      );
      return out
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    enabled: tab === 'bim' && gbsTargets.length > 0,
    retry: false,
  });

  const m = management.data ?? {};
  const mp = m.projects ?? {};
  const billing = m.billing ?? {};
  const qaqc = m.qaqc ?? {};
  const peer = m.peerReview ?? {};
  const rfisM = m.rfis ?? {};
  const meetingsM = m.meetings ?? {};

  const TABS = [
    { key: 'projects', label: 'Projects' },
    { key: 'admin', label: 'Admin / Billing' },
    ...(!hideFinance ? [{ key: 'finance', label: 'Finance' }] : []),
    { key: 'hr', label: 'HR' },
    { key: 'travel', label: 'Travel log' },
    { key: 'ptl', label: 'PTL' },
    { key: 'bim', label: 'BIM & GBS' },
    { key: 'peer', label: 'Peer review' },
    { key: 'qaqc', label: 'QA/QC' },
  ];

  const rfiRows = arr(openRfis.data);
  const pendingResponses = rfiRows.filter((r) =>
    ['open', 'pending', 'raised'].includes(String(r.status ?? '').toLowerCase()),
  );
  const billingReadyRows = arr(billingStages.data).filter((s) =>
    String(s.billingReadiness ?? '').toLowerCase().includes('ready'),
  );
  const leaveRows = arr(leave.data);
  const travelRows = arr(travel.data);
  const entryRows = arr(workEntries.data);
  const peerRows = arr(peers.data);
  const openComments = peerRows.flatMap((p) =>
    (Array.isArray(p.comments) ? p.comments : []).filter((c) =>
      ['open', 'pending', 'unresolved'].includes(String(c.status ?? 'open').toLowerCase()),
    ),
  );
  const inProgressPeers = peerRows.filter((p) =>
    ['in progress', 'inprogress', 'ongoing', 'open'].includes(String(p.status ?? '').toLowerCase()),
  );
  const ptlByProject = useMemo(() => {
    const groups = {};
    for (const e of entryRows) {
      const key = e.project?.name ?? e.project ?? 'Unassigned';
      (groups[key] ??= []).push(e);
    }
    return Object.entries(groups).map(([name, items]) => {
      const pcts = items.map((e) => Number(e.progressPct)).filter((n) => Number.isFinite(n));
      return {
        name,
        entries: items.length,
        progress:
          pcts.length > 0
            ? `${(pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1)}%`
            : '—',
      };
    });
  }, [entryRows]);
  const hoursByProject = useMemo(() => {
    const groups = {};
    for (const e of entryRows) {
      const key = e.project?.name ?? e.project ?? 'Unassigned';
      const h = Number(e.hours ?? e.manHours ?? 0);
      groups[key] = (groups[key] ?? 0) + (Number.isFinite(h) ? h : 0);
    }
    return Object.entries(groups).map(([name, hours]) => ({ name, hours }));
  }, [entryRows]);

  function resetFilters() {
    setBranch('');
    setService('');
    setStage('');
    setProject('');
    setFrom('');
    setTo('');
  }

  const filterError = projects.error?.message ?? management.error?.message;

  return (
    <div id="view-management">
      <div className="page-head">
        <div className="page-title">Management Oversight</div>
        <div className="page-sub">
          Review-only consolidated figures across projects, billing, HR, travel, PTL, BIM/GBS, peer review and QA/QC.
        </div>
      </div>

      <Panel title="Filters">
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Branch</label>
            <select className="filter-select" style={{ width: '100%' }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">All branches</option>
              {branchFilterOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Service</label>
            <input className="form-input" value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Structural" />
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All projects</option>
              {projectRows.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="approve-btn" onClick={resetFilters}>Reset</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Date range applies only to work-entry-derived panels (Travel log hours, PTL); other endpoints do not accept dates.
        </p>
      </Panel>

      {filterError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {filterError}
        </div>
      )}

      <div className="kpi-grid cols-6">
        <KpiCard label="Active projects" value={mp.active ?? 0} accent="forest" />
        <KpiCard label="On hold" value={mp.onHold ?? 0} accent="amber" />
        <KpiCard label="Completed" value={mp.completed ?? 0} accent="blueprint" />
        <KpiCard label="Billing ready" value={billing.ready ?? 0} accent="teal" />
        <KpiCard label="Open RFIs" value={rfisM.open ?? pendingResponses.length} accent="rust" />
        <KpiCard label="QA/QC open discrepancies" value={qaqc.openDiscrepancies ?? 0} accent="violet" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'projects' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Total projects" value={mp.total ?? 0} accent="blueprint" />
            <KpiCard label="Revisions" value={m.revisions ?? arr(revisions.data).length} accent="teal" />
            <KpiCard label="Submissions (transmittals)" value={m.transmittals ?? arr(transmittals.data).length} accent="forest" />
            <KpiCard label="Certificates issued" value={certs.data ? arr(certs.data).length : '—'} accent="copper" />
          </div>
          {certs.error && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              Certificates: {certs.error.message}
            </div>
          )}
          <Panel title="Projects by stage">
            <DataTable
              columns={[
                { key: 'name', label: 'Stage' },
                { key: 'count', label: 'Count' },
              ]}
              rows={countBy(Object.entries(mp.byStage ?? {}).map(([name, count]) => ({ name, count })), (r) => r.name).map((r) => ({ name: r.name, count: mp.byStage[r.name] ?? r.count }))}
              emptyText="No stage breakdown reported."
            />
          </Panel>
          <Panel title="Projects by branch">
            <DataTable
              columns={[{ key: 'name', label: 'Branch' }, { key: 'count', label: 'Count' }]}
              rows={Object.entries(mp.byBranch ?? {}).map(([name, count]) => ({ name, count }))}
              emptyText="No branch breakdown reported."
            />
          </Panel>
          <Panel title="Projects by service">
            <DataTable
              columns={[{ key: 'name', label: 'Service' }, { key: 'count', label: 'Count' }]}
              rows={Object.entries(mp.byService ?? {}).map(([name, count]) => ({ name, count }))}
              emptyText="No service breakdown reported."
            />
          </Panel>
          <Panel title="Pending responses (open RFIs)">
            <DataTable
              columns={[
                { key: 'subject', label: 'Subject', render: (r) => r.subject ?? r.title ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={pendingResponses.slice(0, 20)}
              emptyText="No open RFIs."
            />
          </Panel>
          <Panel title="Billing-ready stages">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
                { key: 'stage', label: 'Stage' },
                { key: 'billingReadiness', label: 'Readiness', render: (r) => <StatusPill status={r.billingReadiness}>{r.billingReadiness}</StatusPill> },
              ]}
              rows={billingReadyRows.slice(0, 20)}
              emptyText="No billing-ready stages."
            />
          </Panel>
        </>
      )}

      {tab === 'admin' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Contract value" value={money(billingOverview.data?.contractValue)} accent="blueprint" />
            <KpiCard label="Invoiced" value={money(billingOverview.data?.invoiced)} accent="copper" />
            <KpiCard label="Received" value={money(billingOverview.data?.received)} accent="forest" />
            <KpiCard label="Transmittal log entries" value={arr(transmittals.data).length} accent="teal" />
          </div>
          <Panel title="Transmittal log (latest)">
            <DataTable
              columns={[
                { key: 'number', label: 'No.', render: (r) => r.number ?? r.transmittalNo ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={arr(transmittals.data).slice(0, 20)}
              emptyText="No transmittals logged."
            />
          </Panel>
        </>
      )}

      {tab === 'finance' && !hideFinance && (
        <Panel title="Revenue by project">
          {revenue.isLoading ? (
            <EmptyState text="Loading revenue…" />
          ) : revenue.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{revenue.error.message}</div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br /><span className="proj-code">{r.code}</span></> },
                { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
                { key: 'received', label: 'Received', render: (r) => money(r.received ?? r.collected) },
                { key: 'pct', label: '% collected', render: (r) => `${r.pct ?? 0}%` },
              ]}
              rows={arr(revenue.data)}
              emptyText="No revenue data yet."
            />
          )}
        </Panel>
      )}

      {tab === 'hr' && (
        <Panel title="Leave requests by status">
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <select className="filter-select" value={leaveStatus} onChange={(e) => setLeaveStatus(e.target.value)}>
              {LEAVE_STATUSES.map((s) => (
                <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>
              ))}
            </select>
          </div>
          {leave.isLoading ? (
            <EmptyState text="Loading leave requests…" />
          ) : leave.error && leave.error.status === 403 ? (
            <EmptyState text="Leave data is not shared with your role." />
          ) : leave.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{leave.error.message}</div>
          ) : (
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                { key: 'type', label: 'Type', render: (r) => r.leaveType ?? r.type ?? '—' },
                { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.from ?? r.startDate)} → ${fmtDate(r.to ?? r.endDate)}` },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={leaveRows}
              emptyText="No leave requests found."
            />
          )}
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            “Denied” requests are those with status Rejected.
          </p>
        </Panel>
      )}

      {tab === 'travel' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Total bookings" value={bookingsSummary.data?.total ?? travelRows.length} accent="blueprint" />
            <KpiCard label="Upcoming" value={bookingsSummary.data?.upcoming ?? 0} accent="teal" />
            <KpiCard label="Travel log entries" value={travelRows.length} accent="copper" />
            <KpiCard label="Work entries in range" value={entryRows.length} accent="violet" />
          </div>
          {travel.error && travel.error.status !== 403 && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{travel.error.message}</div>
          )}
          <Panel title="Travel log">
            {travel.error && travel.error.status === 403 ? (
              <EmptyState text="Travel log is not shared with your role." />
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                  { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.departureDate ?? r.from)} → ${fmtDate(r.returnDate ?? r.to)}` },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={travelRows.slice(0, 20)}
                emptyText="No travel entries yet."
              />
            )}
          </Panel>
          <Panel title="Hours per project (derived from work entries in range)">
            <DataTable
              columns={[{ key: 'name', label: 'Project' }, { key: 'hours', label: 'Hours' }]}
              rows={hoursByProject}
              emptyText="No work entries in the selected range."
            />
          </Panel>
        </>
      )}

      {tab === 'ptl' && (
        <Panel title="PTL entries by project (progress = avg progressPct, derived)">
          {workEntries.isLoading ? (
            <EmptyState text="Loading work entries…" />
          ) : workEntries.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{workEntries.error.message}</div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Project' },
                { key: 'entries', label: 'Entries' },
                { key: 'progress', label: 'Avg progress' },
              ]}
              rows={ptlByProject}
              emptyText="No work entries yet."
            />
          )}
        </Panel>
      )}

      {tab === 'bim' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="BIM work orders" value={arr(bimOrders.data).length} accent="blueprint" />
            <KpiCard label="GBS projects checked" value={gbs.data?.length ?? 0} accent="teal" />
            <KpiCard label="Peer reviews in progress" value={peer.inProgress ?? 0} accent="amber" />
            <KpiCard label="QA/QC visits" value={qaqc.visits ?? 0} accent="violet" />
          </div>
          <Panel title="BIM work orders">
            <DataTable
              columns={[
                { key: 'title', label: 'Order', render: (r) => r.title ?? r.subject ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={arr(bimOrders.data).slice(0, 20)}
              emptyText="No BIM work orders yet."
            />
          </Panel>
          <Panel title="GBS certification phases (first 10 active projects, derived)">
            {gbs.isLoading ? (
              <EmptyState text="Loading GBS certifications…" />
            ) : gbs.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{gbs.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  { key: 'phases', label: 'Phases completed', render: (r) => {
                    const cert = r.data?.item ?? r.data?.cert ?? r.data;
                    const phases = cert?.phases ?? cert?.stages ?? [];
                    if (!Array.isArray(phases)) return '—';
                    const done = phases.filter((p) => ['completed', 'complete', 'done', 'certified'].includes(String(p.status ?? '').toLowerCase())).length;
                    return `${done} / ${phases.length}`;
                  } },
                ]}
                rows={gbs.data ?? []}
                emptyText="No GBS certification data for active projects."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'peer' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="In progress" value={peer.inProgress ?? inProgressPeers.length} accent="amber" />
            <KpiCard label="Open comments" value={peer.openComments ?? openComments.length} accent="rust" />
            <KpiCard label="Total reviews" value={peerRows.length} accent="blueprint" />
            <KpiCard label="QA/QC open discrepancies" value={qaqc.openDiscrepancies ?? 0} accent="violet" />
          </div>
          <Panel title="Peer reviews">
            <DataTable
              columns={[
                { key: 'title', label: 'Review', render: (r) => r.title ?? r.subject ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={peerRows.slice(0, 20)}
              emptyText="No peer reviews yet."
            />
          </Panel>
        </>
      )}

      {tab === 'qaqc' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Site visits" value={qaqc.visits ?? arr(visits.data).length} accent="blueprint" />
            <KpiCard label="Open discrepancies" value={qaqc.openDiscrepancies ?? 0} accent="rust" />
            <KpiCard label="Peer reviews in progress" value={peer.inProgress ?? 0} accent="amber" />
            <KpiCard label="Meetings scheduled" value={meetingsM.scheduled ?? 0} accent="teal" />
          </div>
          <Panel title="Recent site visits">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.visitDate ?? r.date ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={arr(visits.data).slice(0, 20)}
              emptyText="No site visits yet."
            />
          </Panel>
          <Panel title="Open discrepancies">
            <DataTable
              columns={[
                { key: 'title', label: 'Discrepancy', render: (r) => r.title ?? r.description ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              ]}
              rows={arr(discs.data).filter((d) => !['closed', 'resolved', 'completed'].includes(String(d.status ?? '').toLowerCase())).slice(0, 20)}
              emptyText="No open discrepancies."
            />
          </Panel>
        </>
      )}
    </div>
  );
}
