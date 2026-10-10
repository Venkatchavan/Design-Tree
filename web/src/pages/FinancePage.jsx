import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../lib/api.js';
import { billingApi, bookingsApi } from '../lib/phase3Api.js';
import { leaveApi, travelApi } from '../lib/phase4bApi.js';
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

export default function FinancePage({ bootstrap }) {
  const [tab, setTab] = useState('travel');
  const role = bootstrap?.role?.key ?? '';
  const qc = useQueryClient();
  const canDecideLeave = role === 'finance' || role === 'hr' || role === 'founding_director' || role === 'working_director';
  const overview = useQuery({ queryKey: ['finance-overview'], queryFn: billingApi.financeOverview });
  const revenue = useQuery({ queryKey: ['revenue-by-project'], queryFn: billingApi.revenueByProject });
  const costs = useQuery({ queryKey: ['project-costs'], queryFn: billingApi.projectCosts });
  const hours = useQuery({
    queryKey: ['finance-hours'],
    queryFn: () => billingApi.stages({}),
  });
  const bookings = useQuery({ queryKey: ['bookings-finance'], queryFn: () => bookingsApi.list({}) });
  const settlements = useQuery({ queryKey: ['travel-settlements'], queryFn: () => travelApi.list({}) });
  const employees = useQuery({ queryKey: ['employees-finance'], queryFn: () => employeesApi.list({}) });
  const leaves = useQuery({ queryKey: ['finance-leaves'], queryFn: () => leaveApi.list({}) });
  const decideLeave = useMutation({
    mutationFn: ({ id, status, remarks }) => leaveApi.decide(id, { status, remarks: remarks || undefined }),
    onSuccess: () => {
      setLeaveDecisionError('');
      qc.invalidateQueries({ queryKey: ['finance-leaves'] });
    },
  });
  const [leaveRemarks, setLeaveRemarks] = useState('');
  const [leaveDecisionError, setLeaveDecisionError] = useState('');

  function approveLeave(id) {
    setLeaveDecisionError('');
    decideLeave.mutate({ id, status: 'Approved', remarks: leaveRemarks.trim() || undefined });
  }

  function rejectLeave(id) {
    if (!leaveRemarks.trim()) {
      setLeaveDecisionError('A reason is required when rejecting leave.');
      return;
    }
    setLeaveDecisionError('');
    decideLeave.mutate({ id, status: 'Rejected', remarks: leaveRemarks.trim() });
  }
  const financeEmpIds = new Set(
    (employees.data?.items ?? []).filter((e) => e.department === 'Finance').map((e) => String(e._id)),
  );
  const financeLeaves = (leaves.data?.items ?? []).filter((r) =>
    financeEmpIds.has(String(r.employee?._id ?? r.employee ?? '')),
  );
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
        <>
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
              emptyText="No travel bookings yet."
            />
          </Panel>
          <Panel title="Settled travel expenses">
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
                { key: 'advance', label: 'Advance received', render: (r) => money(r.advanceReceived) },
                { key: 'actual', label: 'Actual expense', render: (r) => money(r.actualExpense) },
                { key: 'hospitality', label: 'Hospitality', render: (r) => (r.hospitality ? 'Client-arranged (excluded)' : money(0)) },
                { key: 'balance', label: 'Balance', render: (r) => money(r.balance) },
                { key: 'settlement', label: 'Settlement', render: (r) => r.settlementStatus ?? '—' },
              ]}
              rows={(settlements.data?.items ?? []).filter((r) => (r.actualExpense ?? 0) > 0 || r.settlementStatus)}
              emptyText="No settled travel expenses yet. Employees settle trips in Leave & Travel."
            />
          </Panel>
        </>
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
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label className="form-label">Decision remarks (required to reject)</label>
            <input
              className="form-input"
              value={leaveRemarks}
              onChange={(e) => setLeaveRemarks(e.target.value)}
              placeholder="Reason for approval or rejection"
            />
          </div>
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'leaveType', label: 'Type' },
              { key: 'from', label: 'From', render: (r) => r.from ? new Date(r.from).toLocaleDateString() : '—' },
              { key: 'to', label: 'To', render: (r) => r.to ? new Date(r.to).toLocaleDateString() : '—' },
              { key: 'days', label: 'Days' },
              { key: 'reason', label: 'Reason' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              {
                key: 'actions', label: 'Action',                 render: (r) => canDecideLeave && r.status === 'Pending' ? (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => approveLeave(r._id)}>Approve</button>
                    <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => rejectLeave(r._id)}>Reject</button>
                  </span>
                ) : '—',
              },
            ]}
            rows={financeLeaves}
            emptyText="No finance team leave requests. Other departments are actioned in Leave & Travel → Approvals."
          />
          {(leaveDecisionError || decideLeave.isError) && <div className="login-error" role="alert" style={{ display: 'block' }}>{leaveDecisionError || decideLeave.error.message}</div>}
        </Panel>
      )}
    </div>
  );
}
