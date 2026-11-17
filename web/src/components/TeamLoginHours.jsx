import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../lib/api.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';

function fmtTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Login hours of the people on the Team Lead's / PTL's team (the API limits the
// list to that team).
export default function TeamLoginHours() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: ['team-login-hours', date],
    queryFn: () => attendanceApi.list({ date }),
  });
  const rows = q.data?.items ?? [];
  return (
    <Panel title="Login hours" sub="Sign-in / sign-out and hours worked by the employees on my team">
      <div className="form-row" style={{ maxWidth: 260, marginBottom: 12 }}>
        <label className="form-label">Date</label>
        <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {q.isLoading ? (
        <EmptyState text="Loading…" />
      ) : q.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => (r.employee ? [r.employee.firstName, r.employee.lastName].filter(Boolean).join(' ') || '—' : '—') },
            { key: 'date', label: 'Date', render: (r) => r.date ?? '—' },
            { key: 'loginAt', label: 'Sign-in', render: (r) => fmtTime(r.loginAt) },
            { key: 'logoutAt', label: 'Sign-out', render: (r) => fmtTime(r.logoutAt) },
            {
              key: 'duration', label: 'Hours', render: (r) =>
                (r.loginAt && r.logoutAt ? Number(((new Date(r.logoutAt) - new Date(r.loginAt)) / 3600000).toFixed(1)) : '—'),
            },
            { key: 'lateReason', label: 'Late reason', render: (r) => r.lateReason ?? '—' },
            { key: 'earlyLogoutReason', label: 'Early-out reason', render: (r) => r.earlyLogoutReason ?? '—' },
          ]}
          rows={rows}
          emptyText="No sign-ins recorded for my team on this date."
        />
      )}
    </Panel>
  );
}
