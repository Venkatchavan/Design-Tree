import { leadershipProjectRows } from '../lib/leadershipProjects.js';
import TravelBookingLog from './TravelBookingLog.jsx';
import { workAllocations } from '../lib/workAllocations.js';
import { serviceNames } from '../lib/services.js';
import { addHours, hoursText, workReportApi } from '../lib/workReport.js';
import WorkReportStatus from '../components/work/WorkReportStatus.jsx';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, employeesApi, projectsApi, request, toQuery } from '../lib/api.js';
import { billingApi, certificatesApi, transmittalsApi } from '../lib/phase3Api.js';
import { reportsApi } from '../lib/phase4aApi.js';
import { bimApi, discApi, peerApi, rfiApi, visitsApi } from '../lib/functionsApi.js';
import { allowanceApi, travelApi } from '../lib/phase4bApi.js';
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

export default function ManagementPage({ bootstrap, user, viewKey }) {
  void user;
  void viewKey;
  const role = bootstrap?.role?.key ?? '';
  // Associate/Technical Directors see delivery, commercial and people overview
  // without the Finance tab (no finance API access for these roles).
  const leadership = ['founding_director','executive_director'].includes(role);
  const hideFinance = role === 'associate_director' || role === 'technical_director';

  const [tab, setTab] = useState('projects');
  const [branch, setBranch] = useState('');
  const [service, setService] = useState('');
  const [stage, setStage] = useState('');
  const [project, setProject] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [revSource, setRevSource] = useState('');
  const [awaitSource, setAwaitSource] = useState('');
  // Frozen at mount so day-counts stay stable across re-renders.
  const [nowMs] = useState(() => Date.now());

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
    queryFn: () => projectsApi.directory({}),
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
    enabled: tab === 'projects' || tab === 'admin',
  });
  const revenue = useQuery({
    queryKey: ['mgmt-revenue'],
    queryFn: billingApi.revenueByProject,
    enabled: (tab === 'finance' && !hideFinance) || tab === 'admin',
  });
  const projectCosts = useQuery({
    queryKey: ['mgmt-project-costs'],
    queryFn: billingApi.projectCosts,
    enabled: tab === 'finance' && !hideFinance,
  });
  const certsQ = useQuery({
    queryKey: ['mgmt-certificates'],
    queryFn: () => certificatesApi.list({}),
    enabled: tab === 'admin',
    retry: false,
  });
  const certReqsQ = useQuery({
    queryKey: ['mgmt-cert-requests'],
    queryFn: () => certificatesApi.requests({}),
    enabled: tab === 'admin',
    retry: false,
  });
  const attendanceQ = useQuery({
    queryKey: ['mgmt-attendance'],
    queryFn: () => attendanceApi.list({}),
    enabled: tab === 'hr',
    retry: false,
  });
  const travelsQ = useQuery({
    queryKey: ['mgmt-travels'],
    queryFn: () => travelApi.list({}),
    enabled: tab === 'travel' || tab === 'hr',
    retry: false,
  });
  const allowsQ = useQuery({
    queryKey: ['mgmt-allowances'],
    queryFn: () => allowanceApi.list({}),
    enabled: tab === 'travel',
    retry: false,
  });
  const employeesQ = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list({}),
    enabled: tab === 'hr',
    retry: false,
  });
  const leave = useQuery({
    queryKey: ['mgmt-leave-all'],
    queryFn: () => request('/api/leave-travel/leave'),
    enabled: tab === 'hr',
    retry: false,
  });
  const travel = useQuery({
    queryKey: ['mgmt-travel'],
    queryFn: () => request('/api/leave-travel/travel'),
    enabled: tab === 'travel',
    retry: false,
  });
  const workEntries = useQuery({
    queryKey: ['mgmt-work-entries', from, to],
    queryFn: () =>
      workReportApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    enabled: tab === 'ptl' || tab === 'hr' || tab === 'bim',
    refetchInterval: 10000,
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
  const projectById = (pid) => projectRows.find((p) => String(p._id) === String(pid));
  const branchOf = (populated, pid) => populated?.branch ?? projectById(pid)?.branch ?? '—';
  const branchFilterOptions = useMemo(
    () => [...new Set(projectRows.map((p) => p.branch).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data],
  );
  const serviceFilterOptions = useMemo(
    () => [...new Set([...projectRows.flatMap((p) => [...(p.services ?? []), ...(p.scope ?? []).map((s) => s.service)]), ...(workEntries.data?.items ?? []).map(e => e.service)].filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data, workEntries.data],
  );
  const stageFilterOptions = useMemo(
    () => [...new Set([...projectRows.map((p) => p.currentStage), ...(workEntries.data?.items ?? []).flatMap(workAllocations).map(e => e.stage ?? 'Not recorded')].filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects.data, workEntries.data],
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

  const TABS = [
    { key: 'projects', label: 'Projects' },
    { key: 'admin', label: 'Admin / Billing' },
    ...(!hideFinance ? [{ key: 'finance', label: 'Finance' }] : []),
    { key: 'hr', label: 'HR' },
    { key: 'travel', label: 'Travel log' },
    { key: 'ptl', label: 'PTL' },
    ...(!leadership ? [{ key: 'bim', label: 'BIM & GBS' }, { key: 'peer', label: 'Peer review' }, { key: 'qaqc', label: 'QA/QC' }] : []),
  ];

  const travelRows = arr(travel.data);
  const entryRows = arr(workEntries.data);
  const peerRows = arr(peers.data);
  const ptlHoursFiltered = leadershipProjectRows(projectRows, entryRows, {project,branch,service,stage});

  const ptlTransmittals = useMemo(() => arr(management.data?.submissions).filter((r) => {
    if (project && r.projectId !== project) return false;
    if (branch && r.branch !== branch) return false;
    if (service && r.service !== service) return false;
    if (stage && r.stage !== stage) return false;
    return true;
  }), [management.data, project, branch, service, stage]);

  const ptlProgress = ptlHoursFiltered;

  function resetFilters() {
    setBranch('');
    setService('');
    setStage('');
    setProject('');
    setFrom('');
    setTo('');
  }

  // Revision raised-by → Internal / Client / Architect (free-text field).
  function revisionSourceOf(name) {
    const t = String(name ?? '');
    if (/architect/i.test(t)) return 'Architect';
    if (/client/i.test(t)) return 'Client';
    return 'Internal';
  }

  // RFI raised-by (populated user) → source label.
  function rfiSourceOf(r) {
    const role = String(r.raisedBy?.role ?? '').toLowerCase();
    if (role === 'client') return 'Client';
    if (role === 'architect') return 'Architect';
    return 'Internal';
  }

  function inDateRange(v) {
    if (!from && !to) return true;
    const d = String(v ?? '').slice(0, 10);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  const revisionRows = useMemo(() => arr(revisions.data).map((r) => {
    const pid = String(r.project?._id ?? r.project ?? '');
    const proj = projectById(pid);
    return {
      id: String(r._id ?? r.id),
      project: r.project?.name ?? proj?.name ?? '—',
      projectId: pid,
      branch: proj?.branch ?? '—',
      stage: r.stage ?? '—',
      item: r.details ?? r.drawing ?? '—',
      source: revisionSourceOf(r.raisedBy),
      raised: r.dateRaised ?? r.createdAt,
      status: String(r.status ?? '') === 'Cleared' ? 'Cleared' : 'Awaiting employee update',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [revisions.data, projects.data]);

  const revFiltered = revisionRows.filter((r) =>
    (!revSource || r.source === revSource) &&
    (!project || r.projectId === project) &&
    (!branch || r.branch === branch) &&
    (!stage || r.stage === stage) &&
    inDateRange(r.raised),
  );

  const submissionRows = useMemo(() => arr(management.data?.submissions).filter((r) => {
    if (project && r.projectId !== project) return false;
    if (branch && r.branch !== branch) return false;
    if (service && r.service !== service) return false;
    if (stage && r.stage !== stage) return false;
    return inDateRange(r.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [management.data, project, branch, service, stage, from, to]);

  const delayedRows = useMemo(() => arr(billingStages.data)
    .filter((r) => (r.delayDays ?? 0) > 0)
    .filter((r) => {
      const pid = String(r.project?._id ?? r.project ?? '');
      if (project && pid !== project) return false;
      const b = branchOf(r.project, pid);
      if (branch && b !== branch) return false;
      if (service && (r.service ?? '') !== service) return false;
      if (stage && (r.stage ?? '') !== stage) return false;
      return true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [billingStages.data, projects.data, project, branch, service, stage]);

  const revRows = arr(revenue.data?.items ?? revenue.data);
  const totalContract = revRows.reduce((s, r) => s + Number(r.contract ?? 0), 0);
  const totalInvoiced = revRows.reduce((s, r) => s + Number(r.invoiced ?? 0), 0);
  const totalReceived = revRows.reduce((s, r) => s + Number(r.received ?? 0), 0);

  const readyStages = useMemo(() => arr(billingStages.data?.items ?? billingStages.data)
    .filter((r) => String(r.billingReadiness ?? '') === 'Ready for billing')
    .filter((r) => {
      const pid = String(r.project?._id ?? r.project ?? '');
      if (project && pid !== project) return false;
      if (branch && branchOf(r.project, pid) !== branch) return false;
      if (service && (r.service ?? '') !== service) return false;
      if (stage && (r.stage ?? '') !== stage) return false;
      return true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [billingStages.data, projects.data, project, branch, service, stage]);

  const certRequests = useMemo(() => arr(certReqsQ.data?.items ?? certReqsQ.data), [certReqsQ.data]);
  const certsList = useMemo(() => arr(certsQ.data?.items ?? certsQ.data), [certsQ.data]);
  const certReceived = certRequests.filter((r) => String(r.status ?? '') === 'Uploaded');
  const certRequested = certRequests.filter((r) => String(r.status ?? '') !== 'Uploaded');
  const certRows = useMemo(() => certRequests
    .filter((r) => {
      const pid = String(r.project?._id ?? r.project ?? '');
      if (project && pid !== project) return false;
      if (branch && branchOf(r.project, pid) !== branch) return false;
      return true;
    })
    .map((r) => {
      const pid = String(r.project?._id ?? r.project ?? '');
      const uploaded = String(r.status ?? '') === 'Uploaded';
      const cert = uploaded
        ? certsList.filter((c) => String(c.project?._id ?? c.project ?? '') === pid && (c.certType ?? '') === (r.category ?? '')).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
        : null;
      return {
        id: String(r._id ?? r.id),
        project: r.project,
        certType: r.category,
        stage: cert?.stage ?? '—',
        status: uploaded ? 'Received' : 'Requested',
        issuedDate: cert?.issuedDate,
        createdAt: r.createdAt,
        issuedBy: cert?.issuedBy ?? '—',
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [certRequests, certsList, projects.data, project, branch]);

  // ---- Finance tab aggregates (project lookups join branch/stage) ----
  const finBranchRows = useMemo(() => {
    const m = new Map();
    for (const r of revRows) {
      const b = projectById(r.id)?.branch ?? '—';
      const g = m.get(b) ?? { branch: b, contract: 0, invoiced: 0, received: 0 };
      g.contract += Number(r.contract ?? 0);
      g.invoiced += Number(r.invoiced ?? 0);
      g.received += Number(r.received ?? 0);
      m.set(b, g);
    }
    return [...m.values()].sort((a, b) => b.contract - a.contract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenue.data, projects.data]);

  const finServiceRows = useMemo(
    () => arr(revenue.data?.byService),
    [revenue.data],
  );

  const finStageRows = useMemo(() => {
    const m = new Map();
    for (const r of revRows) {
      const st = projectById(r.id)?.currentStage ?? '—';
      const g = m.get(st) ?? { stage: st, contract: 0, invoiced: 0, received: 0 };
      g.contract += Number(r.contract ?? 0);
      g.invoiced += Number(r.invoiced ?? 0);
      g.received += Number(r.received ?? 0);
      m.set(st, g);
    }
    return [...m.values()].sort((a, b) => b.contract - a.contract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenue.data, projects.data]);

  const invoiceRows = useMemo(() => revRows.flatMap((r) => {
    const rows = r.serviceRows ?? [];
    if (rows.length === 0) {
      return [{
        project: r.name, service: '—', contract: Number(r.contract ?? 0),
        invoiced: Number(r.invoiced ?? 0), received: Number(r.received ?? 0),
        outstanding: Number(r.contract ?? 0) - Number(r.invoiced ?? 0),
      }];
    }
    return rows.map((s) => ({
      project: r.name,
      service: s.service,
      contract: Number(s.contract ?? 0),
      invoiced: Number(s.invoiced ?? 0),
      received: Number(s.received ?? 0),
      outstanding: Number(s.contract ?? 0) - Number(s.invoiced ?? 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [revenue.data]);

  const costPerfRows = useMemo(() => {
    const revById = new Map(revRows.map((r) => [String(r.id), r]));
    return arr(projectCosts.data?.items ?? projectCosts.data).map((c) => {
      const contract = Number(revById.get(String(c.id))?.contract ?? c.budget ?? 0);
      const labourCost = Number(c.labourCost ?? 0);
      return { id: c.id, name: c.name, contract, labourCost, margin: contract - labourCost };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCosts.data, revenue.data]);

  // ---- BIM tab aggregates ----
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
  const bimLogEntries = useMemo(
    () => arr(workEntries.data?.items ?? workEntries.data).filter((e) =>
      bimScopeIds.includes(String(e.project?._id ?? e.project ?? '')),
    ),
    [workEntries.data, bimScopeIds],
  );
  const bimHoursByProject = useMemo(() => {
    const groups = {};
    for (const e of bimLogEntries) {
      const pid = String(e.project?._id ?? e.project ?? '');
      const proj = projectById(pid);
      const key = proj?.name ?? e.project?.name ?? 'Unassigned';
      const g = groups[key] ?? { name: key, pid, branch: proj?.branch ?? e.project?.branch ?? '—', stage: proj?.currentStage ?? '—', hours: 0 };
      g.hours += Number(e.hours ?? e.manHours ?? 0);
      groups[key] = g;
    }
    return Object.values(groups).map((g) => ({ ...g, hours: Number(g.hours) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bimLogEntries, projects.data]);
  const bimHoursFiltered = bimHoursByProject.filter((r) => {
    if (project && r.pid !== project) return false;
    if (branch && r.branch !== branch) return false;
    if (stage && r.stage !== stage) return false;
    return true;
  });
  const bimHoursTotal = bimHoursFiltered.reduce((s, r) => s + r.hours, 0);
  const bimTransmittals = useMemo(() => arr(management.data?.submissions).filter((r) => {
    if (!bimScopeIds.includes(r.projectId)) return false;
    if (project && r.projectId !== project) return false;
    if (branch && r.branch !== branch) return false;
    if (stage && r.stage !== stage) return false;
    return true;
  }), [management.data, bimScopeIds, project, branch, stage]);

  // ---- Peer tab aggregates ----
  const peerClientRows = useMemo(() => peerRows.map((r) => {
    const pid = String(r.project?._id ?? r.project ?? '');
    const proj = projectById(pid);
    return {
      id: String(r._id ?? r.id),
      client: proj?.clientName ?? r.project?.clientName ?? '—',
      project: r.project?.name ?? proj?.name ?? '—',
      stage: r.stage ?? proj?.currentStage ?? '—',
      discipline: r.discipline ?? '—',
      reviewer: r.reviewer ?? '—',
      status: r.status ?? '—',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [peerRows, projects.data]);
  const peerProjectCount = new Set(peerClientRows.map((r) => r.project)).size;
  const peerReviewed = peerRows.filter((r) => r.finalApproved || r.finalVerified || String(r.status ?? '') === 'Approved for Issue').length;
  const peerApprovalsGiven = peerRows.reduce((s, r) => s + (Array.isArray(r.comments) ? r.comments.filter((c) => String(c.closureStatus ?? '') === 'Closed').length : 0), 0);
  const peerPendingCount = peerRows.filter((r) => ['pending', 'overdue'].includes(String(r.status ?? '').toLowerCase())).length;

  // ---- QA/QC tab aggregates ----
  const qaVisits = useMemo(() => arr(visits.data?.items ?? visits.data).filter((r) => {
    if (branch && branchOf(r.project, String(r.project?._id ?? r.project ?? '')) !== branch) return false;
    if (project) {
      const pid = String(r.project?._id ?? r.project ?? '');
      if (pid !== project) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visits.data, projects.data, branch, project]);
  const qaDiscs = useMemo(() => arr(discs.data?.items ?? discs.data), [discs.data]);
  const qaOpenDiscs = qaDiscs.filter((d) => String(d.status ?? '').toLowerCase() !== 'closed');
  const qaClosedDiscs = qaDiscs.filter((d) => String(d.status ?? '').toLowerCase() === 'closed');
  const qaPendingActions = qaOpenDiscs.length + arr(visits.data?.items ?? visits.data).filter((v) => String(v.status ?? '') !== 'Approved').length;

  const awaitingRows = useMemo(() => arr(openRfis.data)
    .filter((r) => ['open', 'responded'].includes(String(r.status ?? '').toLowerCase()))
    .map((r) => {
      const pid = String(r.project?._id ?? r.project ?? '');
      const since = r.createdAt;
      const days = since ? Math.max(0, Math.ceil((nowMs - new Date(since).getTime()) / 86400000)) : '—';
      return {
        id: String(r._id ?? r.id),
        project: r.project?.name ?? projectById(pid)?.name ?? '—',
        projectId: pid,
        branch: branchOf(r.project, pid),
        item: r.description ?? '—',
        source: rfiSourceOf(r),
        since,
        days,
        status: String(r.status ?? '').toLowerCase() === 'responded' ? 'Responded' : 'Pending',
      };
    })
    .filter((r) =>
      (!awaitSource || r.source === awaitSource) &&
      (!project || r.projectId === project) &&
      (!branch || r.branch === branch),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [openRfis.data, projects.data, awaitSource, project, branch]);

  // ---- HR tab aggregates ----
  // Frozen at mount so "today" stays stable across re-renders.
  const [istToday] = useState(() => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const hrAttendance = useMemo(() => arr(attendanceQ.data?.items ?? attendanceQ.data), [attendanceQ.data]);
  const hrPresentIds = useMemo(() => new Set(
    hrAttendance.filter((a) => String(a.date ?? '').slice(0, 10) === istToday && a.loginAt).map((a) => String(a.employee?._id ?? a.employee ?? '')),
  ), [hrAttendance, istToday]);
  const hrTravels = useMemo(() => arr(travelsQ.data?.items ?? travelsQ.data), [travelsQ.data]);
  const hrTravelIds = useMemo(() => new Set(
    hrTravels.filter((t) => {
      if (['Rejected', 'Cancelled'].includes(String(t.status ?? ''))) return false;
      const dep = String(t.departureDate ?? '').slice(0, 10);
      const ret = String(t.returnDate ?? t.departureDate ?? '').slice(0, 10);
      return dep && ret && dep <= istToday && istToday <= ret;
    }).map((t) => String(t.employee?._id ?? t.employee ?? '')),
  ), [hrTravels, istToday]);
  const hrEmployees = useMemo(() => arr(employeesQ.data?.items ?? employeesQ.data), [employeesQ.data]);
  const hrPresent = [...hrPresentIds].filter((id) => id && !hrTravelIds.has(id));
  const hrOnTravel = [...hrTravelIds].filter(Boolean);
  const hrAbsent = Math.max(0, hrEmployees.length - hrPresent.length - hrOnTravel.length);
  const hrHoursRows = useMemo(() => arr(workEntries.data?.items ?? workEntries.data).flatMap(workAllocations).filter((e) => {
    if (project && String(e.project?._id ?? e.project ?? '') !== project) return false;
    if (service && !serviceNames([e.service ?? e.employee?.department]).some(name => serviceNames([service]).includes(name))) return false;
    if (stage && (e.stage ?? 'Not recorded') !== stage) return false;
    if (branch) {
      const pid = String(e.project?._id ?? e.project ?? '');
      if (branchOf(e.project, pid) !== branch) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [workEntries.data, branch, service, stage, project, projects.data]);
  const hrHoursTotal = hoursText(hrHoursRows.reduce((s, e) => addHours(s,e.hours), 0));
  const hrHoursByDept = useMemo(() => {
    const m = new Map();
    for (const e of hrHoursRows) {
      const dept = e.employee?.department ?? '—';
      const g = m.get(dept) ?? { dept, empIds: new Set(), hours: 0 };
      g.empIds.add(String(e.employee?._id ?? e.employee ?? ''));
      g.hours = addHours(g.hours,e.hours);
      m.set(dept, g);
    }
    return [...m.values()].map((g) => ({ dept: g.dept, employees: g.empIds.size, hours: Number(g.hours) })).sort((a, b) => b.hours - a.hours);
  }, [hrHoursRows]);
  const hrLeaves = useMemo(() => arr(leave.data?.items ?? leave.data), [leave.data]);
  const hrLeaveApproved = hrLeaves.filter((r) => String(r.status ?? '').toLowerCase() === 'approved').length;
  const hrLeavePending = hrLeaves.filter((r) => String(r.status ?? '').toLowerCase() === 'pending').length;
  const hrLeaveRejected = hrLeaves.filter((r) => String(r.status ?? '').toLowerCase() === 'rejected').length;

  // ---- Travel tab aggregates ----
  function fmtTripDates(r) {
    const dep = r.departureDate ? new Date(r.departureDate) : null;
    const ret = r.returnDate ? new Date(r.returnDate) : null;
    const day = (d) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
    if (dep && !Number.isNaN(dep) && ret && !Number.isNaN(ret)) {
      if (dep.toDateString() === ret.toDateString()) return day(dep);
      if (dep.getMonth() === ret.getMonth() && dep.getFullYear() === ret.getFullYear()) {
        return `${String(dep.getDate()).padStart(2, '0')}-${String(ret.getDate()).padStart(2, '0')} ${dep.toLocaleString('en-GB', { month: 'short' })}`;
      }
      return `${day(dep)} → ${day(ret)}`;
    }
    return dep && !Number.isNaN(dep) ? day(dep) : '—';
  }

  function travelTripStatus(r) {
    const s = String(r.status ?? '');
    if (s === 'Rejected' || s === 'Cancelled') return s;
    if (String(r.settlementStatus ?? '') === 'Settled') return 'Settled';
    if (s === 'Approved') {
      const ret = r.returnDate ? new Date(r.returnDate) : null;
      if (ret && !Number.isNaN(ret) && ret < new Date(new Date().toISOString().slice(0, 10))) return 'Completed';
      return 'Approved';
    }
    if (s === 'Pending') return 'Awaiting approval';
    return s || '—';
  }

  const travelSummaryRows = useMemo(() => travelRows.filter((r) => {
    const pid = String(r.project?._id ?? r.project ?? '');
    if (project && pid !== project) return false;
    return true;
  }), [travelRows, project]);
  const travelPeople = new Set(travelSummaryRows.map((r) => String(r.employee?._id ?? r.employee ?? ''))).size;
  const travelAdvanceTaken = travelSummaryRows.reduce((s, r) => s + Number(r.advanceReceived ?? r.advanceRequested ?? 0), 0);
  const travelBillsClaimed = travelSummaryRows.reduce((s, r) => s + Number(r.actualExpense ?? 0), 0);
  const cabRows = useMemo(() => arr(allowsQ.data?.items ?? allowsQ.data).filter((r) => String(r.reqType ?? '') === 'Cab'), [allowsQ.data]);
  const travelLocalAllowance = useMemo(() => arr(allowsQ.data?.items ?? allowsQ.data)
    .filter((r) => String(r.reqType ?? '') === 'LA')
    .reduce((s, r) => s + Number(r.amount ?? 0), 0), [allowsQ.data]);

  const filterError = projects.error?.message ?? management.error?.message;

  return (
    <div id="view-management">
      <div className="page-head">
        <div className="page-title">Management & Leadership Dashboard</div>
        <div className="page-sub">
          Consolidated overview of project delivery, commercial performance, people and department-wise activity across the company.
        </div>
      </div>

      <Panel title="Filters" sub="Drill down company performance → branch → service → stage → project → date range. Applies across every section below.">
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Branch</label>
            <select aria-label="Management branch" className="filter-select" style={{ width: '100%' }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">All branches</option>
              {branchFilterOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Service</label>
            <select aria-label="Management service" className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">All services</option>
              {serviceFilterOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <select aria-label="Management stage" className="filter-select" style={{ width: '100%' }} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All stages</option>
              {stageFilterOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Project</label>
            <select aria-label="Management project" className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All projects</option>
              {projectRows.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">From</label>
            <input aria-label="Management from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">To</label>
            <input aria-label="Management to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="approve-btn" onClick={resetFilters}>Reset filters</button>
        </div>
      </Panel>

      {filterError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {filterError}
        </div>
      )}

      <div className="kpi-grid cols-4">
        <KpiCard label="Active projects" value={mp.active ?? 0} accent="forest" />
        <KpiCard label="Projects on hold" value={mp.onHold ?? 0} accent="amber" />
        <KpiCard label="Completed projects" value={mp.completed ?? 0} accent="blueprint" />
        <KpiCard label="Total (filtered)" value={mp.total ?? 0} accent="teal" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'projects' && (
        <>
          <Panel title="Branch-wise project overview">
            <DataTable
              columns={[
                { key: 'branch', label: 'Branch' },
                { key: 'projects', label: 'Projects' },
                { key: 'active', label: 'Active' },
                { key: 'completed', label: 'Completed' },
              ]}
              rows={Object.entries(mp.byBranchStats ?? {}).map(([branch, s]) => ({ branch, projects: s.projects ?? 0, active: s.active ?? 0, completed: s.completed ?? 0 }))}
              emptyText="No branch breakdown reported."
            />
          </Panel>
          <Panel title="Service-wise project overview">
            <DataTable
              columns={[{ key: 'name', label: 'Service' }, { key: 'count', label: 'Projects' }]}
              rows={Object.entries(mp.byService ?? {}).map(([name, count]) => ({ name, count }))}
              emptyText="No service breakdown reported."
            />
          </Panel>
          <Panel title="Stage-wise project overview">
            <DataTable
              columns={[{ key: 'name', label: 'Stage' }, { key: 'count', label: 'Projects' }]}
              rows={Object.entries(mp.byStage ?? {}).map(([name, count]) => ({ name, count }))}
              emptyText="No stage breakdown reported."
            />
          </Panel>
          <Panel title="Number of revisions" sub="Raised internally, or by the client / architect">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <select className="filter-select" value={revSource} onChange={(e) => setRevSource(e.target.value)}>
                <option value="">All sources</option>
                <option>Internal</option>
                <option>Client</option>
                <option>Architect</option>
              </select>
            </div>
            <div className="kpi-grid cols-4" style={{ marginBottom: 12 }}>
              <KpiCard label="Revisions (filtered)" value={revFiltered.length} accent="teal" />
            </div>
            {revisions.isLoading ? <EmptyState text="Loading revisions…" /> : revisions.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{revisions.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  { key: 'item', label: 'Item' },
                  { key: 'source', label: 'Raised by' },
                  { key: 'raised', label: 'Raised', render: (r) => fmtDate(r.raised) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={revFiltered}
                emptyText="No revisions found."
              />
            )}
          </Panel>
          <Panel title="Project submissions" sub="Drawings / documents issued to client, architect or PMC — respects the date range above">
            {management.isLoading ? <EmptyState text="Loading submissions…" /> : management.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{management.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'project', label: 'Project' },
                  { key: 'branch', label: 'Branch' },
                  { key: 'service', label: 'Service' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'to', label: 'To' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={submissionRows}
                emptyText="No submissions found."
              />
            )}
          </Panel>
          <Panel title="Pending / delayed submissions" sub="Stage deliverables still in progress past their planned date">
            {billingStages.isLoading ? <EmptyState text="Loading stages…" /> : billingStages.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{billingStages.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                  { key: 'branch', label: 'Branch', render: (r) => branchOf(r.project, String(r.project?._id ?? r.project ?? '')) },
                  { key: 'service', label: 'Service' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'plannedCompletion', label: 'Planned date', render: (r) => r.plannedCompletion ? String(r.plannedCompletion).slice(0, 10) : '—' },
                  { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
                ]}
                rows={delayedRows}
                emptyText="No pending submissions."
              />
            )}
          </Panel>
          <Panel title="Awaiting responses" sub="Items waiting on someone else before work can continue">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <select className="filter-select" value={awaitSource} onChange={(e) => setAwaitSource(e.target.value)}>
                <option value="">All sources</option>
                <option>Internal</option>
                <option>Client</option>
                <option>Architect</option>
              </select>
            </div>
            {openRfis.isLoading ? <EmptyState text="Loading responses…" /> : openRfis.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{openRfis.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  { key: 'item', label: 'Item' },
                  { key: 'source', label: 'Source' },
                  { key: 'since', label: 'Since', render: (r) => fmtDate(r.since) },
                  { key: 'days', label: 'Days' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={awaitingRows}
                emptyText="Nothing awaiting response."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'admin' && (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="Ready for billing" value={readyStages.length} accent="forest" />
            <KpiCard label="Billing pending" value={revenue.isError ? '—' : money(totalContract - totalInvoiced)} accent="amber" />
            <KpiCard label="Invoice raised" value={revenue.isError ? '—' : money(totalInvoiced)} accent="copper" />
          </div>
          {revenue.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              Revenue figures: {revenue.error.message}
            </div>
          )}
          <Panel title="Projects ready for billing" sub="Stage complete, not yet billed — use the Branch / Service / Stage filters above">
            {billingStages.isLoading ? <EmptyState text="Loading…" /> : billingStages.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{billingStages.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                  { key: 'branch', label: 'Branch', render: (r) => branchOf(r.project, String(r.project?._id ?? r.project ?? '')) },
                  { key: 'service', label: 'Service' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'completedOn', label: 'Completed on', render: (r) => fmtDate(r.updatedAt) },
                ]}
                rows={readyStages}
                emptyText="No stages ready for billing."
              />
            )}
          </Panel>
          <Panel title="Completion certificates">
            <div className="kpi-grid cols-2" style={{ marginBottom: 12 }}>
              <KpiCard label="Received" value={certReceived.length} accent="forest" />
              <KpiCard label="Requested" value={certRequested.length} accent="amber" />
            </div>
            {certsQ.isLoading || certReqsQ.isLoading ? <EmptyState text="Loading…" /> : (certsQ.isError || certReqsQ.isError) ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{(certsQ.error ?? certReqsQ.error)?.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                  { key: 'type', label: 'Type', render: (r) => r.certType ?? r.category ?? '—' },
                  { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.issuedDate ?? r.createdAt) },
                  { key: 'issuedBy', label: 'Issued by', render: (r) => r.issuedBy ?? '—' },
                ]}
                rows={certRows}
                emptyText="No completion certificates yet."
              />
            )}
          </Panel>
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
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Total projects" value={revRows.length} accent="blueprint" />
            <KpiCard label="Total contract value" value={money(totalContract)} accent="teal" />
            <KpiCard label="Revenue till date" value={money(totalReceived)} accent="forest" />
            <KpiCard label="Outstanding" value={money(totalContract - totalReceived)} accent="amber" />
          </div>
          <Panel title="Branch-wise financial overview">
            <DataTable
              columns={[
                { key: 'branch', label: 'Branch' },
                { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
                { key: 'received', label: 'Received', render: (r) => money(r.received) },
              ]}
              rows={finBranchRows}
              emptyText="No branch figures yet."
            />
          </Panel>
          <Panel title="Service-wise financial overview">
            <DataTable
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
                { key: 'received', label: 'Received', render: (r) => money(r.received) },
              ]}
              rows={finServiceRows}
              emptyText="No service figures yet."
            />
          </Panel>
          <Panel title="Stage-wise financial overview">
            <DataTable
              columns={[
                { key: 'stage', label: 'Stage' },
                { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
                { key: 'received', label: 'Received', render: (r) => money(r.received) },
              ]}
              rows={finStageRows}
              emptyText="No stage figures yet."
            />
          </Panel>
          <Panel title="Invoice status">
            <DataTable
              columns={[
                { key: 'project', label: 'Project' },
                { key: 'service', label: 'Service' },
                { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
                { key: 'received', label: 'Received', render: (r) => money(r.received) },
                { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) },
              ]}
              rows={invoiceRows}
              emptyText="No invoice data yet."
            />
          </Panel>
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
                  { key: 'received', label: 'Received', render: (r) => money(r.received) },
                  { key: 'pct', label: '% collected', render: (r) => `${r.contract > 0 ? Math.round((r.received / r.contract) * 100) : 0}%` },
                ]}
                rows={arr(revenue.data?.items ?? revenue.data)}
                emptyText="No revenue data yet."
              />
            )}
          </Panel>
          <Panel title="Project cost & financial performance" sub="Labour cost estimated from logged hours × configured / average rate">
            {projectCosts.isLoading ? <EmptyState text="Loading costs…" /> : projectCosts.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{projectCosts.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'name', label: 'Project' },
                  { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
                  { key: 'labour', label: 'Est. labour cost', render: (r) => money(r.labourCost) },
                  { key: 'margin', label: 'Margin', render: (r) => money(r.margin) },
                ]}
                rows={costPerfRows}
                emptyText="No cost data yet."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'hr' && (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="Employees present today" value={hrPresent.length} accent="forest" />
            <KpiCard label="Employees absent" value={hrAbsent} accent="amber" />
            <KpiCard label="On travel" value={hrOnTravel.length} accent="teal" />
          </div>
          <Panel title="Login hours" sub={`Saved work hours - ${from || 'all dates'} to ${to || 'latest saved date'} (IST) - Branch / Service / Stage filters apply`}><WorkReportStatus query={workEntries} />
            <div className="kpi-grid cols-2" style={{ marginBottom: 12 }}>
              <KpiCard label="Total hours (filtered)" value={workEntries.isError || workEntries.isLoading ? '—' : hrHoursTotal} accent="blueprint" />
            </div>
            <DataTable
              columns={[
                { key: 'dept', label: 'Department / service' },
                { key: 'employees', label: 'Employees' },
                { key: 'hours', label: 'Total hours' },
              ]}
              rows={hrHoursByDept}
              emptyText="No hours logged in range."
            />
          </Panel>
          <Panel title="Leave status">
            <div className="kpi-grid cols-3" style={{ marginBottom: 12 }}>
              <KpiCard label="Approved" value={hrLeaveApproved} accent="forest" />
              <KpiCard label="Pending" value={hrLeavePending} accent="amber" />
              <KpiCard label="Rejected" value={hrLeaveRejected} accent="rust" />
            </div>
            {leave.isLoading ? <EmptyState text="Loading…" /> : leave.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{leave.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                  { key: 'leaveType', label: 'Type' },
                  { key: 'from', label: 'From', render: (r) => fmtDate(r.from) },
                  { key: 'to', label: 'To', render: (r) => fmtDate(r.to) },
                  { key: 'days', label: 'Days', render: (r) => r.days ?? '—' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={hrLeaves}
                emptyText="No leave requests found."
              />
            )}
          </Panel>
          <Panel title="Leave denied" sub="Employee-wise, with reason for denial">
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                { key: 'leaveType', label: 'Type' },
                { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.from)} – ${fmtDate(r.to)}` },
                { key: 'remarks', label: 'Reason for denial', render: (r) => r.remarks ?? '—' },
              ]}
              rows={hrLeaves.filter((r) => String(r.status ?? '').toLowerCase() === 'rejected')}
              emptyText="No denied leaves."
            />
          </Panel>
        </>
      )}

      {tab === 'travel' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="People travelling" value={travelPeople} accent="blueprint" />
            <KpiCard label="Advance taken" value={money(travelAdvanceTaken)} accent="teal" />
            <KpiCard label="Bills claimed" value={money(travelBillsClaimed)} accent="copper" />
            <KpiCard label="Local allowance" value={money(travelLocalAllowance)} accent="violet" />
          </div>
          {(travel.isError && travel.error.status !== 403) && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{travel.error.message} <button onClick={() => travel.refetch()}>Retry travel requests</button></div>
          )}
          <TravelBookingLog readOnly embedded />
          <Panel title="Employee travel requests" sub="Saved requests are separate from booking records above.">
            {travel.isLoading ? <EmptyState text="Loading…" /> : travel.error && travel.error.status === 403 ? (
              <EmptyState text="Travel log is not shared with your role." />
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                  { key: 'route', label: 'Route', render: (r) => (r.toCity ? `${r.fromCity ?? ''} → ${r.toCity}` : (r.fromCity ?? '—')) },
                  { key: 'dates', label: 'Dates', render: (r) => fmtTripDates(r) },
                  { key: 'mode', label: 'Mode', render: (r) => r.mode ?? '—' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={travelTripStatus(r)}>{travelTripStatus(r)}</StatusPill> },
                  { key: 'settlement', label: 'Settlement', render: (r) => r.settlementStatus ?? 'Pending' },
                ]}
                rows={travelSummaryRows}
                emptyText="No travel entries yet."
              />
            )}
          </Panel>
          <Panel title="Local allowance and other requests" sub="Saved allowance records; separate from travel bookings and employee travel requests.">
            {allowsQ.isLoading ? <EmptyState text="Loading allowances…" /> : allowsQ.isError ? <div role="alert">{allowsQ.error.message} <button onClick={() => allowsQ.refetch()}>Retry allowances</button></div> : <DataTable rows={arr(allowsQ.data).filter(r => r.reqType !== 'Cab')} emptyText="No allowance requests yet." columns={[
              {key:'employee',label:'Employee',render:r => [r.employee?.firstName,r.employee?.lastName].filter(Boolean).join(' ') || 'Not recorded'},
              {key:'reqType',label:'Request type'}, {key:'project',label:'Project',render:r => r.project?.name || 'Not recorded'},
              {key:'description',label:'Details',render:r => r.description || r.purpose || 'Not recorded'}, {key:'amount',label:'Amount',render:r => money(r.amount)}, {key:'status',label:'Status'},
            ]} />}
          </Panel>
          <Panel title="Cab / transportation details">
            {allowsQ.isLoading ? <EmptyState text="Loading…" /> : allowsQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{allowsQ.error.message} <button onClick={() => allowsQ.refetch()}>Retry allowances</button></div>
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() || '—' : '—' },
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                  { key: 'vehicle', label: 'Vehicle', render: (r) => r.vehicle ?? '—' },
                  { key: 'route', label: 'Pickup → Drop', render: (r) => [r.pickup || r.route, r.drop].filter(Boolean).join(' → ') || '—' },
                  { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={cabRows}
                emptyText="No cab bookings yet."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'ptl' && (
        <>
          <div className="kpi-grid cols-2" style={{ marginBottom: 12 }}>
            <KpiCard label="Roster projects" value={ptlHoursFiltered.length} accent="blueprint" />
            <KpiCard label="Hours logged" value={addHours(...ptlHoursFiltered.map(r => r.hours))} accent="teal" />
          </div>
          <Panel title="Hours spent on each project" sub="Saved project roster, including projects without work logs. Use the filters above.">
            <WorkReportStatus query={workEntries} />
            {projects.isError && <div role="alert">{projects.error.message} <button onClick={() => projects.refetch()}>Retry project roster</button></div>}
            {workEntries.isLoading ? (
              <EmptyState text="Loading work entries…" />
            ) : workEntries.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{workEntries.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'name', label: 'Project' },
                  { key: 'branch', label: 'Branch' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'hours', label: 'Hours' },
                ]}
                rows={ptlHoursFiltered}
                emptyText="No work entries yet."
              />
            )}
          </Panel>
          <Panel title="Transmittal log">
            {management.isLoading ? <EmptyState text="Loading…" /> : management.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{management.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  { key: 'service', label: 'Service' },
                  { key: 'drawingNo', label: 'No.' },
                  { key: 'rev', label: 'Rev' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'to', label: 'To' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={ptlTransmittals}
                emptyText="No transmittals yet."
              />
            )}
          </Panel>
          <Panel title="Project-wise work / progress overview">
            <DataTable
              columns={[
                { key: 'name', label: 'Project' },
                { key: 'branch', label: 'Branch' },
                { key: 'stage', label: 'Stage' },
                { key: 'progress', label: 'Est. progress' },
              ]}
              rows={ptlProgress}
              emptyText="No work entries yet."
            />
          </Panel>
        </>
      )}

      {tab === 'bim' && (
        <>
          <div className="kpi-grid cols-2" style={{ marginBottom: 12 }}>
            <KpiCard label="Assigned projects" value={bimScopeIds.length} accent="blueprint" />
            <KpiCard label="Hours logged" value={bimHoursTotal} accent="teal" />
          </div>
          <Panel title="Hours spent on each project" sub="Saved project roster, including projects without work logs. Use the filters above.">
            <WorkReportStatus query={workEntries} />
            {projects.isError && <div role="alert">{projects.error.message} <button onClick={() => projects.refetch()}>Retry project roster</button></div>}
            {workEntries.isLoading ? <EmptyState text="Loading…" /> : workEntries.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{workEntries.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'name', label: 'Project' },
                  { key: 'branch', label: 'Branch' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'hours', label: 'Hours' },
                ]}
                rows={bimHoursFiltered}
                emptyText="No BIM hours logged yet."
              />
            )}
          </Panel>
          <Panel title="Transmittal log" sub="For this discipline's assigned projects">
            {management.isLoading ? <EmptyState text="Loading…" /> : management.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{management.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project' },
                  { key: 'service', label: 'Service' },
                  { key: 'drawingNo', label: 'No.' },
                  { key: 'rev', label: 'Rev' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'to', label: 'To' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={bimTransmittals}
                emptyText="No transmittals yet."
              />
            )}
          </Panel>
          <Panel title="Project progress / status">
            <DataTable
              columns={[
                { key: 'woNo', label: 'Work order', render: (r) => r.woNo ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                { key: 'scope', label: 'Scope', render: (r) => r.scope ?? '—' },
                { key: 'fee', label: 'Value', render: (r) => (r.fee ?? null) != null ? `₹${Number(r.fee).toLocaleString('en-IN')}` : '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
              ]}
              rows={arr(bimOrders.data)}
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
            <KpiCard label="Total projects" value={peerProjectCount} accent="blueprint" />
            <KpiCard label="Reviewed" value={peerReviewed} accent="forest" />
            <KpiCard label="Approvals given" value={peerApprovalsGiven} accent="teal" />
            <KpiCard label="Pending reviews" value={peerPendingCount} accent="amber" />
          </div>
          <Panel title="Client-wise project overview">
            {peers.isLoading ? <EmptyState text="Loading…" /> : peers.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{peers.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'client', label: 'Client' },
                  { key: 'project', label: 'Project' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'discipline', label: 'Discipline' },
                  { key: 'reviewer', label: 'Reviewer' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={peerClientRows}
                emptyText="No peer reviews yet."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'qaqc' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Site visits" value={arr(visits.data).length} accent="blueprint" />
            <KpiCard label="Open discrepancies" value={qaOpenDiscs.length} accent="rust" />
            <KpiCard label="Closed discrepancies" value={qaClosedDiscs.length} accent="forest" />
            <KpiCard label="Pending QA/QC actions" value={qaPendingActions} accent="amber" />
          </div>
          <Panel title="Site visits" sub="Use the Branch filter above">
            {visits.isLoading ? <EmptyState text="Loading…" /> : visits.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{visits.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'visitId', label: 'ID', render: (r) => r.visitId ?? String(r._id ?? r.id ?? '').slice(-6) },
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                  { key: 'branch', label: 'Branch', render: (r) => branchOf(r.project, String(r.project?._id ?? r.project ?? '')) },
                  { key: 'phase', label: 'Phase', render: (r) => r.phase ?? '—' },
                  { key: 'visitType', label: 'Type', render: (r) => r.visitType ?? '—' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.visitDate ?? r.createdAt) },
                ]}
                rows={qaVisits}
                emptyText="No site visits yet."
              />
            )}
          </Panel>
          <Panel title="Discrepancies found">
            <div className="kpi-grid cols-2" style={{ marginBottom: 12 }}>
              <KpiCard label="Construction-wise" value={qaOpenDiscs.filter((d) => String(d.kind ?? 'Construction') === 'Construction').length} accent="amber" />
              <KpiCard label="Drawing-wise" value={qaOpenDiscs.filter((d) => String(d.kind ?? '') === 'Drawing').length} accent="rust" />
            </div>
            {discs.isLoading ? <EmptyState text="Loading…" /> : discs.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{discs.error.message}</div>
            ) : (
              <DataTable
                columns={[
                  { key: 'discId', label: 'ID', render: (r) => r.discId ?? String(r._id ?? r.id ?? '').slice(-6) },
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectById(String(r.project?._id ?? r.project ?? ''))?.name ?? '—' },
                  { key: 'discipline', label: 'Discipline', render: (r) => r.discipline ?? '—' },
                  { key: 'severity', label: 'Severity', render: (r) => r.severity ?? '—' },
                  { key: 'issue', label: 'Issue', render: (r) => r.issue ?? r.description ?? '—' },
                  { key: 'raised', label: 'Raised', render: (r) => fmtDate(r.raised ?? r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={qaDiscs}
                emptyText="No discrepancies yet."
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
