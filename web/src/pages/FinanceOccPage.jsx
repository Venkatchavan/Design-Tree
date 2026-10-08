import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { financeOccApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import KpiCard from '../components/KpiCard.jsx';

// Finance Operation Control Center (OCC) — server-persisted.
// Reference: FIN_OCC_HTML iframe (S.pos / S.travel / S.reimb) with
// docsBlock + histBlock + physical bill checklist. Mock SAMPLE data ignored.
// Roles: finance + leadership only (admin blocked, mirrors reference blocklist).
const TABS = [
  { key: 'advances', label: 'Travel advances', kind: 'advance' },
  { key: 'claims', label: 'Hospitality / claims', kind: 'claim' },
  { key: 'pos', label: 'Purchase orders', kind: 'po' },
];
const STATUSES = ['Pending', 'Verified', 'Approved', 'Paid', 'Rejected'];
const CHECK_ITEMS = [
  ['travel', 'Travel tickets / boarding'],
  ['stay', 'Hotel / stay bills'],
  ['food', 'Food bills'],
  ['local', 'Local conveyance bills'],
  ['misc', 'Misc bills'],
  ['po', 'Signed PO / quote'],
];

const LEGACY_KEY = 'datum-finance-occ-v1';
function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const n = (p.advances?.length ?? 0) + (p.claims?.length ?? 0) + (p.pos?.length ?? 0);
    return n > 0 ? p : null;
  } catch {
    return null;
  }
}

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.empId || '—';
}

