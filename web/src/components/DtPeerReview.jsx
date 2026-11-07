import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../lib/api.js';
import Panel from './Panel.jsx';
import KpiCard from './KpiCard.jsx';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import './DtPeerReview.css';

// DT Peer Review (3 Nov 2026): the DesignTree Structural Peer Review dashboard,
// laid out like the client's status report. Lives under the left-nav Peer
// Review item; the per-project Peer Review column is a separate record set.
// 07 Nov 2026: Admin allots the project to the review team (nobody types team
// names); the allotted team works the package; directors only read it.

const B = '/api/dt-peer-review';
const send = (path, method, body) => request(path, { method, body: body ? JSON.stringify(body) : undefined });
const id = (v) => String(v?._id ?? v ?? '');
const person = (e) => (e && typeof e === 'object' ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : '');
const dmy = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const stampText = (s) => (s?.at ? `${s.byName || '—'} · ${dmy(s.at)}` : '—');
const projectLabel = (p) => (p ? [p.jobNumber || p.code, p.name].filter(Boolean).join(' · ') : '—');
const STATUS_TONE = { 'Signed off': 'forest', 'Open comments': 'rust', 'In review': 'amber', 'Not started': 'neutral', Verified: 'forest', 'In Progress': 'amber', 'Not Started': 'neutral', 'N.A.': 'neutral', Approved: 'forest', Submitted: 'teal', Pending: 'amber' };

export default function DtPeerReview() {
  const qc = useQueryClient();
  const meta = useQuery({ queryKey: ['dt-peer-review', 'meta'], queryFn: () => request(`${B}/meta`) });
  const list = useQuery({ queryKey: ['dt-peer-review', 'list'], queryFn: () => request(B) });
  const packages = useMemo(() => list.data?.items ?? [], [list.data]);
  const [picked, setSelected] = useState('');
  const [err, setErr] = useState('');
  // Default to the most recently updated package until one is picked.
  const current = packages.find((p) => id(p.item) === picked) ?? packages[0];
  const selected = current ? id(current.item) : '';

  const mutate = useMutation({
    mutationFn: ({ path, method = 'POST', body }) => send(path, method, body),
    onSuccess: (data) => {
      setErr('');
      qc.invalidateQueries({ queryKey: ['dt-peer-review'] });
      if (data?.item) setSelected(id(data.item));
    },
    onError: (e) => setErr(e.message),
  });
  const run = (path, body, method) => mutate.mutate({ path, body, method });

  const free = (meta.data?.projects ?? []).filter((p) => !packages.some((x) => id(x.item.project) === id(p)));
  const canAllot = !!meta.data?.access?.allot;
  const canEdit = !!current?.canWrite;

  return (
    <div className="dtpr">
      <div className="page-head dtpr-head">
        <div>
          <h1 className="page-title">DT Peer Review</h1>
          <div className="page-sub">Structural (STR) peer review — package status, review stages, approvals, comments and master checklist</div>
        </div>
        {current && <button type="button" className="btn sm" onClick={() => window.print()}>Print report</button>}
      </div>

      <Panel>
        <div className="dtpr-pick">
          <label className="form-label" htmlFor="dtpr-project">Project</label>
          <select id="dtpr-project" className="filter-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {!packages.length && <option value="">No peer review packages yet</option>}
            {packages.map(({ item, summary }) => (
              <option key={id(item)} value={id(item)}>{projectLabel(item.project)} — {summary.status}</option>
            ))}
          </select>
          {canAllot && <AllotProject projects={free} employees={meta.data?.employees ?? []} busy={mutate.isPending} onCreate={(body) => run(B, body)} />}
        </div>
        {(list.error || meta.error) && <div className="login-error" role="alert" style={{ display: 'block' }}>{(list.error || meta.error).message}</div>}
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      </Panel>

      {list.isLoading ? <EmptyState text="Loading peer review packages…" /> : !current ? (
        <EmptyState text={canAllot ? 'Allot a Structural project to the review team above.' : 'No project has been allotted for DT Peer Review yet.'} />
      ) : (
        <Package key={selected} data={current} meta={meta.data ?? {}} canEdit={canEdit && !current.summary.released} canAllot={canAllot && !current.summary.released} busy={mutate.isPending} run={(path, body, method) => run(`${B}/${selected}${path}`, body, method)} />
      )}
    </div>
  );
}

