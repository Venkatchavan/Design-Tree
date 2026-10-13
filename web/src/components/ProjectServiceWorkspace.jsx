import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import KpiCard from './KpiCard.jsx';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import VariationsPanel from './VariationsPanel.jsx';

export const SERVICE_TABS = [
  { key: 'structural', label: 'Structural', codes: ['STR', 'Structural', 'Structure'], kind: 'design' },
  { key: 'electrical', label: 'Electrical', codes: ['ELE', 'Electrical'], kind: 'design' },
  { key: 'mechanical', label: 'Mechanical', codes: ['HVAC', 'MEP', 'Mechanical'], kind: 'design' },
  { key: 'plumbing', label: 'Plumbing', codes: ['PHE', 'Plumbing'], kind: 'design' },
  { key: 'fire', label: 'Fire', codes: ['FIRE', 'Fire'], kind: 'design' },
  { key: 'qs', label: 'QS', codes: ['QS', 'QS/BOQ'], kind: 'qs' },
  { key: 'qaqc', label: 'QAQC', codes: ['QAQC', 'QA/QC'], kind: 'qaqc' },
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

function BimWorkOrderPanel({ project }) {
  const bwo = project.bimWorkOrder;
  return (
    <Panel title="BIM work order" sub="Issued by Admin, kept separate from the work order above">
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
  areaRows,
  boqRows,
  visitRows,
  weeklyRows,
  gbsItem,
  teamBundle,
  peerRows = [],
  variations = [],
  role = '',
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

  if (kind === 'design' || kind === 'bim' || kind === 'peer') {
    const active = svcStages.filter((s) => String(s.currentStatus ?? '').toLowerCase() !== 'completed');
    const delayed = svcStages.filter((s) => Number(s.delayDays ?? 0) > 0);
    const gfc = svcDrawings.filter((d) => String(d.stage ?? '').toUpperCase() === 'GFC');
    const peerOpen = peerRows.filter((p) => p.status !== 'Approved for Issue');
    const items =
      kind === 'peer'
        ? [
            { label: 'Peer reviews', value: peerRows.length, accent: 'blueprint' },
            { label: 'Open reviews', value: peerOpen.length, accent: 'amber' },
            { label: 'Approved for issue', value: peerRows.length - peerOpen.length, accent: 'forest' },
            { label: 'Stages tracked', value: svcStages.length, accent: 'teal' },
          ]
        : [
            { label: 'Stages tracked', value: svcStages.length, accent: 'blueprint' },
            { label: 'Active stages', value: active.length, accent: 'forest' },
            { label: 'Delayed stages', value: delayed.length, accent: 'rust' },
            { label: 'GFC drawings', value: gfc.length, accent: 'teal' },
          ];
    return (
      <>
        {kind === 'bim' && <BimWorkOrderPanel project={project} />}
        <KpiRow items={items} />
        {kind === 'peer' && <PeerReviewPanel rows={peerRows} />}
        <TeamPanels service={service} project={project} teamBundle={teamBundle} />
        <StagePanel svcStages={svcStages} />
        <DrawingsPanel rows={svcDrawings} emptyText="No drawings submitted for this service yet." />
      </>
    );
  }

  if (kind === 'qs') {
    const total = boqRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return (
      <>
        <KpiRow
          items={[
            { label: 'BOQ items', value: boqRows.length, accent: 'blueprint' },
            { label: 'BOQ total', value: total.toLocaleString('en-IN'), accent: 'copper' },
            { label: 'Area zones', value: areaRows.length, accent: 'forest' },
          ]}
        />
        <Panel title="BOQ">
          <DataTable
            columns={[
              { key: 'itemNo', label: 'Item', render: (r) => r.itemNo ?? '—' },
              { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
              { key: 'unit', label: 'Unit', render: (r) => r.unit ?? '—' },
              { key: 'qty', label: 'Qty', render: (r) => r.qty ?? '—' },
              { key: 'rate', label: 'Rate', render: (r) => r.rate ?? '—' },
              { key: 'amount', label: 'Amount', render: (r) => r.amount ?? '—' },
              { key: 'status', label: 'Status', render: (r) => r.status ?? '—' },
            ]}
            rows={boqRows}
            emptyText="No BOQ items logged for this project yet."
          />
        </Panel>
        <Panel title="Area settlement">
          <DataTable
            columns={[
              { key: 'zone', label: 'Zone', render: (r) => r.zone ?? '—' },
              { key: 'initial', label: 'Initial', render: (r) => r.initial ?? '—' },
              { key: 'revised', label: 'Revised', render: (r) => r.revised ?? '—' },
              { key: 'variance', label: 'Variance', render: (r) => (r.initial != null && r.revised != null ? Number(r.revised) - Number(r.initial) : '—') },
              { key: 'status', label: 'Status', render: (r) => r.status ?? '—' },
              { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
            ]}
            rows={areaRows}
            emptyText="No area settlements recorded for this project yet."
          />
        </Panel>
      </>
    );
  }

  if (kind === 'qaqc') {
    const discrepancies = visitRows.filter((v) => v.discrepancyFound).length;
    return (
      <>
        <KpiRow
          items={[
            { label: 'Site visits', value: visitRows.length, accent: 'blueprint' },
            { label: 'Drawing issues found', value: discrepancies, accent: 'rust' },
            { label: 'Weekly reports', value: weeklyRows.length, accent: 'forest' },
          ]}
        />
        <Panel title="Site visits">
          <DataTable
            columns={[
              { key: 'visitId', label: 'Visit no.', render: (v) => v.visitId ?? '—' },
              { key: 'phase', label: 'Phase', render: (v) => v.phase ?? '—' },
              { key: 'type', label: 'Type', render: (v) => v.visitType ?? '—' },
              { key: 'date', label: 'Date', render: (v) => fmtDate(v.date ?? v.createdAt) },
              { key: 'issue', label: 'Drawing issue', render: (v) => (v.discrepancyFound ? 'Yes' : 'No') },
              { key: 'severity', label: 'Severity', render: (v) => v.severity ?? '—' },
            ]}
            rows={visitRows}
            emptyText="No site visits recorded for this project yet."
          />
        </Panel>
        <Panel title="Weekly reports and approval">
          <DataTable
            columns={[
              { key: 'week', label: 'Week', render: (w) => w.weekLabel ?? fmtDate(w.weekStart) },
              { key: 'status', label: 'Status', render: (w) => w.status ?? '—' },
              { key: 'approved', label: 'Approved on', render: (w) => fmtDate(w.approvedAt) },
            ]}
            rows={weeklyRows}
            emptyText="No weekly reports submitted for this project yet."
          />
        </Panel>
      </>
    );
  }

  if (kind === 'gbs') {
    const steps = gbsItem?.steps ?? [];
    const done = steps.filter((s) => s.status === 'Completed').length;
    return (
      <>
        <KpiRow
          items={[
            { label: 'Certification steps', value: steps.length, accent: 'blueprint' },
            { label: 'Completed steps', value: done, accent: 'forest' },
          ]}
        />
        <Panel title="Certification steps">
          <DataTable
            columns={[
              { key: 'phase', label: 'Phase', render: (s) => s.phase ?? '—' },
              { key: 'status', label: 'Status', render: (s) => s.status ?? '—' },
              { key: 'date', label: 'Date', render: (s) => fmtDate(s.date) },
              { key: 'remarks', label: 'Remarks', render: (s) => s.remarks ?? '—' },
            ]}
            rows={steps}
            emptyText="No GBS certification steps recorded for this project yet."
          />
        </Panel>
      </>
    );
  }

  return null;
}
