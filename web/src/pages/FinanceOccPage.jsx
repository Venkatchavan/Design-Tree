import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi, workEntriesApi } from '../lib/api.js';
import { financeOccApi, billingApi } from '../lib/phase3Api.js';
import { travelApi, leaveApi } from '../lib/phase4bApi.js';
import { convApi } from '../lib/functionsApi.js';
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

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);
const inr = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

function verComplete(e) {
  const checks = e?.verification?.checks;
  const vals = checks instanceof Map ? [...checks.values()] : Object.values(checks ?? {});
  return vals.length > 0 && vals.every(Boolean);
}

// 9-stage pipeline membership derived from server entry fields (stages may
// overlap: e.g. an unverified unsettled advance sits in several stages).
const OCC_STAGES = [
  { n: 1, label: 'PO', match: (e) => e.kind === 'po' && e.approval === 'Pending' },
  { n: 2, label: 'Travel advance', match: (e) => e.kind === 'advance' && e.status === 'Pending' && (e.settlement ?? 'Not started') === 'Not started' },
  { n: 3, label: 'Expense submission', match: (e) => e.kind === 'advance' && (e.settlement ?? '') === 'Pending' },
  { n: 4, label: 'Hardcopy verification', match: (e) => (e.kind === 'advance' || e.kind === 'claim') && (e.docs?.length ?? 0) > 0 && !verComplete(e) },
  { n: 5, label: 'Settlement', match: (e) => e.kind === 'advance' && (e.settlement ?? '') === 'Pending' && verComplete(e) },
  { n: 6, label: 'Reimbursement', match: (e) => e.kind === 'claim' && e.status === 'Pending' },
  { n: 7, label: 'Approval', match: (e) => e.approval === 'In Review' || e.status === 'Verified' },
  { n: 8, label: 'Payment', match: (e) => (e.approval === 'Approved' || e.status === 'Approved') && (e.payment ?? 'Pending') === 'Pending' },
];

const DIR_TABS = [
  { key: 'advances', label: 'Travel advances', kind: 'advance' },
  { key: 'claims', label: 'Hospitality / claims', kind: 'claim' },
  { key: 'pos', label: 'Purchase orders', kind: 'po' },
  { key: 'dashboard', label: 'Finance Dashboard', kind: null },
];

