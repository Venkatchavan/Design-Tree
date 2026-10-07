import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meApi, projectsApi } from '../lib/api.js';
import { UNAVAILABLE_REASONS, meetingsApi } from '../lib/phase4bApi.js';
import {
  CONDUCTED_BY_BY_TYPE,
  MEETING_SERVICES,
} from '../lib/meetingsLogic.js';
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

function defaultDate(sudden) {
  const d = new Date();
  if (!sudden) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultTime(sudden, which) {
  if (!sudden) return which === 'start' ? '11:00' : '12:00';
  const h = new Date().getHours();
  if (which === 'start') return `${String(h).padStart(2, '0')}:00`;
  return `${String((h + 1) % 24).padStart(2, '0')}:00`;
}

// v2 form (§5–§7): project team checklist (2A), service chips, responsible
// banner (3B), conducted-by by type, link/location swap, ref docs.
export function ScheduleMeetingModal({ sudden, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [checkedServices, setCheckedServices] = useState([]);
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [type, setType] = useState('Client / DRM');
  const [date, setDate] = useState(defaultDate(sudden));
  const [startTime, setStartTime] = useState(defaultTime(sudden, 'start'));
  const [endTime, setEndTime] = useState(defaultTime(sudden, 'end'));
  const [mode, setMode] = useState('Online');
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');
  const [conductedBy, setConductedBy] = useState('Client');
  const [externalParticipants, setExternalParticipants] = useState('');
  const [reason, setReason] = useState('');
  const [recording, setRecording] = useState('over');
  const [participants, setParticipants] = useState([]);
  const [additionalParticipants, setAdditionalParticipants] = useState('');
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');
  const [teamTouched, setTeamTouched] = useState(false);

  const projQ = useQuery({ queryKey: ['projects', 'mtg'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const projects = projQ.data?.items ?? [];
  const teamQ = useQuery({
    queryKey: ['project-team', project],
    queryFn: () => meetingsApi.projectTeam(project),
    enabled: !!project,
  });
  const team = teamQ.data ?? null;
  const members = useMemo(() => team?.members ?? [], [team]);
  const responsible = team?.responsible ?? null;

  const conductedOptions = useMemo(() => {
    const base = CONDUCTED_BY_BY_TYPE[type] ?? ['Other'];
    const names = members
      .map((m) => [m?.employee?.firstName, m?.employee?.lastName].filter(Boolean).join(' '))
      .filter(Boolean);
    const merged = [...base];
    for (const n of names) if (!merged.includes(n)) merged.push(n);
    return merged;
  }, [type, members]);

  // Defaults when the project changes: committed services, team ticked.
  useEffect(() => {
    if (!team) return;
    setCheckedServices(team.committedServices ?? []);
    if (!teamTouched) {
      setParticipants(members.map((m) => String(m?.employee?._id ?? m?.employee?.id ?? '')).filter(Boolean));
    }
    const base = CONDUCTED_BY_BY_TYPE[type] ?? ['Other'];
    setConductedBy(base[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamQ.data]);

  useEffect(() => {
    const base = CONDUCTED_BY_BY_TYPE[type] ?? ['Other'];
    setConductedBy((prev) => (base.includes(prev) ? prev : base[0]));
  }, [type]);

  const create = useMutation({
    mutationFn: (body) => meetingsApi.create(body),
    onSuccess: async (data) => {
      const item = data?.item ?? data;
      const id = item?._id ?? item?.id;
      const count = participants.length;
      if (files.length > 0 && id) {
        try {
          await meetingsApi.refDocs(id, files);
        } catch {
          /* keep meeting even if docs fail */
        }
      }
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['absence-log'] });
      const msg = sudden
        ? 'Sudden meeting saved. Mark attendance and record the MOM.'
        : `Meeting scheduled. Invitations sent to ${count} team member${count === 1 ? '' : 's'}.`;
      if (onCreated) onCreated(msg, id);
      else onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function toggleService(s) {
    setCheckedServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleParticipant(id) {
    setTeamTouched(true);
    setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e) {
    e.preventDefault();
    setErr('');
    const missing = [];
    if (!title.trim()) missing.push('a meeting title');
    if (!date) missing.push('a meeting date');
    if (startTime && endTime && endTime <= startTime) {
      setErr('End time must be after start time.');
      return;
    }
    if (checkedServices.length === 0) missing.push('at least one service');
    if (participants.length === 0) missing.push('at least one team member');
    if (sudden && !reason.trim()) missing.push('the reason for the sudden meeting');
    if (missing.length > 0) {
      setErr(`Add ${missing.join(', ')} to continue.`);
      return;
    }
    create.mutate({
      project: project || undefined,
      services: checkedServices,
      title: title.trim(),
      agenda: agenda || undefined,
      category: sudden ? 'Sudden' : 'Scheduled',
      type: type || undefined,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      mode: mode || undefined,
      link: mode === 'Online' ? link || undefined : undefined,
      location: mode !== 'Online' ? location || undefined : undefined,
      conductedBy: conductedBy || undefined,
      externalParticipants: externalParticipants || undefined,
      additionalParticipantsText: additionalParticipants || undefined,
      reason: sudden ? reason.trim() : undefined,
      participants: participants.map((employee) => ({ employee })),
    });
  }

  return (
    <Modal title={sudden ? 'Add sudden meeting' : 'Schedule meeting'} wide onClose={onClose}>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-faint)', marginBottom: 12 }}>
        {sudden ? 'Unplanned meeting' : 'Planned meeting'}
      </p>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => { setProject(e.target.value); setTeamTouched(false); }}>
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.code ? `${p.code} - ` : ''}{p.name ?? '—'}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Meeting type</label>
            <select className="filter-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value)}>
              <option>Client / DRM</option>
              <option>DesignTree / Arictech</option>
              <option>PMC</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        {project && (
          <div style={{ background: 'var(--teal-bg, #e6f7f4)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, marginBottom: 12 }}>
            {teamQ.isLoading ? 'Loading team…' : teamQ.isError ? 'Could not load project team.'
              : `Responsible: ${responsible?.label ?? 'Project SPOC'}`}
            <div style={{ color: 'var(--ink-muted)', fontSize: 11.5 }}>Set automatically from the project&apos;s committed services.</div>
          </div>
        )}
        <div className="form-row"><label className="form-label">Meeting title / subject</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly DRM review, Week 41" /></div>
        {sudden && (
          <>
            <div className="form-row"><label className="form-label">Reason for the sudden meeting</label><textarea className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What triggered this meeting?" /></div>
            <div className="form-row">
              <label className="form-label">Recording</label>
              <label style={{ display: 'flex', gap: 6, fontSize: 12.5, marginBottom: 4 }}><input type="radio" checked={recording === 'over'} onChange={() => setRecording('over')} /> Meeting is over: record attendance and MOM now</label>
              <label style={{ display: 'flex', gap: 6, fontSize: 12.5 }}><input type="radio" checked={recording === 'live'} onChange={() => setRecording('live')} /> Meeting in progress: add details as it runs</label>
            </div>
          </>
        )}
        <div className="field-grid">
          <div className="form-row"><label className="form-label">Meeting date</label><input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Start time</label><input className="form-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">End time</label><input className="form-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          <div className="form-row">
            <label className="form-label">Meeting mode</label>
            <select className="filter-select" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>Online</option>
              <option>Offline</option>
            </select>
          </div>
          {mode === 'Online' ? (
            <div className="form-row"><label className="form-label">Meeting link</label><input className="form-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></div>
          ) : (
            <div className="form-row"><label className="form-label">Meeting location</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site office, Hebbal" /></div>
          )}
          <div className="form-row">
            <label className="form-label">Meeting conducted by</label>
            <select className="filter-select" style={{ width: '100%' }} value={conductedBy} onChange={(e) => setConductedBy(e.target.value)}>
              {conductedOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">External participants</label><input className="form-input" value={externalParticipants} onChange={(e) => setExternalParticipants(e.target.value)} placeholder="Client PM, architect, PMC…" /></div>
        </div>
        <div className="form-row">
          <label className="form-label">Services discussed</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MEETING_SERVICES.map((s) => (
              <label key={s} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 20, padding: '5px 11px', background: checkedServices.includes(s) ? 'var(--teal-bg, #e6f7f4)' : undefined }}>
                <input type="checkbox" checked={checkedServices.includes(s)} onChange={() => toggleService(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row"><label className="form-label">Meeting agenda / purpose</label><textarea className="form-input" value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
        <div className="form-row">
          <label className="form-label">Project reference / documents</label>
          <input type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 4 }}>Shared with the selected team members along with the meeting link.</div>
        </div>
        <div className="section-label">Project team members ({participants.length} selected)</div>
        {!project ? <EmptyState text="Select a project to load its team." />
          : teamQ.isLoading ? <EmptyState text="Loading project team…" />
          : teamQ.isError ? <div className="login-error" role="alert" style={{ display: 'block' }}>Could not load the project team.</div>
          : members.length === 0 ? <EmptyState text="No team members linked to this project." />
          : (
            <>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                {members.map((m) => {
                  const id = String(m?.employee?._id ?? m?.employee?.id ?? '');
                  const e = m?.employee ?? {};
                  return (
                    <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '3px 0' }}>
                      <input type="checkbox" checked={participants.includes(id)} onChange={() => toggleParticipant(id)} />
                      <span>{empName(e)} · {e.designation ?? ''}{m.service ? ` · ${m.service}` : ''}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 4 }}>Pulled from the selected project&apos;s team. Selected members receive the invitation in their Meeting Dashboard.</div>
            </>
          )}
        <div className="form-row" style={{ marginTop: 10 }}><label className="form-label">Additional participants (not in project team)</label><input className="form-input" value={additionalParticipants} onChange={(e) => setAdditionalParticipants(e.target.value)} placeholder="Comma-separated names" /></div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="approve-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : sudden ? 'Save sudden meeting' : 'Schedule meeting'}
          </button>
        </div>
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
                      <button type="button" className="approve-btn" onClick={() => flipAction.mutate({ actionId: a._id ?? a.id, status: 'Pending' })}>Reopen</button>
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
