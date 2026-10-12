import { useState } from 'react';
import Panel from './Panel.jsx';
import Tabs from './Tabs.jsx';
import DataTable from './DataTable.jsx';
import KpiCard from './KpiCard.jsx';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';

export const SERVICE_TABS = [
  { key: 'structural', label: 'Structural', codes: ['STR', 'Structural', 'Structure'], kind: 'design' },
  { key: 'mechanical', label: 'Mechanical', codes: ['HVAC', 'MEP', 'Mechanical'], kind: 'design' },
  { key: 'electrical', label: 'Electrical', codes: ['ELE', 'Electrical'], kind: 'design' },
  { key: 'plumbing', label: 'Plumbing', codes: ['PHE', 'Plumbing'], kind: 'design' },
  { key: 'fire', label: 'Fire', codes: ['FIRE', 'Fire'], kind: 'design' },
  { key: 'qs', label: 'QS', codes: ['QS', 'QS/BOQ'], kind: 'qs' },
  { key: 'qaqc', label: 'QAQC', codes: ['QAQC', 'QA/QC'], kind: 'qaqc' },
  { key: 'gbs', label: 'GBS', codes: ['GBS'], kind: 'gbs' },
  { key: 'bim', label: 'BIM', codes: ['BIM'], kind: 'bim' },
  { key: 'drawings', label: 'Drawings', codes: [], kind: 'drawings' },
  { key: 'variations', label: 'Variations', codes: [], kind: 'variations' },
];

const DESIGN_SUBTABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'team', label: 'Team' },
  { key: 'stages', label: 'Stage status' },
  { key: 'drawings', label: 'Drawings' },
];

const SUBTABS_BY_KIND = {
  design: DESIGN_SUBTABS,
  bim: DESIGN_SUBTABS,
  qs: [
    { key: 'overview', label: 'Overview' },
    { key: 'boq', label: 'BOQ' },
    { key: 'area', label: 'Area settlement' },
  ],
  qaqc: [
    { key: 'overview', label: 'Overview' },
    { key: 'visits', label: 'Site visits' },
    { key: 'weekly', label: 'Weekly reports' },
  ],
  gbs: [
    { key: 'overview', label: 'Overview' },
    { key: 'certification', label: 'Certification' },
  ],
  drawings: [{ key: 'register', label: 'Drawing register' }],
  variations: [{ key: 'log', label: 'Variation log' }],
};

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

function ServiceOverview({ service, project, svcStages, svcDrawings }) {
  const active = svcStages.filter((s) => String(s.currentStatus ?? '').toLowerCase() !== 'completed');
  const delayed = svcStages.filter((s) => Number(s.delayDays ?? 0) > 0);
  const gfc = svcDrawings.filter((d) => String(d.stage ?? '').toUpperCase() === 'GFC');
  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Stages tracked" value={svcStages.length} accent="blueprint" />
        <KpiCard label="Active stages" value={active.length} accent="forest" />
        <KpiCard label="Delayed stages" value={delayed.length} accent="rust" />
        <KpiCard label="GFC drawings" value={gfc.length} accent="teal" />
      </div>
      {service.kind === 'bim' && (
        <Panel title="BIM work order" sub="Kept separate from the project work order">
          {!project.bimWorkOrder ? (
            <EmptyState text="No BIM work order for this project." />
          ) : (
            <div className="field-grid">
              <div><div className="form-label">Scope of work</div><div>{project.bimWorkOrder.scope || '—'}</div></div>
              <div><div className="form-label">Fee / value</div><div>{project.bimWorkOrder.fee ?? '—'}</div></div>
              <div><div className="form-label">Description</div><div>{project.bimWorkOrder.description || '—'}</div></div>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function TeamView({ service, project, teamBundle }) {
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

function StagesView({ svcStages }) {
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

function DrawingsView({ rows, emptyText }) {
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

export default function ProjectServiceWorkspace({ service, project, stages, drawings, areaRows, boqRows, visitRows, weeklyRows, gbsItem, teamBundle }) {
  const subtabs = SUBTABS_BY_KIND[service.kind] ?? DESIGN_SUBTABS;
  const [sub, setSub] = useState(subtabs[0].key);
  const codes = service.codes;
  const svcStages = stages.filter((s) => codes.includes(String(s.service ?? '')));
  const svcDrawings = drawings.filter((d) => codes.includes(String(d.service ?? '')));

  let body = null;
  if (service.kind === 'design' || service.kind === 'bim') {
    if (sub === 'overview') body = <ServiceOverview service={service} project={project} svcStages={svcStages} svcDrawings={svcDrawings} />;
    if (sub === 'team') body = <TeamView service={service} project={project} teamBundle={teamBundle} />;
    if (sub === 'stages') body = <StagesView svcStages={svcStages} />;
    if (sub === 'drawings') body = <DrawingsView rows={svcDrawings} emptyText="No drawings submitted for this service yet." />;
  } else if (service.kind === 'qs') {
    const total = boqRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    if (sub === 'overview') {
      body = (
        <div className="kpi-grid cols-3">
          <KpiCard label="BOQ items" value={boqRows.length} accent="blueprint" />
          <KpiCard label="BOQ total" value={total.toLocaleString('en-IN')} accent="copper" />
          <KpiCard label="Area zones" value={areaRows.length} accent="forest" />
        </div>
      );
    }
    if (sub === 'boq') {
      body = (
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
      );
    }
    if (sub === 'area') {
      body = (
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
      );
    }
  } else if (service.kind === 'qaqc') {
    const discrepancies = visitRows.filter((v) => v.discrepancyFound).length;
    if (sub === 'overview') {
      body = (
        <div className="kpi-grid cols-3">
          <KpiCard label="Site visits" value={visitRows.length} accent="blueprint" />
          <KpiCard label="Drawing issues found" value={discrepancies} accent="rust" />
          <KpiCard label="Weekly reports" value={weeklyRows.length} accent="forest" />
        </div>
      );
    }
    if (sub === 'visits') {
      body = (
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
      );
    }
    if (sub === 'weekly') {
      body = (
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
      );
    }
  } else if (service.kind === 'gbs') {
    const steps = gbsItem?.steps ?? [];
    const done = steps.filter((s) => s.status === 'Completed').length;
    if (sub === 'overview') {
      body = (
        <div className="kpi-grid cols-2">
          <KpiCard label="Certification steps" value={steps.length} accent="blueprint" />
          <KpiCard label="Completed steps" value={done} accent="forest" />
        </div>
      );
    }
    if (sub === 'certification') {
      body = (
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
      );
    }
  } else if (service.kind === 'drawings') {
    body = <DrawingsView rows={drawings} emptyText="No drawings submitted for this project yet." />;
  } else if (service.kind === 'variations') {
    body = (
      <Panel title="Variation log">
        <EmptyState text="Variation tracking is not set up in the system yet." />
      </Panel>
    );
  }

  return (
    <>
      <Tabs tabs={subtabs} active={sub} onChange={setSub} />
      {body}
    </>
  );
}
