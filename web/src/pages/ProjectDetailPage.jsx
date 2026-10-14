import MyTeamPage from './MyTeamPage.jsx';
import StageApprovalPanel from '../components/StageApprovalPanel.jsx';
import { DirectoryTab } from './MyCoordinationPage.jsx';
import SpocMeetings from '../components/meetings/SpocMeetings.jsx';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi, employeesApi, usersApi } from '../lib/api.js';
import { spocApi } from '../lib/spocApi.js';
import { discApi, drawingAckApi, gbsApi, peerApi, serviceDashboardApi, stageReviewApi, variationApi, visitsApi, weeklyReportApi, workItemApi } from '../lib/functionsApi.js';
import { billingApi } from '../lib/phase3Api.js';
import { deliverablesApi, drawingsApi, revisionsApi } from '../lib/workApi.js';
import { summarizeRevisions } from '../lib/revisionSummary.js';
import { meetingsApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import KpiCard from '../components/KpiCard.jsx';
import ProjectServiceWorkspace, { SERVICE_TABS, empName, fmtDate, idOf } from '../components/ProjectServiceWorkspace.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import LocationModal from '../components/LocationModal.jsx';

const COORD_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'directory', label: 'Project directory' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'deliverables', label: 'Deliverables & drawings' },
  { key: 'revisions', label: 'Revision logs' },
  { key: 'pending', label: 'Pending & follow-up' },
  { key: 'coordination', label: 'Coordination' },
];

const TOP_TABS = [
  { key: 'coordinator', label: 'Coordinator' },
  ...SERVICE_TABS.map((s) => ({ key: s.key, label: s.label })),
];

const STAGE_ORDER = ['Preliminary concept', 'Concept', 'Schematic', 'Design development', 'Tender', 'GFC'];

const DAY = 86400000;

const listOf = (d) => (Array.isArray(d) ? d : (d?.items ?? []));
const asObj = (v) => (v && typeof v === 'object' ? v : {});

