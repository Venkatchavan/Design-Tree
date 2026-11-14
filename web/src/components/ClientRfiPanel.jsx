import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rfiApi } from '../lib/functionsApi.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';
import Modal from './Modal.jsx';

const empName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || '—';
const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const projText = (p) => [p?.jobNumber || p?.code, p?.name].filter(Boolean).join(' · ') || '—';
const SERVICES = ['STR', 'ELE', 'HVAC', 'PHE', 'FIRE', 'BIM', 'GBS', 'QS', 'QA/QC'];
const tone = (s) => ({ Open: 'amber', 'In Progress': 'blueprint', Responded: 'forest', Closed: 'neutral' }[s] ?? 'neutral');
const today = () => new Date().toISOString().slice(0, 10);

function RfiHistory({ rfi }) {
  const rows = rfi.history ?? [];
  const mails = rfi.emailLog ?? [];
  if (!rows.length && !mails.length) return '—';
  return (
    <details>
      <summary style={{ cursor: 'pointer' }}>{rows.length} step{rows.length === 1 ? '' : 's'}</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12.5 }}>
        {rows.map((h, i) => <li key={`h${i}`}>{fmt(h.at)} · {h.action}{h.by?.name ? ` · ${h.by.name}` : ''}{h.note ? ` — ${h.note}` : ''}</li>)}
        {mails.map((m, i) => <li key={`m${i}`}>{m}</li>)}
      </ul>
    </details>
  );
}

