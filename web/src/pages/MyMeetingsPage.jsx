import { useSearchParams } from 'react-router-dom';
import { computeAlerts, isUpcoming, momRecorded, displayStatus } from '../lib/meetingsLogic.js';
import { MeetingDetailModal } from '../components/MeetingsCommon.jsx';
import SpocMeetings from '../components/meetings/SpocMeetings.jsx';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meApi } from '../lib/api.js';
import { meetingsApi } from '../lib/phase4bApi.js';
import { ResponseBox, empName, fmtDate, projLabel } from '../components/MeetingsCommon.jsx';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

// Read-only meetings view: only meetings the viewer is invited to.
// Scheduling stays with coordinators.
function dayKey(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function fmtDayLong(v) {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
}

function fmtTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

function overdueDays(a) {
  if (!a?.due) return 0;
  if (String(a.status ?? '').toLowerCase() === 'completed') return 0;
  const d = new Date(a.due);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.ceil((Date.now() - d.getTime()) / 86400000));
}

const hasMom = momRecorded;
const logStatus = displayStatus;

export default function MyMeetingsPage({ viewKey }) {
  if (viewKey === 'meetings') return <SpocMeetings readOnly />;
  return <EmployeeMeetings />;
}

function EmployeeMeetings() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [params, setParams] = useSearchParams();
  const [selectedDetailId, setSelectedDetailId] = useState(null);
  const detailId = params.get('meeting') || selectedDetailId;
  function setDetailId(id) { setSelectedDetailId(id); if (params.has('meeting')) { const next = new URLSearchParams(params); next.delete('meeting'); setParams(next, {replace:true}); } }
  const [inviteFilter, setInviteFilter] = useState('upcoming');
  const [logProject, setLogProject] = useState('');
  const [logMom, setLogMom] = useState('');
  const [actionFilter, setActionFilter] = useState('open');
  const [noteFor, setNoteFor] = useState('');
  const [noteText, setNoteText] = useState('');

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const emp = meQ.data?.user?.employee;
  const myEmpId = emp ? String(typeof emp === 'object' ? (emp._id ?? emp.id ?? '') : emp) : '';

  const listQ = useQuery({ queryKey: ['meetings', 'mine'], queryFn: () => meetingsApi.list({ mine: true }), refetchInterval: 60000 });
  const meetings = useMemo(() => listQ.data?.items ?? [], [listQ.data]);

  const today = dayKey(new Date());
  const myInviteOf = (m) => (m.invites ?? []).find((v) => String(v.employee?._id ?? v.employee ?? '') === String(myEmpId)) ?? null;
  const upcoming = useMemo(
    () => meetings.filter(isUpcoming),
    [meetings],
  );
  const past = useMemo(
    () => meetings.filter((m) => !upcoming.includes(m)),
    [meetings, upcoming],
  );
  const todayList = useMemo(() => upcoming.filter((m) => dayKey(m.date) === today), [upcoming, today]);
  const upcomingRest = useMemo(() => upcoming.filter((m) => dayKey(m.date) !== today), [upcoming, today]);
  // Held meetings plus scheduled ones whose date has passed.
  const logRows = useMemo(
    () => past,
    [past],
  );

  const pendingInvites = useMemo(
    () => upcoming.filter((m) => {
      if (!['Scheduled', 'Rescheduled'].includes(m.status)) return false;
      if (!myEmpId) return false;
      const inv = (m.invites ?? []).find((v) => String(v.employee?._id ?? v.employee ?? '') === String(myEmpId));
      return (inv?.response ?? 'Pending') === 'Pending';
    }),
    [upcoming, myEmpId],
  );

  const attended = useMemo(
    () => meetings.filter((m) =>
      (m.attendance ?? []).some((a) => String(a.employee?._id ?? a.employee ?? '') === String(myEmpId) && a.present),
    ),
    [meetings, myEmpId],
  );

  const allMyActions = useMemo(() => {
    const out = [];
    for (const m of meetings) {
      for (const a of m.actions ?? []) {
        const owner = String(a.owner?._id ?? a.owner ?? '');
        if (myEmpId ? owner === myEmpId : true) {
          out.push({
            ...a,
            _actionId: String(a._id ?? a.id),
            _meetingId: String(m._id ?? m.id),
            _meetingTitle: m.title ?? '—',
            _momNo: m.momNo ?? '',
            _project: projLabel(m.project),
          });
        }
      }
    }
    return out;
  }, [meetings, myEmpId]);

  const reminders = useMemo(() => computeAlerts(meetings.map(m => ({...m,invites:(m.invites ?? []).filter(i=>String(i.employee?._id ?? i.employee)===myEmpId),actions:(m.actions ?? []).filter(a=>String(a.owner?._id ?? a.owner)===myEmpId)}))),[meetings,myEmpId]);

  const openActions = useMemo(
    () => allMyActions.filter((a) => String(a.status ?? '').toLowerCase() !== 'completed'),
    [allMyActions],
  );
  const overdueActions = useMemo(() => openActions.filter((a) => overdueDays(a) > 0), [openActions]);



  const actionStatus = useMutation({
    mutationFn: ({ meetingId, actionId, status }) => meetingsApi.actionStatus(meetingId, actionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', detailId] });
    },
  });

  const actionNote = useMutation({
    mutationFn: ({ meetingId, actionId, note }) => meetingsApi.actionNote(meetingId, actionId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', detailId] });
      setNoteFor('');
      setNoteText('');
    },
  });

  const myProjects = useMemo(() => {
    const m = new Map();
    for (const mtg of meetings) {
      const p = mtg.project;
      const id = String(p?._id ?? p ?? '');
      if (!id || m.has(id)) continue;
      m.set(id, { id, name: projLabel(p) });
    }
    return [...m.values()];
  }, [meetings]);

  const inviteRows = upcoming.filter((m) => {
    if (inviteFilter === 'awaiting') return myEmpId ? (myInviteOf(m)?.response ?? 'Pending') === 'Pending' : false;
    if (inviteFilter === 'responded') return myEmpId ? (myInviteOf(m)?.response ?? 'Pending') !== 'Pending' : true;
    return true;
  });

  const logFiltered = logRows.filter((m) => {
    if (logProject && String(m.project?._id ?? m.project ?? '') !== logProject) return false;
    if (logMom === 'available' && !hasMom(m)) return false;
    if (logMom === 'missing' && hasMom(m)) return false;
    return true;
  });

  const actionRows = allMyActions.filter((a) => {
    const s = String(a.status ?? '').toLowerCase();
    if (actionFilter === 'open') return s !== 'completed';
    if (actionFilter === 'overdue') return s !== 'completed' && overdueDays(a) > 0;
    if (actionFilter === 'completed') return s === 'completed';
    return true;
  });

  function myAttendanceOf(m) {
    const att = (m.attendance ?? []).find((a) => String(a.employee?._id ?? a.employee ?? '') === String(myEmpId)) ?? null;
    if (att && typeof att.present === 'boolean') return att.present ? 'Attended' : `Absent${att.reason ? ` – ${att.reason}` : ''}`;
    const inv = myInviteOf(m);
    if (inv && inv.response !== 'Pending') return `${inv.response}${inv.reason ? ` – ${inv.reason}` : ''}`;
    return '—';
  }

  function unavailableOf(m) {
    const out = [];
    for (const a of m.attendance ?? []) {
      if (a.present === false) out.push(`${empName(a.employee)}${a.reason ? ` – ${a.reason}` : ' – Not given'}`);
    }
    for (const v of m.invites ?? []) {
      if (v.response === 'Not Available' && !out.some((x) => x.startsWith(empName(v.employee)))) {
        out.push(`${empName(v.employee)}${v.reason ? ` – ${v.reason}` : ' – Not given'}${v.note ? ` (${v.note})` : ''}`);
      }
    }
    return out.length > 0 ? out.join('; ') : '—';
  }

  function linkCell(m) {
    if (m.link) return <a href={m.link} target="_blank" rel="noreferrer">{m.link}</a>;
    if (String(m.mode ?? '').toLowerCase() !== 'online' && m.location) return `Offline: ${m.location}`;
    return '—';
  }


  return (
    <>
      <div className="page-head">
        <div className="page-title">Meetings</div>
        <div className="page-sub">DesignTree · Employee Meeting Dashboard · Meeting invitations and meeting log</div>
      </div>
      {listQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
      )}
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'invitations', label: 'Meeting invitations' },
          { key: 'log', label: 'Meeting log' },
          { key: 'actions', label: `My action items${overdueActions.length > 0 ? ` (${overdueActions.length} overdue)` : ''}` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <>
          <div className="kpi-grid cols-6">
            <KpiCard label="Today's meetings" value={listQ.isLoading ? '…' : todayList.length} accent="blueprint" />
            <KpiCard label="Upcoming meetings" value={listQ.isLoading ? '…' : upcomingRest.length} accent="teal" />
            <KpiCard label="Pending responses" value={listQ.isLoading ? '…' : pendingInvites.length} accent="amber" />
            <KpiCard label="Open action items" value={listQ.isLoading ? '…' : openActions.length} accent="violet" />
            <KpiCard label="Overdue action items" value={listQ.isLoading ? '…' : overdueActions.length} accent="rust" />
            <KpiCard label="Meetings attended" value={listQ.isLoading ? '…' : attended.length} accent="forest" />
          </div>
          <Panel title="Today's meetings" sub={fmtDayLong(new Date())}>
            {listQ.isLoading ? <EmptyState text="Loading…" /> : todayList.length === 0 ? (
              <EmptyState text="No meetings today." />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                  { key: 'time', label: 'Time', render: (r) => `${fmtTime(r.startTime)}${r.endTime ? `–${fmtTime(r.endTime)}` : ''}` || '—' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={todayList}
                emptyText="No meetings today."
                onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
              />
            )}
          </Panel>
          <Panel title="Upcoming meetings" sub={`${upcomingRest.length}`}>
            {listQ.isLoading ? <EmptyState text="Loading…" /> : upcomingRest.length === 0 ? (
              <EmptyState text="No other upcoming meetings." />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
                ]}
                rows={upcomingRest}
                emptyText="No other upcoming meetings."
                onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
              />
            )}
          </Panel>
          <Panel title="Pending availability responses" sub={`${pendingInvites.length}`}>
            {listQ.isLoading ? <EmptyState text="Loading…" /> : pendingInvites.length === 0 ? (
              <EmptyState text="You have responded to every invitation." />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                ]}
                rows={pendingInvites}
                emptyText="You have responded to every invitation."
                onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
              />
            )}
          </Panel>
          <Panel title="Alerts & reminders">{reminders.length ? <ul>{reminders.map((r,i)=><li key={i}><button type="button" className="approve-btn" onClick={()=>setDetailId(r.meetingId)}>{r.text}</button></li>)}</ul> : <EmptyState text="No meeting reminders." />}</Panel>
          <Panel title="My action items" sub={`${openActions.length} open`}>
            {listQ.isLoading ? <EmptyState text="Loading…" /> : openActions.length === 0 ? (
              <EmptyState text="No open action items." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {openActions.slice(0, 10).map((a) => {
                  const od = overdueDays(a);
                  return (
                    <div key={`${a._meetingId}-${a._actionId}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.text ?? '—'}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
                        {a.due ? `Due ${fmtDate(a.due)}` : 'No due date'}
                        {od > 0 ? ` · ${od}d overdue` : ''} · {a.status ?? 'Pending'} · {a._project}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'invitations' && (
        <Panel title="Meeting invitations" sub="Meetings scheduled by your SPOC appear here with the link and details.">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select className="filter-select" value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value)}>
              <option value="upcoming">All upcoming</option>
              <option value="awaiting">Awaiting my response</option>
              <option value="responded">Responded</option>
            </select>
          </div>
          {listQ.isLoading ? <EmptyState text="Loading…" /> : inviteRows.length === 0 ? (
            <EmptyState text="No invitations here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inviteRows.map((m) => (
                <div key={String(m._id ?? m.id)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title ?? '—'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
                    {projLabel(m.project)} · {fmtDate(m.date)}{m.startTime ? `, ${fmtTime(m.startTime)}${m.endTime ? `–${fmtTime(m.endTime)}` : ''}` : ''} · {m.mode ?? '—'}
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>{linkCell(m)}</div>
                  {m.agenda && <p style={{ fontSize: 13, marginTop: 6 }}>{m.agenda}</p>}
                  <ResponseBox meeting={m} myEmpId={myEmpId} organiser={m.responsible} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'log' && (
        <Panel title="Meeting log" sub="Meetings move here automatically once they are held. Open one to read the MOM and your action items.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <select className="filter-select" value={logProject} onChange={(e) => setLogProject(e.target.value)}>
              <option value="">All my projects</option>
              {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="filter-select" value={logMom} onChange={(e) => setLogMom(e.target.value)}>
              <option value="">MOM: All</option>
              <option value="available">MOM available</option>
              <option value="missing">MOM missing</option>
            </select>
          </div>
          {listQ.isLoading ? <EmptyState text="Loading…" /> : (
            <DataTable
              columns={[
                {
                  key: 'datetime', label: 'Date & time', render: (r) => (
                    <>{fmtDayLong(r.date)}{r.startTime ? <br /> : null}{r.startTime ? `${fmtTime(r.startTime)}${r.endTime ? `–${fmtTime(r.endTime)}` : ''}` : ''}</>
                  ),
                },
                { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                { key: 'title', label: 'Meeting', render: (r) => r.title ?? '—' },
                { key: 'link', label: 'Link', render: (r) => linkCell(r) },
                { key: 'organiser', label: 'Organiser', render: (r) => r.responsible ?? r.conductedBy ?? '—' },
                { key: 'invited', label: 'Invited', render: (r) => (r.invites ?? []).length },
                {
                  key: 'attended', label: 'Attended', render: (r) => {
                    const names = (r.attendance ?? []).filter((a) => a.present).map((a) => empName(a.employee));
                    return names.length > 0 ? names.join(', ') : '—';
                  },
                },
                { key: 'unavailable', label: 'Unavailable & reason', render: (r) => unavailableOf(r) },
                { key: 'you', label: 'You', render: (r) => myAttendanceOf(r) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(logStatus(r))}>{logStatus(r)}</StatusPill> },
                { key: 'mom', label: 'MOM', render: (r) => (hasMom(r) ? 'Available' : '—') },
              ]}
              rows={logFiltered}
              emptyText="No meetings in the log yet."
              onRowClick={(r) => setDetailId(String(r._id ?? r.id))}
            />
          )}
        </Panel>
      )}

      {tab === 'actions' && (
        <Panel title="My action items" sub="Action items assigned to you in MOMs.">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
          </div>
          {listQ.isLoading ? <EmptyState text="Loading…" /> : (
            <DataTable
              columns={[
                { key: 'text', label: 'Action / task' },
                { key: 'project', label: 'Project', render: (r) => r._project },
                { key: 'from', label: 'From meeting', render: (r) => `${r._momNo ? `${r._momNo} · ` : ''}${r._meetingTitle}` },

                {
                  key: 'due', label: 'Due date', render: (r) => {
                    const od = overdueDays(r);
                    return `${fmtDate(r.due)}${od > 0 ? ` (${od}d overdue)` : ''}`;
                  },
                },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
                { key: 'completed', label: 'Completed', render: (r) => fmtDate(r.completedAt) },
                { key: 'note', label: 'Update note', render: (r) => r.note ?? '—' },
                {
                  key: 'update', label: '', render: (r) => {
                    const key = `${r._meetingId}-${r._actionId}`;
                    return (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {noteFor === key ? (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="form-input"
                              style={{ minWidth: 160 }}
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Progress update"
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={actionNote.isPending}
                              onClick={() => actionNote.mutate({ meetingId: r._meetingId, actionId: r._actionId, note: noteText })}
                            >
                              Save
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="approve-btn"
                            onClick={() => { setNoteFor(key); setNoteText(r.note ?? ''); }}
                          >
                            Progress update
                          </button>
                        )}
                        <select className="filter-select" aria-label="Action status" value={r.status || 'Pending'} disabled={actionStatus.isPending} onChange={e => actionStatus.mutate({ meetingId: r._meetingId, actionId: r._actionId, status: e.target.value })}>
                          <option>Pending</option><option>In Progress</option><option>Completed</option>
                        </select>
                      </span>
                    );
                  },
                },
              ]}
              rows={actionRows}
              emptyText="No action items."
            />
          )}
          {actionNote.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{actionNote.error.message}</div>}
          {actionStatus.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{actionStatus.error.message}</div>}
        </Panel>
      )}

      {detailId && <MeetingDetailModal meetingId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
