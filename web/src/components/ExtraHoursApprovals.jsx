import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../lib/api.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';

const empName = (e) => [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ') || e?.empId || 'Not recorded';
const dateText = (d) => String(d ?? '').slice(0, 10) || '—';

// Extra hours (beyond 8h of login) and Sunday / holiday work logged at sign-out by
// people in the caller's reporting chain, team or project. The TL / PTL (or mapped
// director) approves or declines; BOTH need a reason, which is recorded with the
// decision. Renders nothing when the caller has no such requests.
export default function ExtraHoursApprovals() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(null); // { id, status }
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const q = useQuery({ queryKey: ['extra-hours'], queryFn: () => attendanceApi.extraHours(), refetchInterval: 30000 });
  const decide = useMutation({
    mutationFn: ({ id, ...body }) => attendanceApi.decideExtraHours(id, body),
    onSuccess: () => { setOpen(null); setReason(''); setErr(''); queryClient.invalidateQueries({ queryKey: ['extra-hours'] }); },
    onError: (e) => setErr(e.message),
  });
  const items = q.data?.items ?? [];
  if (q.isLoading || q.isError || !items.length) return null;
  const pending = items.filter((i) => i.extraHoursStatus === 'pending');

  function submit() {
    if (!reason.trim()) { setErr(`A reason is required to ${open.status === 'approved' ? 'approve' : 'decline'} extra hours.`); return; }
    setErr('');
    decide.mutate({ id: open.id, status: open.status, reason: reason.trim() });
  }
  function start(row, status) { setOpen({ id: row._id, status }); setReason(''); setErr(''); }

  return (
    <Panel title="Extra hours approvals" sub={`${pending.length} awaiting a decision · extra hours after 8 hours of login, and Sunday / holiday work`}>
      <DataTable rows={items} emptyText="No extra-hours requests." columns={[
        { key: 'date', label: 'Date', render: (r) => dateText(r.date) },
        { key: 'who', label: 'Employee', render: (r) => <>{empName(r.employee)}{r.employee?.designation ? <span style={{ color: 'var(--ink-muted)' }}> · {r.employee.designation}</span> : null}</> },
        { key: 'hours', label: 'Extra hours', render: (r) => <>{r.extraHours != null ? `${r.extraHours} h` : '—'}{r.workingDay === false && <span className="load-badge" style={{ marginLeft: 6 }}>Sunday / holiday</span>}</> },
        { key: 'why', label: 'Reason given', render: (r) => r.extraHoursReason || '—' },
        {
          key: 'status', label: 'Decision', render: (r) => {
            if (r.extraHoursStatus === 'pending') {
              if (open?.id === r._id) {
                return (
                  <div style={{ minWidth: 240 }}>
                    <textarea
                      className="form-input"
                      aria-label={open.status === 'approved' ? 'Reason for approving' : 'Reason for declining'}
                      placeholder={open.status === 'approved' ? 'Reason for approving *' : 'Reason for declining *'}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button type="button" className="btn-primary" disabled={decide.isPending} onClick={submit}>
                        {open.status === 'approved' ? 'Confirm approve' : 'Confirm decline'}
                      </button>
                      <button type="button" className="approve-btn" onClick={() => setOpen(null)}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="approve-btn" onClick={() => start(r, 'approved')}>Approve</button>
                  <button type="button" className="approve-btn" onClick={() => start(r, 'declined')}>Decline</button>
                </div>
              );
            }
            return <>{r.extraHoursStatus === 'approved' ? 'Approved' : 'Declined'}{r.extraHoursDecisionReason ? ` — ${r.extraHoursDecisionReason}` : ''}</>;
          },
        },
      ]} />
    </Panel>
  );
}
