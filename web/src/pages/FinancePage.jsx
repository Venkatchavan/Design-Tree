import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../lib/api.js';
import { billingApi } from '../lib/phase3Api.js';
import { leaveApi, travelApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';

const SUBTABS = [
  { key: 'travel', label: 'Travel expenses' },
  { key: 'leave', label: 'Leave approvals' },
  { key: 'hours', label: 'Login hours' },
];

const inr = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function FinancePage({ bootstrap }) {
  const [subtab, setSubtab] = useState('travel');
  const role = bootstrap?.role?.key ?? '';
  const qc = useQueryClient();
  const canDecideLeave = role === 'finance';

  // Core finance overview
  const overview = useQuery({ queryKey: ['finance-overview'], queryFn: billingApi.financeOverview });
  const stages = useQuery({ queryKey: ['billing-stages'], queryFn: () => billingApi.stages({}) });

  // Travel and leave data
  const travels = useQuery({ queryKey: ['travels-all'], queryFn: () => travelApi.list({}) });
  const employees = useQuery({ queryKey: ['employees-all'], queryFn: () => employeesApi.list({}) });
  const leaves = useQuery({ queryKey: ['leaves-all'], queryFn: () => leaveApi.list({}) });

  // Leave decision mutation
  const decideLeave = useMutation({
    mutationFn: ({ id, status, remarks }) => leaveApi.decide(id, { status, remarks: remarks || undefined }),
    onSuccess: () => {
      setLeaveDecisionError('');
      qc.invalidateQueries({ queryKey: ['leaves-all'] });
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

  const o = overview.data ?? {};
  const t = travels.data ?? {};
  const e = employees.data ?? {};
  const l = leaves.data ?? {};

  // Derived KPIs
  const travelSpendAll = (t.items ?? []).reduce((s, r) => s + (Number(r.actualExpense ?? 0) || Number(r.estExpense ?? 0)), 0);
  const pendingTravel = (t.items ?? []).filter((r) => r.status === 'Pending').length;
  const pendingSettlement = (t.items ?? []).filter((r) => r.settlementStatus && r.settlementStatus !== 'Settled').length;

  // Finance team employees and their leave requests
  const financeEmpIds = new Set(
    (e.items ?? []).filter((emp) => emp.department === 'Finance').map((emp) => String(emp._id)),
  );
  const financeLeaves = (l.items ?? []).filter((leave) =>
    financeEmpIds.has(String(leave.employee?._id ?? leave.employee ?? '')),
  );
  const pendingFinanceLeave = financeLeaves.filter((r) => !['Approved', 'Rejected'].includes(String(r.status ?? ''))).length;

  // Login hours summary
  const stageItems = stages.data?.items ?? [];
  const totalHoursToday = o.hoursToday ?? 0;
  const projectsWithActivity = new Set(stageItems.map((s) => String(s.project?._id ?? s.project ?? ''))).size;
  const stagesInProgress = stageItems.filter((s) => s.currentStatus && s.currentStatus !== 'Completed').length;
  const avgHoursPerStage = stagesInProgress > 0 ? (totalHoursToday / stagesInProgress) : 0;

  // Format date as d-mon-yy (e.g. "22 Aug")
  const fmtDateShort = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return String(d);
    }
  };

  // Format date with time (e.g. "22 Aug, 02:00 pm")
  const fmtDateTime = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return String(d);
      const day = date.getDate();
      const mon = date.toLocaleString('en-GB', { month: 'short' });
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${mon}, ${hours}:${mins} ${ampm}`;
    } catch {
      return String(d);
    }
  };

  return (
    <div id="view-finance">
      <div className="page-head">
        <div className="page-title">Finance Dashboard</div>
        <div className="page-sub">A consolidated snapshot of revenue, billing, project cost &amp; performance, travel spend and approvals across the Finance module</div>
      </div>

      {/* Primary KPI Grid */}
      <div className="kpi-grid cols-6">
        <KpiCard label="Total contract value" value={overview.isLoading ? '…' : inr(o.contractValue)} accent="blueprint" />
        <KpiCard label="Invoiced to date" value={overview.isLoading ? '…' : inr(o.invoiced)} accent="copper" />
        <KpiCard label="Received to date" value={overview.isLoading ? '…' : inr(o.received)} accent="forest" />
        <KpiCard label="% collected (of invoiced)" value={overview.isLoading ? '…' : `${o.pctCollected ?? 0}%`} accent="teal" />
        <KpiCard label="Pending approvals" value={overview.isLoading ? '…' : (o.pendingApprovals ?? 0)} accent="amber" />
        <KpiCard label="Travel spend (all depts.)" value={travels.isLoading ? '…' : inr(travelSpendAll)} accent="violet" />
      </div>
      <div className="kpi-grid cols-2">
        <KpiCard label="Hours logged today" value={overview.isLoading ? '…' : totalHoursToday} accent="violet" />
        <KpiCard label="Projects at risk / delayed" value={overview.isLoading ? '…' : (o.atRisk ?? 0)} accent="rust" />
      </div>

      {/* Pending Finance Team Leave KPIs */}
      <div className="kpi-grid cols-4" style={{ marginTop: 16 }}>
        <KpiCard label="Pending Finance team leave" value={pendingFinanceLeave} accent="amber" />
        <KpiCard label="Pending travel (all depts.)" value={pendingTravel} accent="blueprint" />
        <KpiCard label="Total travel spend (Aug)" value={inr(travelSpendAll)} accent="violet" />
        <KpiCard label="Pending settlement" value={pendingSettlement} accent="teal" />
      </div>

      {/* Subtabs */}
      <Tabs tabs={SUBTABS} active={subtab} onChange={setSubtab} />

      {/* Travel Expenses Subtab */}
      {subtab === 'travel' && (
        <>
          <Panel title="Travel expense summary" sub="Across every department, most recent first">
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
                { key: 'department', label: 'Department', render: (r) => r.employee?.department ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
                { key: 'dates', label: 'Dates', render: (r) => {
                  const dep = fmtDateShort(r.departureDate);
                  const ret = fmtDateShort(r.returnDate);
                  if (dep === '—' && ret === '—') return '—';
                  if (dep !== '—' && ret !== '—') return `${dep} – ${ret}`;
                  return dep !== '—' ? dep : ret;
                }},
                { key: 'checkIn', label: 'Check-in', render: (r) => r.lodging ? fmtDateTime(r.lodging.checkIn) : '—' },
                { key: 'checkOut', label: 'Check-out', render: (r) => r.lodging ? fmtDateTime(r.lodging.checkOut) : '—' },
                { key: 'hotel', label: 'Hotel', render: (r) => r.lodging?.hotel ?? '—' },
                { key: 'location', label: 'Location', render: (r) => r.lodging?.location ?? '—' },
                { key: 'nights', label: 'Nights', render: (r) => r.lodging?.nights != null ? r.lodging.nights : '—' },
                { key: 'hotelCost', label: 'Hotel cost', render: (r) => inr(r.lodgingAmount) },
                { key: 'advance', label: 'Advance', render: (r) => inr(r.advanceReceived) },
                { key: 'actualExpense', label: 'Actual expense', render: (r) => inr(r.actualExpense) },
                { key: 'hospitality', label: 'Hospitality (client-arr.)', render: (r) => inr(r.hospitalityAmount) },
                { key: 'balance', label: 'Balance', render: (r) => inr(r.balance) },
                { key: 'settlement', label: 'Settlement', render: (r) => r.settlementStatus ?? '—' },
              ]}
              rows={(t.items ?? []).sort((a, b) => {
                const da = new Date(a.createdAt ?? a.departureDate ?? '');
                const db = new Date(b.createdAt ?? b.departureDate ?? '');
                return db - da;
              })}
              emptyText="No travel expenses recorded yet."
            />
          </Panel>
        </>
      )}

      {/* Leave Approvals Subtab */}
      {subtab === 'leave' && (
        <>
          <Panel title="Finance team - leave requests" sub="Pending leave requests from employees working under the Finance department">
            {(leaveDecisionError || decideLeave.isError) && <div className="login-error" role="alert" style={{ display: 'block' }}>{leaveDecisionError || decideLeave.error.message}</div>}
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
                { key: 'designation', label: '', render: (r) => r.employee?.designation ?? '—' },
                { key: 'leaveType', label: 'Type' },
                { key: 'from', label: 'From', render: (r) => r.from ? new Date(r.from).toLocaleDateString('en-GB') : '—' },
                { key: 'to', label: 'To', render: (r) => r.to ? new Date(r.to).toLocaleDateString('en-GB') : '—' },
                { key: 'days', label: 'Days' },
                { key: 'reason', label: 'Reason' },
                {
                  key: 'actions', label: '',
                  render: (r) => canDecideLeave && !['Approved', 'Rejected'].includes(String(r.status ?? '')) ? (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => approveLeave(r._id)}>Approve</button>
                      <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => rejectLeave(r._id)}>Reject</button>
                    </span>
                  ) : '—',
                },
              ]}
              rows={financeLeaves}
              emptyText="No finance team leave requests."
            />
          </Panel>
        </>
      )}

      {/* Login Hours Subtab */}
      {subtab === 'hours' && (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid cols-4" style={{ marginBottom: 16 }}>
            <KpiCard label="Total hours logged today" value={totalHoursToday.toFixed(1)} accent="violet" />
            <KpiCard label="Projects with activity" value={projectsWithActivity} accent="forest" />
            <KpiCard label="Stages in progress" value={stagesInProgress} accent="blueprint" />
            <KpiCard label="Avg. hours / stage" value={avgHoursPerStage.toFixed(1)} accent="teal" />
          </div>

          <Panel title="Login hours by project and stage" sub="HR-sourced hours, by project and design stage — the same data feeding Man-Hours & Cost in Project Cost & Performance">
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
                { key: 'stage', label: 'Stage' },
                { key: 'employeesLoggedIn', label: 'Employees logged in', render: (r) => r.employees ?? '—' },
                { key: 'totalHours', label: 'Total hours', render: (r) => r.hours?.toFixed(1) ?? '—' },
                { key: 'avgHoursPerEmployee', label: 'Avg. hours / employee', render: (r) => {
                  const h = Number(r.hours ?? 0);
                  const e = Number(r.employees ?? 0);
                  return e > 0 ? (h / e).toFixed(1) : '—';
                }},
              ]}
              rows={stageItems}
              emptyText="No stage activity recorded."
            />
          </Panel>
        </>
      )}
    </div>
  );
}

