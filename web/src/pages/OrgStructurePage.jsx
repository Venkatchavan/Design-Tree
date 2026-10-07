import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';

const ORG_CARDS = [
  { title: 'Founding / Working Directors', body: 'Full access (SUPER). Final approval on policy, recruitment, finance and closures.' },
  { title: 'Executive Leadership', body: 'Directors and senior managers driving branches, P&L and delivery.' },
  { title: 'Associate / Technical Directors', body: 'Technical governance, design review and scoped approvals for their teams.' },
  { title: 'Team Leads (PTL)', body: 'Own project teams, allocate work, review submissions and raise recruitment needs.' },
  { title: 'Drafting ladder', body: 'Senior → Junior drafters and trainees. Execute drawings, revisions and site inputs.' },
  { title: 'Project Coordinator (SPOC)', body: 'Single point of contact per project: directory, daily updates, meetings and client coordination.' },
  { title: 'Quantity Surveying (QS)', body: 'Measurement, billing quantities and rate analysis supporting Billing.' },
  { title: 'QA / QC', body: 'Quality checks on drawings, GFC releases and site execution.' },
  { title: 'BIM cell', body: 'Model authoring, clash detection and BIM orders.' },
  { title: 'GBS cell', body: 'Green building certification scope and documentation.' },
  { title: 'Peer review', body: 'Independent design review before issue.' },
  { title: 'Admin / Billing', body: 'Logins for a subset of users, billing stages, claims and collections.' },
  { title: 'HR', body: 'Directory, headcount, track records, recruitment and employee support.' },
  { title: 'Client / Architect (portal)', body: 'View-only portal: project details, stages, drawings to acknowledge and certificates.' },
];

const POLICY_ROWS = [
  { designation: 'Founding / Working Director', view: 'All', add: 'All', edit: 'All', approve: 'All' },
  { designation: 'Executive / Director', view: 'Branch + assigned', add: 'Projects, teams', edit: 'Assigned', approve: 'Branch scope' },
  { designation: 'Technical / Associate Technical Director', view: 'Assigned services', add: 'Tasks, revisions', edit: 'Assigned', approve: 'Scoped team' },
  { designation: 'Team Lead (PTL)', view: 'Own team + projects', add: 'Tasks, recruitment', edit: 'Own team', approve: 'Own team submissions' },
  { designation: 'Senior Engineer / Drafter', view: 'Own work', add: 'Progress, revisions', edit: 'Own entries', approve: '—' },
  { designation: 'Junior Engineer / Drafter', view: 'Own work', add: 'Progress', edit: 'Own entries', approve: '—' },
  { designation: 'Coordinator (SPOC)', view: 'Allocated projects', add: 'Allocations, entries, meetings', edit: 'Own entries', approve: '—' },
  { designation: 'QS / QA-QC / BIM / GBS', view: 'Assigned projects', add: 'Functional records', edit: 'Own records', approve: 'Functional sign-off' },
  { designation: 'Admin / Billing', view: 'Billing + directory', add: 'Claims, stages', edit: 'Billing records', approve: 'Billing (non-technical)' },
  { designation: 'HR', view: 'Directory + support', add: 'Employees, holidays, support updates', edit: 'Employee records', approve: 'HR workflows' },
  { designation: 'Finance', view: 'Billing + travel/allowance', add: 'Payments', edit: 'Finance records', approve: 'Travel + allowance' },
  { designation: 'Client / Architect', view: 'Own projects (portal)', add: 'Acknowledgements, uploads', edit: '—', approve: '—' },
];

export default function OrgStructurePage({ bootstrap, user, viewKey }) {
  const [tab, setTab] = useState('org');
  return (
    <>
      <div className="page-head">
        <div className="page-title">Organisation</div>
        <div className="page-sub">Static reference — roles, ladders and approval policy.</div>
      </div>
      <Tabs
        tabs={[
          { key: 'org', label: 'Org structure' },
          { key: 'policy', label: 'Level & approval policy' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'org' && (
        <Panel title="Org structure (reference)">
          <div className="teams-grid">
            {ORG_CARDS.map((c) => (
              <div className="team-card" key={c.title}>
                <div className="team-card-head"><span className="team-card-name">{c.title}</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {tab === 'policy' && (
        <Panel title="Level & approval policy (§3.4 reference)">
          <DataTable
            columns={[
              { key: 'designation', label: 'Designation' },
              { key: 'view', label: 'View' },
              { key: 'add', label: 'Add' },
              { key: 'edit', label: 'Edit' },
              { key: 'approve', label: 'Approve' },
            ]}
            rows={POLICY_ROWS}
            emptyText="No policy rows."
          />
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 10 }}>
            Reference matrix only. Enforcement lives server-side per role; this table documents intent.
          </p>
        </Panel>
      )}
    </>
  );
}
