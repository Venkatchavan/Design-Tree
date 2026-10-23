import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { CoordinationPanel } from '../components/ProjectUpdates.jsx';

export default function PeerDashboardPage() {
  const q = useQuery({
    queryKey: ['peer-dashboard'],
    queryFn: () => request('/api/projects/peer-dashboard'),
    refetchInterval: 10000,
  });
  const rows = q.data?.items ?? [];
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Peer Review dashboard</h1>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Active projects" value={q.data?.active ?? 0} />
        <KpiCard label="Assigned projects" value={rows.length} />
        <KpiCard
          label="Pending reviews"
          value={rows.reduce((n, r) => n + r.pendingReviews, 0)}
        />
      </div>
      <Panel title="Work Tracking">
        <p>Record work, revisions and peer reviews.</p>
        <Link className="btn-primary" to="/work-tracking">
          Work Tracking
        </Link>
      </Panel>
      <Panel title="Peer Review projects">
        {q.error && <p role="alert">{q.error.message}</p>}
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Project',
              render: (r) => <Link to={'/projects/' + r._id}>{r.name}</Link>,
            },
            { key: 'status', label: 'Status' },
            { key: 'currentStage', label: 'Stage' },
            { key: 'pendingReviews', label: 'Pending reviews' },
            {
              key: 'updatedAt',
              label: 'Latest update',
              render: (r) => new Date(r.updatedAt).toLocaleString(),
            },
          ]}
          rows={rows}
          emptyText={
            q.isLoading
              ? 'Loading projects…'
              : 'No assigned Peer Review projects.'
          }
        />
      </Panel>
      <CoordinationPanel service="Peer Review" />
    </>
  );
}