// Admin only: pick a Structural project and the review team it is allotted to.
function AllotProject({ projects, employees, busy, onCreate }) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState('');
  const [team, setTeam] = useState([]);
  if (!open) return <button type="button" className="btn-primary" onClick={() => setOpen(true)} disabled={!projects.length} title={projects.length ? '' : 'Every eligible Structural project is already allotted'}>Allot project to review team</button>;
  return (
    <form className="dtpr-form" onSubmit={(e) => { e.preventDefault(); onCreate({ project, reviewTeam: team }); setOpen(false); setProject(''); setTeam([]); }}>
      <select className="filter-select" aria-label="Structural project" value={project} onChange={(e) => setProject(e.target.value)} required>
        <option value="">Select Structural project</option>
        {projects.map((p) => <option key={id(p)} value={id(p)}>{projectLabel(p)}</option>)}
      </select>
      <TeamPicker employees={employees} value={team} onChange={setTeam} />
      <button type="submit" className="btn-primary" disabled={busy || !project || !team.length}>Allot project</button>
      <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}

function TeamPicker({ employees, value, onChange }) {
  if (!employees.length) return <span className="dtpr-note">No review team members are available to allot.</span>;
  return (
    <fieldset className="dtpr-team-pick">
      <legend className="form-label">Review team</legend>
      {employees.map((e) => (
        <label key={id(e)} className="dtpr-check">
          <input type="checkbox" checked={value.includes(id(e))} onChange={(ev) => onChange(ev.target.checked ? [...value, id(e)] : value.filter((v) => v !== id(e)))} />
          {person(e)}{e.designation ? ` · ${e.designation}` : ''}
        </label>
      ))}
    </fieldset>
  );
}

