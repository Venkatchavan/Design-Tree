import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request } from '../lib/api.js';
import { subscribeNotifications } from '../lib/realtime.js';
import Panel from '../components/Panel.jsx';
import './announcements.css';

const post = (path, body = {}) => request('/api/announcements' + path, { method: 'POST', body: JSON.stringify(body) });
const date = value => value ? new Date(value).toLocaleString() : '—';
function ErrorText({ error }) { return error ? <p role="alert" className="announcement-error">{error.message}</p> : null; }

function Compose({ onSent }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ack, setAck] = useState(false);
  const [audience, setAudience] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const preview = useMutation({ mutationFn: () => post('/preview'), onSuccess: result => { setAudience(result); setConfirmed(false); } });
  const send = useMutation({
    mutationFn: () => post('', { title, body, requireAcknowledgment: ack, audienceToken: audience.audienceToken, requestId: requestId.current }),
    onSuccess: result => onSent(result.item.id),
    onError: error => { if (error.status === 409) { setAudience(null); setConfirmed(false); } },
  });
  const editing = () => { requestId.current = crypto.randomUUID(); setConfirmed(false); send.reset(); };
  return <Panel title="Send an announcement" sub="Send one saved message to internal staff across all branches.">
    <form onSubmit={e => { e.preventDefault(); if (confirmed && audience) send.mutate(); }} className="announcement-form">
      <label>Title<input className="form-input" required maxLength={180} value={title} onChange={e => { editing(); setTitle(e.target.value); }} /></label>
      <label>Message<textarea className="form-input" required maxLength={10000} rows={7} value={body} onChange={e => { editing(); setBody(e.target.value); }} /></label>
      <label className="announcement-check"><input type="checkbox" checked={ack} onChange={e => { editing(); setAck(e.target.checked); }} />Ask each recipient to acknowledge this notice</label>
      <p><strong>Audience: All branches.</strong> Client, Architect, technical superuser, inactive accounts, and exited employees are excluded.</p>
      <button type="button" className="approve-btn" disabled={preview.isPending || send.isPending} onClick={() => preview.mutate()}>{preview.isPending ? 'Preparing preview…' : 'Preview audience'}</button>
      <ErrorText error={preview.error} />
      {audience && <section aria-label="Audience preview">
        <h3>{audience.recipientCount} staff accounts</h3>
        <ul>{audience.branches.map(b => <li key={b.branchName}>{b.branchName}: {b.count} recipients{b.count === 0 ? ' — no eligible staff' : ''}</li>)}</ul>
        {audience.warnings.length > 0 && <details><summary>{audience.warnings.length} accounts need a branch assignment check. They remain included.</summary><ul>{audience.warnings.map(w => <li key={w.user}>{w.name}: {w.issue}</li>)}</ul></details>}
        <p><strong>{title || 'Untitled announcement'}</strong></p><p className="announcement-body">{body}</p>
        <label className="announcement-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the message and recipient counts.</label>
      </section>}
      <ErrorText error={send.error} />
      <div><button type="submit" className="btn-primary" disabled={!audience || !confirmed || !title.trim() || !body.trim() || send.isPending}>{send.isPending ? 'Sending…' : 'Send to all branches'}</button></div>
      <p className="page-sub">Staff who are offline can read the saved notice after they reconnect. A bell alert does not confirm that they read it.</p>
    </form>
  </Panel>;
}

function Report({ id }) {
  const q = useQuery({ queryKey: ['announcements', 'report', id], queryFn: () => request(`/api/announcements/${id}/report`), refetchInterval: 10000 });
  if (q.isPending) return <p>Loading report…</p>;
  if (q.error) return <ErrorText error={q.error} />;
  return <Panel title="Recipient report" sub="Opened and acknowledged are individual staff actions. Counts use the branch recorded when the message was sent.">
    <div className="announcement-table-wrap"><table className="announcement-table"><thead><tr><th>Branch</th><th>Recipients</th><th>Opened</th><th>Unopened</th><th>Acknowledged</th></tr></thead><tbody>{q.data.branches.map(b => <tr key={b.branchName}><td>{b.branchName}</td><td>{b.recipients}</td><td>{b.opened}</td><td>{b.recipients - b.opened}</td><td>{b.acknowledged}</td></tr>)}</tbody></table></div>
    {q.data.item.status !== 'published' && <p role="status">Publication is pending. Recipient actions appear after publication completes. Automatic recovery is active.</p>}
    <details><summary>Individual recipient records</summary><div className="announcement-table-wrap"><table className="announcement-table"><thead><tr><th>Staff member</th><th>Branch at send time</th><th>Opened</th><th>Acknowledged</th></tr></thead><tbody>{q.data.recipients.map(r => <tr key={r.user}><td>{r.name}</td><td>{r.branchName}</td><td>{date(r.readAt)}</td><td>{date(r.acknowledgedAt)}</td></tr>)}</tbody></table></div></details>
  </Panel>;
}

