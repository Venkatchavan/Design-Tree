import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workEntriesApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
}

function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}

export default function AdminWorkUpdatePage({ bootstrap, user }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');

  const listQ = useQuery({
    queryKey: ['admin-work-entries'],
    queryFn: () => workEntriesApi.list({}),
  });
  const rows = [...(listQ.data?.items ?? [])].sort((a, b) =>
    String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? '')),
  );

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-entries'] });
      setHours('');
      setNotes('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  function submit(e) {
    e.preventDefault();
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      setErr('Hours must be greater than 0.');
      return;
    }
    setErr('');
    create.mutate({ hours: h, date: date || undefined, notes: notes.trim() || undefined });
  }

  const displayName = user?.name ?? bootstrap?.user?.name ?? 'Admin user';
  const designation = bootstrap?.role?.designation ?? bootstrap?.role?.label ?? '';

  return (
    <div id="view-update-work">
      <div className="page-head">
        <div className="page-title">Update Work Progress</div>
        <div className="page-sub">{displayName}{designation ? ` · ${designation}` : ''}</div>
      </div>
      <Panel title="Today's work update" sub="Log your hours and describe the work done today">
        <form onSubmit={submit}>
          <div className="form-row" style={{ maxWidth: 260 }}>
            <label className="form-label">Hours worked</label>
            <input className="form-input" type="number" min="0" step="0.5" placeholder="e.g. 8" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="form-row" style={{ maxWidth: 260 }}>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Work done today</label>
            <textarea className="form-input" placeholder="Describe the work you completed today" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : "Submit today's update"}
          </button>
        </form>
      </Panel>
      <Panel title="My submissions" sub="Everyone's updates logged from this page, most recent first">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'wuNo', label: 'WU no.', render: (r) => r.wuNo ?? r.refNo ?? '—' },
              { key: 'date', label: 'Date', render: (r) => r.date ? String(r.date).slice(0, 10) : '—' },
              { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
              { key: 'deliverable', label: 'Deliverable', render: (r) => r.deliverable ?? '—' },
              { key: 'taskActivity', label: 'Task / Activity', render: (r) => r.taskActivity ?? '—' },
              { key: 'drawing', label: 'Drawing', render: (r) => r.drawing ?? '—' },
              {
                key: 'hourly', label: 'Hourly work handled', render: (r) => {
                  const other = (r.otherHours ?? []).reduce((s, o) => s + Number(o.hours ?? 0), 0);
                  if (other > 0) return Number(other.toFixed(1));
                  if (r.category === 'Hourly') return r.hours ?? '—';
                  return '—';
                },
              },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={rows}
            emptyText="No work progress submitted yet."
          />
        )}
      </Panel>
    </div>
  );
}
