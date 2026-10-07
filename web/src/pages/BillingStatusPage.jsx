import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function BillingStatusPage() {
  const [readiness, setReadiness] = useState('');
  const stages = useQuery({
    queryKey: ['billing-status-stages', readiness],
    queryFn: () => billingApi.stages({ readiness }),
  });
  const rows = stages.data?.items ?? [];
  const billed = rows.filter((r) => r.billingReadiness === 'Billed').length;
  const ready = rows.filter((r) => r.billingReadiness === 'Ready for billing').length;
  const pending = rows.filter((r) => r.billingReadiness === 'Pending').length;

  return (
    <div id="view-finbilling">
      <div className="page-head">
        <div className="page-title">Billing Status</div>
        <div className="page-sub">Live billing readiness from the stage tracker.</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Stages tracked" value={rows.length} accent="blueprint" />
        <KpiCard label="Billed" value={billed} accent="forest" />
        <KpiCard label="Ready for billing" value={ready} accent="teal" />
        <KpiCard label="Pending (stage in progress)" value={pending} accent="amber" />
      </div>
      <Panel title="Billing status by stage">
        <div style={{ marginBottom: 12 }}>
          <select className="filter-select" value={readiness} onChange={(e) => setReadiness(e.target.value)}>
            <option value="">All billing statuses</option>
            <option>Billed</option>
            <option>Ready for billing</option>
            <option>Pending</option>
          </select>
        </div>
        {stages.isLoading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'service', label: 'Service' },
              { key: 'stage', label: 'Stage' },
              { key: 'plannedCompletion', label: 'Planned completion', render: (r) => r.plannedCompletion ? new Date(r.plannedCompletion).toLocaleDateString() : '—' },
              { key: 'currentStatus', label: 'Current status' },
              { key: 'delayDays', label: 'Delay' },
              { key: 'billingReadiness', label: 'Billing status', render: (r) => <StatusPill status={r.billingReadiness}>{r.billingReadiness}</StatusPill> },
            ]}
            rows={rows}
            emptyText="No stage readiness records yet."
          />
        )}
      </Panel>
    </div>
  );
}
