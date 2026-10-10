import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { projectsApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Only Admin may create projects. Directors are read-only (also enforced
// server-side: denyRoles blocks FD/WD/ED on project writes).
const CREATOR_ROLES = new Set(['admin_billing']);

const STATUS_KPIS = [
  { key: 'active', label: 'Active', accent: 'forest' },
  { key: 'onHold', label: 'On hold', accent: 'amber' },
  { key: 'completed', label: 'Completed', accent: 'violet' },
];

export default function DashboardPage({ bootstrap }) {
  const navigate = useNavigate();
  const roleKey = bootstrap?.role?.key;
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');

  const statsQuery = useQuery({ queryKey: ['projects-stats'], queryFn: projectsApi.stats });
  const filtersQuery = useQuery({ queryKey: ['projects-filters'], queryFn: projectsApi.filters });
  const listQuery = useQuery({
    queryKey: ['projects', { search, branch, service, status }],
    queryFn: () => projectsApi.list({ search, branch, service, status }),
  });

  const stats = statsQuery.data;
  const counts = stats?.counts ?? {};
  const branches = stats?.branches ?? [];
  const byStage = stats?.byStage ?? [];
  const services = stats?.services ?? [];
  const totals = stats?.totals ?? {};
  const filters = filtersQuery.data;

  const active = counts.active ?? 0;
  const branchCount = totals.branches ?? branches.length ?? 0;

  const stageChart = useMemo(
    () => ({
      labels: byStage.map((s) => s.stage ?? '—'),
      datasets: [
        {
          label: 'Projects',
          data: byStage.map((s) => s.count ?? 0),
          backgroundColor: '#1D68D6',
        },
      ],
    }),
    [byStage],
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? items.length;

  const newProjectPath = bootstrap?.views?.['new-project']?.path ?? '/projects/new';
  const canCreate = CREATOR_ROLES.has(roleKey);

  return (
    <>
      <div className="page-head">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">
          {statsQuery.isLoading
            ? 'Loading live project data…'
            : `${active} active engagements across ${branchCount} branches`}
        </div>
      </div>

      {statsQuery.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {statsQuery.error.message}
        </div>
      )}

      <div className="kpi-grid cols-3">
        {STATUS_KPIS.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={counts[k.key] ?? 0}
            accent={k.accent}
            open={status === k.key}
            onClick={() => setStatus((s) => (s === k.key ? '' : k.key))}
          >
            <div className="kpi-drop-row">
              <span>Filter projects table</span>
              <b>{status === k.key ? 'On — click to clear' : 'Click card to filter'}</b>
            </div>
          </KpiCard>
        ))}
      </div>



      <Panel title="Branches">
        {branches.length === 0 ? (
          <EmptyState text={statsQuery.isLoading ? 'Loading…' : 'No branch data yet.'} />
        ) : (
          <div className="branch-row">
            {branches.map((b) => (
              <div
                key={b.branch}
                className={`branch-card${branch === b.branch ? ' selected' : ''}`}
                onClick={() => setBranch((cur) => (cur === b.branch ? '' : b.branch))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setBranch((cur) => (cur === b.branch ? '' : b.branch));
                  }
                }}
              >
                <div className="branch-head">
                  <span className="branch-name">{b.branch}</span>
                </div>
                <div className="branch-stats">
                  <div>
                    <span className="branch-stat-value">{b.projects ?? 0}</span>
                    <span className="branch-stat-label">Projects</span>
                  </div>
                  <div>
                    <span className="branch-stat-value">
                      {b.avgCompletion != null ? `${b.avgCompletion}%` : '—'}
                    </span>
                    <span className="branch-stat-label">Avg completion</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Projects by stage">
        {byStage.length === 0 ? (
          <EmptyState text="No stage data yet." />
        ) : (
          <div className="chart-wrap">
            <Bar
              data={stageChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              }}
            />
          </div>
        )}
      </Panel>

      <Panel title={`Projects (${total})`}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ maxWidth: 240 }}
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All branches</option>
            {(filters?.branches ?? branches.map((b) => b.branch)).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select className="filter-select" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">All services</option>
            {(filters?.services ?? services.map((s) => s.service)).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {status && (
            <button type="button" className="approve-btn" onClick={() => setStatus('')}>
              Clear status: {status} ✕
            </button>
          )}
          {canCreate && (
            <button type="button" className="btn-primary" onClick={() => navigate(newProjectPath)}>
              New project
            </button>
          )}
        </div>
        {listQuery.isLoading ? (
          <EmptyState text="Loading…" />
        ) : listQuery.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {listQuery.error.message}
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Project',
                render: (r) => (
                  <>
                    <div className="proj-name">{r.name ?? '—'}</div>
                    <div className="proj-code">{r.code ?? ''}</div>
                  </>
                ),
              },
              { key: 'branch', label: 'Branch' },
              { key: 'clientName', label: 'Client' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill>
                ),
              },
              {
                key: 'completion',
                label: 'Completion',
                render: (r) => (r.completion != null ? `${r.completion}%` : '—'),
              },
              { key: 'currentStage', label: 'Stage' },
            ]}
            rows={items}
            emptyText="No projects match these filters."
            onRowClick={(r) => navigate(`/projects/${r._id}`)}
          />
        )}
      </Panel>
    </>
  );
}
