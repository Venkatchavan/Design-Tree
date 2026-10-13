import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import KpiCard from './KpiCard.jsx';
import StatusPill from './StatusPill.jsx';
import VariationsPanel from './VariationsPanel.jsx';
import ServiceTeamPanel from './ServiceTeamPanel.jsx';
import StageReviewPanel from './StageReviewPanel.jsx';
import DesignTeamPanel from './DesignTeamPanel.jsx';
import QsServicePanel from './QsServicePanel.jsx';
import QaqcServicePanel from './QaqcServicePanel.jsx';

export const SERVICE_TABS = [
  { key: 'structural', label: 'Structural', codes: ['STR', 'Structural', 'Structure'], kind: 'design', dash: 'STR' },
  { key: 'electrical', label: 'Electrical', codes: ['ELE', 'Electrical'], kind: 'design', dash: 'ELE' },
  { key: 'mechanical', label: 'Mechanical', codes: ['HVAC', 'MEP', 'Mechanical'], kind: 'design', dash: 'HVAC' },
  { key: 'plumbing', label: 'Plumbing', codes: ['PHE', 'Plumbing'], kind: 'design', dash: 'PHE' },
  { key: 'fire', label: 'Fire', codes: ['FIRE', 'Fire'], kind: 'design', dash: 'FIRE' },
  { key: 'qs', label: 'QS', codes: ['QS', 'QS/BOQ'], kind: 'qs', dash: 'QS' },
  { key: 'qaqc', label: 'QAQC', codes: ['QAQC', 'QA/QC'], kind: 'qaqc', dash: 'QAQC' },
  { key: 'gbs', label: 'GBS', codes: ['GBS'], kind: 'gbs' },
  { key: 'bim', label: 'BIM', codes: ['BIM'], kind: 'bim' },
  { key: 'peer', label: 'Peer review', codes: ['PEER', 'Peer Review'], kind: 'peer' },
  { key: 'drawings', label: 'Drawings', codes: [], kind: 'drawings' },
  { key: 'variations', label: 'Variations', codes: [], kind: 'variations' },
];

export function idOf(v) {
  if (v && typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v ?? '');
}

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function empName(e) {
  if (!e || typeof e !== 'object') return '—';
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
}

function delayText(days) {
  const n = Number(days ?? 0);
  return n > 0 ? `${n} day(s) late` : 'On time';
}

function KpiRow({ items }) {
  return (
    <div className={`kpi-grid cols-${items.length}`}>
      {items.map((k) => (
        <KpiCard key={k.label} label={k.label} value={k.value} accent={k.accent} />
      ))}
    </div>
  );
}

function TeamPanels({ service, project, teamBundle }) {
  const codes = service.codes;
  const leads = (project.principalTeamLeads ?? []).filter((t) => codes.includes(String(t.service ?? '')));
  const members = (teamBundle?.members ?? []).filter((m) => codes.includes(String(m.service ?? '')));
  return (
    <>
      <Panel title="Principal team lead" sub="Entered by the SPOC in team allocation">
        <DataTable
          columns={[
            { key: 'service', label: 'Service' },
            { key: 'name', label: 'Name(s)', render: (r) => [r.name, ...((r.names ?? []).filter(Boolean))].filter(Boolean).join(', ') || '—' },
          ]}
          rows={leads}
          emptyText="No principal team lead assigned for this service."
        />
      </Panel>
      <Panel title="Team members">
        <DataTable
          columns={[
            { key: 'name', label: 'Team member', render: (m) => empName(m.employee) },
            { key: 'designation', label: 'Designation', render: (m) => m.employee?.designation ?? '—' },
            { key: 'team', label: 'Team', render: (m) => (typeof m.team === 'object' ? m.team?.name : m.team) || '—' },
          ]}
          rows={members}
          emptyText="No team members allocated for this service."
        />
      </Panel>
    </>
  );
}

function StagePanel({ svcStages }) {
  return (
    <Panel title="Stage status">
      <DataTable
        columns={[
          { key: 'stage', label: 'Stage', render: (s) => s.stage ?? '—' },
          { key: 'planned', label: 'Planned completion', render: (s) => fmtDate(s.plannedCompletion) },
          { key: 'status', label: 'Current status', render: (s) => s.currentStatus ?? '—' },
          { key: 'delay', label: 'Delay', render: (s) => delayText(s.delayDays) },
          { key: 'billing', label: 'Billing readiness', render: (s) => (s.billingReadiness ? <StatusPill status={s.billingReadiness}>{s.billingReadiness}</StatusPill> : '—') },
          { key: 'reason', label: 'Reason', render: (s) => s.reason ?? '—' },
        ]}
        rows={svcStages}
        emptyText="No stage status recorded for this service yet."
      />
    </Panel>
  );
}

