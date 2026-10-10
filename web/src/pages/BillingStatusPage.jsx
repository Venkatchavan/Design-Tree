import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);

function fmtShortDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day} ${mon} ${String(d.getFullYear()).slice(2)}`;
}

const delayLabel = (r) => ((r.delayDays ?? 0) > 0 ? `${r.delayDays} day(s) late` : 'On time');

export default function BillingStatusPage({ bootstrap }) {
  const isDirector = DIRECTOR_ROLES.has(bootstrap?.role?.key ?? '');
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
        <div className="page-sub">{isDirector
          ? 'Live from Billing\u2019s stage tracker — which stages are billed, ready for billing, or still pending, service by service'
          : 'Live billing readiness from the stage tracker.'}</div>
      </div>
      {isDirector ? (
      <div className="kpi-grid cols-3">
        <KpiCard label="Billed" value={billed} accent="forest" />
        <KpiCard label="Ready for billing" value={ready} accent="teal" />
        <KpiCard label="Pending (stage in progress)" value={pending} accent="amber" />
      </div>
      ) : (
      <div className="kpi-grid cols-4">
        <KpiCard label="Stages tracked" value={rows.length} accent="blueprint" />
        <KpiCard label="Billed" value={billed} accent="forest" />
        <KpiCard label="Ready for billing" value={ready} accent="teal" />
        <KpiCard label="Pending (stage in progress)" value={pending} accent="amber" />
      </div>
      )}
      <Panel title="Billing status by stage">
        <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          {isDirector && <span className="form-label">Filter by billing status</span>}
          <select className="filter-select" value={readiness} onChange={(e) => setReadiness(e.target.value)}>
            <option value="">{isDirector ? 'All' : 'All billing statuses'}</option>
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
              { key: 'plannedCompletion', label: 'Planned completion', render: (r) => fmtShortDate(r.plannedCompletion) },
              { key: 'currentStatus', label: 'Current status' },
              { key: 'delayDays', label: 'Delay', render: (r) => delayLabel(r) },
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
