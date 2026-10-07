import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'service', label: 'By project & service' },
  { key: 'project', label: 'Project-wise report' },
  { key: 'team', label: 'Project team' },
  { key: 'cost', label: 'Project cost & performance' },
];
const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function RevenueReportsPage() {
  const [tab, setTab] = useState('service');
  const [filter, setFilter] = useState('');
  const revenue = useQuery({ queryKey: ['revenue-full'], queryFn: billingApi.revenueByProject });
  const costs = useQuery({ queryKey: ['costs-full'], queryFn: billingApi.projectCosts });
  const rows = (revenue.data?.items ?? []).filter((r) =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const costRows = (costs.data?.items ?? []).filter((r) =>
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
        <Panel title="Project team (by service)">
          <EmptyState text="Team-by-service mapping will be enriched when project team assignments arrive with My Team data." />
        </Panel>
      )}
      {tab === 'cost' && (
        <Panel title="Project cost & performance">
          <DataTable
            columns={[
              { key: 'name', label: 'Project' },
              { key: 'manHours', label: 'Man-hours' },
              { key: 'labourCost', label: 'Labour cost', render: (r) => money(r.labourCost) },
              { key: 'budget', label: 'Budget', render: (r) => money(r.budget) },
              { key: 'utilizedPct', label: 'Utilised %', render: (r) => `${r.utilizedPct}%` },
              { key: 'variance', label: 'Cost variance', render: (r) => money(r.variance) },
            ]}
            rows={costRows}
            emptyText="Log work hours to build cost data. Set employee hourly rates in HR."
          />
        </Panel>
      )}
    </div>
  );
}