function DrawingsPanel({ rows, emptyText }) {
  return (
    <Panel title="Drawing register">
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
        rows={rows}
        emptyText={emptyText}
      />
    </Panel>
  );
}

function PeerReviewPanel({ rows }) {
  return (
    <Panel title="Peer reviews" sub="Peer review submissions for this project">
      <DataTable
        columns={[
          { key: 'submission', label: 'Submission', render: (r) => r.submission || '—' },
          { key: 'discipline', label: 'Discipline', render: (r) => r.discipline || '—' },
          { key: 'stage', label: 'Stage', render: (r) => r.stage || '—' },
          { key: 'reviewer', label: 'Reviewer', render: (r) => r.reviewer || '—' },
          { key: 'due', label: 'Due', render: (r) => fmtDate(r.dueDate) },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
        ]}
        rows={rows}
        emptyText="No peer reviews for this project yet."
      />
    </Panel>
  );
}

function contactText(c) {
  if (!c) return '—';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    return [c.name, c.company, c.email, c.phone].filter(Boolean).join(' · ') || '—';
  }
  return String(c);
}

function normSvc(v) {
  return String(v ?? '').trim().toLowerCase();
}

function serviceMatches(service, value) {
  const candidates = [service.label, service.dash, ...(service.codes ?? [])].map(normSvc);
  return candidates.includes(normSvc(value));
}

function meetingsForService(meetings, service) {
  return (meetings ?? []).filter((m) => {
    const svcs = m?.services ?? [];
    if (!Array.isArray(svcs) || svcs.length === 0) return false;
    return svcs.some((s) => serviceMatches(service, s));
  });
}

function ServiceMeetingsPanel({ service, meetings }) {
  const rows = meetingsForService(meetings, service);
  const actions = rows.flatMap((m) => (m.actions ?? []).map((a) => ({ ...a, meetingTitle: m.title, meetingDate: m.date })));
  return (
    <>
      <Panel title={`Meetings — ${service.label}`} sub="Meetings for this project tagged to this service">
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
            { key: 'title', label: 'Meeting', render: (m) => m.title ?? '—' },
            { key: 'type', label: 'Type', render: (m) => m.type ?? '—' },
            { key: 'status', label: 'Status', render: (m) => m.status ?? '—' },
          ]}
          rows={[...rows].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))}
          emptyText={`No ${service.label} meetings logged for this project yet.`}
        />
      </Panel>
      <Panel title={`Meeting action items — ${service.label}`} sub="Open and completed actions from this service's meetings">
        <DataTable
          columns={[
            { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
            { key: 'service', label: 'Service', render: (a) => a.service ?? service.label },
            { key: 'due', label: 'Due', render: (a) => fmtDate(a.due) },
            { key: 'status', label: 'Status', render: (a) => a.status ?? '—' },
            { key: 'from', label: 'From meeting', render: (a) => a.meetingTitle ?? '—' },
          ]}
          rows={actions}
          emptyText="No action items for this service yet."
        />
      </Panel>
    </>
  );
}

function ServiceDirectoryPanel({ service, project, teamBundle }) {
  const codes = service.codes ?? [];
  const contacts = (project?.contacts ?? {});
  const asObj = (v) => (v && typeof v === 'object' ? v : {});
  const client = asObj(contacts.client);
  const architect = asObj(contacts.architect);
  const pmc = asObj(contacts.pmc);
  const contactRows = [
    { name: client.company || client.name || project?.clientName || '—', org: 'Client', role: client.designation || 'Client', contact: [client.email, client.phone].filter(Boolean).join(' · ') || '—' },
    { name: architect.company || architect.name || '—', org: 'Architect', role: architect.designation || 'Design architect', contact: [architect.email, architect.phone].filter(Boolean).join(' · ') || '—' },
    { name: pmc.company || pmc.name || '—', org: 'PMC', role: pmc.designation || 'PMC', contact: [pmc.email, pmc.phone].filter(Boolean).join(' · ') || '—' },
  ].filter((r) => r.name && r.name !== '—');
  const leads = (project?.principalTeamLeads ?? [])
    .filter((t) => codes.includes(String(t.service ?? '')))
    .flatMap((t) => {
      const names = (t.names ?? []).filter(Boolean);
      const list = names.length > 0 ? names : [t.name ?? ''];
      return list.filter(Boolean).map((name) => ({ service: t.service ?? service.label, name, role: t.role ?? 'Principal team lead' }));
    });
  const members = (teamBundle?.members ?? [])
    .filter((m) => codes.includes(String(m.service ?? '')))
    .map((m) => ({ service: m.service ?? service.label, name: empName(m.employee), role: m.employee?.designation ?? m.role ?? 'Team member' }));
  return (
    <Panel title={`Project directory — ${service.label}`} sub="Contacts and service team for this project">
      <div className="section-label">Key contacts</div>
      <DataTable
        columns={[
          { key: 'name', label: 'Name / organisation' },
          { key: 'org', label: 'Organisation' },
          { key: 'role', label: 'Role' },
          { key: 'contact', label: 'Contact' },
        ]}
        rows={contactRows}
        emptyText="No project contacts recorded yet."
      />
      <div className="section-label" style={{ marginTop: 12 }}>Service team</div>
      <DataTable
        columns={[
          { key: 'service', label: 'Service' },
          { key: 'name', label: 'Team member', render: (r) => r.name || 'Not allocated' },
          { key: 'role', label: 'Role / responsibility', render: (r) => r.role || '—' },
        ]}
        rows={[...leads, ...members]}
        emptyText={`No team allocated for ${service.label} yet.`}
      />
    </Panel>
  );
}