function RegisterForm({ projectId, onDone }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({ subject: '', description: '', service: '', raiserName: '', raiserOrg: '', raiserEmail: '', cc: '', receivedOn: today(), due: '', assignedLead: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const leadsQ = useQuery({ queryKey: ['rfi-leads', projectId], queryFn: () => rfiApi.clientLeads(projectId), enabled: !!projectId });
  const leads = leadsQ.data?.items ?? [];
  const save = useMutation({
    mutationFn: (body) => rfiApi.clientRegister(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-rfis'] });
      onDone?.();
    },
    onError: (e) => setErr(e.message),
  });
  function submit(e) {
    e.preventDefault();
    setErr('');
    if (!f.description.trim()) return setErr('Enter the query raised.');
    if (!f.raiserEmail.trim()) return setErr('Enter the email of the person who raised the RFI — the response is emailed to them.');
    if (!f.assignedLead) return setErr('Assign the RFI to the concerned team lead.');
    const cc = f.cc.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    save.mutate({
      project: projectId,
      type: 'Client RFI',
      subject: f.subject.trim() || undefined,
      description: f.description.trim(),
      service: f.service || undefined,
      raiserName: f.raiserName.trim() || undefined,
      raiserOrg: f.raiserOrg.trim() || undefined,
      raiserEmail: f.raiserEmail.trim(),
      ccEmails: cc.length ? cc : undefined,
      receivedOn: f.receivedOn || undefined,
      due: f.due || undefined,
      assignedLead: f.assignedLead,
    });
  }
  return (
    <form onSubmit={submit}>
      <div className="field-grid">
        <div className="form-row"><label className="form-label" htmlFor="rfi-raiser">Raised by (name)</label><input id="rfi-raiser" className="form-input" value={f.raiserName} onChange={set('raiserName')} /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-org">Organisation</label><input id="rfi-org" className="form-input" value={f.raiserOrg} onChange={set('raiserOrg')} placeholder="Client / architect / PMC" /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-email">Raiser's email *</label><input id="rfi-email" type="email" className="form-input" value={f.raiserEmail} onChange={set('raiserEmail')} /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-cc">CC (stakeholder emails)</label><input id="rfi-cc" className="form-input" value={f.cc} onChange={set('cc')} placeholder="Separate with commas" /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-received">Received on</label><input id="rfi-received" type="date" className="form-input" value={f.receivedOn} onChange={set('receivedOn')} /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-due">Response due</label><input id="rfi-due" type="date" className="form-input" value={f.due} onChange={set('due')} /></div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-service">Service</label>
          <select id="rfi-service" className="filter-select" style={{ width: '100%' }} value={f.service} onChange={set('service')}>
            <option value="">Select service</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row"><label className="form-label" htmlFor="rfi-lead">Assign to team lead *</label>
          <select id="rfi-lead" className="filter-select" style={{ width: '100%' }} value={f.assignedLead} onChange={set('assignedLead')} disabled={leadsQ.isLoading}>
            <option value="">{leadsQ.isLoading ? 'Loading team leads…' : leads.length ? 'Select team lead' : 'No team lead allocated on this project'}</option>
            {leads.map((l) => <option key={l.employee._id} value={l.employee._id}>{empName(l.employee)}{l.services.length ? ` · ${l.services.join(', ')}` : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row"><label className="form-label" htmlFor="rfi-subject">Subject</label><input id="rfi-subject" className="form-input" value={f.subject} onChange={set('subject')} /></div>
      <div className="form-row"><label className="form-label" htmlFor="rfi-desc">Query raised *</label><textarea id="rfi-desc" className="form-input" rows={4} value={f.description} onChange={set('description')} /></div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Register RFI'}</button>
    </form>
  );
}

function RespondModal({ rfi, onClose }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(rfi.leadResponse?.text ?? '');
  const [err, setErr] = useState('');
  const respond = useMutation({
    mutationFn: () => rfiApi.clientRespond(rfi._id, text.trim()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['client-rfis'] }); onClose(); },
    onError: (e) => setErr(e.message),
  });
  return (
    <Modal title={`Respond to ${rfi.rfiNo}`} onClose={onClose} wide>
      <p style={{ fontSize: 13 }}><b>Query:</b> {rfi.description}</p>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
        Your response is emailed automatically to {rfi.raiserEmail || 'the raiser'}, with the SPOC{rfi.ccEmails?.length ? ` and ${rfi.ccEmails.join(', ')}` : ''} in CC.
      </p>
      <div className="form-row"><label className="form-label" htmlFor="rfi-response">Response *</label><textarea id="rfi-response" className="form-input" rows={6} value={text} onChange={(e) => setText(e.target.value)} /></div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <button type="button" className="btn-primary" disabled={respond.isPending || !text.trim()} onClick={() => respond.mutate()}>{respond.isPending ? 'Sending…' : 'Submit response'}</button>
    </Modal>
  );
}

// mode: 'spoc' (register + close), 'lead' (respond to RFIs assigned to me),
// 'log' (PTL and above: read-only full log).
export default function ClientRfiPanel({ projectId, mode = 'log' }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [responding, setResponding] = useState(null);
  const params = mode === 'lead' ? { mine: true } : { project: projectId };
  const q = useQuery({ queryKey: ['client-rfis', mode, projectId ?? ''], queryFn: () => rfiApi.clientList(params), refetchInterval: 20000, enabled: mode === 'lead' || !!projectId });
  const close = useMutation({
    mutationFn: (id) => rfiApi.clientStatus(id, 'Closed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-rfis'] }),
  });
  const rows = q.data?.items ?? [];
  const columns = [
    { key: 'rfiNo', label: 'RFI No.', render: (r) => r.rfiNo ?? '—' },
    ...(mode === 'lead' ? [{ key: 'project', label: 'Project', render: (r) => projText(r.project) }] : []),
    { key: 'received', label: 'Received', render: (r) => fmt(r.receivedOn ?? r.createdAt) },
    { key: 'raiser', label: 'Raised by', render: (r) => [r.raiserName, r.raiserOrg].filter(Boolean).join(' · ') || r.raiserEmail || '—' },
    { key: 'query', label: 'Query', render: (r) => <>{r.subject && <b>{r.subject}<br /></b>}{r.description}</> },
    { key: 'service', label: 'Service', render: (r) => r.service || '—' },
    { key: 'lead', label: 'Assigned TL', render: (r) => empName(r.assignedLead) },
    { key: 'due', label: 'Due', render: (r) => fmt(r.due) },
    { key: 'response', label: 'Response', render: (r) => r.leadResponse?.text ? <>{r.leadResponse.text}<br /><span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{fmt(r.leadResponse.at)}{r.leadResponse.by?.name ? ` · ${r.leadResponse.by.name}` : ''}</span></> : '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
    { key: 'history', label: 'History', render: (r) => <RfiHistory rfi={r} /> },
    ...(mode === 'log' ? [] : [{
      key: 'act',
      label: '',
      render: (r) => {
        if (mode === 'lead' && r.status !== 'Closed') return <button type="button" className="approve-btn" onClick={() => setResponding(r)}>{r.status === 'Responded' ? 'Update response' : 'Respond'}</button>;
        if (mode === 'spoc' && r.status === 'Responded') return <button type="button" className="approve-btn" disabled={close.isPending} onClick={() => close.mutate(r._id)}>Close</button>;
        return '—';
      },
    }]),
  ];
  const title = mode === 'lead' ? 'Client RFIs assigned to me' : 'RFI Log';
  const sub = mode === 'spoc'
    ? 'Register RFIs received from the client and assign them to the concerned team lead. The lead\'s response is emailed automatically to the raiser, with you in CC.'
    : mode === 'lead'
      ? 'Review the query with your engineers / QA-QC and submit the response. It is emailed automatically to the raiser with the SPOC and stakeholders in CC.'
      : 'All RFIs for this project — records, status, assignments, responses and history';
  return (
    <>
      {mode === 'spoc' && (
        <Panel title="Register RFI" sub="RFI received by email from the client / external stakeholder">
          {adding ? <RegisterForm projectId={projectId} onDone={() => setAdding(false)} /> : (
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>+ Register RFI</button>
          )}
        </Panel>
      )}
      <Panel title={title} sub={sub}>
        {q.isLoading ? <EmptyState text="Loading RFIs…" /> : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText={mode === 'lead' ? 'No client RFIs are assigned to you.' : 'No RFIs have been logged for this project.'} />
        )}
        {close.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{close.error.message}</div>}
      </Panel>
      {responding && <RespondModal rfi={responding} onClose={() => setResponding(null)} />}
    </>
  );
}
