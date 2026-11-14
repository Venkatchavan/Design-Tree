import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, toQuery } from '../lib/api.js';
import Panel from './Panel.jsx';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';

// 13 Nov 2026: DBR (Design Basis Report) workflow.
//   Engineer DBR details → Team Lead review → Shared with client → Client response → Final approval
// mode: 'tl' (enter / review / forward), 'spoc' (share with client / feedback),
// 'view' (directors and others: status cards + progress + activity log).
const dbrApi = {
  list: (project) => request(`/api/dbr${toQuery({ project })}`),
  submit: (body) => request('/api/dbr', { method: 'POST', body: JSON.stringify(body) }),
  review: (id, body) => request(`/api/dbr/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),
  forward: (id) => request(`/api/dbr/${id}/forward`, { method: 'POST', body: '{}' }),
  share: (id, body) => request(`/api/dbr/${id}/share`, { method: 'POST', body: JSON.stringify(body) }),
  feedback: (id, body) => request(`/api/dbr/${id}/feedback`, { method: 'PATCH', body: JSON.stringify(body) }),
};

const SERVICES = ['STR', 'ELE', 'HVAC', 'PHE', 'FIRE'];
const STEPS = ['Engineer DBR Details', 'Team Lead Review', 'Shared with Client', 'Client Response', 'Final Approval'];
const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const empName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || '—';
const statusTone = (s) => ({ Approved: 'forest', Reviewed: 'forest', 'Forwarded to SPOC': 'blueprint', 'Under Client Review': 'blueprint', Revised: 'violet', 'Changes Required': 'amber', 'Revision Required': 'amber', 'Under TL Review': 'amber' }[s] ?? 'neutral');
const clientTone = (s) => ({ Approved: 'forest', 'Revision Required': 'amber', 'Awaiting Response': 'amber' }[s] ?? 'neutral');

// How far along the five steps the DBR is (completed steps count).
function stepsDone(d) {
  if (!d) return 0;
  if (d.status === 'Approved') return 5;
  if (d.clientRespondedAt && d.clientStatus !== 'Awaiting Response') return 4;
  if (d.sharedAt && ['Under Client Review'].includes(d.status)) return 3;
  if (['Reviewed', 'Revised', 'Forwarded to SPOC'].includes(d.status)) return 2;
  return 1;
}

function Stepper({ dbr }) {
  const done = stepsDone(dbr);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, margin: '8px 0 4px', overflowX: 'auto' }}>
      {STEPS.map((label, i) => {
        const complete = i < done;
        const current = i === done;
        const color = complete ? 'var(--forest, #16a34a)' : current ? 'var(--blueprint, #2563eb)' : 'var(--line, #d4d4d8)';
        return (
          <div key={label} style={{ flex: 1, minWidth: 96, textAlign: 'center', position: 'relative' }}>
            {i > 0 && <div style={{ position: 'absolute', top: 10, right: '50%', width: '100%', height: 3, background: i <= done ? 'var(--forest, #16a34a)' : 'var(--line, #d4d4d8)' }} />}
            <div aria-hidden="true" style={{ position: 'relative', margin: '0 auto', width: 22, height: 22, borderRadius: '50%', background: complete ? color : 'var(--surface, #fff)', border: `3px solid ${color}`, color: '#fff', fontSize: 12, lineHeight: '16px' }}>{complete ? '✓' : ''}</div>
            <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: current ? 600 : 400 }}>{label}{complete ? ' (done)' : current ? ' (current)' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusCards({ dbr }) {
  const card = (label, value, tone) => (
    <div className="kpi-card" style={{ minWidth: 0 }}>
      <div className="kpi-label">{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{tone ? <StatusPill tone={tone}>{value}</StatusPill> : value}</div>
    </div>
  );
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      {card('DBR Status', dbr.status, statusTone(dbr.status))}
      {card('Client Response', dbr.clientStatus === 'Not shared' ? 'Not shared yet' : dbr.clientStatus, clientTone(dbr.clientStatus))}
      {card('Submitted On', fmt(dbr.sharedAt ?? dbr.submittedAt))}
      {card('Revision Count', dbr.revisionCount ?? 0)}
    </div>
  );
}

function ActivityLog({ dbr }) {
  const rows = [...(dbr.log ?? [])].reverse();
  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-label">Activity log</div>
      {rows.length === 0 ? <p style={{ fontSize: 13 }}>No activity yet.</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
          {rows.map((r, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--line, #eee)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-muted)', minWidth: 150 }}>{fmtTime(r.at)}</span>
              <span style={{ flex: 1 }}>{r.action}{r.note ? ` — ${r.note}` : ''}{r.by?.name ? ` · ${r.by.name}` : ''}</span>
              {r.actor && <StatusPill tone="violet">{r.actor}</StatusPill>}
            </li>
          ))}
        </ul>
      )}
      {(dbr.emailLog ?? []).length > 0 && (
        <details style={{ marginTop: 6, fontSize: 12.5 }}><summary style={{ cursor: 'pointer' }}>Email log</summary><ul>{dbr.emailLog.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
      )}
    </div>
  );
}

function SubmitForm({ projectId, existing, members, onDone }) {
  const queryClient = useQueryClient();
  const [service, setService] = useState(existing?.service ?? 'STR');
  const [details, setDetails] = useState(existing?.details ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [engineer, setEngineer] = useState(existing?.engineer?._id ?? '');
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => dbrApi.submit({ project: projectId, service, details: details.trim(), reference: reference.trim() || undefined, engineer: engineer || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dbr', projectId] }); onDone?.(); },
    onError: (e) => setErr(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); if (!details.trim()) { setErr('Enter the DBR details.'); return; } save.mutate(); }}>
      <div className="field-grid">
        <div className="form-row"><label className="form-label" htmlFor="dbr-service">Service</label>
          <select id="dbr-service" className="filter-select" style={{ width: '100%' }} value={service} disabled={!!existing} onChange={(e) => setService(e.target.value)}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="form-row"><label className="form-label" htmlFor="dbr-engineer">Prepared by (engineer)</label>
          <select id="dbr-engineer" className="filter-select" style={{ width: '100%' }} value={engineer} onChange={(e) => setEngineer(e.target.value)}>
            <option value="">Select engineer</option>
            {members.map((m) => <option key={m._id} value={m._id}>{empName(m)}{m.designation ? ` · ${m.designation}` : ''}</option>)}
          </select>
        </div>
        <div className="form-row"><label className="form-label" htmlFor="dbr-ref">Reference / document link</label><input id="dbr-ref" className="form-input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      </div>
      <div className="form-row"><label className="form-label" htmlFor="dbr-details">DBR details *</label><textarea id="dbr-details" className="form-input" rows={5} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : existing ? 'Save revised DBR details' : 'Submit DBR details'}</button>
    </form>
  );
}

function TlActions({ dbr, projectId }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');
  const done = () => { setRemarks(''); setErr(''); queryClient.invalidateQueries({ queryKey: ['dbr', projectId] }); };
  const review = useMutation({ mutationFn: (decision) => dbrApi.review(dbr._id, { decision, remarks: remarks.trim() || undefined }), onSuccess: done, onError: (e) => setErr(e.message) });
  const forward = useMutation({ mutationFn: () => dbrApi.forward(dbr._id), onSuccess: done, onError: (e) => setErr(e.message) });
  if (dbr.status === 'Approved') return <p style={{ fontSize: 13 }}>Approved by the client on {fmt(dbr.approvedAt)}.</p>;
  const busy = review.isPending || forward.isPending;
  const canForward = ['Reviewed', 'Revised'].includes(dbr.status);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="section-label">Internal review status</div>
      {dbr.status === 'Revision Required' && dbr.clientComments && (
        <p style={{ fontSize: 13 }}><b>Client comments:</b> {dbr.clientComments}</p>
      )}
      <div className="form-row"><label className="form-label" htmlFor={`dbr-remarks-${dbr._id}`}>Remarks</label><textarea id={`dbr-remarks-${dbr._id}`} className="form-input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Please review the scope for HVAC" /></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="approve-btn" disabled={busy} onClick={() => review.mutate('Approved')}>Approved</button>
        <button type="button" className="approve-btn" disabled={busy} onClick={() => review.mutate('Reviewed')}>Reviewed</button>
        <button type="button" className="approve-btn" disabled={busy} onClick={() => review.mutate('Changes Required')}>Changes required</button>
        <button type="button" className="approve-btn" disabled={busy} onClick={() => review.mutate('Revised')}>Revised</button>
        <button type="button" className="btn-primary" disabled={busy || !canForward} title={canForward ? '' : 'Mark the DBR Reviewed / Approved or Revised first'} onClick={() => forward.mutate()}>Forward to SPOC</button>
      </div>
      {dbr.reviewRemarks && <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 6 }}>Last remarks: {dbr.reviewRemarks} · {fmt(dbr.reviewedAt)}</p>}
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
    </div>
  );
}

function SpocActions({ dbr, projectId, defaultEmail }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(dbr.clientEmail ?? defaultEmail ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comments, setComments] = useState('');
  const [err, setErr] = useState('');
  const done = () => { setErr(''); setComments(''); queryClient.invalidateQueries({ queryKey: ['dbr', projectId] }); };
  const share = useMutation({ mutationFn: () => dbrApi.share(dbr._id, { clientEmail: email.trim(), sharedAt: date || undefined }), onSuccess: done, onError: (e) => setErr(e.message) });
  const feedback = useMutation({ mutationFn: (clientStatus) => dbrApi.feedback(dbr._id, { clientStatus, comments: comments.trim() || undefined }), onSuccess: done, onError: (e) => setErr(e.message) });
  const received = ['Forwarded to SPOC', 'Under Client Review', 'Revision Required', 'Approved'].includes(dbr.status) || dbr.forwardedAt;
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 13 }}>
        <b>Received DBR details</b>{' '}
        {received ? <StatusPill tone="forest">Received</StatusPill> : <StatusPill tone="neutral">Not yet forwarded by the Team Lead</StatusPill>}
        {dbr.forwardedAt && <> · From: Team Lead{dbr.forwardedBy?.name ? ` (${dbr.forwardedBy.name})` : ''} · On: {fmt(dbr.forwardedAt)}</>}
      </p>
      {dbr.status !== 'Approved' && (
        <>
          <div className="section-label">Client communication</div>
          <div className="field-grid">
            <div className="form-row"><label className="form-label" htmlFor={`dbr-client-${dbr._id}`}>Client email ID</label><input id={`dbr-client-${dbr._id}`} type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="form-row"><label className="form-label" htmlFor={`dbr-date-${dbr._id}`}>Submission date</label><input id={`dbr-date-${dbr._id}`} type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <button type="button" className="btn-primary" disabled={share.isPending || !['Forwarded to SPOC', 'Under Client Review'].includes(dbr.status) || !email.trim()} onClick={() => share.mutate()}>
            {share.isPending ? 'Sharing…' : dbr.sharedAt ? 'Re-share with client' : 'Share with client'}
          </button>
          {dbr.sharedAt && (
            <>
              <div className="section-label" style={{ marginTop: 12 }}>Client feedback</div>
              <div className="form-row"><label className="form-label" htmlFor={`dbr-comments-${dbr._id}`}>Client comments</label><textarea id={`dbr-comments-${dbr._id}`} className="form-input" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} /></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="approve-btn" disabled={feedback.isPending} onClick={() => feedback.mutate('Approved')}>Approved</button>
                <button type="button" className="approve-btn" disabled={feedback.isPending} onClick={() => feedback.mutate('Revision Required')}>Revision required</button>
                <button type="button" className="approve-btn" disabled={feedback.isPending} onClick={() => feedback.mutate('Awaiting Response')}>Awaiting response</button>
              </div>
            </>
          )}
        </>
      )}
      {dbr.clientComments && <p style={{ fontSize: 12.5, marginTop: 6 }}><b>Client comments:</b> {dbr.clientComments}</p>}
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
    </div>
  );
}

export default function DbrWorkflowPanel({ projectId, mode = 'view', members = [], clientEmail = '' }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState('');
  const q = useQuery({ queryKey: ['dbr', projectId], queryFn: () => dbrApi.list(projectId), enabled: !!projectId, refetchInterval: 20000 });
  const items = q.data?.items ?? [];
  const roleTag = mode === 'tl' ? 'Team Lead' : mode === 'spoc' ? 'SPOC' : null;
  return (
    <Panel title={<>DBR – Design Basis Report{roleTag && <span style={{ marginLeft: 8 }}><StatusPill tone="blueprint">{roleTag}</StatusPill></span>}</>} sub="Engineer → Team Lead review → SPOC → Client review → Approval">
      {q.isLoading ? <EmptyState text="Loading DBR…" /> : q.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      ) : (
        <>
          {items.length === 0 && !adding && <EmptyState text={mode === 'tl' ? 'No DBR has been entered for this project yet.' : 'No DBR has been recorded for this project yet.'} />}
          {items.map((d) => (
            <div key={d._id} style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <b>{d.title || 'Design Basis Report'} · {d.service}</b>
                <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Prepared by {empName(d.engineer)} · submitted {fmt(d.submittedAt)}</span>
              </div>
              <StatusCards dbr={d} />
              <Stepper dbr={d} />
              <div style={{ marginTop: 8 }}>
                <div className="section-label">Engineer submission</div>
                <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{d.details || '—'}</p>
                {d.reference && <p style={{ fontSize: 12.5 }}>Reference: {d.reference}</p>}
              </div>
              {mode === 'tl' && d.status !== 'Approved' && (
                editing === d._id
                  ? <SubmitForm projectId={projectId} existing={d} members={members} onDone={() => setEditing('')} />
                  : <button type="button" className="approve-btn" onClick={() => setEditing(d._id)}>Edit / revise DBR details</button>
              )}
              {mode === 'tl' && <TlActions dbr={d} projectId={projectId} />}
              {mode === 'spoc' && <SpocActions dbr={d} projectId={projectId} defaultEmail={clientEmail} />}
              <ActivityLog dbr={d} />
            </div>
          ))}
          {mode === 'tl' && (adding
            ? <SubmitForm projectId={projectId} members={members} onDone={() => setAdding(false)} />
            : <button type="button" className="btn-primary" onClick={() => setAdding(true)}>+ Enter DBR details</button>)}
        </>
      )}
    </Panel>
  );
}