export default function FinanceOccPage({ bootstrap }) {
  const [tab, setTab] = useState('advances');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [legacy, setLegacy] = useState(readLegacy);
  const role = bootstrap?.role?.key ?? '';
  const canDecide = role === 'finance' || role === 'founding_director' || role === 'working_director';
  const qc = useQueryClient();
  const kind = TABS.find((t) => t.key === tab)?.kind;

  const summary = useQuery({ queryKey: ['finance-occ-summary'], queryFn: financeOccApi.summary });
  const list = useQuery({ queryKey: ['finance-occ', kind, statusFilter], queryFn: () => financeOccApi.list({ kind, status: statusFilter || undefined }) });
  const employees = useQuery({ queryKey: ['employees-pick'], queryFn: () => employeesApi.list({}) });
  const projects = useQuery({ queryKey: ['projects-pick'], queryFn: () => projectsApi.list({}) });
  const travels = useQuery({ queryKey: ['finance-occ-travels'], queryFn: () => financeOccApi.list({ kind: 'advance' }), enabled: tab === 'claims' });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance-occ'] });
    qc.invalidateQueries({ queryKey: ['finance-occ-summary'] });
  };
  const create = useMutation({ mutationFn: financeOccApi.create, onSuccess: () => { invalidate(); setModal(null); } });
  const decide = useMutation({ mutationFn: ({ id, body }) => financeOccApi.decide(id, body), onSuccess: () => { invalidate(); setDetail(null); } });
  const remove = useMutation({ mutationFn: financeOccApi.remove, onSuccess: invalidate });

  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const s = summary.data ?? {};

  async function importLegacy() {
    if (!legacy) return;
    const push = [];
    for (const [k, lkind] of [['advances', 'advance'], ['claims', 'claim'], ['pos', 'po']]) {
      for (const e of legacy[k] ?? []) {
        push.push({ kind: lkind, purpose: e.purpose ?? '', remarks: `Migrated from browser (${e.id ?? 'legacy'})`, amount: Number(e.amount) || 0 });
      }
    }
    try {
      // Employee is required server-side; skip import if no linkable employee.
      setNotice(`Found ${push.length} browser entr${push.length === 1 ? 'y' : 'ies'}. Select an employee in each new form — automatic import needs an employee link, so legacy rows were kept in the browser.`);
    } catch {
      setNotice('Could not migrate browser entries.');
    }
  }

  return (
    <div id="view-financeocc">
      <div className="page-head">
        <div className="page-title">Finance Operation Control Center</div>
        <div className="page-sub">Purchase orders, travel advances and hospitality / reimbursement claims — tracked end-to-end with their own workflow, bill verification checklist and audit trail.</div>
      </div>
      <div className="kpi-grid cols-6">
        <KpiCard label="Total entries" value={s.total ?? 0} accent="blueprint" />
        <KpiCard label="Advances" value={s.advances ?? 0} accent="teal" />
        <KpiCard label="Claims" value={s.claims ?? 0} accent="violet" />
        <KpiCard label="POs" value={s.pos ?? 0} accent="copper" />
        <KpiCard label="Pending" value={s.pending ?? 0} accent="amber" />
        <KpiCard label="Paid" value={s.paid ?? 0} accent="forest" />
      </div>
      {legacy && (
        <Panel title="Browser entries found">
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            This browser has {((legacy.advances?.length ?? 0) + (legacy.claims?.length ?? 0) + (legacy.pos?.length ?? 0))} unsynced local entries from the old offline version. Server is now the source of truth.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="approve-btn" onClick={importLegacy}>Review</button>
            <button type="button" className="approve-btn" onClick={() => { localStorage.removeItem(LEGACY_KEY); setLegacy(null); }}>Discard browser data</button>
          </div>
        </Panel>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn-primary" onClick={() => setModal('advance')}>+ Travel advance</button>
        <button type="button" className="btn-primary" onClick={() => setModal('claim')}>+ Hospitality / claim</button>
        <button type="button" className="btn-primary" onClick={() => setModal('po')}>+ Purchase order</button>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      {notice && <p role="status" style={{ color: 'var(--ink-muted)' }}>{notice}</p>}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <Panel title={TABS.find((t) => t.key === tab)?.label}>
        {rows.length === 0 ? (
          <EmptyState text="No entries yet." />
        ) : tab === 'pos' ? (
          <DataTable
            columns={[
              { key: 'poNo', label: 'PO number', render: (r) => <span className="mono">{r.poNo || r._id.slice(-6)}</span> },
              { key: 'project', label: 'Project / Dept', render: (r) => `${r.project?.name ?? '—'}${r.dept ? ` · ${r.dept}` : ''}` },
              { key: 'vendor', label: 'Vendor' },
              { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
              { key: 'requestedBy', label: 'Requested by', render: (r) => r.requestedBy || empName(r.employee) },
              { key: 'approval', label: 'Approval', render: (r) => <StatusPill status={r.approval}>{r.approval}</StatusPill> },
              { key: 'payment', label: 'Payment', render: (r) => <StatusPill status={r.payment}>{r.payment}</StatusPill> },
              { key: 'docs', label: 'Docs', render: (r) => r.docs?.length ?? 0 },
              { key: 'open', label: 'Open', render: (r) => <button type="button" className="approve-btn" onClick={() => setDetail(r)}>Open</button> },
              ...(canDecide ? [{ key: 'del', label: 'Delete', render: (r) => <button type="button" className="approve-btn" onClick={() => remove.mutate(r._id)}>Delete</button> }] : []),
            ]}
            rows={rows}
            emptyText="No purchase orders."
          />
        ) : tab === 'claims' ? (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
              { key: 'client', label: 'Client' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
              { key: 'payment', label: 'Payment', render: (r) => <StatusPill status={r.payment}>{r.payment}</StatusPill> },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'docs', label: 'Docs', render: (r) => r.docs?.length ?? 0 },
              { key: 'open', label: 'Open', render: (r) => <button type="button" className="approve-btn" onClick={() => setDetail(r)}>Open</button> },
            ]}
            rows={rows}
            emptyText="No claims."
          />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => empName(r.employee) },
              { key: 'location', label: 'Location' },
              { key: 'dates', label: 'Dates', render: (r) => `${r.fromDate ? new Date(r.fromDate).toLocaleDateString() : '—'} → ${r.toDate ? new Date(r.toDate).toLocaleDateString() : '—'}` },
              { key: 'amount', label: 'Advance', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
              { key: 'settlement', label: 'Settlement', render: (r) => <StatusPill status={r.settlement}>{r.settlement}</StatusPill> },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'docs', label: 'Docs', render: (r) => r.docs?.length ?? 0 },
              { key: 'open', label: 'Open', render: (r) => <button type="button" className="approve-btn" onClick={() => setDetail(r)}>Open</button> },
            ]}
            rows={rows}
            emptyText="No travel advances."
          />
        )}
      </Panel>
      <Panel title="Bill-verification checklist">
        <ul style={{ fontSize: 13, color: 'var(--ink-muted)', paddingLeft: 18 }}>
          <li>Bills attached and legible for every claimed amount (PDF or image, up to 20 MB each).</li>
          <li>Advance settled against actuals before the next advance.</li>
          <li>Hospitality claims separated from reimbursable travel.</li>
          <li>Verified / Approved / Paid stay locked until the hardcopy checklist is complete.</li>
          <li>Status history per entry acts as the audit trail.</li>
        </ul>
      </Panel>
      {modal && (
        <EntryModal
          kind={modal}
          employees={employees.data?.items ?? []}
          projects={projects.data?.items ?? []}
          travels={travels.data?.items ?? []}
          onClose={() => setModal(null)}
          onSubmit={(body) => create.mutate(body)}
          error={create.error?.message}
          pending={create.isPending}
        />
      )}
      {detail && (
        <DetailModal
          entry={detail}
          canDecide={canDecide}
          onClose={() => setDetail(null)}
          onDecide={(body) => decide.mutate({ id: detail._id, body })}
          decideError={decide.error?.message}
          decidePending={decide.isPending}
          onUploaded={invalidate}
        />
      )}
    </div>
  );
}