export default function ProjectServiceWorkspace({
  service,
  project,
  stages,
  drawings,
  visitRows,
  weeklyRows,
  gbsItem,
  teamBundle,
  peerRows = [],
  variations = [],
  role = '',
  serviceDashboards = [],
  stageReviews = [],
  employees = [],
  discrepancies = [],
  drawingAcks = new Set(),
  workItems = [],
  meetings = [],
}) {
  const codes = service.codes;
  const svcStages = stages.filter((s) => codes.includes(String(s.service ?? '')));
  const svcDrawings = drawings.filter((d) => codes.includes(String(d.service ?? '')));
  const kind = service.kind;

  if (kind === 'drawings') {
    return <DrawingsPanel rows={drawings} emptyText="No drawings submitted for this project yet." />;
  }

  if (kind === 'variations') {
    return <VariationsPanel projectId={project._id} variations={variations} role={role} />;
  }

  if (kind === 'design') {
    const teamMembers = (teamBundle?.members ?? []).filter((m) => codes.includes(String(m.service ?? '')));
    return (
      <>
        <DesignTeamPanel
          projectId={project._id}
          service={service}
          dashboard={serviceDashboards.find((d) => d.service === service.dash)}
          principalTeamLeads={project.principalTeamLeads}
          teamMembers={teamMembers}
          employees={employees}
          drawings={svcDrawings}
          acks={drawingAcks}
          discrepancies={discrepancies}
          role={role}
        />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  if (kind === 'bim') {
    return (
      <>
        <ServiceTeamPanel
          projectId={project._id}
          service="BIM"
          dashboard={serviceDashboards.find((d) => d.service === 'BIM')}
          principalTeamLeads={project.principalTeamLeads}
          role={role}
        />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  if (kind === 'peer') {
    const peerOpen = peerRows.filter((p) => p.status !== 'Approved for Issue');
    return (
      <>
        <StageReviewPanel projectId={project._id} reviews={stageReviews} role={role} />
        <KpiRow
          items={[
            { label: 'Peer reviews', value: peerRows.length, accent: 'blueprint' },
            { label: 'Open reviews', value: peerOpen.length, accent: 'amber' },
            { label: 'Approved for issue', value: peerRows.length - peerOpen.length, accent: 'forest' },
            { label: 'Stages tracked', value: svcStages.length, accent: 'teal' },
          ]}
        />
        <PeerReviewPanel rows={peerRows} />
        <TeamPanels service={service} project={project} teamBundle={teamBundle} />
        <StagePanel svcStages={svcStages} />
        <DrawingsPanel rows={svcDrawings} emptyText="No drawings submitted for this service yet." />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  if (kind === 'qs') {
    return (
      <>
        <QsServicePanel
          projectId={project._id}
          codes={codes}
          dashboard={serviceDashboards.find((d) => d.service === service.dash)}
          principalTeamLeads={project.principalTeamLeads}
          workItems={workItems}
          role={role}
        />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  if (kind === 'qaqc') {
    return (
      <>
        <QaqcServicePanel
          projectId={project._id}
          codes={codes}
          dashboard={serviceDashboards.find((d) => d.service === service.dash)}
          principalTeamLeads={project.principalTeamLeads}
          visits={visitRows}
          discrepancies={discrepancies}
          weeklyRows={weeklyRows}
          role={role}
        />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  if (kind === 'gbs') {
    return (
      <>
        <ServiceTeamPanel
          projectId={project._id}
          service="GBS"
          dashboard={serviceDashboards.find((d) => d.service === 'GBS')}
          principalTeamLeads={project.principalTeamLeads}
          role={role}
          gbsSteps={gbsItem?.steps ?? []}
        />
        <ServiceMeetingsPanel service={service} meetings={meetings} />
        <ServiceDirectoryPanel service={service} project={project} teamBundle={teamBundle} />
      </>
    );
  }

  return null;
}
