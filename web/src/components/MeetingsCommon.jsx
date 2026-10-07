import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, meApi, projectsApi } from '../lib/api.js';
import { UNAVAILABLE_REASONS, meetingsApi } from '../lib/phase4bApi.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import StatusPill, { statusTone } from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import Modal from './Modal.jsx';

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
export function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
}
export function idOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}
export function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}
export function isOverdueAction(a) {
  if (!a?.due) return false;
  const s = String(a.status ?? '').toLowerCase();
  if (s === 'completed') return false;
  const d = new Date(a.due);
  if (Number.isNaN(d.getTime())) return false;
  return d < new Date();
}
export function isDueSoonAction(a) {
  if (!a?.due) return false;
  const s = String(a.status ?? '').toLowerCase();
  if (s === 'completed') return false;
  const d = new Date(a.due);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const in3 = new Date();
  in3.setDate(now.getDate() + 3);
  return d >= now && d <= in3;
}

export function actionLabel(a) {
  if (isOverdueAction(a)) return 'overdue';
  if (isDueSoonAction(a)) return 'due soon (within 3 days)';
  return a.status ?? '—';
}

export function ScheduleMeetingModal({ sudden, onClose }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [services, setServices] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [type, setType] = useState('Client / DRM');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mode, setMode] = useState('Offline');
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [participants, setParticipants] = useState([]);
  const [err, setErr] = useState('');

  const projQ = useQuery({ queryKey: ['projects', 'mtg'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const empQ = useQuery({ queryKey: ['employees-mtg'], queryFn: () => employeesApi.list({}) });
  const projects = projQ.data?.items ?? [];
  const employees = empQ.data?.items ?? [];

  const create = useMutation({
    mutationFn: (body) => meetingsApi.create(body),
    onSuccess: async (data) => {
      const id = data?.item?._id ?? data?.item?.id ?? data?._id ?? data?.id;
      if (sudden && id) {
        try {
          await meetingsApi.held(id);
        } catch {
          /* keep created meeting even if held fails */
        }
      }
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function toggleParticipant(id) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e) {
    e.preventDefault();
    setErr('');
    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    if (!date) {
      setErr('Date is required.');
      return;
    }
    create.mutate({
      project: project || undefined,
      services: services
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      title: title.trim(),
      agenda: agenda || undefined,
      category: sudden ? 'Sudden' : 'Scheduled',
      type: type || undefined,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      mode: mode || undefined,
      link: link || undefined,
      location: location || undefined,
      reason: sudden ? reason || undefined : undefined,
      participants: participants.map((employee) => ({ employee })),
      ...(sudden ? { status: 'Held' } : {}),
    });
  }

  return (
    <Modal title={sudden ? 'Add sudden meeting (saved as held)' : 'Schedule meeting'} wide onClose={onClose}>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Responsible: Project SPOC</p>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
              ))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">Services</label><input className="form-input" value={services} onChange={(e) => setServices(e.target.value)} placeholder="e.g. Structure, Electrical" /></div>
          <div className="form-row"><label className="form-label">Title *</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="form-row">
            <label className="form-label">Type</label>
            <select className="filter-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value)} disabled={sudden}>
              <option>Client / DRM</option>
              <option>DesignTree / Arictech</option>
              <option>PMC</option>
              <option>Other</option>
            </select>
          </div>
          <div className="form-row"><label className="form-label">Date *</label><input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Start</label><input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">End</label><input className="form-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          <div className="form-row">
            <label className="form-label">Mode</label>
            <select className="filter-select" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>Offline</option>
              <option>Online</option>
            </select>
          </div>
          <div className="form-row"><label className="form-label">Link</label><input className="form-input" value={link} onChange={(e) => setLink(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          {sudden && (
            <div className="form-row"><label className="form-label">Reason (sudden)</label><input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          )}
        </div>
        <div className="form-row"><label className="form-label">Agenda</label><textarea className="form-input" value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
        <div className="section-label">Participants ({participants.length} selected)</div>
        {empQ.isLoading ? <EmptyState text="Loading employees…" /> : (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
            {employees.map((e) => {
              const id = String(e._id ?? e.id);
              return (
                <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '3px 0' }}>
                  <input type="checkbox" checked={participants.includes(id)} onChange={() => toggleParticipant(id)} />
                  {empName(e)} · {e.designation ?? ''}
                </label>
              );
            })}
          </div>
        )}
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <button type="submit" className="btn-primary" disabled={create.isPending} style={{ marginTop: 10 }}>
          {create.isPending ? 'Saving…' : sudden ? 'Save as held' : 'Schedule meeting'}
        </button>
      </form>
    </Modal>
  );
}

export function MeetingDetailModal({ meetingId, onClose, manage = false }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery({ queryKey: ['meeting', meetingId], queryFn: () => meetingsApi.get(meetingId), enabled: !!meetingId });
  const [resDate, setResDate] = useState('');
  const [resStart, setResStart] = useState('');
  const [resEnd, setResEnd] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [actionPriority, setActionPriority] = useState('Medium');
  const [refFiles, setRefFiles] = useState([]);
  const [err, setErr] = useState('');
  const [attendance, setAttendance] = useState(null);

  const meeting = detailQ.data?.item ?? detailQ.data?.meeting ?? detailQ.data ?? null;
  const invites = meeting?.invites ?? [];
  const actions = meeting?.actions ?? [];
  const isHeld = String(meeting?.status ?? '').toLowerCase() === 'held';

  const absenceQ = useQuery({
    queryKey: ['absence-log', meeting?.project],
    queryFn: () => meetingsApi.absenceLog({ project: idOf(meeting?.project) || undefined }),
    enabled: !!meeting,
  });
  const absenceItems = useMemo(() => {
    const items = absenceQ.data?.items ?? [];
    if (!meetingId) return items;
    return items.filter((a) => String(a.meeting?._id ?? a.meeting ?? '') === String(meetingId) || !a.meeting);
  }, [absenceQ.data, meetingId]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
    queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['absence-log'] });
  }

  const reschedule = useMutation({
    mutationFn: (body) => meetingsApi.reschedule(meetingId, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const held = useMutation({
    mutationFn: () => meetingsApi.held(meetingId),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const cancel = useMutation({
    mutationFn: (reason) => meetingsApi.cancel(meetingId, reason ? { reason } : undefined),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const saveAttendance = useMutation({
    mutationFn: (body) => meetingsApi.attendance(meetingId, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const addAction = useMutation({
    mutationFn: (body) => meetingsApi.addAction(meetingId, body),
    onSuccess: () => {
      invalidate();
      setActionText('');
      setActionOwner('');
      setActionDue('');
      setActionPriority('Medium');
    },
    onError: (e) => setErr(e.message),
  });
  const flipAction = useMutation({
    mutationFn: ({ actionId, status }) => meetingsApi.actionStatus(meetingId, actionId, { status }),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });

  if (!meetingId) return null;

  return (
    <Modal title="Meeting detail" wide onClose={onClose}>
      {detailQ.isLoading ? <EmptyState text="Loading…" /> : detailQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{detailQ.error.message}</div>
      ) : !meeting ? <EmptyState text="Meeting not found." /> : (
        <>
          <div className="field-grid">
            <div><div className="form-label">Title</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{meeting.title ?? '—'}</div></div>
            <div><div className="form-label">Project</div><div style={{ fontSize: 13 }}>{projLabel(meeting.project)}</div></div>
            <div><div className="form-label">Date</div><div style={{ fontSize: 13 }}>{fmtDate(meeting.date)} {meeting.startTime ?? ''}{meeting.endTime ? `–${meeting.endTime}` : ''}</div></div>
            <div><div className="form-label">Status</div><StatusPill tone={statusTone(meeting.status)}>{meeting.status ?? '—'}</StatusPill></div>
          </div>
          {meeting.agenda && <p style={{ fontSize: 13 }}>{meeting.agenda}</p>}
          <div className="section-label">Invites & responses ({invites.length})</div>
          <DataTable
            columns={[
              { key: 'employee', label: 'Invitee', render: (r) => empName(r.employee) },
              { key: 'response', label: 'Response', render: (r) => r.response ? <StatusPill tone={statusTone(r.response)}>{r.response}</StatusPill> : '—' },
              { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
              { key: 'note', label: 'Note', render: (r) => r.note ?? '—' },
            ]}
            rows={invites}
            emptyText="No invites."
          />
          <ModalInviteResponse meeting={meeting} />
          {isHeld && <AttendanceReadout meeting={meeting} />}
          {!isHeld && manage && (
            <Panel title="Reschedule / close">
              <div className="field-grid">
                <div className="form-row"><label className="form-label">Date</label><input className="form-input" type="date" value={resDate} onChange={(e) => setResDate(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Start</label><input className="form-input" type="time" value={resStart} onChange={(e) => setResStart(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">End</label><input className="form-input" type="time" value={resEnd} onChange={(e) => setResEnd(e.target.value)} /></div>
              </div>
              <div className="form-row"><label className="form-label">Cancellation reason (for Cancel)</label><input className="form-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason shown to invitees" /></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="approve-btn" disabled={!resDate || reschedule.isPending} onClick={() => reschedule.mutate({ date: resDate, startTime: resStart || undefined, endTime: resEnd || undefined })}>Reschedule</button>
                <button type="button" className="approve-btn" disabled={held.isPending} onClick={() => held.mutate()}>Mark held</button>
                <button type="button" className="approve-btn" disabled={cancel.isPending} onClick={() => cancel.mutate(cancelReason.trim() || undefined)}>Cancel</button>
              </div>
            </Panel>
          )}
          {meeting.status === 'Cancelled' && meeting.cancelReason && (
            <p style={{ fontSize: 13, color: 'var(--rust-dark)' }}>Cancelled by SPOC: {meeting.cancelReason}</p>
          )}
          {isHeld && manage && (
            <Panel title="Attendance editor (Held)">
              <AttendanceEditor
                invites={invites}
                initial={attendance}
                onChange={setAttendance}
                onSave={(rows) => saveAttendance.mutate({ attendance: rows })}
                saving={saveAttendance.isPending}
              />
            </Panel>
          )}
          <MomSection meeting={meeting} manage={manage && isHeld} onSaved={invalidate} />
          <RefDocsSection meeting={meeting} manage={manage} onSaved={invalidate} />
          <Panel title={`Actions (${actions.length})`}>
            <DataTable
              columns={[
                { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
                { key: 'owner', label: 'Owner', render: (a) => empName(a.owner) },
                {
                  key: 'priority', label: 'Priority', render: (a) => {
                    const p = a.priority ?? 'Medium';
                    const tone = p === 'High' ? 'rust' : p === 'Low' ? 'neutral' : 'amber';
                    return <StatusPill tone={tone}>{p}</StatusPill>;
                  },
                },
                { key: 'due', label: 'Due', render: (a) => `${fmtDate(a.due)} · ${actionLabel(a)}` },
                { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
                { key: 'note', label: 'Update note', render: (a) => a.note ?? '—' },
                {
                  key: 'flip',
                  label: 'Update',
                  render: (a) => (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="approve-btn" onClick={() => flipAction.mutate({ actionId: a._id ?? a.id, status: 'Completed' })}>Complete</button>
                      <button type="button" className="approve-btn" onClick={() => flipAction.mutate({ actionId: a._id ?? a.id, status: 'Open' })}>Reopen</button>
                    </span>
                  ),
                },
              ]}
              rows={actions}
              emptyText="No actions yet."
            />
            {manage && isHeld && (
              <>
                <div className="field-grid" style={{ marginTop: 10 }}>
                  <div className="form-row"><label className="form-label">Action text *</label><input className="form-input" value={actionText} onChange={(e) => setActionText(e.target.value)} /></div>
                  <div className="form-row"><label className="form-label">Owner (employee id)</label><input className="form-input" value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} placeholder="Optional employee id" /></div>
                  <div className="form-row"><label className="form-label">Due</label><input className="form-input" type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} /></div>
                  <div className="form-row">
                    <label className="form-label">Priority</label>
                    <select className="filter-select" style={{ width: '100%' }} value={actionPriority} onChange={(e) => setActionPriority(e.target.value)}>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 8 }}
                  disabled={addAction.isPending || !actionText.trim()}
                  onClick={() => addAction.mutate({ text: actionText.trim(), owner: actionOwner || undefined, due: actionDue || undefined, priority: actionPriority })}
                >
                  Add action
                </button>
              </>
            )}
          </Panel>
          <Panel title="Absence log (this meeting / project)">
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
                { key: 'reason', label: 'Reason' },
                { key: 'note', label: 'Note', render: (r) => r.note ?? '—' },
                { key: 'at', label: 'Responded', render: (r) => fmtDate(r.respondedAt) },
              ]}
              rows={absenceItems}
              emptyText="No absence entries."
            />
          </Panel>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        </>
      )}
    </Modal>
  );
}

function ModalInviteResponse({ meeting }) {
  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const emp = meQ.data?.user?.employee;
  const myEmpId = emp
    ? String(typeof emp === 'object' ? (emp._id ?? emp.id ?? '') : emp)
    : '';
  if (meeting?.status !== 'Scheduled' || meeting?.category !== 'Scheduled') return null;
  if (meeting?.date) {
    const d = new Date(meeting.date);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (!Number.isNaN(d.getTime()) && d < t) return null;
  }
  const invited = (meeting?.invites ?? []).some(
    (v) => idOf(v.employee) === String(myEmpId),
  );
  if (!myEmpId || !invited) return null;
  return <ResponseBox meeting={meeting} myEmpId={myEmpId} organiser={meeting.responsible} />;
}

function AttendanceReadout({ meeting }) {
  const rows = meeting?.attendance ?? [];
  const present = rows.filter((x) => x.present).length;
  return (
    <Panel title={`Attendance — ${present}/${rows.length} attended`}>
      {rows.length === 0 ? <EmptyState text="Not marked" /> : (
        <DataTable
          columns={[
            { key: 'employee', label: 'Invitee', render: (r) => empName(r.employee) },
            {
              key: 'status', label: 'Status', render: (r) => r.present
                ? <StatusPill tone="forest">Attended</StatusPill>
                : <StatusPill tone="rust">Not attended</StatusPill>,
            },
            { key: 'reason', label: 'Reason', render: (r) => (!r.present && r.reason ? r.reason : '—') },
          ]}
          rows={rows}
          emptyText="Not marked"
        />
      )}
    </Panel>
  );
}

function AttendanceEditor({ invites, initial, onChange, onSave, saving }) {
  const [rows, setRows] = useState(null);
  const effective = rows ?? initial ?? invites.map((v) => ({ employee: idOf(v.employee), present: true }));
  function setRow(i, patch) {
    const next = effective.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  }
  if (effective.length === 0) return <EmptyState text="No invitees to mark." />;
  return (
    <>
      <table className="data">
        <thead><tr><th>Invitee</th><th>Present</th><th>Absence reason</th></tr></thead>
        <tbody>
          {effective.map((r, i) => (
            <tr key={String(r.employee ?? i)}>
              <td>{empName(invites[i]?.employee)}</td>
              <td>
                <input type="checkbox" checked={!!r.present} onChange={(e) => setRow(i, { present: e.target.checked })} aria-label="Present" />
              </td>
              <td>
                {!r.present && (
                  <input
                    className="form-input"
                    value={r.reason ?? ''}
                    onChange={(e) => setRow(i, { reason: e.target.value })}
                    placeholder="Reason for absence"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => onSave(effective)}>
        {saving ? 'Saving…' : 'Save attendance'}
      </button>
    </>
  );
}

function MomSection({ meeting, manage, onSaved }) {
  const queryClient = useQueryClient();
  const mom = meeting?.mom && typeof meeting.mom === 'object' ? meeting.mom : {};
  const hasMom =
    (mom.discussion ?? '').trim() ||
    (mom.decisions ?? '').trim() ||
    (mom.followUp ?? '').trim() ||
    meeting?.momDoc;
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const draft = form ?? {
    discussion: mom.discussion ?? '',
    decisions: mom.decisions ?? '',
    followUp: mom.followUp ?? '',
    nextMeeting: mom.nextMeeting ? String(mom.nextMeeting).slice(0, 10) : '',
  };
  const save = useMutation({
    mutationFn: (body) => meetingsApi.mom(meeting._id ?? meeting.id, body),
    onSuccess: () => {
      setForm(null);
      setErr('');
      onSaved();
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
    },
    onError: (e) => setErr(e.message),
  });
  const set = (k, v) => setForm({ ...draft, [k]: v });
  return (
    <Panel title="Minutes of meeting">
      {!hasMom ? (
        <EmptyState text={`Not yet shared by ${meeting?.responsible ?? 'SPOC'}. The MOM will appear here as soon as it is recorded.`} />
      ) : (
        <div className="field-grid">
          <div><div className="form-label">Key discussion points</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.discussion?.trim() || '—'}</p></div>
          <div><div className="form-label">Decisions taken</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.decisions?.trim() || '—'}</p></div>
          <div><div className="form-label">Follow-up</div><p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{mom.followUp?.trim() || '—'}</p></div>
          <div><div className="form-label">Next meeting</div><p style={{ fontSize: 13 }}>{mom.nextMeeting ? fmtDate(mom.nextMeeting) : '—'}</p></div>
          <div>
            <div className="form-label">MOM document</div>
            <p style={{ fontSize: 13 }}>{meeting?.momDoc ?? 'Entered in system'}</p>
          </div>
          <div>
            <div className="form-label">Download</div>
            <a className="approve-btn" style={{ textDecoration: 'none', display: 'inline-block' }} href={meetingsApi.momDownloadUrl(meeting._id ?? meeting.id)} download>
              Download MOM
            </a>
          </div>
        </div>
      )}
      {manage && (
        <>
          <div className="field-grid" style={{ marginTop: 10 }}>
            <div className="form-row"><label className="form-label">Key discussion points</label><textarea className="form-input" value={draft.discussion} onChange={(e) => set('discussion', e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Decisions taken</label><textarea className="form-input" value={draft.decisions} onChange={(e) => set('decisions', e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Follow-up requirements</label><textarea className="form-input" value={draft.followUp} onChange={(e) => set('followUp', e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Next meeting date</label><input className="form-input" type="date" value={draft.nextMeeting} onChange={(e) => set('nextMeeting', e.target.value)} /></div>
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button
            type="button"
            className="approve-btn"
            disabled={save.isPending}
            onClick={() => save.mutate({
              discussion: draft.discussion || undefined,
              decisions: draft.decisions || undefined,
              followUp: draft.followUp || undefined,
              nextMeeting: draft.nextMeeting || undefined,
            })}
          >
            {save.isPending ? 'Saving…' : 'Save MOM'}
          </button>
        </>
      )}
    </Panel>
  );
}

function RefDocsSection({ meeting, manage, onSaved }) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const docs = meeting?.refDocs ?? [];
  async function upload(e) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      await meetingsApi.refDocs(meeting._id ?? meeting.id, files);
      setFiles([]);
      onSaved();
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Reference documents">
      {docs.length === 0 ? (
        <EmptyState text="No reference documents shared." />
      ) : (
        <ul style={{ fontSize: 13, paddingLeft: 18 }}>
          {docs.map((d, i) => (
            <li key={i}>{String(d).split('/').pop()}</li>
          ))}
        </ul>
      )}
      {manage && (
        <form onSubmit={upload} style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <button type="submit" className="approve-btn" disabled={busy || files.length === 0}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
    </Panel>
  );
}

export function ResponseBox({ meeting, myEmpId, organiser }) {
  const queryClient = useQueryClient();
  const myInvite = useMemo(() => {
    const list = meeting?.invites ?? [];
    return list.find((v) => idOf(v.employee) === String(myEmpId)) ?? null;
  }, [meeting, myEmpId]);
  const alreadyResponded = myInvite?.response === 'Available' || myInvite?.response === 'Not Available';
  const [choice, setChoice] = useState(
    myInvite?.response === 'Not Available' ? 'Not Available' : 'Available',
  );
  const [reason, setReason] = useState(myInvite?.reason ?? '');
  const [note, setNote] = useState(myInvite?.note ?? '');
  const [customReason, setCustomReason] = useState(
    myInvite?.reason && !UNAVAILABLE_REASONS.includes(myInvite.reason) ? myInvite.reason : '',
  );
  const [err, setErr] = useState('');
  const [sentAt, setSentAt] = useState(myInvite?.respondedAt ?? null);

  const respond = useMutation({
    mutationFn: (body) => meetingsApi.respond(meeting._id ?? meeting.id, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
      setErr('');
      setSentAt(new Date().toISOString());
      setChoice(vars.response);
    },
    onError: (e) => setErr(e.message),
  });

  function submit() {
    setErr('');
    if (choice !== 'Available' && choice !== 'Not Available') {
      setErr('Choose Available or Not available.');
      return;
    }
    if (choice === 'Not Available' && !reason) {
      setErr('Select a reason for not being available.');
      return;
    }
    if (choice === 'Not Available' && reason === 'Other — specify' && !customReason.trim()) {
      setErr('Describe the reason.');
      return;
    }
    const finalReason = reason === 'Other — specify' ? customReason.trim() : reason;
    respond.mutate({
      response: choice,
      reason: choice === 'Not Available' ? finalReason : undefined,
      note: note.trim() || undefined,
    });
  }

  const showReason = choice === 'Not Available';
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginTop: 8, background: 'var(--surface-alt)' }}>
      <div className="form-label">Your availability</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <button
          type="button"
          className={choice === 'Available' ? 'btn-primary' : 'approve-btn'}
          onClick={() => setChoice('Available')}
        >
          Available
        </button>
        <button
          type="button"
          className={choice === 'Not Available' ? 'btn-primary' : 'approve-btn'}
          onClick={() => setChoice('Not Available')}
        >
          Not available
        </button>
      </div>
      {showReason && (
        <div className="field-grid" style={{ marginTop: 8 }}>
          <div className="form-row">
            <label className="form-label">Reason (required)</label>
            <select className="filter-select" style={{ width: '100%' }} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select reason</option>
              {UNAVAILABLE_REASONS.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">
              {reason === 'Other — specify' ? 'Specify reason (required)' : 'Note for SPOC (optional)'}
            </label>
            <input
              className="form-input"
              value={reason === 'Other — specify' ? customReason : note}
              onChange={(e) => (reason === 'Other — specify' ? setCustomReason(e.target.value) : setNote(e.target.value))}
              placeholder={reason === 'Other — specify' ? 'Describe the reason' : 'e.g. can join after 4 PM'}
            />
          </div>
        </div>
      )}
      {!showReason && (
        <div className="form-row" style={{ marginTop: 8 }}>
          <label className="form-label">Note for SPOC (optional)</label>
          <input
            className="form-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="btn-primary" disabled={respond.isPending} onClick={submit}>
          {respond.isPending ? 'Sending…' : alreadyResponded ? 'Update response' : 'Send response'}
        </button>
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      {sentAt && !err && (
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
          {alreadyResponded || myInvite?.respondedAt ? 'Updated' : 'Response sent'}
          {organiser ? ` to ${organiser}` : ''} · Sent {fmtDate(sentAt)}.
        </p>
      )}
    </div>
  );
}
