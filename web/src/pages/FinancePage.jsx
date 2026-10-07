import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi, bookingsApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'travel', label: 'Travel expenses' },
  { key: 'hours', label: 'Login hours' },
  { key: 'costs', label: 'Project cost & performance' },
  { key: 'leave', label: 'Leave approvals' },
];
const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function FinancePage() {
  const [tab, setTab] = useState('travel');
  const overview = useQuery({ queryKey: ['finance-overview'], queryFn: billingApi.financeOverview });
  const revenue = useQuery({ queryKey: ['revenue-by-project'], queryFn: billingApi.revenueByProject });
  const costs = useQuery({ queryKey: ['project-costs'], queryFn: billingApi.projectCosts });
  const hours = useQuery({
    queryKey: ['finance-hours'],
    queryFn: () => billingApi.stages({}),
  });
  const bookings = useQuery({ queryKey: ['bookings-finance'], queryFn: () => bookingsApi.list({}) });
  const o = overview.data ?? {};

  return (
    <div id="view-finance">
      <div className="page-head">
        <div className="page-title">Finance Dashboard</div>
        <div className="page-sub">Revenue, billing, project cost, travel spend and approvals across the Finance module.</div>
      </div>
      <div className="kpi-grid cols-6">
        <KpiCard label="Total contract value" value={money(o.contractValue)} accent="blueprint" />
        <KpiCard label="Invoiced to date" value={money(o.invoiced)} accent="copper" />
        <KpiCard label="Received to date" value={money(o.received)} accent="forest" />
        <KpiCard label="% collected" value={`${o.pctCollected ?? 0}%`} accent="teal" />
        <KpiCard label="Pending approvals" value={o.pendingApprovals ?? 0} accent="amber" />
        <KpiCard label="Hours logged today" value={o.hoursToday ?? 0} accent="violet" />
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Travel spend (all departments)" value="—" accent="neutral" />
        <KpiCard label="Projects at risk / delayed" value={o.atRisk ?? 0} accent="rust" />
        <KpiCard label="Ready for billing" value={o.ready ?? 0} accent="forest" />
        <KpiCard label="Billing pending" value={o.pending ?? 0} accent="amber" />
      </div>

      <Panel title="Revenue by project">
        <DataTable
          columns={[
            { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br /><span className="proj-code">{r.code}</span></> },
            { key: 'contract', label: 'Contract value', render: (r) => money(r.contract) },
            { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
            { key: 'pct', label: '% collected', render: (r) => `${r.pct}%` },
          ]}
          rows={(revenue.data?.items ?? []).slice(0, 8)}
          emptyText="No revenue data yet."
        />
        <a href="/finance/revenue" style={{ fontSize: 12.5 }}>Full report →</a>
      </Panel>

      <Panel title="Billing status">
        <DataTable
          columns={[
            { key: 'name', label: 'Project' },
            { key: 'invoiced', label: 'Invoiced', render: (r) => money(r.invoiced) },
            { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) },
          ]}
          rows={(revenue.data?.items ?? []).slice(0, 8)}
          emptyText="No billing data yet."
        />
        <a href="/finance/billing-status" style={{ fontSize: 12.5 }}>View all →</a>
      </Panel>

      <Panel title="Project cost & performance snapshot">
        <DataTable
          columns={[
            { key: 'name', label: 'Project' },
            { key: 'status', label: 'Status', render: () => '—' },
            { key: 'budget', label: 'Quoted fee', render: (r) => money(r.budget) },
            { key: 'utilizedPct', label: 'Budget utilised', render: (r) => `${r.utilizedPct}%` },
            { key: 'variance', label: 'Cost variance', render: (r) => money(r.variance) },
          ]}
          rows={(costs.data?.items ?? []).slice(0, 8)}
          emptyText="No cost data yet."
        />
        <a href="/finance/revenue" style={{ fontSize: 12.5 }}>Open tracker →</a>
      </Panel>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'travel' && (
        <Panel title="Travel expense summary">
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'dates', label: 'Dates', render: (r) => `${r.departureDate ? new Date(r.departureDate).toLocaleDateString() : '—'} → ${r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '—'}` },
              { key: 'hotel', label: 'Hotel' },
              { key: 'nights', label: 'Nights' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
            ]}
            rows={bookings.data?.items ?? []}
            emptyText="No travel bookings yet. Detailed expense settlement arrives with Leave & Travel in Phase 4."
          />
        </Panel>
      )}
      {tab === 'hours' && (
        <Panel title="Login hours by project and stage">
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'stage', label: 'Stage' },
              { key: 'billingReadiness', label: 'Activity', render: (r) => r.currentStatus ?? '—' },
            ]}
            rows={hours.data?.items ?? []}
            emptyText="No stage activity recorded."
          />
        </Panel>
      )}
      {tab === 'costs' && (
        <Panel title="Project cost summary">
          <DataTable
            columns={[
              { key: 'name', label: 'Project' },
              { key: 'manHours', label: 'Total man-hours' },
              { key: 'labourCost', label: 'Labour cost', render: (r) => money(r.labourCost) },
              { key: 'budget', label: 'Budget', render: (r) => money(r.budget) },
              { key: 'utilizedPct', label: 'Utilised %', render: (r) => `${r.utilizedPct}%` },
              { key: 'variance', label: 'Variance', render: (r) => money(r.variance) },
            ]}
            rows={costs.data?.items ?? []}
            emptyText="Log work hours to build cost data. Set employee hourly rates in HR."
          />
        </Panel>
      )}
      {tab === 'leave' && (
        <Panel title="Finance leave approvals">
          <EmptyState text="Finance team leave requests will appear here when Leave & Travel arrives in Phase 4." />
        </Panel>
      )}
    </div>
  );
}