export default function FinanceOccPage({ bootstrap }) {
  const [tab, setTab] = useState('advances');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [legacy, setLegacy] = useState(readLegacy);
  const role = bootstrap?.role?.key ?? '';
  const canDecide = role === 'finance' || role === 'founding_director' || role === 'working_director';
  const isDirector = DIRECTOR_ROLES.has(role);
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

  if (isDirector) {
    return (
      <DirectorOccView
        employees={employees.data?.items ?? []}
        projects={projects.data?.items ?? []}
        canDecide={canDecide}
        onCreate={(body) => create.mutate(body)}
        createPending={create.isPending}
        createError={create.error?.message}
        onDecide={(id, body) => decide.mutate({ id, body })}
        decidePending={decide.isPending}
        decideError={decide.error?.message}
        onRemove={(id) => remove.mutate(id)}
        onChanged={invalidate}
      />
    );
  }

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

function DirectorOccView({
  employees, projects, canDecide,
  onCreate, createPending, createError,
  onDecide, decidePending, decideError,
  onRemove, onChanged,
}) {
  const [tab, setTab] = useState('advances');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fEmployee, setFEmployee] = useState('');
  const [fProject, setFProject] = useState('');
  const [fDept, setFDept] = useState('');
  const [fClient, setFClient] = useState('');
  const [fVendor, setFVendor] = useState('');
  const [fApproval, setFApproval] = useState('');
  const [fSettlement, setFSettlement] = useState('');
  const [fReimb, setFReimb] = useState('');
  const [fPayment, setFPayment] = useState('');
  const [actionChip, setActionChip] = useState('all');
  const [auditKind, setAuditKind] = useState('all');

  const allQ = useQuery({ queryKey: ['finance-occ-all'], queryFn: () => financeOccApi.list({}) });
  const all = useMemo(() => allQ.data?.items ?? [], [allQ.data]);

  const todayLine = (() => {
    const d = new Date();
    const wd = d.toLocaleString('en-GB', { weekday: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-GB', { month: 'short' });
    return `${wd}, ${day} ${mon}, ${d.getFullYear()}`;
  })();

  const F = useMemo(() => all.filter((e) => {
    const created = String(e.createdAt ?? '').slice(0, 10);
    if (fromDate && created < fromDate) return false;
    if (toDate && created > toDate) return false;
    if (fEmployee && String(e.employee?._id ?? e.employee ?? '') !== fEmployee) return false;
    if (fProject && String(e.project?._id ?? e.project ?? '') !== fProject) return false;
    if (fDept && (e.employee?.department ?? '') !== fDept) return false;
    if (fClient && (e.client ?? '') !== fClient) return false;
    if (fVendor && (e.vendor ?? '') !== fVendor) return false;
    if (fApproval && (e.approval ?? 'Pending') !== fApproval) return false;
    if (fSettlement && (e.settlement ?? 'Not started') !== fSettlement) return false;
    if (fPayment && (e.payment ?? 'Pending') !== fPayment) return false;
    if (fReimb === 'raised' && !(e.kind === 'claim' && e.status !== 'Pending')) return false;
    if (fReimb === 'toraise' && !(e.kind === 'claim' && e.status === 'Pending')) return false;
    return true;
  }), [all, fromDate, toDate, fEmployee, fProject, fDept, fClient, fVendor, fApproval, fSettlement, fReimb, fPayment]);

  const activeFilters = [fromDate, toDate, fEmployee, fProject, fDept, fClient, fVendor, fApproval, fSettlement, fReimb, fPayment].filter(Boolean).length;
  const clearFilters = () => {
    setFromDate(''); setToDate(''); setFEmployee(''); setFProject(''); setFDept('');
    setFClient(''); setFVendor(''); setFApproval(''); setFSettlement(''); setFReimb(''); setFPayment('');
  };

  const depts = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(), [employees]);
  const clients = useMemo(() => [...new Set(all.map((e) => e.client).filter(Boolean))].sort(), [all]);
  const vendors = useMemo(() => [...new Set(all.map((e) => e.vendor).filter(Boolean))].sort(), [all]);

  const stageCounts = useMemo(() => OCC_STAGES.map((st) => ({ ...st, count: F.filter(st.match).length })), [F]);

  const pos = useMemo(() => F.filter((e) => e.kind === 'po'), [F]);
  const adv = useMemo(() => F.filter((e) => e.kind === 'advance'), [F]);
  const claims = useMemo(() => F.filter((e) => e.kind === 'claim'), [F]);
  const sum = (rows) => rows.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const poPending = pos.filter((e) => ['Pending', 'In Review'].includes(e.approval ?? 'Pending'));
  const poApproved = pos.filter((e) => e.approval === 'Approved');
  const poAwaitingVendor = poApproved.filter((e) => (e.payment ?? 'Pending') === 'Pending');
  const advOutstanding = adv.filter((e) => (e.settlement ?? 'Not started') !== 'Settled');
  const settlePending = adv.filter((e) => (e.settlement ?? '') === 'Pending');
  const unverified = F.filter((e) => (e.kind === 'advance' || e.kind === 'claim') && (e.docs?.length ?? 0) > 0 && !verComplete(e));
  const reimbToRaise = claims.filter((e) => e.status === 'Pending');
  const reimbRaised = claims.filter((e) => e.status !== 'Pending' && (e.payment ?? 'Pending') === 'Pending');
  const vendorOpen = pos.filter((e) => (e.payment ?? 'Pending') !== 'Paid');
  const verifiedBills = F.filter(verComplete).length;
  const paidItems = F.filter((e) => e.status === 'Paid').length;
  const closedItems = F.filter((e) => e.status === 'Paid' || e.status === 'Rejected').length;

  const needsAction = (e) => {
    if (e.kind === 'po') return ['Pending', 'In Review'].includes(e.approval ?? 'Pending');
    if (e.kind === 'advance') return (e.settlement ?? 'Not started') !== 'Settled';
    return e.status !== 'Paid' && e.status !== 'Rejected';
  };
  const actionRows = useMemo(() => F.filter(needsAction).sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))), [F]);
  const actionFiltered = actionRows.filter((e) => {
    if (actionChip === 'pos') return e.kind === 'po';
    if (actionChip === 'settlement') return e.kind === 'advance' && (e.settlement ?? 'Not started') !== 'Settled';
    if (actionChip === 'verification') return !verComplete(e);
    if (actionChip === 'claims') return e.kind === 'claim';
    return true;
  });
  const refOf = (e) => {
    if (e.kind === 'po') return `${e.poNo || String(e._id).slice(-6)} · ${e.vendor || '—'}`;
    if (e.kind === 'advance') return `${empName(e.employee)} · ${e.location || e.purpose || '—'}`;
    return `${e.client || '—'} · ${empName(e.employee)}`;
  };
  const auditEvents = useMemo(() => {
    const ev = [];
    for (const e of F) {
      for (const h of e.history ?? []) ev.push({ ...h, ref: refOf(e), kind: e.kind });
    }
    return ev
      .filter((h) => auditKind === 'all' || (auditKind === 'pos' ? h.kind === 'po' : auditKind === 'settlement' ? h.kind === 'advance' : h.kind === 'claim'))
      .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
      .slice(0, 200);
  }, [F, auditKind]);

  const kind = DIR_TABS.find((t) => t.key === tab)?.kind;
  const kindRows = kind ? F.filter((e) => e.kind === kind) : [];

  return (
    <div id="view-financeocc">
      <div className="page-head">
        <div className="page-sub" style={{ fontWeight: 600 }}>DesignTree Service Consultants · Finance Operations</div>
        <div className="page-title">Finance Operations Control Centre</div>
        <div className="page-sub">{todayLine}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn-primary" onClick={() => setModal('advance')}>+ Travel advance</button>
        <button type="button" className="btn-primary" onClick={() => setModal('claim')}>+ Hospitality / claim</button>
        <button type="button" className="btn-primary" onClick={() => setModal('po')}>+ Purchase order</button>
      </div>

      <Panel title="Filters">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-row"><label className="form-label">From date</label><input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">To date</label><input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Employee</label><select className="filter-select" value={fEmployee} onChange={(e) => setFEmployee(e.target.value)}><option value="">All employees</option>{employees.map((x) => <option key={x._id} value={String(x._id)}>{x.firstName} {x.lastName}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Project</label><select className="filter-select" value={fProject} onChange={(e) => setFProject(e.target.value)}><option value="">All projects</option>{projects.map((p) => <option key={p._id} value={String(p._id)}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Department</label><select className="filter-select" value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="">All departments</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Client</label><select className="filter-select" value={fClient} onChange={(e) => setFClient(e.target.value)}><option value="">All clients</option>{clients.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Vendor</label><select className="filter-select" value={fVendor} onChange={(e) => setFVendor(e.target.value)}><option value="">All vendors</option>{vendors.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <div className="form-row"><label className="form-label">PO status</label><select className="filter-select" value={fApproval} onChange={(e) => setFApproval(e.target.value)}><option value="">Any</option>{['Pending', 'In Review', 'Approved'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Travel settlement</label><select className="filter-select" value={fSettlement} onChange={(e) => setFSettlement(e.target.value)}><option value="">Any</option>{['Not started', 'Pending', 'Settled'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Reimbursement</label><select className="filter-select" value={fReimb} onChange={(e) => setFReimb(e.target.value)}><option value="">Any</option><option value="toraise">To be raised</option><option value="raised">Raised</option></select></div>
          <div className="form-row"><label className="form-label">Payment status</label><select className="filter-select" value={fPayment} onChange={(e) => setFPayment(e.target.value)}><option value="">Any</option>{['Pending', 'Paid'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 10 }}>
          {activeFilters} filter{activeFilters === 1 ? '' : 's'} active · {pos.length} POs, {adv.length} trips, {claims.length} claims
          {activeFilters > 0 && <> · <button type="button" className="approve-btn" onClick={clearFilters}>Clear filters</button></>}
        </p>
      </Panel>

      {allQ.isLoading ? <EmptyState text="Loading finance records…" /> : allQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{allQ.error.message}</div>
      ) : (
        <>
          <div className="occ-flow">
            {stageCounts.map((st) => (
              <div key={st.n} className={`occ-stage${st.count > 0 ? ' hot' : ''}`}>
                <span className="occ-sn">Stage {st.n} · open</span>
                <span className="occ-st">{st.label}</span>
                <span className="occ-sc">{st.count}</span>
                <span className="occ-bar" />
              </div>
            ))}
            <div className="occ-stage done">
              <span className="occ-sn">Stage 9</span>
              <span className="occ-st">Closure</span>
              <span className="occ-sc">{closedItems}</span>
              <span className="occ-bar" />
            </div>
          </div>

          <div className="kpi-grid cols-4">
            <KpiCard label="Purchase Orders – Pending" value={`${poPending.length} · ${inr(sum(poPending))}`} accent="amber" />
            <KpiCard label="Purchase Orders – Approved" value={`${poApproved.length} · ${inr(sum(poApproved))}`} accent="forest" />
            <KpiCard label="Travel Advances – Outstanding" value={`${advOutstanding.length} · ${inr(sum(advOutstanding))}`} accent="blueprint" />
            <KpiCard label="Travel Settlements – Pending" value={`${inr(settlePending.reduce((s, e) => s + Number(e.amount ?? 0), 0))} payable`} accent="teal" />
            <KpiCard label="Bills Pending Verification" value={`${unverified.length} · ${inr(sum(unverified))}`} accent="rust" />
            <KpiCard label="Reimbursements to be Raised" value={`${reimbToRaise.length} · ${inr(sum(reimbToRaise))}`} accent="violet" />
            <KpiCard label="Reimbursements Raised – Pending Payment" value={`${reimbRaised.length} · ${inr(sum(reimbRaised))}`} accent="copper" />
            <KpiCard label="Total Amount Pending" value={inr(sum(vendorOpen) + sum(advOutstanding) + sum(reimbToRaise) + sum(reimbRaised))} accent="blueprint" />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{poAwaitingVendor.length} approved POs awaiting vendor payment</p>

          <Panel title="Where the pending money sits">
            <div className="kpi-grid cols-4">
              <KpiCard label="Vendor POs" value={inr(sum(vendorOpen))} accent="amber" />
              <KpiCard label="Employee payables" value={inr(sum(advOutstanding))} accent="blueprint" />
              <KpiCard label="Claims to raise" value={inr(sum(reimbToRaise))} accent="violet" />
              <KpiCard label="Claims raised" value={inr(sum(reimbRaised))} accent="teal" />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Advance to recover from employees {inr(0)} · Completed: travel bills fully verified {verifiedBills} · Items paid {paidItems} · Items closed {closedItems}</p>
          </Panel>

          <Panel title="Action Centre" sub="Action required · most urgent first">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[['all', 'All'], ['pos', 'Purchase Orders'], ['settlement', 'Travel Settlements'], ['verification', 'Bill Verification'], ['claims', 'Client Hospitality & Claims']].map(([k, label]) => (
                <button key={k} type="button" className="approve-btn" disabled={actionChip === k} onClick={() => setActionChip(k)}>{label}</button>
              ))}
            </div>
            <DataTable
              columns={[
                { key: 'ref', label: 'Item', render: (r) => refOf(r) },
                { key: 'kind', label: 'Type', render: (r) => r.kind },
                { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                { key: 'open', label: 'Update', render: (r) => <button type="button" className="approve-btn" onClick={() => setDetail(r)}>Update</button> },
              ]}
              rows={actionFiltered}
              emptyText="Nothing needs action."
            />
          </Panel>

          <Panel title="Audit Trail" sub="Every create, update, upload, verification and closure is logged with who did it and when.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[['all', 'All'], ['pos', 'PO'], ['settlement', 'Travel'], ['claims', 'Claim']].map(([k, label]) => (
                <button key={k} type="button" className="approve-btn" disabled={auditKind === k} onClick={() => setAuditKind(k)}>{label}</button>
              ))}
            </div>
            {auditEvents.length === 0 ? <EmptyState text="No activity." /> : (
              <ul style={{ fontSize: 12.5, paddingLeft: 18, color: 'var(--ink-muted)' }}>
                {auditEvents.map((h, i) => (
                  <li key={i}>{h.at ? new Date(h.at).toLocaleString() : ''} — <b>{h.kind}</b> · {h.ref} · {h.action} <span>by {h.by ? String(h.by).slice(-6) : '—'}</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <Tabs tabs={DIR_TABS} active={tab} onChange={setTab} />
      {tab === 'dashboard' ? (
        <DirectorFinanceDashboard canDecideLeave={canDecide} />
      ) : (
        <Panel title={DIR_TABS.find((t) => t.key === tab)?.label}>
          <DataTable
            columns={[
              { key: 'ref', label: 'Item', render: (r) => refOf(r) },
              { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'open', label: 'Open', render: (r) => <button type="button" className="approve-btn" onClick={() => setDetail(r)}>Open</button> },
              ...(canDecide ? [{ key: 'del', label: 'Delete', render: (r) => <button type="button" className="approve-btn" onClick={() => onRemove(r._id)}>Delete</button> }] : []),
            ]}
            rows={kindRows}
            emptyText="No entries yet."
          />
        </Panel>
      )}
      {modal && (
        <EntryModal
          kind={modal}
          employees={employees}
          projects={projects}
          travels={all.filter((e) => e.kind === 'advance')}
          onClose={() => setModal(null)}
          onSubmit={(body) => { onCreate(body); setModal(null); }}
          error={createError}
          pending={createPending}
        />
      )}
      {detail && (
        <DetailModal
          entry={detail}
          canDecide={canDecide}
          onClose={() => setDetail(null)}
          onDecide={(body) => { onDecide(detail._id, body); setDetail(null); }}
          decideError={decideError}
          decidePending={decidePending}
          onUploaded={onChanged}
        />
      )}
    </div>
  );
}

function DirectorFinanceDashboard({ canDecideLeave }) {
  const qc = useQueryClient();
  const [cProject, setCProject] = useState('');
  const [cDept, setCDept] = useState('');
  const [cEmployee, setCEmployee] = useState('');
  const [cFrom, setCFrom] = useState('');
  const [cTo, setCTo] = useState('');
  const [cType, setCType] = useState('');

  const overview = useQuery({ queryKey: ['finance-overview'], queryFn: billingApi.financeOverview });
  const revenue = useQuery({ queryKey: ['revenue-by-project'], queryFn: billingApi.revenueByProject });
  const costs = useQuery({ queryKey: ['project-costs'], queryFn: billingApi.projectCosts });
  const stagesQ = useQuery({ queryKey: ['billing-stages-all'], queryFn: () => billingApi.stages({}) });
  const travelsQ = useQuery({ queryKey: ['finance-travels-all'], queryFn: () => travelApi.list({}) });
  const leavesQ = useQuery({ queryKey: ['finance-leaves-all'], queryFn: () => leaveApi.list({}) });
  const employeesQ = useQuery({ queryKey: ['employees-finance-all'], queryFn: () => employeesApi.list({}) });
  const convQ = useQuery({ queryKey: ['finance-conv-all'], queryFn: () => convApi.list({}) });
  const projectsQ = useQuery({ queryKey: ['projects-finance-all'], queryFn: () => projectsApi.list({}) });

  const costFiltered = !!(cFrom || cTo || cEmployee || cDept);
  const costEntriesQ = useQuery({
    queryKey: ['finance-cost-entries', cFrom, cTo, cEmployee],
    queryFn: () => workEntriesApi.list({ from: cFrom || undefined, to: cTo || undefined, employee: cEmployee || undefined }),
    enabled: costFiltered,
  });

  const decideLeave = useMutation({
    mutationFn: ({ id, status, remarks }) => leaveApi.decide(id, { status, remarks: remarks || undefined }),
    onSuccess: () => {
      setLeaveDecisionError('');
      qc.invalidateQueries({ queryKey: ['finance-leaves-all'] });
    },
  });
  const [leaveRemarks, setLeaveRemarks] = useState('');
  const [leaveDecisionError, setLeaveDecisionError] = useState('');

  function approveLeave(id) {
    setLeaveDecisionError('');
    decideLeave.mutate({ id, status: 'Approved', remarks: leaveRemarks.trim() || undefined });
  }

  function rejectLeave(id) {
    if (!leaveRemarks.trim()) {
      setLeaveDecisionError('A reason is required when rejecting leave.');
      return;
    }
    setLeaveDecisionError('');
    decideLeave.mutate({ id, status: 'Rejected', remarks: leaveRemarks.trim() });
  }

  const o = overview.data ?? {};
  const revRows = revenue.data?.items ?? [];
  const stageRows = stagesQ.data?.items ?? [];
  const travelRows = travelsQ.data?.items ?? [];
  const empRows = employeesQ.data?.items ?? [];
  const projRows = projectsQ.data?.items ?? [];

  const spendOf = (r) => {
    const a = Number(r.actualExpense ?? 0);
    return a > 0 ? a : Number(r.estExpense ?? 0);
  };
  const augPrefix = `${new Date().getFullYear()}-08`;
  const travelSpendAug = travelRows
    .filter((r) => String(r.departureDate ?? '').slice(0, 7) === augPrefix)
    .reduce((s, r) => s + spendOf(r), 0);
  const pendingTravel = travelRows.filter((r) => r.status === 'Pending').length;
  const pendingSettlement = travelRows.filter((r) => r.settlementStatus && r.settlementStatus !== 'Settled').length;

  const billed = stageRows.filter((r) => r.billingReadiness === 'Billed').length;
  const ready = stageRows.filter((r) => r.billingReadiness === 'Ready for billing').length;
  const pending = stageRows.filter((r) => r.billingReadiness === 'Pending').length;
  const delayByProject = useMemo(() => {
    const m = new Map();
    for (const r of stagesQ.data?.items ?? []) {
      const pid = String(r.project?._id ?? r.project ?? '');
      const d = Number(r.delayDays ?? 0);
      const cur = m.get(pid) ?? { project: r.project?.name ?? '—', service: '', stage: '', delay: 0 };
      if (d > (cur.delay ?? 0)) {
        m.set(pid, { project: r.project?.name ?? cur.project, service: r.service ?? '', stage: r.stage ?? '', delay: d });
      } else if (!m.has(pid)) {
        m.set(pid, cur);
      }
    }
    return [...m.values()].filter((x) => x.delay > 0).sort((a, b) => b.delay - a.delay);
  }, [stagesQ.data]);

  const financeEmpIds = useMemo(() => new Set(
    (employeesQ.data?.items ?? []).filter((e) => e.department === 'Finance').map((e) => String(e._id)),
  ), [employeesQ.data]);
  const financeLeaves = (leavesQ.data?.items ?? []).filter((r) =>
    financeEmpIds.has(String(r.employee?._id ?? r.employee ?? '')),
  );

  // ---- Cost summary ----
  const rates = useMemo(() => new Map((employeesQ.data?.items ?? []).map((e) => [String(e._id), Number(e.hourlyRate ?? 0)])), [employeesQ.data]);
  const empDept = useMemo(() => new Map((employeesQ.data?.items ?? []).map((e) => [String(e._id), e.department ?? ''])), [employeesQ.data]);
  const projMeta = useMemo(() => {
    const m = new Map();
    for (const p of projectsQ.data?.items ?? []) m.set(String(p._id), p);
    return m;
  }, [projectsQ.data]);
  const costBase = useMemo(() => new Map((costs.data?.items ?? []).map((c) => [String(c.id), c])), [costs.data]);

  const costRows = useMemo(() => {
    const labour = new Map();
    if (costFiltered) {
      for (const e of costEntriesQ.data?.items ?? []) {
        const pid = String(e.project?._id ?? e.project ?? '');
        if (!pid) continue;
        const eid = String(e.employee?._id ?? e.employee ?? '');
        if (cDept && (e.employee?.department ?? empDept.get(eid) ?? '') !== cDept) continue;
        const h = Number(e.hours ?? 0);
        const g = labour.get(pid) ?? { hours: 0, cost: 0 };
        g.hours += h;
        g.cost += h * (rates.get(eid) ?? 0);
        labour.set(pid, g);
      }
    }
    const other = new Map();
    for (const c of convQ.data?.items ?? []) {
      const pid = String(c.project?._id ?? c.project ?? '');
      if (!pid) continue;
      if (cProject && pid !== cProject) continue;
      const d = String(c.date ?? '').slice(0, 10);
      if (cFrom && d < cFrom) continue;
      if (cTo && d > cTo) continue;
      const eid = String(c.employee?._id ?? c.employee ?? '');
      if (cEmployee && eid !== cEmployee) continue;
      if (cDept && (c.employee?.department ?? empDept.get(eid) ?? '') !== cDept) continue;
      other.set(pid, (other.get(pid) ?? 0) + Number(c.amount ?? 0));
    }
    const ids = new Set([...costBase.keys(), ...labour.keys(), ...other.keys()]);
    const rows = [];
    for (const pid of ids) {
      const base = costBase.get(pid);
      const meta = projMeta.get(pid);
      if (cProject && pid !== cProject) continue;
      const manHours = costFiltered ? Math.round(((labour.get(pid)?.hours ?? 0)) * 10) / 10 : (base?.manHours ?? 0);
      const labourCost = costFiltered ? Math.round(labour.get(pid)?.cost ?? 0) : (base?.labourCost ?? 0);
      const otherCost = Math.round(other.get(pid) ?? 0);
      const actual = labourCost + otherCost;
      const budget = base?.budget ?? 0;
      rows.push({
        id: pid,
        name: meta?.name ?? base?.name ?? '—',
        wo: meta?.jobNumber ?? '—',
        manHours, labourCost, otherCost, actual, budget,
        utilizedPct: budget > 0 ? Math.round((actual / budget) * 100) : 0,
        remaining: budget - actual,
        variance: actual - budget,
      });
    }
    return rows.filter((r) => (cType === 'labour' ? r.labourCost > 0 : cType === 'other' ? r.otherCost > 0 : true));
  }, [costEntriesQ.data, convQ.data, cProject, cDept, cEmployee, cFrom, cTo, cType, costFiltered, rates, empDept, projMeta, costBase]);

  const totCost = costRows.reduce((s, r) => s + r.actual, 0);
  const totLabour = costRows.reduce((s, r) => s + r.labourCost, 0);
  const totOther = costRows.reduce((s, r) => s + r.otherCost, 0);
  const totBudget = costRows.reduce((s, r) => s + r.budget, 0);
  const budgetUtil = totBudget > 0 ? Math.round((totCost / totBudget) * 100) : 0;

  const snapshotRows = delayByProject.map((d) => {
    const cost = costBase.get(
      [...costBase.keys()].find((k) => (projMeta.get(k)?.name ?? costBase.get(k)?.name) === d.project) ?? '',
    );
    const actual = (cost?.labourCost ?? 0);
    const budget = cost?.budget ?? 0;
    const margin = budget - actual;
    return {
      project: d.project, delayed: d.delay > 0, budget, margin,
      marginPct: budget > 0 ? Math.round((margin / budget) * 100) : 0, delay: d.delay,
    };
  });

  const deptRev = useMemo(() => {
    const m = new Map();
    for (const r of revenue.data?.items ?? []) {
      const dept = (r.services ?? [])[0] ?? 'Unassigned';
      const g = m.get(dept) ?? { dept, projects: 0, contract: 0, invoiced: 0, received: 0 };
      g.projects += 1;
      g.contract += Number(r.contract ?? 0);
      g.invoiced += Number(r.invoiced ?? 0);
      g.received += Number(r.received ?? 0);
      m.set(dept, g);
    }
    return [...m.values()].map((g) => ({
      ...g,
      pct: g.invoiced > 0 ? Math.round((g.received / g.invoiced) * 100) : 0,
    })).sort((a, b) => b.contract - a.contract);
  }, [revenue.data]);

  const deptOptions = useMemo(() => [...new Set((employeesQ.data?.items ?? []).map((e) => e.department).filter(Boolean))].sort(), [employeesQ.data]);
  const resetCostFilters = () => { setCProject(''); setCDept(''); setCEmployee(''); setCFrom(''); setCTo(''); setCType(''); };

  return (
    <>
      <div className="page-head">
        <div className="page-title">Finance Dashboard</div>
        <div className="page-sub">A consolidated snapshot of revenue, billing, project cost &amp; performance, travel spend and approvals across the Finance module</div>
      </div>
      <div className="kpi-grid cols-6">
        <KpiCard label="Total contract value" value={inr(o.contractValue)} accent="blueprint" />
        <KpiCard label="Invoiced to date" value={inr(o.invoiced)} accent="copper" />
        <KpiCard label="Received to date" value={inr(o.received)} accent="forest" />
        <KpiCard label="% collected (of invoiced)" value={`${o.pctCollected ?? 0}%`} accent="teal" />
        <KpiCard label="Pending approvals" value={o.pendingApprovals ?? 0} accent="amber" />
        <KpiCard label="Travel spend (all depts.)" value={inr(travelSpendAug)} accent="violet" />
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Hours logged today" value={o.hoursToday ?? 0} accent="violet" />
        <KpiCard label="Projects at risk / delayed" value={o.atRisk ?? 0} accent="rust" />
        <KpiCard label="Ready for billing" value={o.ready ?? 0} accent="forest" />
        <KpiCard label="Billing pending" value={o.pending ?? 0} accent="amber" />
      </div>

      <Panel title="Revenue by project" sub="Contract value, invoiced and % collected">
        <DataTable
          columns={[
            { key: 'name', label: 'Project' },
            { key: 'contract', label: 'Contract value', render: (r) => inr(r.contract) },
            { key: 'invoiced', label: 'Invoiced', render: (r) => inr(r.invoiced) },
            { key: 'pct', label: '% collected', render: (r) => `${r.pct ?? 0}%` },
          ]}
          rows={revRows}
          emptyText="No revenue data yet."
        />
        <a href="/finance/revenue" style={{ fontSize: 12.5 }}>Full report →</a>
      </Panel>

      <Panel title="Billing status" sub="Stage-wise, across every tracked project">
        <div className="kpi-grid cols-3">
          <KpiCard label="Billed" value={billed} accent="forest" />
          <KpiCard label="Ready to bill" value={ready} accent="teal" />
          <KpiCard label="Pending" value={pending} accent="amber" />
        </div>
        <div className="section-label">Needs attention</div>
        {delayByProject.length === 0 ? <EmptyState text="No delayed stages." /> : (
          <table className="data">
            <tbody>
              {delayByProject.slice(0, 5).map((d, i) => (
                <tr key={i}><td>{d.project} — {d.service} ({d.stage})</td><td className="mono">{d.delay}d late</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <a href="/finance/billing-status" style={{ fontSize: 12.5 }}>View all →</a>
      </Panel>

      <Panel title="Project Cost & Performance snapshot" sub="Quoted fee, actual margin and delay — tracked projects">
        <DataTable
          columns={[
            { key: 'project', label: 'Project' },
            { key: 'status', label: 'Status', render: (r) => r.delayed ? <StatusPill status="Delayed">Delayed</StatusPill> : <StatusPill status="On track">On track</StatusPill> },
            { key: 'budget', label: 'Quoted fee', render: (r) => inr(r.budget) },
            { key: 'margin', label: 'Actual margin', render: (r) => `${inr(r.margin)} (${r.marginPct}%)` },
            { key: 'delay', label: 'Total delay', render: (r) => r.delay > 0 ? `${r.delay}d` : '—' },
          ]}
          rows={snapshotRows}
          emptyText="No cost data yet."
        />
      </Panel>

      <Panel title="Project Cost Summary" sub="Employee Cost = Hours Worked x each employee's configured hourly rate, always. Project Labour Cost sums every employee's cost automatically — no manual entry, no single blended or average rate.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="filter-select" value={cProject} onChange={(e) => setCProject(e.target.value)}><option value="">All projects</option>{projRows.map((p) => <option key={p._id} value={String(p._id)}>{p.name}</option>)}</select>
          <select className="filter-select" value={cDept} onChange={(e) => setCDept(e.target.value)}><option value="">All departments</option>{deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <select className="filter-select" value={cEmployee} onChange={(e) => setCEmployee(e.target.value)}><option value="">All employees</option>{empRows.map((x) => <option key={x._id} value={String(x._id)}>{x.firstName} {x.lastName}</option>)}</select>
          <input type="date" className="form-input" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
          <input type="date" className="form-input" value={cTo} onChange={(e) => setCTo(e.target.value)} />
          <select className="filter-select" value={cType} onChange={(e) => setCType(e.target.value)}><option value="">All cost types</option><option value="labour">Labour</option><option value="other">Other</option></select>
          <button type="button" className="approve-btn" onClick={resetCostFilters}>Reset filters</button>
        </div>
        <div className="kpi-grid cols-4">
          <KpiCard label="Total Project Cost" value={inr(totCost)} accent="blueprint" />
          <KpiCard label="Total Labour Cost" value={inr(totLabour)} accent="forest" />
          <KpiCard label="Total Other Expenses" value={inr(totOther)} accent="teal" />
          <KpiCard label="Total Project Budget" value={inr(totBudget)} accent="copper" />
          <KpiCard label="Budget Utilized" value={`${budgetUtil}%`} accent="violet" />
          <KpiCard label="Pending / Unaccounted Costs" value={inr(0)} accent="amber" />
        </div>
        <DataTable
          columns={[
            { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br /><span className="proj-code">{r.wo}</span></> },
            { key: 'manHours', label: 'Total Man-Hours' },
            { key: 'labourCost', label: 'Project Labour Cost', render: (r) => inr(r.labourCost) },
            { key: 'otherCost', label: 'Other Project Expenses', render: (r) => inr(r.otherCost) },
            { key: 'actual', label: 'Total Actual Project Cost', render: (r) => inr(r.actual) },
            { key: 'budget', label: 'Project Budget', render: (r) => inr(r.budget) },
            { key: 'utilizedPct', label: 'Budget Utilized %', render: (r) => `${r.utilizedPct}%` },
            { key: 'remaining', label: 'Remaining Budget', render: (r) => inr(r.remaining) },
            { key: 'variance', label: 'Cost Variance', render: (r) => `${r.variance > 0 ? '+' : ''}${inr(r.variance)}` },
          ]}
          rows={costRows}
          emptyText="No cost data yet."
        />
      </Panel>

      <Panel title="Revenue by department / service category" sub="Contract value, invoiced and % collected, grouped by the service each project falls under">
        <DataTable
          columns={[
            { key: 'dept', label: 'Department / category' },
            { key: 'projects', label: 'Projects' },
            { key: 'contract', label: 'Contract value', render: (r) => inr(r.contract) },
            { key: 'invoiced', label: 'Invoiced', render: (r) => inr(r.invoiced) },
            { key: 'pct', label: '% collected', render: (r) => `${r.pct}%` },
          ]}
          rows={deptRev}
          emptyText="No revenue data yet."
        />
      </Panel>

      <Panel title="Finance Operation Control Center (OCC)" sub="Purchase orders, travel advances and hospitality / reimbursement claims, tracked end-to-end with their own workflow, bill verification checklist and audit trail">
        <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>You are viewing the OCC now — use the workflow tabs above for entries, verification and audit.</p>
      </Panel>

      <Panel title="Approvals" sub="Approvals are actioned from Leave & Travel → Approvals. Finance approves travel requests from every department. Leave requests from employees working under the Finance department can be approved directly below, without leaving this dashboard.">
        <div className="kpi-grid cols-4">
          <KpiCard label="Pending Finance team leave" value={financeLeaves.filter((r) => r.status === 'Pending').length} accent="amber" />
          <KpiCard label="Pending travel (all depts.)" value={pendingTravel} accent="teal" />
          <KpiCard label="Total travel spend (Aug)" value={inr(travelSpendAug)} accent="violet" />
          <KpiCard label="Pending settlement" value={pendingSettlement} accent="rust" />
        </div>
        <div className="section-label">Pending Finance team leave</div>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label className="form-label">Decision remarks (required to reject)</label>
          <input
            className="form-input"
            value={leaveRemarks}
            onChange={(e) => setLeaveRemarks(e.target.value)}
            placeholder="Reason for approval or rejection"
          />
        </div>
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
            { key: 'leaveType', label: 'Type' },
            { key: 'from', label: 'From', render: (r) => r.from ? new Date(r.from).toLocaleDateString() : '—' },
            { key: 'to', label: 'To', render: (r) => r.to ? new Date(r.to).toLocaleDateString() : '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
            {
              key: 'actions', label: 'Action', render: (r) => canDecideLeave && r.status === 'Pending' ? (
                <span style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => approveLeave(r._id)}>Approve</button>
                  <button type="button" className="approve-btn" disabled={decideLeave.isPending} onClick={() => rejectLeave(r._id)}>Reject</button>
                </span>
              ) : '—',
            },
          ]}
          rows={financeLeaves.filter((r) => r.status === 'Pending')}
          emptyText="No pending finance leave requests."
        />
        {(leaveDecisionError || decideLeave.isError) && <div className="login-error" role="alert" style={{ display: 'block' }}>{leaveDecisionError || decideLeave.error.message}</div>}
      </Panel>
    </>
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
