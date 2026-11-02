import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import { teamsApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProjectPulse from '../components/ProjectPulse.jsx';

const TABS = [
  { key: 'service', label: 'By project & service' },
  { key: 'project', label: 'Project-wise report' },
  { key: 'team', label: 'Project team' },
  { key: 'cost', label: 'Project cost & performance' },
];
const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const idOf = (v) => String(v?._id ?? v?.id ?? v ?? '');
const personName = (e) => [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ') || e?.empId || 'Not recorded';

// One row per project × service from saved team assignments (TL + members).
function projectTeamRows(directory, filter) {
  const people = new Map((directory?.employees ?? []).map((e) => [idOf(e), e]));
  const projects = new Map((directory?.projects ?? []).map((p) => [idOf(p), p]));
  const groups = new Map();
  for (const a of directory?.assignments ?? []) {
    const project = projects.get(a.project), person = people.get(a.employee);
    if (!project || !person) continue;
    if (filter && !String(project.name ?? '').toLowerCase().includes(filter.toLowerCase())) continue;
    const key = a.project + ':' + a.service;
    if (!groups.has(key)) groups.set(key, { key, project, service: a.service, leads: [], members: [] });
    (a.lead ? groups.get(key).leads : groups.get(key).members).push(person);
  }
  return [...groups.values()].sort((x, y) => String(x.project.name).localeCompare(String(y.project.name)) || String(x.service).localeCompare(String(y.service)));
}
const peopleText = (list) => list.length
  ? list.map((e) => `${personName(e)}${e.designation ? ` (${e.designation})` : ''}`).join(', ')
  : '—';

export default function RevenueReportsPage() {
  const [tab, setTab] = useState('service');
  const [filter, setFilter] = useState('');
  const revenue = useQuery({ queryKey: ['revenue-full'], queryFn: billingApi.revenueByProject });
  const directory = useQuery({ queryKey: ['revenue-project-team'], queryFn: () => teamsApi.directory(true), enabled: tab === 'team' });
  const teamRows = projectTeamRows(directory.data, filter);
  const rows = (revenue.data?.items ?? []).filter((r) =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div id="view-finrevenue">
      <div className="page-head">
        <div className="page-title">Revenue &amp; Financial Reports</div>
        <div className="page-sub">Service-wise financial view per project, consolidated into project-wise reports.</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <input className="form-input" style={{ maxWidth: 260 }} placeholder="Filter by project" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'service' && (
        <Panel title="By project & service">
          <DataTable
            columns={[
              { key: 'code', label: 'Job no.' },
              { key: 'name', label: 'Project' },
              { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
              { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
              { key: 'pct', label: '% collected', render: (r) => `${r.pct}%` },
            ]}
            rows={rows}
            emptyText="No revenue data yet."
          />
        </Panel>
      )}
      {tab === 'project' && (
        <Panel title="Project-wise report">
          <DataTable
            columns={[
              { key: 'code', label: 'Job no.' },
              { key: 'name', label: 'Project' },
              { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
              { key: 'invoiced', label: 'Billed (invoiced)', render: (r) => money(r.invoiced) },
              { key: 'pct', label: '% collected', render: (r) => `${r.pct}%` },
              { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) },
            ]}
            rows={rows}
            emptyText="No revenue data yet."
          />
        </Panel>
      )}
      {tab === 'team' && (
        <Panel title="Project team (by service)" sub="Saved team allocations per project and service">
          {directory.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{directory.error.message}</div>
          ) : directory.isLoading ? (
            <EmptyState text="Loading project teams…" />
          ) : (
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project.name ?? '—' },
                { key: 'service', label: 'Service' },
                { key: 'leads', label: 'Team lead', render: (r) => peopleText(r.leads) },
                { key: 'members', label: 'Team members', render: (r) => peopleText(r.members) },
                { key: 'size', label: 'Team size', render: (r) => r.leads.length + r.members.length },
              ]}
              rows={teamRows}
              emptyText="No project team allocations saved yet."
            />
          )}
        </Panel>
      )}
      {tab === 'cost' && (
        <ProjectPulse filter={filter} />
      )}
    </div>
  );
}
