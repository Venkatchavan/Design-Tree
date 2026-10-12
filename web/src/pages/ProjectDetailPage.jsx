import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi, employeesApi, usersApi } from '../lib/api.js';
import { areaApi, boqApi, gbsApi, visitsApi, weeklyReportApi } from '../lib/functionsApi.js';
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

const COORD_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'coordination', label: 'Coordination' },
  { key: 'pending', label: 'Pending & follow-up' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'deliverables', label: 'Deliverables & drawings' },
  { key: 'revisions', label: 'Revision logs' },
  { key: 'reports', label: 'Reports' },
];

const SERVICE_VIEW_TABS = SERVICE_TABS.map((s) => ({ key: `svc-${s.key}`, label: s.label }));

const STAGE_ORDER = ['Preliminary concept', 'Concept', 'Schematic', 'Design development', 'Tender', 'GFC'];

const DAY = 86400000;

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
  const [spocId, setSpocId] = useState('');
  const [view, setView] = useState('overview');

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

  const activate = useMutation({
    mutationFn: (body) => projectsApi.activate(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      setSpocId('');
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
  const scope = project.scope ?? [];
  const totalFee = scope.reduce((s, r) => s + (Number(r.fee) || 0), 0);
  const contacts = project.contacts ?? {};
  const billing = contacts.billing ?? {};
  const loc = project.location ?? {};
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
  const activeServiceTab = view.startsWith('svc-') ? SERVICE_TABS.find((s) => `svc-${s.key}` === view) : null;

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <StatusPill tone={statusTone(project.status)}>{project.status ?? '—'}</StatusPill>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            {project.completion != null ? `${project.completion}% complete` : 'Completion —'}
          </span>
        </div>
      </div>

      <div className="kpi-grid cols-6">
        <KpiCard label="Open flags" value={openRevisions.length} accent="rust" />
        <KpiCard label="Revisions logged" value={revisions.length} accent="violet" />
        <KpiCard label="Drawings submitted" value={drawings.length} accent="blueprint" />
        <KpiCard label="Completion" value={project.completion != null ? `${project.completion}%` : '—'} accent="forest" />
        <KpiCard label="Current stage" value={project.currentStage ?? '—'} accent="teal" />
        <KpiCard label="Contract completion" value={fmtDate(project.expectedCompletion)} accent="amber" />
      </div>

      <Tabs tabs={COORD_TABS} active={activeServiceTab ? '' : view} onChange={setView} />
      <Tabs tabs={SERVICE_VIEW_TABS} active={activeServiceTab ? view : ''} onChange={setView} />

      {view === 'overview' && (
        <>
          <Panel title="Project details">
            <div className="field-grid">
              <Field label="Name" value={project.name} />
              <Field label="Code" value={project.code} mono />
              <Field label="State" value={project.state} />
              <Field label="Branch" value={project.branch} />
              <Field label="Project type" value={project.projectType} />
              <Field label="Services" value={(project.services ?? []).join(', ') || project.usedFor} />
              <Field label="Source" value={project.source} />
              <Field label="Entity" value={project.entityName} />
              <Field label="Complexity" value={project.complexity} />
              <Field label="Project location" value={loc.label} />
              <Field label="Address" value={[loc.address1, loc.address2].filter(Boolean).join(', ')} />
              <Field label="City" value={loc.city} />
              <Field label="ZIP" value={loc.zip} mono />
            </div>
            {project.description && (
              <div style={{ marginTop: 8 }}>
                <Field label="Description" value={project.description} />
              </div>
            )}
            {project.requirements && (
              <div style={{ marginTop: 8 }}>
                <Field label="Project requirements" value={project.requirements} />
              </div>
            )}
          </Panel>

          <Panel title="Work order">
            <div className="field-grid">
              <Field label="Work order no." value={project.jobNumber} mono />
              <Field label="Start date" value={fmtDate(project.startDate)} />
              <Field label="Contract completion" value={fmtDate(project.expectedCompletion)} />
              <Field label="Actual completion" value={project.actualCompletion ? fmtDate(project.actualCompletion) : 'Pending'} />
              <Field label="Total fee" value={totalFee ? totalFee.toLocaleString('en-IN') : null} />
            </div>
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: 'service', label: 'Service', render: (r) => r.service ?? '—' },
                  { key: 'scope', label: 'Scope', render: (r) => r.scope ?? '—' },
                  { key: 'fee', label: 'Fee', render: (r) => (r.fee ?? '—') },
                ]}
                rows={scope}
                emptyText="No scope rows recorded for this project."
              />
            </div>
          </Panel>

          <Panel title="Client and contacts">
            <div className="field-grid">
              <Field label="Client" value={contactText(contacts.client) === '—' ? project.clientName : contactText(contacts.client)} />
              <Field label="Architect" value={contactText(contacts.architect)} />
              <Field label="PMC" value={contactText(contacts.pmc)} />
              <Field label="Peer review" value={contactText(contacts.peerReview)} />
              <Field label="Billing contact" value={billing.name} />
              <Field label="Billing company" value={billing.company} />
              <Field label="Billing phone" value={billing.phone} />
              <Field label="Billing email" value={billing.email} />
            </div>
          </Panel>

          <Panel title="Scope and services — stage status">
            <DataTable
              columns={[
                { key: 'service', label: 'Service', render: (s) => s.service ?? '—' },
                { key: 'stage', label: 'Stage', render: (s) => s.stage ?? '—' },
                { key: 'planned', label: 'Planned completion', render: (s) => fmtDate(s.plannedCompletion) },
                { key: 'status', label: 'Current status', render: (s) => s.currentStatus ?? '—' },
                { key: 'delay', label: 'Delay', render: (s) => (Number(s.delayDays ?? 0) > 0 ? `${s.delayDays} day(s) late` : 'On time') },
                { key: 'billing', label: 'Billing readiness', render: (s) => (s.billingReadiness ? <StatusPill status={s.billingReadiness}>{s.billingReadiness}</StatusPill> : '—') },
              ]}
              rows={stages}
              emptyText="No stage status recorded for this project yet."
            />
          </Panel>

          <Panel title="Area statement">
            <DataTable
              columns={[
                { key: 'zone', label: 'Zone', render: (r) => r.zone ?? '—' },
                { key: 'initial', label: 'Initial', render: (r) => r.initial ?? '—' },
                { key: 'revised', label: 'Revised', render: (r) => r.revised ?? '—' },
                { key: 'variance', label: 'Variance', render: (r) => (r.initial != null && r.revised != null ? Number(r.revised) - Number(r.initial) : '—') },
                { key: 'status', label: 'Status', render: (r) => r.status ?? '—' },
              ]}
              rows={areaRows}
              emptyText="No area statement recorded for this project yet."
            />
          </Panel>

          {project.bimWorkOrder && (
            <Panel title="BIM work order" sub="Kept separate from the work order above">
              <div className="field-grid">
                <Field label="Scope of work" value={project.bimWorkOrder.scope} />
                <Field label="Fee / value" value={project.bimWorkOrder.fee} />
                <Field label="Description" value={project.bimWorkOrder.description} />
              </div>
            </Panel>
          )}

          <Panel title="Owner & dates">
            <div className="field-grid">
              <Field label="Owner" value={project.owner} />
              <Field label="Start date" value={fmtDate(project.startDate)} />
              <Field label="Expected completion" value={fmtDate(project.expectedCompletion)} />
              <Field label="Actual completion" value={fmtDate(project.actualCompletion)} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="approve-btn" onClick={() => setModal('owner')}>Change owner</button>
              <button type="button" className="approve-btn" onClick={() => setModal('dates')}>Edit dates</button>
            </div>
          </Panel>

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

          {isAdmin && project.activation?.status !== 'Activated' && (
            <Panel title="Activation & approvals">
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
            </Panel>
          )}

          <Panel title="Portal access">
            <PortalAccessPanel projectId={id} initialIds={project.portalUsers ?? []} isAdmin={isAdmin} />
          </Panel>
        </>
      )}

      {view === 'coordination' && (
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

      {view === 'pending' && (
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

      {view === 'meetings' && (
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

      {view === 'deliverables' && (
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

      {view === 'revisions' && (
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
      )}

      {view === 'reports' && (
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

      {activeServiceTab && (
        <ProjectServiceWorkspace
          key={activeServiceTab.key}
          service={activeServiceTab}
          project={project}
          stages={stages}
          drawings={drawings}
          areaRows={areaRows}
          boqRows={boqRows}
          visitRows={visitRows}
          weeklyRows={weeklyRows}
          gbsItem={gbsQ.data?.item}
          teamBundle={teamQ.data}
        />
      )}

      {modal && (
        <OwnerDatesModal project={project} mode={modal} onClose={() => setModal(null)} />
      )}
    </>
  );
}
