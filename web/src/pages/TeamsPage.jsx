import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { teamsApi } from '../lib/api.js';
import EmptyState from '../components/EmptyState.jsx';

export default function TeamsPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const items = q.data?.items ?? [];

  return (
    <>
      <div className="page-head">
        <div className="page-title">Teams</div>
        <div className="page-sub">
          {q.isLoading ? 'Loading…' : `${q.data?.total ?? items.length} teams`}
        </div>
      </div>
      {q.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {q.error.message}
        </div>
      )}
      {q.isLoading ? (
        <EmptyState text="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState text="No teams yet." />
      ) : (
        <div className="teams-grid">
          {items.map((t) => (
            <div
              key={t.id}
              className="team-card"
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/teams/${t.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/teams/${t.id}`);
              }}
            >
              <div className="team-card-head">
                <span className="team-card-name">{t.name ?? '—'}</span>
                {t.active === false && <span className="load-badge overloaded">Inactive</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 12 }}>
                {[t.service, t.branch].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="team-card-count">{t.memberCount ?? 0}</div>
              <div className="team-card-count-label">members</div>
              <div className="deliv-label">
                {t.weekHours != null ? `${t.weekHours} hrs logged this week` : 'Week hours —'}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