function OwnerDatesModal({ project, mode, onClose }) {
  const queryClient = useQueryClient();
  const [owner, setOwner] = useState(project.owner ?? '');
  const [startDate, setStartDate] = useState((project.startDate ?? '').slice(0, 10));
  const [expectedCompletion, setExpectedCompletion] = useState(
    (project.expectedCompletion ?? '').slice(0, 10),
  );
  const [actualCompletion, setActualCompletion] = useState(
    (project.actualCompletion ?? '').slice(0, 10),
  );

  const save = useMutation({
    mutationFn: (body) => projectsApi.update(project._id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project._id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'owner') save.mutate({ owner });
    else {
      save.mutate({
        startDate: startDate || null,
        expectedCompletion: expectedCompletion || null,
        actualCompletion: actualCompletion || null,
      });
    }
  }

  return (
    <Modal title={mode === 'owner' ? 'Change owner' : 'Edit dates'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {mode === 'owner' ? (
          <div className="form-row">
            <label className="form-label" htmlFor="pd-owner">Owner</label>
            <input
              id="pd-owner"
              className="form-input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-start">Start date</label>
              <input id="pd-start" className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-exp">Expected completion</label>
              <input id="pd-exp" className="form-input" type="date" value={expectedCompletion} onChange={(e) => setExpectedCompletion(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-act">Actual completion</label>
              <input id="pd-act" className="form-input" type="date" value={actualCompletion} onChange={(e) => setActualCompletion(e.target.value)} />
            </div>
          </>
        )}
        {save.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {save.error.message}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}

// Contacts arrive as objects ({name, company, email, ...}) from the API
// or as plain strings from the New Project form — render either safely.
function contactText(c) {
  if (!c) return '—';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    return [c.name, c.company, c.email, c.phone].filter(Boolean).join(' · ') || '—';
  }
  return String(c);
}

function PortalAccessPanel({ projectId, initialIds, isAdmin }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState((initialIds ?? []).map(String));
  const [saved, setSaved] = useState(false);

  const usersQ = useQuery({
    queryKey: ['users-portal', projectId],
    queryFn: () => usersApi.list({}),
    enabled: isAdmin,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (userIds) => projectsApi.setPortalUsers(projectId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSaved(true);
    },
  });

  if (!isAdmin) return null;
  const users = usersQ.data?.items ?? usersQ.data ?? [];
  const external = users.filter((u) => u.role === 'client' || u.role === 'architect');

  function toggle(uid) {
    setSaved(false);
    setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-label">Portal access — Client / Architect portal</div>
      {usersQ.isLoading ? (
        <EmptyState text="Loading users…" />
      ) : usersQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {usersQ.error.message}
        </div>
      ) : external.length === 0 ? (
        <EmptyState text="No client / architect logins yet — create them in HR → External access, then assign projects here." />
      ) : (
        <>
          {external.map((u) => {
            const uid = String(u._id ?? u.id);
            return (
              <label key={uid} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                <input type="checkbox" checked={selected.includes(uid)} onChange={() => toggle(uid)} />
                {u.name ?? u.email} ({u.role})
              </label>
            );
          })}
          {save.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {save.error.message}
            </div>
          )}
          <button type="button" className="approve-btn" disabled={save.isPending} onClick={() => save.mutate(selected)} style={{ marginTop: 8 }}>
            {save.isPending ? 'Saving…' : 'Save portal access'}
          </button>
          {saved && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Portal access saved.</p>}
        </>
      )}
    </div>
  );
}

const PTL_SERVICES = [
  'Structural', 'Electrical', 'Mechanical', 'Plumbing', 'Fire',
  'QS', 'QA/QC', 'BIM', 'GBS', 'Peer review',
];

function ptlEntries(project) {
  return (project?.principalTeamLeads ?? []).flatMap((t) => {
    const names = (t.names ?? []).filter(Boolean);
    const list = names.length > 0 ? names : [t.name ?? ''];
    return list.filter(Boolean).map((name) => ({
      service: t.service ?? '',
      employee: t.employee ? String(t.employee._id ?? t.employee) : undefined,
      name,
      role: t.role ?? '',
      nominatedBy: t.nominatedBy ?? '',
      approvalStatus: t.approvalStatus ?? '',
    }));
  });
}

function toPtlPayload(entries) {
  return entries
    .map((r) => ({
      service: (r.service ?? '').trim(),
      name: (r.name ?? '').trim(),
      ...(r.employee ? {employee:r.employee} : {}),
      ...(r.role?.trim() ? { role: r.role.trim() } : {}),
      ...(r.nominatedBy?.trim() ? { nominatedBy: r.nominatedBy.trim() } : {}),
      ...(r.approvalStatus ? { approvalStatus: r.approvalStatus } : {}),
    }))
    .filter((r) => r.service || r.name);
}

function empLabel(e) {
  const n = [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || e?.email || '—';
  return e?.designation ? `${n} · ${e.designation}` : n;
}

function empValue(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || e?.email || '';
}

// Technical Director: enter the principal team lead (PTL) for each service
// on this project. Saved via PUT /api/projects/:id/team-leads.
function TechnicalPtlPanel({ projectId, project, employees }) {
  const queryClient = useQueryClient();
  const [service, setService] = useState('');
  const [member, setMember] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [importing, setImporting] = useState(false);

  const rows = ptlEntries(project);
  const seen = new Set();
  const serviceOptions = [];
  for (const s of [...(project?.services ?? []), ...rows.map((r) => r.service), ...PTL_SERVICES]) {
    const t = String(s ?? '').trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    serviceOptions.push(t);
  }
  const empList = employees.data?.items ?? employees.data ?? [];

  const save = useMutation({
    mutationFn: ({ entries }) => projectsApi.saveTeamLeads(projectId, { principalTeamLeads: toPtlPayload(entries) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setService('');
      setMember('');
      setErr('');
      for(const key of ['project-team','my-teams','teams']) queryClient.invalidateQueries({queryKey:[key]});
      setOk(variables.successMessage ?? 'Principal team lead saved.');
    },
    onError: (e) => {
      setErr(e.message);
      setOk('');
    },
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!service) {
      setErr('Service is required.');
      return;
    }
    if (!member) {
      setErr('Team member is required.');
      return;
    }
    const next = [...rows];
    const selected = empList.find(e=>String(e._id ?? e.id)===member);
    const name = empValue(selected);
    const idx = next.findIndex((r) => r.service === service && r.name === name);
    const row = { service, name, employee:member, approvalStatus: 'Approved' };
    if (idx >= 0) next[idx] = { ...next[idx], ...row };
    else next.push(row);
    save.mutate({ entries: next });
  }

  function removeRow(target) {
    setErr('');
    setOk('');
    save.mutate({ entries: rows.filter((r) => !(r.service === target.service && r.name === target.name)) });
  }

  async function importTeamFile(file) {
    if (!file) return;
    setErr('');
    setOk('');
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('The spreadsheet does not contain a worksheet.');
      const importedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      if (importedRows.length === 0) throw new Error('The worksheet is empty.');

      const headerKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const headers = Object.keys(importedRows[0]);
      const serviceKey = headers.find((h) => headerKey(h) === 'service');
      const memberKey = headers.find((h) => ['teammember', 'teamlead', 'principalteamlead', 'name', 'employee'].includes(headerKey(h)));
      if (!serviceKey || !memberKey) {
        throw new Error('Add header columns named "Service" and "Team member" to the first row.');
      }

      const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      const parseErrors = [];
      const importedLeads = [];
      for (const [index, row] of importedRows.entries()) {
        const serviceName = String(row[serviceKey] ?? '').trim();
        const memberName = String(row[memberKey] ?? '').trim();
        const matchedService = serviceOptions.find((item) => normalize(item) === normalize(serviceName));
        const matchedEmployees = empList.filter((employee) => {
          const name = empValue(employee);
          return [name, employee.empId, employee.email].some((value) => normalize(value) === normalize(memberName));
        });
        if (!matchedService || !memberName || matchedEmployees.length !== 1) {
          const reason = !matchedService
            ? `unknown service "${serviceName}"`
            : !memberName
              ? 'team member is blank'
              : matchedEmployees.length === 0
                ? `employee "${memberName}" was not found`
                : `employee "${memberName}" is ambiguous`;
          parseErrors.push(`Row ${index + 2}: ${reason}.`);
          continue;
        }
        const employee = matchedEmployees[0];
        importedLeads.push({
          service: matchedService,
          name: empValue(employee),
          employee: String(employee._id ?? employee.id),
          approvalStatus: 'Approved',
        });
      }
      if (parseErrors.length) throw new Error(parseErrors.join(' '));
      if (importedLeads.length === 0) throw new Error('No team leads were found to import.');

      const next = [...rows];
      for (const lead of importedLeads) {
        const existingIndex = next.findIndex((item) => item.service === lead.service && item.name === lead.name);
        if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...lead };
        else next.push(lead);
      }
      save.mutate({ entries: next, successMessage: `Imported ${importedLeads.length} principal team lead${importedLeads.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setErr(error.message || 'Unable to import team from this file.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Panel title="Principal team leads — per service" sub="Enter the PTL for each service on this project.">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label className="approve-btn" style={{ cursor: importing || save.isPending ? 'not-allowed' : 'pointer' }}>
          {importing ? 'Reading team…' : 'Import team from Excel'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={importing || save.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void importTeamFile(file);
            }}
            style={{ display: 'none' }}
          />
        </label>
        <span className="page-sub">Use columns: Service and Team member.</span>
      </div>
      <div className="section-label" style={{ marginTop: 12 }}>Enter / replace PTL</div>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Service</label>
            <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Select service</option>
              {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Team member</label>
            <select className="filter-select" style={{ width: '100%' }} value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Select member</option>
              {empList.map((x) => {
                const v = String(x._id ?? x.id);
                return <option key={x._id ?? x.id} value={v}>{empLabel(x)}</option>;
              })}
            </select>
          </div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{ok}</p>}
        <button type="submit" className="btn-primary" disabled={save.isPending} style={{ marginTop: 8 }}>
          {save.isPending ? 'Saving…' : 'Save PTL'}
        </button>
      </form>
      <DataTable
        columns={[
          { key: 'service', label: 'Service' },
          { key: 'name', label: 'Team member' },
          { key: 'approvalStatus', label: 'Status', render: (r) => (r.approvalStatus ? <StatusPill status={r.approvalStatus}>{r.approvalStatus}</StatusPill> : '—') },
          {
            key: 'actions',
            label: 'Action',
            render: (r) => (
              <button type="button" className="approve-btn" disabled={save.isPending} onClick={() => removeRow(r)}>
                Remove
              </button>
            ),
          },
        ]}
        rows={rows}
        emptyText="No principal team leads assigned yet."
      />

    </Panel>
  );
}

// Technical Director: propose the SPOC (coordinator) for this project.
// Lands as Proposed for the Design Management Head / Admin to approve.
function TechnicalSpocPanel({ projectId, project, employees }) {
  const queryClient = useQueryClient();
  const [coordId, setCoordId] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const allocsQ = useQuery({
    queryKey: ['spoc-allocations', projectId],
    queryFn: () => spocApi.allocationsList({ project: projectId }),
    enabled: !!projectId,
    retry: false,
  });
  const allocs = allocsQ.data?.items ?? [];
  const empList = employees.data?.items ?? employees.data ?? [];
  const sorted = [...empList].sort((a, b) => {
    const ac = /coordinator|spoc/i.test(a?.designation ?? '') ? 0 : 1;
    const bc = /coordinator|spoc/i.test(b?.designation ?? '') ? 0 : 1;
    return ac - bc;
  });

  const propose = useMutation({
    mutationFn: (body) => spocApi.proposeAllocation(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-allocations', projectId] });
      setCoordId('');
      setErr('');
      setOk('SPOC proposed — Design Management Head / Admin will approve.');
    },
    onError: (e) => {
      setErr(e.message);
      setOk('');
    },
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!coordId) {
      setErr('Select a coordinator.');
      return;
    }
    propose.mutate({ project: projectId, coordinator: coordId, services: project?.services ?? [] });
  }

  const coordName = (c) => {
    if (!c) return '—';
    if (typeof c === 'string') return c;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.empId || '—';
  };

  return (
    <Panel title="SPOC for this project" sub="Propose the coordinator (SPOC) — approved by the Design Management Head / Admin.">
      <div className="section-label" style={{ marginTop: 12 }}>Propose SPOC</div>
      <form onSubmit={submit}>
        <div className="form-row" style={{ maxWidth: 360 }}>
          <label className="form-label">Coordinator</label>
          <select className="filter-select" style={{ width: '100%' }} value={coordId} onChange={(e) => setCoordId(e.target.value)}>
            <option value="">Select…</option>
            {sorted.map((x) => (
              <option key={x._id ?? x.id} value={x._id ?? x.id}>
                {empLabel(x)}
              </option>
            ))}
          </select>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{ok}</p>}
        <button type="submit" className="btn-primary" disabled={propose.isPending} style={{ marginTop: 8 }}>
          {propose.isPending ? 'Saving…' : 'Propose SPOC'}
        </button>
      </form>
      {allocsQ.isLoading ? (
        <EmptyState text="Loading…" />
      ) : (
        <DataTable
          columns={[
            { key: 'coordinator', label: 'Coordinator', render: (r) => coordName(r.coordinator) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            { key: 'services', label: 'Services', render: (r) => (r.services ?? []).join(', ') || '—' },
          ]}
          rows={allocs}
          emptyText="No SPOC proposed yet."
        />
      )}

    </Panel>
  );
}

export default function ProjectDetailPage({ bootstrap }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  const [spocId, setSpocId] = useState('');
  const [top, setTop] = useState(bootstrap?.role?.key === 'team_lead' ? 'team-workspace' : 'coordinator');
  const [coord, setCoord] = useState('overview');

  const q = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });
  const role = bootstrap?.role?.key ?? '';
  const isAdmin = role === 'admin_billing';
  const isTD = role === 'technical_director';

  const employees = useQuery({
    queryKey: ['employees-spoc', id],
    queryFn: () => employeesApi.list({}),
    enabled: !!id,
    retry: false,
  });
  const stagesQ = useQuery({ queryKey: ['project-stages', id], queryFn: () => billingApi.stages({ project: id }), enabled: !!id, retry: false });
  const drawingsQ = useQuery({ queryKey: ['project-drawings', id], queryFn: () => drawingsApi.list({ project: id }), enabled: !!id, retry: false });
  const revisionsQ = useQuery({ queryKey: ['project-revisions', id], queryFn: () => revisionsApi.list({ project: id }), enabled: !!id, retry: false });
  const deliverablesQ = useQuery({ queryKey: ['project-deliverables', id], queryFn: () => deliverablesApi.list({ project: id }), enabled: !!id, retry: false });
  const meetingsQ = useQuery({ queryKey: ['project-meetings', id], queryFn: () => meetingsApi.list({ project: id }), enabled: !!id, retry: false });
  const workItemsQ = useQuery({ queryKey: ['project-work-items', id], queryFn: () => workItemApi.list({ project: id }), enabled: !!id, retry: false });
  const visitsQ = useQuery({ queryKey: ['project-visits', id], queryFn: () => visitsApi.list({ project: id }), enabled: !!id, retry: false });
  const weeklyQ = useQuery({ queryKey: ['project-weekly', id], queryFn: () => weeklyReportApi.list({ project: id }), enabled: !!id, retry: false });
  const gbsQ = useQuery({ queryKey: ['project-gbs', id], queryFn: () => gbsApi.get(id), enabled: !!id, retry: false });
  const teamQ = useQuery({ queryKey: ['project-team', id], queryFn: () => projectsApi.team(id), enabled: !!id, retry: false });
  const peersQ = useQuery({ queryKey: ['project-peers', id], queryFn: () => peerApi.list({ project: id }), enabled: !!id, retry: false });
  const discsQ = useQuery({ queryKey: ['project-discs', id], queryFn: () => discApi.list({ project: id }), enabled: !!id, retry: false });
  const variationsQ = useQuery({ queryKey: ['project-variations', id], queryFn: () => variationApi.list({ project: id }), enabled: !!id, retry: false });
  const dashboardsQ = useQuery({ queryKey: ['project-service-dashboards', id], queryFn: () => serviceDashboardApi.list({ project: id }), enabled: !!id, retry: false });
  const stageReviewsQ = useQuery({ queryKey: ['project-stage-reviews', id], queryFn: () => stageReviewApi.list({ project: id }), enabled: !!id, retry: false });
  const drawingAcksQ = useQuery({ queryKey: ['project-drawing-acks', id], queryFn: () => drawingAckApi.list({ project: id }), enabled: !!id, retry: false });

  const activate = useMutation({
    mutationFn: (body) => projectsApi.activate(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      setSpocId('');
    },
  });

  const saveLocation = useMutation({
    mutationFn: (loc) => projectsApi.update(id, loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setLocOpen(false);
    },
  });

  if (q.isLoading) return <EmptyState text="Loading project…" />;
  if (q.isError) {
    return (
      <>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>
          ← Back to dashboard
        </button>
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {q.error.message}
        </div>
      </>
    );
  }

  const project = q.data?.project ?? {};
  const pid = String(id);
  const ofProject = (items) => (items ?? []).filter((r) => idOf(r.project) === pid);
  const stages = ofProject(stagesQ.data?.items);
  const drawings = ofProject(drawingsQ.data?.items);
  const revisions = ofProject(revisionsQ.data?.items);
  const deliverables = ofProject(deliverablesQ.data?.items);
  const meetings = ofProject(meetingsQ.data?.items);
  const workItemRows = ofProject(listOf(workItemsQ.data));
  const visitRows = ofProject(visitsQ.data?.items);
  const weeklyRows = ofProject(weeklyQ.data?.items);
  const peerRows = ofProject(listOf(peersQ.data));
  const discRows = ofProject(listOf(discsQ.data));
  const variationRows = ofProject(listOf(variationsQ.data));
  const serviceDashboards = ofProject(listOf(dashboardsQ.data));
  const stageReviewRows = ofProject(listOf(stageReviewsQ.data));
  const drawingAckIds = new Set(listOf(drawingAcksQ.data).map((a) => String(a.drawing)));
  const scope = project.scope ?? [];
  const totalFee = scope.reduce((s, r) => s + (Number(r.fee) || 0), 0);
  const contacts = asObj(project.contacts);
  const client = asObj(contacts.client);
  const architect = asObj(contacts.architect);
  const pmc = asObj(contacts.pmc);
  const billing = asObj(contacts.billing);
  const loc = asObj(project.location);

  const openRevisions = revisions.filter((r) => String(r.status ?? '') !== 'Cleared');
  const openActions = meetings.flatMap((m) =>
    (m.actions ?? [])
      .filter((a) => String(a.status ?? '') !== 'Completed')
      .map((a) => ({ ...a, meetingTitle: m.title, meetingDate: m.date })),
  );
  // Technical Director's Meetings sub-tab reads every action (open + done).
  const allActions = meetings.flatMap((m) =>
    (m.actions ?? []).map((a) => ({ ...a, meetingTitle: m.title, meetingDate: m.date })),
  );
  const upcomingMeetingsList = [...meetings]
    .filter((m) => String(m.status ?? '') !== 'Held' && String(m.status ?? '') !== 'Cancelled')
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  const heldMeetingsList = [...meetings]
    .filter((m) => String(m.status ?? '') === 'Held')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const meetingAttendees = (m) => (m.invites ?? [])
    .map((v) => {
      const e = v.employee ?? v;
      return typeof e === 'object' ? ([e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '') : String(e ?? '');
    })
    .filter(Boolean)
    .join(', ') || '—';
  const meetingSummary = (m) => {
    const mom = m.mom && typeof m.mom === 'object' ? m.mom : {};
    return mom.discussion?.trim() || mom.decisions?.trim() || (typeof m.momDoc === 'string' ? m.momDoc : '') || '—';
  };
  const actionOwner = (a) => {
    const o = a.owner;
    if (o && typeof o === 'object') return empName(o) ?? '—';
    return o ?? a.service ?? '—';
  };
  const last7 = Date.now() - 7 * DAY;
  const revisionsLast7 = revisions.filter((r) => Date.parse(r.dateRaised ?? r.createdAt) >= last7).length;
  const meetingsLast7 = meetings.filter((m) => Date.parse(m.date) >= last7).length;
  const overdueActions = openActions.filter((a) => a.due && Date.parse(a.due) < Date.now()).length;
  const upcomingMeetings = meetings.filter((m) => Date.parse(m.date) >= Date.now() && m.status !== 'Cancelled').length;
  const heldMeetings = meetings.filter((m) => m.status === 'Held').length;
  const extraStages = [...new Set(revisions.map((r) => r.stage).filter(Boolean))].filter((s) => !STAGE_ORDER.includes(s));
  const revisionGroups = [...STAGE_ORDER, ...extraStages].map((stage) => ({
    stage,
    rows: revisions.filter((r) => (r.stage ?? '') === stage),
  }));
  const revisionSummary = summarizeRevisions(revisions, drawings, stages, project);
  const daysOpen = (v) => {
    const t = Date.parse(v);
    return Number.isNaN(t) ? '—' : Math.max(0, Math.floor((Date.now() - t) / DAY));
  };

  const addressLine = [loc.address1, loc.address2, loc.city, loc.state, loc.zip].filter(Boolean).join(', ');
  const mapsQuery = addressLine || loc.label || '';
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;
  const locationText = [loc.label, loc.city, loc.state].filter(Boolean).join(', ');

  // Technical Director's Coordination sub-tab: one Coordination log panel
  // (Date / Channel / Topic / Deadline / Status) built from live revisions.
  const coordinationRows = [...revisions]
    .sort((a, b) => String(b.dateRaised ?? b.createdAt ?? '').localeCompare(String(a.dateRaised ?? a.createdAt ?? '')))
    .map((r) => {
      const cleared = String(r.status ?? '') === 'Cleared';
      const due = r.resubmissionDue ? new Date(r.resubmissionDue) : null;
      const overdue = !cleared && due && !Number.isNaN(due.getTime())
        && due < new Date(new Date().toISOString().slice(0, 10));
      return {
        ...r,
        coordStatus: cleared ? 'Resolved' : overdue ? 'Overdue - alert sent' : (r.status ?? 'Open'),
      };
    });

  const revisionLogPanel = (
    <Panel title="Revision logs" sub="By stage · client and architect revisions are the ones eligible for additional billing">
      {revisionGroups.map((g) => (
        <div key={g.stage} style={{ marginBottom: 16 }}>
          <div className="section-label">{g.stage}</div>
          {g.rows.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No revisions logged - stage not yet started.</p>
          ) : (
            <DataTable
              columns={[
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.dateRaised ?? r.createdAt) },
                { key: 'desc', label: 'Description', render: (r) => r.details ?? '—' },
                { key: 'reason', label: 'Reason', render: (r) => r.raisedBy ?? '—' },
              ]}
              rows={g.rows}
              emptyText="No revisions logged."
            />
          )}
        </div>
      ))}
    </Panel>
  );

  // Coordinator → Overview shows exactly 5 components for every internal role.
  const overviewProgress = (s) => {
    const status = String(s?.currentStatus ?? '');
    const lower = status.toLowerCase();
    if (lower === 'completed') return `100% · completed ${fmtDate(s.updatedAt ?? s.plannedCompletion)}`;
    if (s?.reason) return s.reason;
    if (lower === 'in progress' || lower === 'inprogress' || lower === 'ongoing') {
      return `In progress since ${fmtDate(s.createdAt)}`;
    }
    if (lower === 'on hold' || lower === 'onhold' || lower === 'paused') {
      return `Paused since ${fmtDate(s.updatedAt ?? s.createdAt)}`;
    }
    if (lower === 'revision' || lower === 'revision requested') {
      return `Revision requested ${fmtDate(s.updatedAt ?? s.createdAt)}`;
    }
    return status || '—';
  };

  const overviewDelay = (s) => {
    const lower = String(s?.currentStatus ?? '').toLowerCase();
    if (lower === 'on hold' || lower === 'onhold' || lower === 'paused') return 'On hold — awaiting input';
    if (lower === 'revision' || lower === 'revision requested') return 'Awaiting resubmission';
    const n = Number(s?.delayDays ?? 0);
    return n > 0 ? `Tracking ${n} days behind` : 'On time';
  };

  // Reconciled 5-stage schedule: durations derived live from StageStatus
  // (createdAt → plannedCompletion = planned days, createdAt → updatedAt = actual days).
  const RECONCILED_SCHEDULE = ['Concept', 'Schematic', 'Tender', 'GFC - sub structure', 'GFC - super structure'];
  const reconciledMatches = (slot, raw) => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (slot === 'Concept') return ['concept', 'cd', 'preliminary concept'].includes(v);
    if (slot === 'Schematic') return ['schematic', 'sd'].includes(v);
    if (slot === 'Tender') return ['tender', 'td', 'design development', 'dd'].includes(v);
    if (slot === 'GFC - sub structure') return v.includes('gfc') && (v.includes('sub') || v === 'gfc');
    if (slot === 'GFC - super structure') return v.includes('gfc') && (v.includes('super') || v === 'gfc');
    return false;
  };
  const daysBetween = (a, b) => {
    const t1 = Date.parse(a);
    const t2 = Date.parse(b);
    if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
    return Math.round((t2 - t1) / DAY);
  };
  const median = (nums) => {
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const stageTimingRows = RECONCILED_SCHEDULE.map((slot) => {
    const rows = stages.filter((s) => reconciledMatches(slot, s.stage));
    if (rows.length === 0) return { stage: slot, planned: '—', actual: 'Not started', variance: '—' };
    const plannedDurations = rows
      .map((s) => daysBetween(s.createdAt, s.plannedCompletion))
      .filter((n) => n != null && n >= 0);
    const completedDurations = rows
      .filter((s) => String(s.currentStatus ?? '').toLowerCase() === 'completed')
      .map((s) => daysBetween(s.createdAt, s.updatedAt ?? s.plannedCompletion))
      .filter((n) => n != null && n >= 0);
    const plannedMedian = median(plannedDurations);
    const actualMedian = median(completedDurations);
    const planned = plannedMedian != null ? `${plannedMedian} days` : '—';
    let actual = 'Not started';
    let variance = '—';
    if (actualMedian != null && plannedMedian != null) {
      actual = `${actualMedian} days`;
      const diff = actualMedian - plannedMedian;
      variance = diff === 0 ? 'On time' : `${diff > 0 ? '+' : ''}${diff} days`;
    } else if (actualMedian != null) {
      actual = `${actualMedian} days`;
    } else if (rows.some((s) => ['in progress', 'inprogress', 'ongoing', 'revision', 'on hold'].includes(String(s.currentStatus ?? '').toLowerCase()))) {
      actual = 'Ongoing';
    }
    return { stage: slot, planned, actual, variance };
  });

  // Coordination log — schematic and tender only.
  const schematicTenderLog = [...meetings]
    .filter((m) => ['schematic', 'tender', 'sd', 'td'].includes(String(m.stage ?? '').trim().toLowerCase()))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  const clashRows = [...discRows].sort((a, b) =>
    String(b.raised ?? b.createdAt ?? '').localeCompare(String(a.raised ?? a.createdAt ?? '')),
  );

  const activeService = SERVICE_TABS.find((s) => s.key === top) ?? null;

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← Back to dashboard
      </button>
      <div className="page-head">
        <div className="page-title">{project.name ?? '—'}</div>
        <div className="page-sub">
          {[project.code, project.branch, project.clientName].filter(Boolean).join(' · ')}
        </div>
      </div>

      <Panel title="Project summary">
        <div className="field-grid">
          <Field label="Project" value={project.name} />
          <Field label="Code" value={project.code} mono />
          <Field label="Client" value={project.clientName || contactText(contacts.client)} />
          <Field label="Status" value={<StatusPill tone={statusTone(project.status)}>{project.status ?? '—'}</StatusPill>} />

          <Field label="Current stage" value={project.currentStage} />
          <Field label="Contract completion" value={fmtDate(project.expectedCompletion)} />
        </div>
      </Panel>

      <div className="kpi-grid cols-4">
        <KpiCard label="Completion" value={project.completion != null ? `${project.completion}%` : '—'} accent="forest" />
        <KpiCard label="Open flags" value={openRevisions.length} accent="rust" />
        <KpiCard label="Revisions logged" value={revisions.length} accent="violet" />
        <KpiCard label="Drawings submitted" value={drawings.length} accent="blueprint" />
      </div>

      <Panel title="Project details">
        <div className="field-grid">
          <Field label="Source person" value={project.sourcePerson} />
          <Field label="Referral" value={project.referral} />
          <Field label="Project type" value={project.projectType} />
          <Field label="Category" value={project.category} />
          <Field label="Project owner" value={project.owner} />
          <Field label="Start date" value={fmtDate(project.startDate)} />
          <Field label="Expected completion" value={fmtDate(project.expectedCompletion)} />
          <Field label="Actual completion" value={project.actualCompletion ? fmtDate(project.actualCompletion) : 'Pending'} />
          <Field label="Address" value={addressLine} />
          <Field
            label="Project location"
            value={
              <span>
                {locationText ? `📍 ${locationText}` : '—'}
                {mapsUrl && (
                  <>
                    {' · '}
                    <a href={mapsUrl} target="_blank" rel="noreferrer">View on Google Maps ↗</a>
                  </>
                )}
              </span>
            }
          />
        </div>
        {project.description && (
          <div style={{ marginTop: 8 }}>
            <Field label="Description" value={project.description} />
          </div>
        )}
        {isAdmin && <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="approve-btn" onClick={() => setModal('owner')}>Change owner</button>
          <button type="button" className="approve-btn" onClick={() => setModal('dates')}>Edit dates</button>
          <button type="button" className="approve-btn" onClick={() => setLocOpen(true)}>Change Location</button>
        </div>}
      </Panel>

      <Panel title="Work order">
        <div className="field-grid">
          <Field label="Work order no." value={project.jobNumber} mono />
          <Field label="Work order date" value={fmtDate(project.workOrderDate)} />
          <Field label="Start date" value={fmtDate(project.startDate)} />
          <Field label="Contract completion" value={fmtDate(project.expectedCompletion)} />
          <Field label="Scope of work" value={(project.services ?? []).join(', ') || scope.map((s) => s.scope).filter(Boolean).join('; ')} />
          <Field label="Work order value" value={totalFee ? `₹${totalFee.toLocaleString('en-IN')}` : null} />
          <Field label="Work order document" value={project.workOrderDocument} />
        </div>
      </Panel>

      <Panel title="Client and contacts">
        <div className="field-grid">
          <Field label="Client name" value={client.company || client.name || project.clientName} />
          <Field label="Client SPOC" value={project.clientSpoc} />
          <Field label="Client email" value={client.email} />
          <Field label="Client phone" value={client.phone} />
          <Field label="Billing contact" value={billing.name} />
          <Field label="Architect" value={architect.company || architect.name} />
          <Field label="Architect email" value={architect.email} />
          <Field label="Architect contact" value={architect.phone} />
          <Field label="PMC" value={pmc.company || pmc.name} />
          <Field label="PMC email" value={pmc.email} />
          <Field label="PMC contact" value={pmc.phone} />
        </div>
      </Panel>

      <Panel title="Scope and services">
        <DataTable
          columns={[
            { key: 'service', label: 'Service', render: (s) => s.service ?? '—' },
            { key: 'stage', label: 'Stage', render: (s) => s.stage ?? '—' },
            { key: 'start', label: 'Start date', render: () => '—' },
            { key: 'status', label: 'Status', render: (s) => (s.currentStatus ? <StatusPill status={s.currentStatus}>{s.currentStatus}</StatusPill> : '—') },
            { key: 'completed', label: 'Completed', render: () => '—' },
          ]}
          rows={stages}
          emptyText="No services or stages recorded for this project yet."
        />
      </Panel>

      <BimSection project={project} />

      {isAdmin ? (
        <Panel title="Revision Logs">
          {revisionsQ.isLoading || drawingsQ.isLoading || stagesQ.isLoading ? (
            <EmptyState text="Loading revision summary…" />
          ) : revisionsQ.isError || drawingsQ.isError || stagesQ.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {revisionsQ.error?.message ?? drawingsQ.error?.message ?? stagesQ.error?.message}
            </div>
          ) : (
            <>
              <div className="kpi-grid cols-3">
                <KpiCard label="Total revisions" value={revisionSummary.total} accent="violet" />
                <KpiCard label="Within a stage" value={revisionSummary.within} accent="blueprint" />
                <KpiCard label="After stage completed" value={revisionSummary.after} accent="rust" />
              </div>
              <section style={{ marginTop: 20 }}>
                <div className="section-label">Stage-wise revisions</div>
                <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
                  Revisions made while a stage was in progress, and revisions made after the stage was completed
                </p>
                <DataTable
                  columns={[
                    { key: 'stage', label: 'Stage' },
                    { key: 'within', label: 'Within the stage' },
                    { key: 'after', label: 'After stage completed' },
                    { key: 'total', label: 'Total' },
                  ]}
                  rows={revisionSummary.stageRows}
                />
              </section>
              <section style={{ marginTop: 20 }}>
                <div className="section-label">Service-wise revisions</div>
                <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
                  Revisions by service associated with this project
                </p>
                <DataTable
                  columns={[
                    { key: 'service', label: 'Service' },
                    { key: 'stages', label: 'Stages affected', render: (row) => row.stages || '—' },
                    { key: 'within', label: 'Within the stage' },
                    { key: 'after', label: 'After stage completed' },
                    { key: 'total', label: 'Total' },
                  ]}
                  rows={revisionSummary.serviceRows}
                  emptyText="No revisions logged."
                />
              </section>
            </>
          )}
        </Panel>
      ) : (
        <>
      <Panel title="Open this project for a team">
        {(isAdmin || isTD) && project.activation?.status !== 'Activated' ? (
          <>
            <div className="form-row" style={{ maxWidth: 360 }}>
              <label className="form-label" htmlFor="pd-spoc">SPOC (coordinator)</label>
              <select id="pd-spoc" className="filter-select" value={spocId} onChange={(e) => setSpocId(e.target.value)}>
                <option value="">Select…</option>
                {((employees.data?.items ?? employees.data ?? [])).map((e) => (
                  <option key={e._id ?? e.id} value={e._id ?? e.id}>
                    {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email} ({e.empId ?? '—'})
                  </option>
                ))}
              </select>
            </div>
            {activate.isError && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{activate.error.message}</div>
            )}
            <button type="button" className="btn-primary" disabled={activate.isPending} onClick={() => activate.mutate(spocId ? { coordinator: spocId } : {})}>
              {activate.isPending ? 'Activating…' : 'Activate project'}
            </button>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              Activation assigns the SPOC and opens the SPOC workspace.
            </p>
          </>
        ) : project.activation?.status === 'Activated' ? (
          <p style={{ fontSize: 13.5 }}>
            Activated{project.activation?.activatedAt ? ` on ${fmtDate(project.activation.activatedAt)}` : ''}.
          </p>
        ) : (
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>Team opening is managed by Admin.</p>
        )}
        <PortalAccessPanel projectId={id} initialIds={project.portalUsers ?? []} isAdmin={isAdmin} />
      </Panel>

      {isTD && (
        <TechnicalPtlPanel projectId={id} project={project} employees={employees} />
      )}
      {isTD && (
        <TechnicalSpocPanel projectId={id} project={project} employees={employees} />
      )}

      <StageApprovalPanel projectId={id} role={role} />
      <Tabs tabs={role === 'team_lead' ? [{ key: 'team-workspace', label: 'Team workspace' }, ...TOP_TABS] : TOP_TABS} active={top} onChange={setTop} />
      {top === 'team-workspace' && <MyTeamPage key={id} bootstrap={bootstrap} projectId={id} projectWorkspace />}

      {top === 'coordinator' && (
        <>
          <Tabs tabs={COORD_TABS} active={coord} onChange={setCoord} />

          {(!isTD && coord !== 'overview') && (
          <Panel title="Assigned SPOC">
            <p>{(teamQ.data?.allocations ?? []).filter(a => a.status === 'Approved').map(a => empName(a.coordinator)).join(', ') || empName(project.activation?.spoc) || 'Not allocated'}</p>
          </Panel>
          )}
          {coord === 'directory' && <>
            <DirectoryTab myAllocs={teamQ.data?.allocations ?? []} activeProjects={[project]} activeLoading={teamQ.isLoading} canEdit={role === 'coordinator'} />
            <Panel title="Project team"><DataTable columns={[
              { key: 'service', label: 'Service' }, { key: 'team', label: 'Team' },
              { key: 'name', label: 'Member', render: r => empName(r.employee) },
              { key: 'designation', label: 'Designation', render: r => r.employee?.designation ?? '—' },
              { key: 'experience', label: 'Experience', render: r => r.employee?.experience ?? '—' },
            ]} rows={teamQ.data?.members ?? []} emptyText="No team members allocated." /></Panel>
          </>}
          {coord === 'overview' && (
            <>
              <Panel title="Stage & Service-wise Status" sub="Live project status, progress & completion, and delay / submission status — by service and stage, covering every service tracked on the Board & Leadership dashboard">
                <DataTable
                  columns={[
                    { key: 'service', label: 'Service', render: (s) => s.service ?? '—' },
                    { key: 'stage', label: 'Stage', render: (s) => s.stage ?? '—' },
                    { key: 'live', label: 'Live status', render: (s) => s.currentStatus ?? '—' },
                    { key: 'progress', label: 'Progress / completion', render: (s) => overviewProgress(s) },
                    { key: 'delay', label: 'Delay / submission status', render: (s) => overviewDelay(s) },
                  ]}
                  rows={stages}
                  emptyText="No stage status recorded for this project yet."
                />
              </Panel>

              <Panel title="Stage timing" sub="Planned vs. actual, per the reconciled 5-stage schedule">
                <DataTable
                  columns={[
                    { key: 'stage', label: 'Stage' },
                    { key: 'planned', label: 'Planned' },
                    { key: 'actual', label: 'Actual' },
                    { key: 'variance', label: 'Variance' },
                  ]}
                  rows={stageTimingRows}
                  emptyText="No stage timing recorded for this project yet."
                />
              </Panel>

              {revisionLogPanel}

              <Panel title="Coordination log - schematic and tender">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
                    { key: 'stage', label: 'Stage', render: (m) => m.stage ?? '—' },
                    { key: 'services', label: 'Disciplines', render: (m) => (m.services ?? []).join(' · ') || '—' },
                    { key: 'issue', label: 'Issue', render: (m) => m.title ?? '—' },
                    { key: 'action', label: 'Action', render: (m) => m.actions?.[0]?.text ? `Action: ${m.actions[0].text}` : '—' },
                  ]}
                  rows={schematicTenderLog}
                  emptyText="No schematic / tender coordination logged for this project yet."
                />
              </Panel>

              <Panel title="Clash log" sub="All stages">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (d) => fmtDate(d.raised ?? d.createdAt) },
                    { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                    { key: 'disciplines', label: 'Disciplines', render: (d) => [d.discipline, d.withDiscipline].filter(Boolean).join(' / ') || '—' },
                    { key: 'issue', label: 'Issue', render: (d) => d.issue ?? '—' },
                    { key: 'status', label: 'Status', render: (d) => <StatusPill status={d.status}>{d.status ?? '—'}</StatusPill> },
                  ]}
                  rows={clashRows}
                  emptyText="No clashes or discrepancies logged for this project."
                />
              </Panel>
            </>
          )}

          {coord === 'coordination' && (
            isTD ? (
            <Panel title="Coordination log">
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.dateRaised ?? r.createdAt) },
                  { key: 'channel', label: 'Channel', render: (r) => r.raisedBy ?? '—' },
                  { key: 'topic', label: 'Topic', render: (r) => r.details ?? r.drawing ?? '—' },
                  { key: 'deadline', label: 'Deadline', render: (r) => fmtDate(r.resubmissionDue) },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => (
                      <StatusPill tone={r.coordStatus === 'Resolved' ? 'forest' : String(r.coordStatus).startsWith('Overdue') ? 'rust' : statusTone(r.coordStatus)}>
                        {r.coordStatus}
                      </StatusPill>
                    ),
                  },
                ]}
                rows={coordinationRows}
                emptyText="No coordination items logged for this project yet."
              />
            </Panel>
            ) : (
            <Panel title="Open coordination items" sub="Revisions raised by client, architect, PMC or internal teams that are not yet cleared">
              <DataTable
                columns={[
                  { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                  { key: 'item', label: 'Item', render: (r) => r.details ?? r.drawing ?? '—' },
                  { key: 'raisedBy', label: 'Raised by', render: (r) => r.raisedBy ?? '—' },
                  { key: 'raised', label: 'Raised', render: (r) => fmtDate(r.dateRaised ?? r.createdAt) },
                  { key: 'days', label: 'Days open', render: (r) => daysOpen(r.dateRaised ?? r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => r.status ?? '—' },
                ]}
                rows={openRevisions}
                emptyText="No open coordination items for this project."
              />
            </Panel>
            )
          )}

          {coord === 'pending' && (
            isTD ? (
            <Panel title="Pending and follow-up" sub="By source">
              <DataTable
                columns={[
                  { key: 'item', label: 'Item', render: (r) => r.item },
                  { key: 'source', label: 'Source', render: (r) => r.source },
                  { key: 'since', label: 'Since', render: (r) => fmtDate(r.since) },
                  { key: 'days', label: 'Days waiting', render: (r) => daysOpen(r.since) },
                ]}
                rows={[
                  ...openRevisions.map((r) => ({ item: r.details ?? '—', source: r.raisedBy ?? 'Internal', since: r.dateRaised ?? r.createdAt })),
                  ...openActions.map((a) => ({ item: a.text ?? '—', source: a.service ?? 'Meeting action', since: a.meetingDate })),
                ]}
                emptyText="Nothing pending or awaiting follow-up for this project."
              />
            </Panel>
            ) : (
            <Panel title="Pending and follow-up" sub="Open revisions and meeting action items">
              <DataTable
                columns={[
                  { key: 'type', label: 'Type', render: (r) => r.type },
                  { key: 'item', label: 'Item', render: (r) => r.item },
                  { key: 'source', label: 'Source', render: (r) => r.source },
                  { key: 'since', label: 'Since', render: (r) => fmtDate(r.since) },
                  { key: 'days', label: 'Days waiting', render: (r) => daysOpen(r.since) },
                ]}
                rows={[
                  ...openRevisions.map((r) => ({ type: 'Revision', item: r.details ?? '—', source: r.raisedBy ?? 'Internal', since: r.dateRaised ?? r.createdAt })),
                  ...openActions.map((a) => ({ type: 'Action', item: a.text ?? '—', source: a.service ?? 'Meeting action', since: a.meetingDate })),
                ]}
                emptyText="Nothing pending or awaiting follow-up for this project."
              />
            </Panel>
            )
          )}

          {coord === 'meetings' && (
            isTD ? (
            <>
              <Panel title="Meeting schedule">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
                    { key: 'time', label: 'Time', render: (m) => [m.startTime, m.endTime].filter(Boolean).join('–') || '—' },
                    { key: 'topic', label: 'Topic', render: (m) => m.title ?? '—' },
                    { key: 'attendees', label: 'Attendees', render: (m) => meetingAttendees(m) },
                    { key: 'join', label: 'Join', render: (m) => (m.link ? <a href={m.link} target="_blank" rel="noreferrer">Join</a> : '—') },
                  ]}
                  rows={upcomingMeetingsList}
                  emptyText="No upcoming meetings."
                />
              </Panel>
              <Panel title="Meeting log / MoM" sub="Outcome recorded once a scheduled meeting concludes">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
                    { key: 'topic', label: 'Topic', render: (m) => m.title ?? '—' },
                    { key: 'summary', label: 'Summary', render: (m) => meetingSummary(m) },
                  ]}
                  rows={heldMeetingsList}
                  emptyText="No meeting outcomes recorded yet."
                />
              </Panel>
              <Panel title="Action items">
                <DataTable
                  columns={[
                    { key: 'action', label: 'Action', render: (a) => a.text ?? '—' },
                    { key: 'owner', label: 'Owner', render: (a) => actionOwner(a) },
                    { key: 'due', label: 'Due', render: (a) => fmtDate(a.due) },
                    { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
                  ]}
                  rows={allActions}
                  emptyText="No action items for this project."
                />
              </Panel>
            </>
            ) : (
            <SpocMeetings projectId={id} readOnly={role !== 'coordinator'} />
            )
          )}

          {coord === 'deliverables' && (
            isTD ? (
            <Panel title="Drawing register" sub="Drawing numbers apply from GFC stage onward - earlier stages are tracked by title">
              <DataTable
                columns={[
                  { key: 'service', label: 'Service', render: (d) => d.service ?? '—' },
                  { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                  { key: 'drawingNo', label: 'Drawing no.', render: (d) => d.drawingNo ?? '—' },
                  { key: 'title', label: 'Title', render: (d) => d.title ?? '—' },
                  { key: 'date', label: 'Date', render: (d) => fmtDate(d.date ?? d.createdAt) },
                  { key: 'issuedTo', label: 'To', render: (d) => d.issuedTo ?? '—' },
                  { key: 'method', label: 'Method', render: (d) => d.method ?? '—' },
                  { key: 'type', label: 'Type', render: (d) => d.submission ?? d.submissionType ?? '—' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (d) => {
                      const s = drawingAckIds.has(String(d._id ?? d.id ?? '')) ? 'Acknowledged' : (d.status ?? '—');
                      return <StatusPill tone={statusTone(s)}>{s}</StatusPill>;
                    },
                  },
                ]}
                rows={drawings}
                emptyText="No drawings submitted for this project yet."
              />
            </Panel>
            ) : (
            <>
              <Panel title="Deliverables">
                <DataTable
                  columns={[
                    { key: 'deliverable', label: 'Deliverable', render: (d) => d.deliverable ?? d.specify ?? '—' },
                    { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                    { key: 'assigned', label: 'Assigned to', render: (d) => (d.assignedTo && typeof d.assignedTo === 'object' ? empName(d.assignedTo) : '—') },
                    { key: 'planned', label: 'Planned', render: (d) => fmtDate(d.plannedDate) },
                    { key: 'due', label: 'Due', render: (d) => fmtDate(d.dueDate) },
                    { key: 'status', label: 'Status', render: (d) => d.status ?? '—' },
                  ]}
                  rows={deliverables}
                  emptyText="No deliverables recorded for this project yet."
                />
              </Panel>
              <Panel title="Drawing submission register">
                <DataTable
                  columns={[
                    { key: 'service', label: 'Service', render: (d) => d.service ?? '—' },
                    { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                    { key: 'drawingNo', label: 'Drawing no.', render: (d) => d.drawingNo ?? '—' },
                    { key: 'title', label: 'Title', render: (d) => d.title ?? '—' },
                    { key: 'rev', label: 'Rev', render: (d) => d.rev ?? '—' },
                    { key: 'date', label: 'Date', render: (d) => fmtDate(d.date ?? d.createdAt) },
                    { key: 'issuedTo', label: 'To', render: (d) => d.issuedTo ?? '—' },
                    { key: 'method', label: 'Method', render: (d) => d.method ?? '—' },
                  ]}
                  rows={drawings}
                  emptyText="No drawings submitted for this project yet."
                />
              </Panel>
            </>
            )
          )}

          {coord === 'revisions' && revisionLogPanel}

          {coord === 'reports' && (
            <>
              <Panel title="Project status report">
                <p style={{ fontSize: 13.5 }}>
                  {project.name} · {project.currentStage ?? '—'} stage · {project.completion ?? 0}% complete · {project.status ?? '—'} · {openRevisions.length} open flag(s)
                </p>
              </Panel>
              <Panel title="Weekly coordination report">
                <p style={{ fontSize: 13.5 }}>
                  {revisionsLast7} revision(s) and {meetingsLast7} meeting(s) logged in the last 7 days · {overdueActions} overdue action item(s)
                </p>
              </Panel>
              <Panel title="Meeting report">
                <p style={{ fontSize: 13.5 }}>
                  {meetings.length} meeting(s) logged · {heldMeetings} held · {upcomingMeetings} upcoming
                </p>
              </Panel>
              <Panel title="Pending action report">
                <p style={{ fontSize: 13.5 }}>
                  {openRevisions.length} open revision(s) · {openActions.length} open action item(s)
                </p>
              </Panel>
            </>
          )}
        </>
      )}

      {activeService && (
        <ProjectServiceWorkspace
          key={activeService.key}
          service={activeService}
          project={project}
          stages={stages}
          drawings={drawings}
          workItems={workItemRows}
          visitRows={visitRows}
          weeklyRows={weeklyRows}
          gbsItem={gbsQ.data?.item}
          teamBundle={teamQ.data}
          peerRows={peerRows}
          variations={variationRows}
          role={role}
          serviceDashboards={serviceDashboards}
          stageReviews={stageReviewRows}
          employees={listOf(employees.data)}
          discrepancies={discRows}
          drawingAcks={drawingAckIds}
          meetings={meetings}
        />
      )}
        </>
      )}

      {modal && (
        <OwnerDatesModal project={project} mode={modal} onClose={() => setModal(null)} />
      )}

      {locOpen && (
        <LocationModal
          onSave={(l) => saveLocation.mutate({
            location: {
              label: l.label ?? '',
              address1: l.address1 ?? '',
              address2: l.address2 ?? '',
              city: l.city ?? '',
              state: l.state ?? '',
              zip: l.zip ?? '',
            },
          })}
          onClose={() => setLocOpen(false)}
        />
      )}
    </>
  );
}

function BimSection({ project }) {
  const bwo = project.bimWorkOrder;
  return (
    <Panel title="BIM Work Order" sub="Issued by Admin, kept separate from the work order above">
      {!bwo ? (
        <EmptyState text="No BIM work order for this project." />
      ) : (
        <DataTable
          columns={[
            { key: 'no', label: 'BIM WO No.', render: (r) => r.no || '—' },
            { key: 'scope', label: 'Scope of work', render: (r) => r.scope || '—' },
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'fee', label: 'Fee / value', render: (r) => (r.fee != null ? `₹${Number(r.fee).toLocaleString('en-IN')}` : '—') },
            { key: 'status', label: 'Status', render: (r) => r.status || '—' },
          ]}
          rows={[bwo]}
          emptyText="No BIM work order for this project."
        />
      )}
    </Panel>
  );
}
