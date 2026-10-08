import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import StatusPill from '../components/StatusPill.jsx';

// Static reference mirroring project-reference Datum_dashboard_updated view-orghierarchy.
// No API: reporting hierarchy + per-level access policy. Enforcement lives server-side.
const ORG_GROUPS = [
  {
    title: 'Board & Leadership',
    rows: [
      { title: 'Founding Directors', desc: 'Promoter-directors of the firm', pill: 'Full visibility', tone: 'forest' },
      { title: 'Working Directors', desc: 'Full-time executive directors', pill: 'Full visibility', tone: 'forest' },
      { title: 'Admin / Billing', desc: 'Company administration, invoicing and collections', pill: 'Function', tone: 'teal', level: 2 },
      { title: 'HR', desc: 'Recruitment, records, leave and payroll inputs', pill: 'Function', tone: 'teal', level: 2 },
    ],
  },
  {
    title: 'Directorate',
    rows: [
      { title: 'Executive Director', desc: 'Reports to the Board', pill: 'Org-wide (ex. Admin/HR)', tone: 'blueprint' },
      { title: 'Associate Directors', desc: 'Oversee delivery across branches and services', pill: 'All projects · all services', tone: 'violet' },
      { title: 'Technical Director', desc: 'Technical authority for the service line', pill: 'All projects · all services', tone: 'violet' },
      { title: 'Associate Technical Directors', desc: 'Support the Technical Director', pill: 'All projects · all services', tone: 'violet', level: 2 },
    ],
  },
  {
    title: 'Project Delivery — Design Team',
    rows: [
      { title: 'Principal Team Lead (PTL)', desc: 'Owns delivery for an assigned set of projects', pill: 'Assigned projects only', tone: 'amber' },
      { title: 'Senior Team Lead', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Senior Design Engineer', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Design Engineer', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Junior Engineer', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Trainee Engineer', pill: 'Assigned projects only', tone: 'amber', level: 2 },
    ],
  },
  {
    title: 'Project Delivery — Drafting Team',
    rows: [
      { title: 'Drafting Team Lead', desc: 'Mirrors the PTL structure, for drafting', pill: 'Assigned projects only', tone: 'amber' },
      { title: 'Senior Draftsman', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Draftsman', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Junior Draftsman', pill: 'Assigned projects only', tone: 'amber', level: 2 },
      { title: 'Trainee Draftsman', pill: 'Assigned projects only', tone: 'amber', level: 2 },
    ],
  },
  {
    title: 'Coordination',
    rows: [
      { title: 'Coordinator (SPOC)', desc: 'Single point of contact to client, architect and internal teams', pill: 'Assigned projects only', tone: 'amber' },
    ],
  },
  {
    title: 'Functions & Departments',
    rows: [
      { title: 'Peer Review', desc: 'Independent cross-discipline design review', pill: 'Function · cross-project', tone: 'teal' },
      { title: 'BIM', desc: 'Federated modelling and clash coordination', pill: 'Function · assigned projects', tone: 'teal' },
      { title: 'QS', desc: 'Quantity surveying, BOQ and area settlement', pill: 'Function · assigned projects', tone: 'teal' },
      { title: 'QA/QC', desc: 'Site quality inspection and audits', pill: 'Function · assigned projects', tone: 'teal' },
      { title: 'GBS', desc: 'Green building certification — feasibility through commissioning', pill: 'Function · assigned projects', tone: 'teal' },
    ],
  },
];

