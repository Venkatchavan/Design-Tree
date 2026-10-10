import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meApi } from '../lib/api.js';
import { meetingsApi } from '../lib/phase4bApi.js';
import { ResponseBox, fmtDate, projLabel } from '../components/MeetingsCommon.jsx';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

// Read-only meetings view: only meetings the viewer is invited to.
// Scheduling stays with coordinators / the Design Management Head.
function dayKey(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function MyMeetingsPage() {
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState(null);

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const emp = meQ.data?.user?.employee;
  const myEmpId = emp ? String(typeof emp === 'object' ? (emp._id ?? emp.id ?? '') : emp) : '';

  const listQ = useQuery({ queryKey: ['meetings', 'mine'], queryFn: () => meetingsApi.list({ mine: true }) });
  const meetings = useMemo(() => listQ.data?.items ?? [], [listQ.data]);

  const today = dayKey(new Date());
  const upcoming = useMemo(
    () => meetings.filter((m) => (m.date ? dayKey(m.date) >= today : true) && m.status !== 'Cancelled'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetings],
  );
  const past = useMemo(
    () => meetings.filter((m) => !upcoming.includes(m)),
    [meetings, upcoming],
  );

  const detailQ = useQuery({
    queryKey: ['meeting', detailId],
    queryFn: () => meetingsApi.get(detailId),
    enabled: !!detailId,
  });
  const meeting = detailQ.data?.item ?? detailQ.data ?? null;

  const actionStatus = useMutation({
    mutationFn: ({ meetingId, actionId, status }) => meetingsApi.actionStatus(meetingId, actionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', detailId] });
    },
  });

  const myOpenActions = useMemo(() => {
    let n = 0;
    for (const m of meetings) {
      for (const a of m.actions ?? []) {
        const owner = String(a.owner?._id ?? a.owner ?? '');
        if ((myEmpId ? owner === myEmpId : true) && String(a.status ?? '').toLowerCase() !== 'completed') n += 1;
      }
    }
    return n;
  }, [meetings, myEmpId]);

  const myActions = useMemo(() => {
    const actions = meeting?.actions ?? [];
    if (!myEmpId) return actions.filter((a) => String(a.status ?? '').toLowerCase() !== 'completed');
    return actions.filter(
      (a) =>
        String(a.owner?._id ?? a.owner ?? '') === myEmpId &&
        String(a.status ?? '').toLowerCase() !== 'completed',
    );
  }, [meeting, myEmpId]);

  return (
    <>
      <div className="page-head">
        <div className="page-title">My meetings</div>
        <div className="page-sub">Meetings you are invited to — view only. Scheduling is done by the coordinator (SPOC).</div>
      </div>
      <div className="kpi-grid cols-3">
        <KpiCard label="Assigned meetings" value={listQ.isLoading ? '…' : meetings.length} accent="blueprint" />
        <KpiCard label="Upcoming" value={listQ.isLoading ? '…' : upcoming.length} accent="teal" />
        <KpiCard label="My open actions" value={listQ.isLoading ? '…' : myOpenActions} accent="amber" />
      </div>
      {listQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
      )}
      <Panel title="Upcoming meetings">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'mode', label: 'Mode', render: (r) => r.mode ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={upcoming}
            emptyText="No upcoming meetings assigned to you."
            onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
          />
        )}
      </Panel>
      <Panel title="Past meetings">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : (
          <DataTable
            columns={[
              { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={past}
            emptyText="No past meetings."
            onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
          />
        )}
      </Panel>
      {detailId && (
        <Modal title={meeting?.title ?? 'Meeting'} onClose={() => setDetailId(null)} wide>
          {detailQ.isLoading ? <EmptyState text="Loading…" /> : detailQ.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{detailQ.error.message}</div>
          ) : meeting ? (
            <>
              <div className="field-grid">
                <div className="form-row"><span className="form-label">Project</span><div>{projLabel(meeting.project)}</div></div>
                <div className="form-row"><span className="form-label">Date</span><div>{fmtDate(meeting.date)}{meeting.startTime ? `, ${meeting.startTime}` : ''}{meeting.endTime ? `–${meeting.endTime}` : ''}</div></div>
                <div className="form-row"><span className="form-label">Mode</span><div>{meeting.mode ?? '—'}{meeting.mode === 'Online' && meeting.link ? ` · ${meeting.link}` : ''}{meeting.mode !== 'Online' && meeting.location ? ` · ${meeting.location}` : ''}</div></div>
                <div className="form-row"><span className="form-label">Status</span><div><StatusPill tone={statusTone(meeting.status)}>{meeting.status ?? '—'}</StatusPill></div></div>
              </div>
              {meeting.agenda && <p style={{ fontSize: 13.5 }}>{meeting.agenda}</p>}
              <div className="section-label">Your response</div>
              <ResponseBox meeting={meeting} myEmpId={myEmpId} />
              {meeting?.momDoc && (
                <p style={{ fontSize: 12.5 }}>
                  <a href={meetingsApi.momDownloadUrl(meeting._id ?? meeting.id)} download>Download MOM</a>
                </p>
              )}
              {myActions.length > 0 && (
                <>
                  <div className="section-label">My open action items</div>
                  <DataTable
                    columns={[
                      { key: 'text', label: 'Action' },
                      { key: 'due', label: 'Due', render: (a) => fmtDate(a.due) },
                      { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
                      {
                        key: 'done',
                        label: '',
                        render: (a) => (
                          <button
                            type="button"
                            className="approve-btn"
                            disabled={actionStatus.isPending}
                            onClick={() => actionStatus.mutate({ meetingId: meeting._id ?? meeting.id, actionId: a._id ?? a.id, status: 'Completed' })}
                          >
                            Mark done
                          </button>
                        ),
                      },
                    ]}
                    rows={myActions}
                    emptyText="No open actions."
                  />
                </>
              )}
            </>
          ) : (
            <EmptyState text="Meeting not found." />
          )}
        </Modal>
      )}
    </>
  );
}
