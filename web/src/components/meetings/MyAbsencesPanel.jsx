import { useQuery } from '@tanstack/react-query';
import { meetingsApi } from '../../lib/phase4bApi.js';
import Panel from '../Panel.jsx';
import DataTable from '../DataTable.jsx';
import EmptyState from '../EmptyState.jsx';
import { fmtDay } from '../../lib/meetingsLogic.js';

// The signed-in employee's own meeting absences (attendance marked
// "Not attended" on held meetings), shown on their own dashboard.
export function useMyAbsences() {
  return useQuery({
    queryKey: ['absence-log', 'mine'],
    queryFn: () => meetingsApi.absenceLog({ mine: true }),
    refetchInterval: 60000,
  });
}

function projectLabel(p) {
  if (!p || typeof p !== 'object') return '—';
  return [p.code, p.name].filter(Boolean).join(' - ') || '—';
}

export default function MyAbsencesPanel({ query }) {
  const own = useMyAbsences();
  const q = query ?? own;
  const items = q.data?.items ?? [];
  return (
    <Panel title="My absences" sub={`${items.length} meeting${items.length === 1 ? '' : 's'} marked not attended`}>
      {q.isLoading ? <EmptyState text="Loading…" /> : q.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDay(r.date) },
            { key: 'project', label: 'Project', render: (r) => projectLabel(r.project) },
            { key: 'meeting', label: 'Meeting', render: (r) => `${r.meeting?.momNo ? `${r.meeting.momNo} · ` : ''}${r.meeting?.title ?? '—'}` },
            { key: 'type', label: 'Type', render: (r) => r.meeting?.type ?? '—' },
            { key: 'reason', label: 'Reason', render: (r) => r.reason || 'Not given' },
          ]}
          rows={items}
          emptyText="No absences recorded."
        />
      )}
    </Panel>
  );
}