function Detail({ id, canSend }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['announcements', 'detail', id], queryFn: () => request(`/api/announcements/${id}`), refetchInterval: 5000 });
  const read = useMutation({ mutationFn: () => post(`/${id}/read`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); } });
  const ack = useMutation({ mutationFn: () => post(`/${id}/acknowledge`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); } });
  const doc = q.data?.item;
  const markRead = read.mutate;
  useEffect(() => { if (doc?.status === 'published' && !doc.readAt && !read.isPending && !read.isError) markRead(); }, [doc?.status, doc?.readAt, read.isPending, read.isError, markRead]);
  return <>
    <Link to="/announcements">Back to announcements</Link>
    {q.isPending && <p>Loading announcement…</p>}
    <ErrorText error={q.error} />
    {doc && <Panel title={doc.title} sub={`From ${doc.authorName} · ${date(doc.publishedAt ?? doc.createdAt)}`}>
      {doc.status === 'pending' && <p role="status">Publication pending. The server will retry interrupted work automatically. Do not create another copy.</p>}
      {doc.lastError && <p role="status">{doc.lastError}</p>}
      <div className="announcement-body">{doc.body}</div>
      {doc.status === 'published' && <p>{doc.readAt ? `Opened ${date(doc.readAt)}` : 'Recording your open time…'}</p>}
      <ErrorText error={read.error} />
      {doc.requireAcknowledgment && doc.status === 'published' && (doc.acknowledgedAt ? <p role="status">Acknowledged {date(doc.acknowledgedAt)}</p> : <button type="button" className="btn-primary" disabled={ack.isPending} onClick={() => ack.mutate()}>{ack.isPending ? 'Saving…' : 'Acknowledge notice'}</button>)}
      <ErrorText error={ack.error} />
    </Panel>}
    {doc && canSend && <Report id={id} />}
  </>;
}

export default function AnnouncementsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [folder, setFolder] = useState('inbox');
  const [page, setPage] = useState(1);
  const [compose, setCompose] = useState(false);
  const caps = useQuery({ queryKey: ['announcements', 'capabilities'], queryFn: () => request('/api/announcements/capabilities') });
  const unread = useQuery({ queryKey: ['announcements', 'unread'], queryFn: () => request('/api/announcements/unread-count'), refetchInterval: 10000, refetchOnReconnect: 'always', refetchOnWindowFocus: 'always' });
  const list = useQuery({ queryKey: ['announcements', 'list', folder, page], queryFn: () => request(`/api/announcements?folder=${folder}&page=${page}`), enabled: !id, refetchInterval: 5000, refetchOnReconnect: 'always', refetchOnWindowFocus: 'always' });
  useEffect(() => subscribeNotifications(() => qc.invalidateQueries({ queryKey: ['announcements'] })), [qc]);
  const canSend = caps.data?.canSend === true;
  if (id) return <Detail key={id} id={id} canSend={canSend} />;
  return <div className="announcements-page">
    <div className="page-head"><div><div className="page-title">Announcements</div><div className="page-sub">Company messages for all branches · {unread.data?.unread ?? 0} unread</div></div>
      {canSend && <button type="button" className="btn-primary" onClick={() => setCompose(v => !v)}>{compose ? 'Close message form' : 'New announcement'}</button>}
    </div>
    <ErrorText error={caps.error || unread.error} />
    {compose && canSend && <Compose onSent={newId => { setCompose(false); qc.invalidateQueries({ queryKey: ['announcements'] }); navigate('/announcements/' + newId); }} />}
    <Panel title="Message history">
      <div className="announcement-tabs" aria-label="Announcement folders">{['inbox', 'unread', ...(canSend ? ['sent'] : [])].map(f => <button key={f} type="button" className={f === folder ? 'btn-primary' : 'approve-btn'} aria-pressed={f === folder} onClick={() => { setFolder(f); setPage(1); }}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
      {list.isPending && <p>Loading messages…</p>}<ErrorText error={list.error} />
      {list.data?.items.length === 0 && <p>No announcements in this folder.</p>}
      <div className="announcement-list">{list.data?.items.map(item => <article key={item.id}><Link to={'/announcements/' + item.id}><strong>{item.title}</strong></Link><p>{item.authorName} · {date(item.publishedAt ?? item.createdAt)}</p><p>{item.status === 'pending' ? 'Publication pending' : item.acknowledgedAt ? 'Acknowledged' : item.readAt ? 'Opened' : 'Unread'}{item.requireAcknowledgment ? ' · Acknowledgment requested' : ''}</p></article>)}</div>
      <div className="announcement-pages"><button type="button" className="approve-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} · {list.data?.total ?? 0} messages</span><button type="button" className="approve-btn" disabled={!list.data || page * 20 >= list.data.total} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </Panel>
  </div>;
}
