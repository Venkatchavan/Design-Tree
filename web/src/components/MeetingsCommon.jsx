import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
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
  const [type, setType] = useState('Scheduled');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mode, setMode] = useState('In person');
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
      services: services || undefined,
      title: title.trim(),
      agenda: agenda || undefined,
      type: sudden ? 'Sudden' : type || undefined,
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
          <div className="form-row"><label className="form-label">Type</label><input className="form-input" value={sudden ? 'Sudden' : type} onChange={(e) => setType(e.target.value)} disabled={sudden} /></div>
          <div className="form-row"><label className="form-label">Date *</label><input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Start</label><input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">End</label><input className="form-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          <div className="form-row">
            <label className="form-label">Mode</label>
            <select className="filter-select" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>In person</option>
              <option>Online</option>
              <option>Hybrid</option>
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

export function MeetingDetailModal({ meetingId, onClose }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery({ queryKey: ['meeting', meetingId], queryFn: () => meetingsApi.get(meetingId), enabled: !!meetingId });
  const [resDate, setResDate] = useState('');
  const [resStart, setResStart] = useState('');
  const [resEnd, setResEnd] = useState('');
  const [mom, setMom] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionDue, setActionDue] = useState('');
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
    mutationFn: () => meetingsApi.cancel(meetingId),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const saveAttendance = useMutation({
    mutationFn: (body) => meetingsApi.attendance(meetingId, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e.message),
  });
  const saveMom = useMutation({
    mutationFn: (body) => meetingsApi.mom(meetingId, body),
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
          {!isHeld && (
            <Panel title="Reschedule / close">
              <div className="field-grid">
                <div className="form-row"><label className="form-label">Date</label><input className="form-input" type="date" value={resDate} onChange={(e) => setResDate(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Start</label><input className="form-input" type="time" value={resStart} onChange={(e) => setResStart(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">End</label><input className="form-input" type="time" value={resEnd} onChange={(e) => setResEnd(e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="approve-btn" disabled={!resDate || reschedule.isPending} onClick={() => reschedule.mutate({ date: resDate, startTime: resStart || undefined, endTime: resEnd || undefined })}>Reschedule</button>
                <button type="button" className="approve-btn" disabled={held.isPending} onClick={() => held.mutate()}>Mark held</button>
                <button type="button" className="approve-btn" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</button>
              </div>
            </Panel>
          )}
          {isHeld && (
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
          <Panel title="MOM">
            {meeting.mom ? <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{meeting.mom}</p> : <EmptyState text="No MOM yet." />}
            <div className="form-row">
              <label className="form-label">Edit MOM</label>
              <textarea className="form-input" defaultValue={meeting.mom ?? ''} onChange={(e) => setMom(e.target.value)} placeholder="Minutes of meeting" />
            </div>
            <button type="button" className="approve-btn" disabled={saveMom.isPending} onClick={() => saveMom.mutate({ mom })}>Save MOM</button>
          </Panel>
          <Panel title={`Actions (${actions.length})`}>
            <DataTable
              columns={[
                { key: 'text', label: 'Action', render: (a) => a.text ?? '—' },
                { key: 'owner', label: 'Owner', render: (a) => empName(a.owner) },
                { key: 'due', label: 'Due', render: (a) => `${fmtDate(a.due)} · ${actionLabel(a)}` },
                { key: 'status', label: 'Status', render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status ?? '—'}</StatusPill> },
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
            <div className="field-grid" style={{ marginTop: 10 }}>
              <div className="form-row"><label className="form-label">Action text *</label><input className="form-input" value={actionText} onChange={(e) => setActionText(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Owner (employee id)</label><input className="form-input" value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} placeholder="Optional employee id" /></div>
              <div className="form-row"><label className="form-label">Due</label><input className="form-input" type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} /></div>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 8 }}
              disabled={addAction.isPending || !actionText.trim()}
              onClick={() => addAction.mutate({ text: actionText.trim(), owner: actionOwner || undefined, due: actionDue || undefined })}
            >
              Add action
            </button>
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

function AttendanceEditor({ invites, initial, onChange, onSave, saving }) {
  const [rows, setRows] = useState(null);
  const effective = rows ?? initial ?? invites.map((v) => ({ employee: idOf(v.employee), present: true }));
  function setPresent(i, present) {
    const next = effective.map((r, j) => (j === i ? { ...r, present } : r));
    setRows(next);
    onChange(next);
  }
  if (effective.length === 0) return <EmptyState text="No invitees to mark." />;
  return (
    <>
      <table className="data">
        <thead><tr><th>Invitee</th><th>Present</th></tr></thead>
        <tbody>
          {effective.map((r, i) => (
            <tr key={String(r.employee ?? i)}>
              <td>{empName(invites[i]?.employee)}</td>
              <td>
                <input type="checkbox" checked={!!r.present} onChange={(e) => setPresent(i, e.target.checked)} aria-label="Present" />
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

export function ResponseBox({ meeting, myEmpId }) {
  const queryClient = useQueryClient();
  const myInvite = useMemo(() => {
    const list = meeting?.invites ?? [];
    return list.find((v) => idOf(v.employee) === String(myEmpId)) ?? null;
  }, [meeting, myEmpId]);
  const [response, setResponse] = useState(myInvite?.response ?? 'Available');
  const [reason, setReason] = useState(myInvite?.reason ?? '');
  const [note, setNote] = useState(myInvite?.note ?? '');
  const [customReason, setCustomReason] = useState('');
  const [err, setErr] = useState('');

  const respond = useMutation({
    mutationFn: (body) => meetingsApi.respond(meeting._id ?? meeting.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  function submit() {
    setErr('');
    const finalReason = reason === 'Other — specify' ? customReason : reason;
    respond.mutate({ response, reason: finalReason || undefined, note: note || undefined });
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginTop: 8 }}>
      <div className="form-label">My availability — current: {myInvite?.response ?? 'no response yet'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <select className="filter-select" value={response} onChange={(e) => setResponse(e.target.value)}>
          <option value="Available">Available</option>
          <option value="Not Available">Not available</option>
          <option value="Pending">Pending</option>
        </select>
        <select className="filter-select" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Select reason</option>
          {UNAVAILABLE_REASONS.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        {reason === 'Other — specify' && (
          <input className="form-input" value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Specify reason" />
        )}
        <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        <button type="button" className="btn-primary" disabled={respond.isPending} onClick={submit}>
          {respond.isPending ? 'Sending…' : 'Send / Update response'}
        </button>
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
    </div>
  );
}
