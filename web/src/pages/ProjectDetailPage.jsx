import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi, employeesApi, usersApi } from '../lib/api.js';
import { areaApi, boqApi, discApi, gbsApi, peerApi, rfiApi, variationApi, visitsApi, weeklyReportApi } from '../lib/functionsApi.js';
import { billingApi } from '../lib/phase3Api.js';
import { deliverablesApi, drawingsApi, revisionsApi } from '../lib/workApi.js';
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
  { key: 'coordination', label: 'Coordination' },
  { key: 'pending', label: 'Pending & follow-up' },
  { key: 'rfis', label: "RFI's" },
  { key: 'meetings', label: 'Meetings' },
  { key: 'deliverables', label: 'Deliverables & drawings' },
  { key: 'revisions', label: 'Revision logs' },
  { key: 'reports', label: 'Reports' },
];

const TOP_TABS = [
  { key: 'coordinator', label: 'Coordinator' },
  ...SERVICE_TABS.map((s) => ({ key: s.key, label: s.label })),
];

const PROJECT_STAGE_CODES = ['CD', 'SD', 'DD', 'TD', 'GFC'];
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

export default function ProjectDetailPage({ bootstrap }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  const [spocId, setSpocId] = useState('');
  const [top, setTop] = useState('coordinator');
  const [coord, setCoord] = useState('overview');

  const q = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });
  const role = bootstrap?.role?.key ?? '';
  const isSuper = role === 'founding_director' || role === 'working_director';
  const isAdmin = role === 'admin_billing' || isSuper;

  const employees = useQuery({
    queryKey: ['employees-spoc', id],
    queryFn: () => employeesApi.list({}),
    enabled: isAdmin,
    retry: false,
  });
  const stagesQ = useQuery({ queryKey: ['project-stages', id], queryFn: () => billingApi.stages({ project: id }), enabled: !!id, retry: false });
  const drawingsQ = useQuery({ queryKey: ['project-drawings', id], queryFn: () => drawingsApi.list({ project: id }), enabled: !!id, retry: false });
  const revisionsQ = useQuery({ queryKey: ['project-revisions', id], queryFn: () => revisionsApi.list({ project: id }), enabled: !!id, retry: false });
  const deliverablesQ = useQuery({ queryKey: ['project-deliverables', id], queryFn: () => deliverablesApi.list({ project: id }), enabled: !!id, retry: false });
  const meetingsQ = useQuery({ queryKey: ['project-meetings', id], queryFn: () => meetingsApi.list({ project: id }), enabled: !!id, retry: false });
  const areaQ = useQuery({ queryKey: ['project-area', id], queryFn: () => areaApi.list({ project: id }), enabled: !!id, retry: false });
  const boqQ = useQuery({ queryKey: ['project-boq', id], queryFn: () => boqApi.list({ project: id }), enabled: !!id, retry: false });
  const visitsQ = useQuery({ queryKey: ['project-visits', id], queryFn: () => visitsApi.list({ project: id }), enabled: !!id, retry: false });
  const weeklyQ = useQuery({ queryKey: ['project-weekly', id], queryFn: () => weeklyReportApi.list({ project: id }), enabled: !!id, retry: false });
  const gbsQ = useQuery({ queryKey: ['project-gbs', id], queryFn: () => gbsApi.get(id), enabled: !!id, retry: false });
  const teamQ = useQuery({ queryKey: ['project-team', id], queryFn: () => projectsApi.team(id), enabled: !!id, retry: false });
  const rfisQ = useQuery({ queryKey: ['project-rfis', id], queryFn: () => rfiApi.list({ project: id }), enabled: !!id, retry: false });
  const peersQ = useQuery({ queryKey: ['project-peers', id], queryFn: () => peerApi.list({ project: id }), enabled: !!id, retry: false });
  const discsQ = useQuery({ queryKey: ['project-discs', id], queryFn: () => discApi.list({ project: id }), enabled: !!id, retry: false });
  const variationsQ = useQuery({ queryKey: ['project-variations', id], queryFn: () => variationApi.list({ project: id }), enabled: !!id, retry: false });

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
  const areaRows = ofProject(areaQ.data?.items);
  const boqRows = ofProject(boqQ.data?.items);
  const visitRows = ofProject(visitsQ.data?.items);
  const weeklyRows = ofProject(weeklyQ.data?.items);
  const rfiRows = ofProject(listOf(rfisQ.data));
  const peerRows = ofProject(listOf(peersQ.data));
  const discRows = ofProject(listOf(discsQ.data));
  const variationRows = ofProject(listOf(variationsQ.data));
  const scope = project.scope ?? [];
  const totalFee = scope.reduce((s, r) => s + (Number(r.fee) || 0), 0);
  const contacts = asObj(project.contacts);
  const client = asObj(contacts.client);
  const architect = asObj(contacts.architect);
  const pmc = asObj(contacts.pmc);
  const billing = asObj(contacts.billing);
  const loc = asObj(project.location);
  const ptls = project.principalTeamLeads ?? [];

  const openRevisions = revisions.filter((r) => String(r.status ?? '') !== 'Cleared');
  const openActions = meetings.flatMap((m) =>
    (m.actions ?? [])
      .filter((a) => String(a.status ?? '') !== 'Completed')
      .map((a) => ({ ...a, meetingTitle: m.title, meetingDate: m.date })),
  );
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
  const daysOpen = (v) => {
    const t = Date.parse(v);
    return Number.isNaN(t) ? '—' : Math.max(0, Math.floor((Date.now() - t) / DAY));
  };

  const addressLine = [loc.address1, loc.address2, loc.city, loc.state, loc.zip].filter(Boolean).join(', ');
  const mapsQuery = addressLine || loc.label || '';
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;
  const locationText = [loc.label, loc.city, loc.state].filter(Boolean).join(', ');

  const timeline = PROJECT_STAGE_CODES.map((code, i) => {
    const cur = PROJECT_STAGE_CODES.indexOf(project.currentStage ?? 'CD');
    const status = i < cur ? 'Completed' : i === cur ? 'In progress' : 'Not started';
    return { code, status };
  });

  const areaInitial = areaRows.reduce((s, r) => s + Number(r.initial ?? 0), 0);
  const areaRevised = areaRows.reduce((s, r) => s + Number(r.revised ?? 0), 0);
  const areaDelta = areaRevised - areaInitial;
  const flags = [
    {
      flag: 'Work order',
      detail: project.jobNumber
        ? `${project.jobNumber} logged${project.workOrderDate ? ` on ${fmtDate(project.workOrderDate)}` : ''}`
        : 'No work order number recorded',
    },
    {
      flag: 'Area variance',
      detail: areaRows.length === 0
        ? 'No area statement recorded'
        : areaDelta === 0
          ? 'No change from the initial area statement'
          : `${areaInitial.toLocaleString('en-IN')} → ${areaRevised.toLocaleString('en-IN')} (${areaDelta > 0 ? '+' : ''}${areaDelta.toLocaleString('en-IN')}) against the initial area statement`,
    },
  ];

  const coordinationLog = [...meetings]
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 10);

  const revisionLogPanel = (
    <Panel title="Revision logs" sub="By stage, for this project">
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
                { key: 'drawing', label: 'Drawing', render: (r) => r.drawing ?? '—' },
                { key: 'rev', label: 'Rev', render: (r) => r.revNo ?? '—' },
                { key: 'status', label: 'Status', render: (r) => r.status ?? '—' },
              ]}
              rows={g.rows}
              emptyText="No revisions logged."
            />
          )}
        </div>
      ))}
    </Panel>
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
          <Field label="Priority" value={project.priority} />
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
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="approve-btn" onClick={() => setModal('owner')}>Change owner</button>
          <button type="button" className="approve-btn" onClick={() => setModal('dates')}>Edit dates</button>
          <button type="button" className="approve-btn" onClick={() => setLocOpen(true)}>Change Location</button>
        </div>
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

      <Panel title="Open this project for a team">
        {isAdmin && project.activation?.status !== 'Activated' ? (
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

      <Tabs tabs={TOP_TABS} active={top} onChange={setTop} />

      {top === 'coordinator' && (
        <>
          <Tabs tabs={COORD_TABS} active={coord} onChange={setCoord} />

          {coord === 'overview' && (
            <>
              <Panel title="Project status" sub="Design-stage timeline">
                <DataTable
                  columns={[
                    { key: 'stage', label: 'Stage', render: (r) => r.code },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  ]}
                  rows={timeline}
                />
              </Panel>

              <Panel title="Stage & Service-wise Status" sub="Live project status, progress & completion, and delay / submission status — by service and stage">
                <DataTable
                  columns={[
                    { key: 'service', label: 'Service', render: (s) => s.service ?? '—' },
                    { key: 'stage', label: 'Stage', render: (s) => s.stage ?? '—' },
                    { key: 'live', label: 'Live status', render: (s) => s.currentStatus ?? '—' },
                    { key: 'progress', label: 'Progress / completion', render: (s) => (String(s.currentStatus ?? '').toLowerCase() === 'completed' ? 'Completed' : '—') },
                    { key: 'delay', label: 'Delay / submission status', render: (s) => (Number(s.delayDays ?? 0) > 0 ? `${s.delayDays} day(s) late` : 'On time') },
                  ]}
                  rows={stages}
                  emptyText="No stage status recorded for this project yet."
                />
              </Panel>

              <Panel title="Flags" sub="Work order and area statement">
                <DataTable
                  columns={[
                    { key: 'flag', label: 'Flag', render: (r) => r.flag },
                    { key: 'detail', label: 'Detail', render: (r) => r.detail },
                  ]}
                  rows={flags}
                />
              </Panel>

              <Panel title="Coordination log" sub="Meetings and coordination actions for this project">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
                    { key: 'services', label: 'Disciplines', render: (m) => (m.services ?? []).join(' / ') || '—' },
                    { key: 'title', label: 'Meeting', render: (m) => m.title ?? '—' },
                    { key: 'action', label: 'Action', render: (m) => m.actions?.[0]?.text ?? '—' },
                    { key: 'status', label: 'Status', render: (m) => m.status ?? '—' },
                  ]}
                  rows={coordinationLog}
                  emptyText="No coordination meetings logged for this project yet."
                />
              </Panel>

              <Panel title="Clash log" sub="Construction and drawing discrepancies raised on this project">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (d) => fmtDate(d.raised ?? d.createdAt) },
                    { key: 'kind', label: 'Type', render: (d) => d.kind ?? '—' },
                    { key: 'discipline', label: 'Discipline', render: (d) => d.discipline ?? '—' },
                    { key: 'issue', label: 'Issue', render: (d) => d.issue ?? '—' },
                    { key: 'status', label: 'Status', render: (d) => <StatusPill status={d.status}>{d.status ?? '—'}</StatusPill> },
                  ]}
                  rows={discRows}
                  emptyText="No clashes or discrepancies logged for this project."
                />
              </Panel>

              {revisionLogPanel}

              <Panel title="Principal team leads">
                {ptls.length === 0 ? (
                  <EmptyState text="No principal team leads assigned yet." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'service', label: 'Service' },
                      { key: 'name', label: 'Name(s)', render: (r) => [r.name, ...((r.names ?? []).filter(Boolean))].filter(Boolean).join(', ') || '—' },
                    ]}
                    rows={ptls}
                    emptyText="No principal team leads assigned yet."
                  />
                )}
              </Panel>
            </>
          )}

          {coord === 'coordination' && (
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
          )}

          {coord === 'pending' && (
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
          )}

          {coord === 'rfis' && (
            <Panel title="RFI's" sub="Requests for information raised on this project">
              <DataTable
                columns={[
                  { key: 'rfiNo', label: 'ID', render: (r) => r.rfiNo ?? String(r._id ?? '').slice(-6) },
                  { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
                  { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
                  { key: 'team', label: 'Team', render: (r) => r.team ?? '—' },
                  { key: 'raisedBy', label: 'Raised by', render: (r) => r.raisedBy?.name ?? r.raisedBy?.email ?? '—' },
                  { key: 'assignedTo', label: 'Assigned to', render: (r) => r.assignedTo ?? '—' },
                  { key: 'due', label: 'Due', render: (r) => fmtDate(r.due) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={rfiRows}
                emptyText="No RFI's raised for this project yet."
              />
            </Panel>
          )}

          {coord === 'meetings' && (
            <>
              <Panel title="Meeting log" sub="Meetings for this project, most recent first">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
                    { key: 'time', label: 'Time', render: (m) => [m.startTime, m.endTime].filter(Boolean).join('–') || '—' },
                    { key: 'title', label: 'Meeting', render: (m) => m.title ?? '—' },
                    { key: 'type', label: 'Type', render: (m) => m.type ?? '—' },
                    { key: 'mode', label: 'Mode', render: (m) => m.mode ?? '—' },
                    { key: 'status', label: 'Status', render: (m) => m.status ?? '—' },
                    { key: 'participants', label: 'Participants', render: (m) => (m.participants ?? []).length },
                    { key: 'mom', label: 'MOM', render: (m) => (m.mom?.discussion ? 'Recorded' : '—') },
                  ]}
                  rows={[...meetings].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))}
                  emptyText="No meetings logged for this project yet."
                />
              </Panel>
              <Panel title="Action items">
                <DataTable
                  columns={[
                    { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
                    { key: 'owner', label: 'Owner', render: (a) => (a.owner && typeof a.owner === 'object' ? empName(a.owner) : '—') },
                    { key: 'service', label: 'Service', render: (a) => a.service ?? '—' },
                    { key: 'due', label: 'Due', render: (a) => fmtDate(a.due) },
                    { key: 'status', label: 'Status', render: (a) => a.status ?? '—' },
                    { key: 'from', label: 'From meeting', render: (a) => a.meetingTitle ?? '—' },
                  ]}
                  rows={meetings.flatMap((m) => (m.actions ?? []).map((a) => ({ ...a, meetingTitle: m.title })))}
                  emptyText="No action items recorded for this project yet."
                />
              </Panel>
            </>
          )}

          {coord === 'deliverables' && (
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
          areaRows={areaRows}
          boqRows={boqRows}
          visitRows={visitRows}
          weeklyRows={weeklyRows}
          gbsItem={gbsQ.data?.item}
          teamBundle={teamQ.data}
          peerRows={peerRows}
          variations={variationRows}
          role={role}
        />
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