function EntryModal({ kind, employees, projects, travels, onClose, onSubmit, error, pending }) {
  const [f, setF] = useState({ employee: '', project: '', amount: '', purpose: '', vendor: '', dept: '', poNo: '', location: '', fromDate: '', toDate: '', client: '', linkedTravel: '', remarks: '', requestedBy: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function submit(e) {
    e.preventDefault();
    const body = { kind, employee: f.employee, project: f.project || undefined, amount: Number(f.amount) || 0, purpose: f.purpose || undefined, remarks: f.remarks || undefined };
    if (kind === 'po') Object.assign(body, { vendor: f.vendor || undefined, dept: f.dept || undefined, poNo: f.poNo || undefined, requestedBy: f.requestedBy || undefined });
    if (kind === 'advance') Object.assign(body, { location: f.location || undefined, fromDate: f.fromDate || undefined, toDate: f.toDate || undefined });
    if (kind === 'claim') Object.assign(body, { client: f.client || undefined, linkedTravel: f.linkedTravel || undefined });
    onSubmit(body);
  }
  return (
    <Modal title={kind === 'po' ? 'New purchase order' : kind === 'claim' ? 'New hospitality / claim' : 'New travel advance'} onClose={onClose} wide>
      <form onSubmit={submit} className="field-grid">
        <div className="form-row"><label className="form-label">Employee *</label><select required className="filter-select" style={{ width: '100%' }} value={f.employee} onChange={set('employee')}><option value="">Select employee</option>{employees.map((x) => <option key={x._id} value={x._id}>{x.firstName} {x.lastName} ({x.empId})</option>)}</select></div>
        <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={f.project} onChange={set('project')}><option value="">No project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
        {kind === 'po' && (
          <>
            <div className="form-row"><label className="form-label">PO number</label><input className="form-input" value={f.poNo} onChange={set('poNo')} placeholder="Auto if blank" /></div>
            <div className="form-row"><label className="form-label">Vendor</label><input className="form-input" value={f.vendor} onChange={set('vendor')} /></div>
            <div className="form-row"><label className="form-label">Department</label><input className="form-input" value={f.dept} onChange={set('dept')} /></div>
            <div className="form-row"><label className="form-label">Requested by</label><input className="form-input" value={f.requestedBy} onChange={set('requestedBy')} /></div>
          </>
        )}
        {kind === 'advance' && (
          <>
            <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={f.location} onChange={set('location')} /></div>
            <div className="form-row"><label className="form-label">From</label><input type="date" className="form-input" value={f.fromDate} onChange={set('fromDate')} /></div>
            <div className="form-row"><label className="form-label">To</label><input type="date" className="form-input" value={f.toDate} onChange={set('toDate')} /></div>
          </>
        )}
        {kind === 'claim' && (
          <>
            <div className="form-row"><label className="form-label">Client</label><input className="form-input" value={f.client} onChange={set('client')} /></div>
            <div className="form-row"><label className="form-label">Linked travel</label><select className="filter-select" style={{ width: '100%' }} value={f.linkedTravel} onChange={set('linkedTravel')}><option value="">None</option>{travels.map((t) => <option key={t._id} value={t._id}>{empName(t.employee)} — {t.location || t.purpose || t._id.slice(-6)}</option>)}</select></div>
          </>
        )}
        <div className="form-row"><label className="form-label">Amount (₹)</label><input type="number" min="0" className="form-input" value={f.amount} onChange={set('amount')} /></div>
        <div className="form-row"><label className="form-label">Purpose</label><input className="form-input" value={f.purpose} onChange={set('purpose')} /></div>
        <div className="form-row" style={{ gridColumn: '1 / -1' }}><label className="form-label">Remarks</label><input className="form-input" value={f.remarks} onChange={set('remarks')} /></div>
        {error && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{error}</div>}
        <button className="btn-primary" type="submit" disabled={pending}>Save entry</button>
      </form>
    </Modal>
  );
}

function toChecks(v) {
  if (!v) return {};
  if (v instanceof Map) return Object.fromEntries(v);
  if (typeof v === 'object') return { ...v };
  return {};
}

function DetailModal({ entry, canDecide, onClose, onDecide, decideError, decidePending, onUploaded }) {
  const [checks, setChecks] = useState(() => toChecks(entry.verification?.checks));
  const [missing, setMissing] = useState(entry.verification?.missing ?? '');
  const [remark, setRemark] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadMsg, setUploadMsg] = useState('');
  const completed = Object.keys(checks).length > 0 && Object.values(checks).every(Boolean);

  async function upload(e) {
    e.preventDefault();
    if (!files.length) return;
    try {
      await financeOccApi.uploadDocs(entry._id, files);
      setFiles([]);
      setUploadMsg('Uploaded.');
      onUploaded();
    } catch (err) {
      setUploadMsg(err.message);
    }
  }

  return (
    <Modal title={`${entry.kind === 'po' ? `PO ${entry.poNo || entry._id.slice(-6)}` : entry.kind === 'claim' ? `Claim — ${entry.client || empName(entry.employee)}` : `Advance — ${empName(entry.employee)}`}`} onClose={onClose} wide>
      <div className="field-grid">
        <div className="form-row"><div className="form-label">Status</div><StatusPill status={entry.status}>{entry.status}</StatusPill></div>
        <div className="form-row"><div className="form-label">Amount</div><div>₹{Number(entry.amount ?? 0).toLocaleString('en-IN')}</div></div>
        {entry.purpose && <div className="form-row" style={{ gridColumn: '1 / -1' }}><div className="form-label">Purpose</div><div>{entry.purpose}</div></div>}
        {entry.remarks && <div className="form-row" style={{ gridColumn: '1 / -1' }}><div className="form-label">Remarks</div><div>{entry.remarks}</div></div>}
      </div>
      <Panel title="Documents">
        {(entry.docs ?? []).length === 0 ? <EmptyState text="No documents yet. Attach PDF or image, up to 20 MB each." /> : (
          <ul style={{ fontSize: 13, paddingLeft: 18 }}>
            {(entry.docs ?? []).map((d, i) => (
              <li key={i}><a href={financeOccApi.downloadUrl(d.file)} target="_blank" rel="noreferrer">{d.name || d.file}</a></li>
            ))}
          </ul>
        )}
        <form onSubmit={upload} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFiles([...e.target.files])} />
          <button className="approve-btn" type="submit">Attach</button>
        </form>
        {uploadMsg && <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{uploadMsg}</p>}
      </Panel>
      <Panel title="Physical bill checklist">
        {CHECK_ITEMS.map(([k, label]) => (
          <label key={k} className="checkrow" style={{ display: 'flex', gap: 8, fontSize: 13, padding: '6px 0' }}>
            <input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} /> {label} verified
          </label>
        ))}
        <div className="form-row" style={{ marginTop: 8 }}><label className="form-label">Remarks / missing documents</label><textarea className="form-input" value={missing} onChange={(e) => setMissing(e.target.value)} /></div>
        {!completed && <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Verified, Approved and Paid stay locked until the checklist is complete.</p>}
      </Panel>
      {entry.history?.length > 0 && (
        <Panel title="History">
          <ul style={{ fontSize: 12.5, paddingLeft: 18, color: 'var(--ink-muted)' }}>
            {[...entry.history].reverse().map((h, i) => <li key={i}>{h.at ? new Date(h.at).toLocaleString() : ''} — {h.action}</li>)}
          </ul>
        </Panel>
      )}
      {canDecide && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {STATUSES.map((st) => (
            <button key={st} type="button" className="approve-btn" disabled={decidePending} onClick={() => onDecide({ status: st, verification: { checks, missing }, remark: remark || undefined })}>{st}</button>
          ))}
        </div>
      )}
      {canDecide && <div className="form-row" style={{ marginTop: 8 }}><label className="form-label">Decision remark</label><input className="form-input" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>}
      {decideError && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 8 }}>{decideError}</div>}
    </Modal>
  );
}
