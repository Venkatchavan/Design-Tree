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
    );
  }

  if (kind === 'bim') {
    return (
      <ServiceTeamPanel
        projectId={project._id}
        service="BIM"
        dashboard={serviceDashboards.find((d) => d.service === 'BIM')}
        principalTeamLeads={project.principalTeamLeads}
        role={role}
      />
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
      </>
    );
  }

  if (kind === 'qs') {
    return (
      <QsServicePanel
        projectId={project._id}
        codes={codes}
        dashboard={serviceDashboards.find((d) => d.service === service.dash)}
        principalTeamLeads={project.principalTeamLeads}
        workItems={workItems}
        role={role}
      />
    );
  }

  if (kind === 'qaqc') {
    return (
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
    );
  }

  if (kind === 'gbs') {
    return (
      <ServiceTeamPanel
        projectId={project._id}
        service="GBS"
        dashboard={serviceDashboards.find((d) => d.service === 'GBS')}
        principalTeamLeads={project.principalTeamLeads}
        role={role}
        gbsSteps={gbsItem?.steps ?? []}
      />
    );
  }

  return null;
}