const POLICY_PANELS = [
  {
    id: 'founding', title: 'Founding Director · Working Director', sub: 'Complete organizational visibility',
    items: [
      ['Admin / Billing', 'Full — view / add / edit / approve', 'forest'],
      ['HR', 'Full — view / add / edit / approve', 'forest'],
      ['Project Details', 'Full', 'forest'],
      ['Client & Architect Details', 'Full', 'forest'],
      ['Work Orders', 'Full', 'forest'],
      ['Project Team Details', 'Full', 'forest'],
      ['Project Status', 'Full', 'forest'],
      ['Revision Logs', 'Full', 'forest'],
      ['Drawing Register', 'Full', 'forest'],
      ['Transmittals', 'Full', 'forest'],
      ['Travel Log', 'Full — view / approve, company-wide', 'forest'],
    ],
  },
  {
    id: 'exec', title: 'Executive Director', sub: 'Full view access to all employees, departments, projects and organizational information',
    items: [
      ['Admin / Billing', 'View', 'blueprint'],
      ['HR', 'View', 'blueprint'],
      ['Project Details', 'View', 'blueprint'],
      ['Transmittals, Completion Certificates', 'View', 'blueprint'],
      ['Management reports', 'View', 'blueprint'],
      ['Travel Log', 'View + approve', 'blueprint'],
    ],
  },
  {
    id: 'assoc', title: 'Associate Director · Technical Director · Associate Technical Director', sub: 'All projects, across all services',
    items: [
      ['Project Details', 'View', 'violet'],
      ['Project Status', 'View + technical approve', 'violet'],
      ['Revision Logs', 'View + approve', 'violet'],
      ['Drawing Register', 'View + approve', 'violet'],
      ['Admin / Billing & HR', 'No access', 'neutral'],
    ],
  },
  {
    id: 'admin', title: 'Admin / Billing', sub: '',
    items: [
      ['Admin / Billing', 'Full — view / add / edit / approve', 'forest'],
      ['Project Details, Work Orders & Client Details', 'View', 'blueprint'],
      ['Transmittals, Revision Logs & PTL Details', 'View', 'blueprint'],
      ['Completion Certificates', 'View', 'blueprint'],
      ['Travel Log', 'View + settle expenses', 'blueprint'],
    ],
  },
  {
    id: 'hr', title: 'HR', sub: '',
    items: [
      ['HR', 'Full — view / add / edit / approve', 'forest'],
      ['Project Team Details', 'View (headcount / roster)', 'blueprint'],
      ['Leave requests', 'Full — view / add / edit / approve', 'forest'],
      ['Travel Log', 'View + approve', 'blueprint'],
    ],
  },
  {
    id: 'design', title: 'Design Team — PTL → Trainee Engineer', sub: 'Identical access, scoped to assigned projects',
    items: [
      ['Project Details', 'View — assigned projects only', 'amber'],
      ['Revision Logs', 'PTL: add/edit · team: view', 'amber'],
      ['Drawing Register', 'PTL: add/edit · team: view', 'amber'],
      ['Travel Log', 'Add · PTL also approves for own team', 'amber'],
    ],
  },
  {
    id: 'draft', title: 'Drafting Team — Lead → Trainee Draftsman', sub: 'Same access pattern as the Design Team',
    items: [
      ['Project Details', 'View — assigned projects only', 'amber'],
      ['Drawing Register', 'Team Lead: add/edit · others: view', 'amber'],
    ],
  },
  {
    id: 'coord', title: 'Coordinator (SPOC)', sub: '',
    items: [
      ['Project Details', 'View — assigned projects', 'amber'],
      ['Client & Architect Details', 'View + respond', 'amber'],
      ['Transmittals', 'Add / edit — assigned projects', 'amber'],
      ['Travel Log', 'Add', 'amber'],
    ],
  },
  {
    id: 'functions', title: 'QS · QA/QC · BIM · GBS · Peer Review', sub: 'Function scope, assigned projects',
    items: [
      ['QS — BOQ / area settlement', 'Add / edit', 'blueprint'],
      ['QA/QC — site visit log', 'Add / edit', 'blueprint'],
      ['BIM — federated model & clash log', 'Add / edit', 'blueprint'],
      ['GBS — certification workflow', 'Add / edit', 'blueprint'],
      ['Peer Review — review log', 'Add / edit', 'blueprint'],
      ['Travel Log', 'Add', 'amber'],
    ],
  },
  {
    id: 'client', title: 'Client · Architect', sub: 'External portal, scoped to their own project(s)',
    items: [
      ['Own project(s)', 'View', 'amber'],
      ['Drawing Register', 'View + acknowledge', 'amber'],
      ['Awaiting Response (directed to them)', 'Respond', 'amber'],
    ],
  },
];

export default function OrgStructurePage() {
  const [tab, setTab] = useState('org');
  return (
    <>
      <div className="page-head">
        <div className="page-title">Org Structure &amp; Policy</div>
        <div className="page-sub">Reporting hierarchy, functions, and what each designation can view, add, edit or approve</div>
      </div>
      <Tabs
        tabs={[
          { key: 'org', label: 'Org structure' },
          { key: 'policy', label: 'Level & approval policy' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'org' && ORG_GROUPS.map((g) => (
        <div className="org-group" key={g.title}>
          <div className="org-group-title">{g.title}</div>
          {g.rows.map((r) => (
            <div className={`org-row${r.level === 2 ? ' lvl2' : ''}`} key={r.title}>
              <div className="org-title">{r.title}</div>
              {r.desc && <div className="org-desc">{r.desc}</div>}
              <StatusPill status={r.tone}>{r.pill}</StatusPill>
            </div>
          ))}
        </div>
      ))}
      {tab === 'policy' && POLICY_PANELS.map((p) => (
        <Panel key={p.id} title={p.title} sub={p.sub}>
          {p.items.map(([label, pill, tone]) => (
            <div className="checklist-item" key={label}>
              <span>{label}</span>
              <StatusPill status={tone}>{pill}</StatusPill>
            </div>
          ))}
        </Panel>
      ))}
    </>
  );
}