function Package({ data, meta, canEdit, canAllot, busy, run }) {
  const { item, summary: s } = data;
  const [editing, setEditing] = useState(false);
  const [allotting, setAllotting] = useState(false);
  const stages = meta.stages ?? [];
  return (
    <>
      <Panel title={item.project?.name ?? 'Project'} sub={`${item.deliverableStage || '—'} · Peer Review applies to Structural (STR) services only`}>
        {editing ? <HeaderForm item={item} busy={busy} onSave={(body) => { run('', body, 'PATCH'); setEditing(false); }} onCancel={() => setEditing(false)} /> : (
          <>
            <dl className="dtpr-info">
              {[['Project', item.project?.name], ['Location', item.location], ['Client', item.client], ['Principal Consultant', item.principalConsultant], ['Service', 'Structural (STR)'], ['Deliverable stage', item.deliverableStage], ['Peer review', 'DesignTree Service Consultants Pvt. Ltd.']].map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
              ))}
            </dl>
            {canEdit && <button type="button" className="btn sm" onClick={() => setEditing(true)}>Edit details</button>}
          </>
        )}
      </Panel>

      <Panel title="1. Package status">
        <div className={`dtpr-status ${s.released ? 'released' : s.blocked ? 'blocked' : 'ready'}`}>
          <b>{s.status}</b>
          {s.released ? <span>Released by {stampText(s.released)}</span> : s.blockers.length > 0 && <ul>{s.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          {canEdit && !s.blocked && !s.released && <button type="button" className="btn-primary" disabled={busy} onClick={() => run('/release')}>Mark Released for Issue</button>}
        </div>
        <div className="kpi-grid cols-3">
          <KpiCard label="Master checklist" value={`${s.checklist.pct}%`} accent="blueprint" />
          <KpiCard label="Stages signed off" value={`${s.signed} / ${s.stages.length}`} accent="forest" />
          <KpiCard label="Open comments" value={s.comments.open} accent={s.comments.open ? 'rust' : 'forest'} />
          <KpiCard label="Average closure time" value={s.comments.avgClosureDays == null ? '—' : `${s.comments.avgClosureDays} days`} accent="teal" />
          <KpiCard label="Overdue comments" value={s.comments.overdue} accent={s.comments.overdue ? 'rust' : 'forest'} />
          <KpiCard label="Approvals" value={`${s.approvals.done} / ${s.approvals.total}`} accent="amber" />
        </div>
        <p className="dtpr-note">
          {s.checklist.closed} of {s.checklist.total} checklist items closed · Current: {s.current} · {s.comments.total} raised, {s.comments.closed} closed
          {s.comments.closed ? ` · closure average across ${s.comments.closed} closed comment${s.comments.closed === 1 ? '' : 's'}` : ''} · overdue = no reply within {meta.responseTargetDays ?? 7} days · approvals count Approved or N.A.
        </p>
      </Panel>

      <Panel title="2. Review team" sub={item.allottedBy?.at ? `Allotted by ${stampText(item.allottedBy)}` : 'Allotted by Admin'}>
        <div className="dtpr-scroll">
          <table className="data"><thead><tr><th>Name</th><th>Employee ID</th><th>Designation</th></tr></thead>
            <tbody>{(item.reviewTeam ?? []).length === 0 ? <tr><td colSpan={3}>No review team allotted.</td></tr> : item.reviewTeam.map((e) => <tr key={id(e)}><td>{person(e)}</td><td>{e.empId || '—'}</td><td>{e.designation || '—'}</td></tr>)}</tbody>
          </table>
        </div>
        {canAllot && (allotting
          ? <TeamForm employees={meta.employees ?? []} current={(item.reviewTeam ?? []).map(id)} busy={busy} onSave={(reviewTeam) => { run('/team', { reviewTeam }, 'PUT'); setAllotting(false); }} onCancel={() => setAllotting(false)} />
          : <button type="button" className="btn sm" onClick={() => setAllotting(true)}>Change review team</button>)}
      </Panel>

      <Panel title="3. Review stage progress">
        <div className="dtpr-scroll">
          <table className="data"><thead><tr><th>Stage</th><th>Description</th><th>Items closed</th><th>Open comments</th><th>Status</th></tr></thead>
            <tbody>{s.stages.map((st) => (
              <tr key={st.code}>
                <td><b>{st.code}</b></td><td>{st.name}</td><td>{st.itemsClosed} / {st.items}</td><td>{st.openComments}</td>
                <td>
                  <StatusPill tone={STATUS_TONE[st.status]}>{st.status}</StatusPill>
                  {st.signedOff && <div className="dtpr-stamp">{stampText(st.signedOff)}</div>}
                  {canEdit && st.canSignOff && <button type="button" className="btn sm" disabled={busy} onClick={() => run(`/stages/${st.code}/sign-off`)}>Sign off</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="dtpr-note">A stage can be marked complete only when all its checklist items are Verified or N.A. and it has no open comments, and only by the allotted review team.</p>
      </Panel>

      <Panel title="4. Approval gate">
        <div className="dtpr-scroll"><table className="data"><thead><tr><th>Deliverable</th><th>Status</th><th>By / date</th></tr></thead>
          <tbody>{(item.approvals ?? []).map((a) => (
            <tr key={id(a)}>
              <td>{a.deliverable}</td>
              <td>{canEdit ? (
                <select className="filter-select" aria-label={`${a.deliverable} status`} value={a.status} disabled={busy} onChange={(e) => run(`/approvals/${id(a)}`, { status: e.target.value }, 'PATCH')}>
                  {(meta.approvalStatus ?? []).map((v) => <option key={v}>{v}</option>)}
                </select>
              ) : <StatusPill tone={STATUS_TONE[a.status]}>{a.status}</StatusPill>}</td>
              <td>{stampText(a.stamped)}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="dtpr-note">The package stays blocked while any review comment is open. Only the allotted review team can mark it Released for Issue.</p>
      </Panel>

      <Panel title="5. Comments log" sub={`${s.comments.total} comments · ${s.comments.open} open (${s.comments.awaitingConsultant} awaiting consultant response, ${s.comments.awaitingDt} awaiting DesignTree review) · ${s.comments.closed} closed`}>
        {canEdit && <NewComment stages={stages} busy={busy} onAdd={(body) => run('/comments', body)} />}
        {(item.comments ?? []).length === 0 ? <EmptyState text="No review comments raised yet." /> : (
          <div className="dtpr-scroll">
            <table className="data dtpr-comments">
              <thead><tr><th>#</th><th>Stage</th><th>Document</th><th>Topic</th><th>Page / Detail</th><th>Round</th><th>Comment date</th><th>DT Comment / Question</th><th>Response date</th><th>Response to Comment / Question</th></tr></thead>
              <tbody>{item.comments.map((c, n) => <CommentRows key={id(c)} n={n + 1} c={c} state={s.commentStates[id(c)]} canEdit={canEdit} busy={busy} run={run} />)}</tbody>
            </table>
          </div>
        )}
        <p className="dtpr-note"><span className="dtpr-key dt" /> DesignTree comment or review · <span className="dtpr-key resp" /> Principal Consultant response · <span className="dtpr-key wait" /> response awaited. Each round is a DesignTree comment followed by the consultant&apos;s response; later DesignTree rounds state COMMENT IS OPEN or COMMENT IS CLOSED.</p>
      </Panel>

      <Panel title="6. Master checklist" sub={`${s.checklist.pct}% complete · ${s.checklist.verified} verified · ${s.checklist.inProgress} in progress · ${s.checklist.notStarted} not started${s.checklist.na ? ` · ${s.checklist.na} N.A.` : ''}`}>
        {canEdit && <NewItem stages={stages} busy={busy} onAdd={(body) => run('/checklist', body)} />}
        <div className="dtpr-scroll">
          <table className="data"><thead><tr><th>Stage</th><th>Item</th><th>Status</th><th>Stamped by / date</th><th>Remarks</th></tr></thead>
            <tbody>{(item.checklist ?? []).map((i) => {
              const locked = !!s.stages.find((st) => st.code === i.stage)?.signedOff;
              return (
                <tr key={id(i)}>
                  <td>{i.stage}</td><td>{i.item}</td>
                  <td>{canEdit && !locked ? (
                    <select className="filter-select" aria-label={`${i.item} status`} value={i.status} disabled={busy} onChange={(e) => run(`/checklist/${id(i)}`, { status: e.target.value }, 'PATCH')}>
                      {(meta.itemStatus ?? []).map((v) => <option key={v}>{v}</option>)}
                    </select>
                  ) : <StatusPill tone={STATUS_TONE[i.status]}>{i.status}</StatusPill>}</td>
                  <td>{stampText(i.stamped)}</td>
                  <td>{canEdit && !locked ? <Remarks value={i.remarks} onSave={(remarks) => run(`/checklist/${id(i)}`, { remarks }, 'PATCH')} /> : (i.remarks || '')}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function CommentRows({ n, c, state, canEdit, busy, run }) {
  const rounds = c.rounds ?? [];
  const last = rounds[rounds.length - 1];
  const open = state?.open;
  const rows = rounds.map((r, i) => {
    const dtText = i === 0 ? r.comment : [`COMMENT IS ${String(r.verdict ?? '').toUpperCase()}`, r.comment].filter(Boolean).join('\n');
    const awaited = !r.response && i === rounds.length - 1 && r.verdict !== 'Closed';
    return (
      <tr key={id(r) || i} className={i ? 'dtpr-round' : undefined}>
        {i === 0 && <><td rowSpan={rounds.length + (canEdit && open ? 1 : 0)}><b>{n}</b><div className="dtpr-stamp">{state?.label}{state?.overdue ? ' · overdue' : ''}</div></td><td rowSpan={rounds.length + (canEdit && open ? 1 : 0)}>{c.stage}</td><td rowSpan={rounds.length + (canEdit && open ? 1 : 0)}>{c.document}</td><td rowSpan={rounds.length + (canEdit && open ? 1 : 0)}>{c.topic}</td><td rowSpan={rounds.length + (canEdit && open ? 1 : 0)}>{c.detail}</td></>}
        <td>R{i + 1}</td><td>{dmy(r.commentDate)}</td>
        <td className={`dtpr-dt${r.verdict === 'Closed' ? ' closed' : ''}`}>{dtText}</td>
        <td>{dmy(r.responseDate)}</td>
        <td className={r.response ? 'dtpr-resp' : r.verdict === 'Closed' ? '' : awaited ? 'dtpr-wait' : ''}>
          {r.response || (r.verdict === 'Closed' ? '' : awaited ? 'Awaiting response from Principal Consultant' : '')}
        </td>
      </tr>
    );
  });
  if (canEdit && open) rows.push(<tr key="act"><td colSpan={5}><RoundForm needsResponse={!last?.response} busy={busy} onSubmit={(body) => run(`/comments/${id(c)}/rounds`, body)} /></td></tr>);
  if (open && last?.response && !canEdit) {
    rows.push(<tr key="await" className="dtpr-round"><td>R{rounds.length + 1}</td><td /><td className="dtpr-wait" colSpan={3}>Awaiting DesignTree review of the response</td></tr>);
  }
  return <>{rows}</>;
}

function RoundForm({ needsResponse, busy, onSubmit }) {
  const [textValue, setText] = useState('');
  const [verdict, setVerdict] = useState('Open');
  const [when, setWhen] = useState('');
  const submit = (e) => {
    e.preventDefault();
    onSubmit(needsResponse ? { kind: 'response', response: textValue, responseDate: when || undefined } : { kind: 'review', verdict, comment: textValue, commentDate: when || undefined });
    setText('');
  };
  return (
    <form className="dtpr-form" onSubmit={submit}>
      {!needsResponse && (
        <select className="filter-select" aria-label="DesignTree review" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
          <option value="Open">COMMENT IS OPEN</option><option value="Closed">COMMENT IS CLOSED</option>
        </select>
      )}
      <input className="form-input dtpr-grow" aria-label={needsResponse ? 'Consultant response' : 'DesignTree remark'} placeholder={needsResponse ? 'Principal Consultant response' : 'DesignTree remark (optional when closing)'} value={textValue} onChange={(e) => setText(e.target.value)} required={needsResponse || verdict === 'Open'} />
      <input type="date" className="form-input" aria-label="Date" value={when} onChange={(e) => setWhen(e.target.value)} />
      <button type="submit" className="btn sm primary" disabled={busy}>{needsResponse ? 'Record response' : 'Add DesignTree round'}</button>
    </form>
  );
}

function NewComment({ stages, busy, onAdd }) {
  const blank = { stage: stages[0]?.code ?? 'S1', document: '', topic: '', detail: '', comment: '', commentDate: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="dtpr-form" onSubmit={(e) => { e.preventDefault(); onAdd({ ...f, commentDate: f.commentDate || undefined }); setF(blank); }}>
      <select className="filter-select" aria-label="Comment stage" value={f.stage} onChange={set('stage')}>{stages.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select>
      <input className="form-input" placeholder="Document" value={f.document} onChange={set('document')} />
      <input className="form-input" placeholder="Topic" value={f.topic} onChange={set('topic')} />
      <input className="form-input" placeholder="Page / Detail" value={f.detail} onChange={set('detail')} />
      <input className="form-input dtpr-grow" placeholder="DT Comment / Question" value={f.comment} onChange={set('comment')} required />
      <input type="date" className="form-input" aria-label="Comment date" value={f.commentDate} onChange={set('commentDate')} />
      <button type="submit" className="btn sm primary" disabled={busy}>Raise comment</button>
    </form>
  );
}

function NewItem({ stages, busy, onAdd }) {
  const [stage, setStage] = useState(stages[0]?.code ?? 'S1');
  const [itemText, setItem] = useState('');
  return (
    <form className="dtpr-form" onSubmit={(e) => { e.preventDefault(); onAdd({ stage, item: itemText }); setItem(''); }}>
      <select className="filter-select" aria-label="Checklist stage" value={stage} onChange={(e) => setStage(e.target.value)}>{stages.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select>
      <input className="form-input dtpr-grow" placeholder="New checklist item" value={itemText} onChange={(e) => setItem(e.target.value)} required />
      <button type="submit" className="btn sm" disabled={busy}>Add item</button>
    </form>
  );
}

function Remarks({ value, onSave }) {
  const [v, setV] = useState(value ?? '');
  return <input className="form-input" aria-label="Remarks" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? '') && onSave(v)} />;
}

function TeamForm({ employees, current, busy, onSave, onCancel }) {
  const [team, setTeam] = useState(current);
  return (
    <form className="dtpr-form" onSubmit={(e) => { e.preventDefault(); onSave(team); }}>
      <TeamPicker employees={employees} value={team} onChange={setTeam} />
      <button type="submit" className="btn-primary" disabled={busy || !team.length}>Save team</button>
      <button type="button" className="btn sm ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function HeaderForm({ item, busy, onSave, onCancel }) {
  const [f, setF] = useState({
    location: item.location ?? '', client: item.client ?? '', principalConsultant: item.principalConsultant ?? '', deliverableStage: item.deliverableStage ?? '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="field-grid">
        {[['location', 'Location'], ['client', 'Client'], ['principalConsultant', 'Principal Consultant'], ['deliverableStage', 'Deliverable stage']].map(([k, label]) => (
          <div className="form-row" key={k}><label className="form-label">{label}<input className="form-input" value={f[k]} onChange={set(k)} /></label></div>
        ))}
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>Save</button>{' '}
      <button type="button" className="btn sm ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}
