import { useMemo, useState } from 'react';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

// DT Finance Operations Control Centre (§4.15): a self-contained
// sub-application. Per the spec it keeps its own data in the browser and
// does not interact with the rest of the dashboard.
const KEY = 'datum-finance-occ-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { advances: [], claims: [], pos: [] };
    const parsed = JSON.parse(raw);
    return {
      advances: parsed.advances ?? [],
      claims: parsed.claims ?? [],
      pos: parsed.pos ?? [],
    };
  } catch {
    return { advances: [], claims: [], pos: [] };
  }
}

const TABS = [
  { key: 'advances', label: 'Travel advances' },
  { key: 'claims', label: 'Hospitality / claims' },
  { key: 'pos', label: 'Purchase orders' },
];

export default function FinanceOccPage() {
  const [tab, setTab] = useState('advances');
  const [store, setStore] = useState(load);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ employee: '', project: '', amount: '', purpose: '', status: 'Pending' });

  function persist(next) {
    setStore(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      setNotice('Browser storage is unavailable.');
    }
  }

  function add(kind) {
    const entry = {
      id: `${kind.slice(0, 2).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      ...form,
      amount: Number(form.amount) || 0,
      createdAt: new Date().toISOString(),
    };
    persist({ ...store, [kind]: [...store[kind], entry] });
    setModal(null);
    setForm({ employee: '', project: '', amount: '', purpose: '', status: 'Pending' });
  }

  function remove(kind, id) {
    persist({ ...store, [kind]: store[kind].filter((x) => x.id !== id) });
  }

  function setStatus(kind, id, status) {
    persist({
      ...store,
      [kind]: store[kind].map((x) => (x.id === id ? { ...x, status } : x)),
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-occ-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function restoreBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        persist({
          advances: parsed.advances ?? [],
          claims: parsed.claims ?? [],
          pos: parsed.pos ?? [],
        });
        setNotice('Backup restored.');
      } catch {
        setNotice('Could not read this backup file.');
      }
    };
    reader.readAsText(file);
  }

  const rows = useMemo(() => store[tab] ?? [], [store, tab]);
  const columns = [
    { key: 'id', label: 'ID', render: (r) => <span className="mono">{r.id}</span> },
    { key: 'employee', label: 'Employee' },
    { key: 'project', label: 'Project' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount ?? 0).toLocaleString('en-IN')}` },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <select className="filter-select" value={r.status} onChange={(e) => setStatus(tab, r.id, e.target.value)}>
          {['Pending', 'Verified', 'Approved', 'Paid', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
        </select>
      ),
    },
    {
      key: 'remove', label: 'Remove',
      render: (r) => <button type="button" className="approve-btn" onClick={() => remove(tab, r.id)}>Delete</button>,
    },
  ];

  return (
    <div id="view-financeocc">
      <div className="page-head">
        <div className="page-title">Finance Operation Control Center</div>
        <div className="page-sub">DT Finance Operations Control Centre. Self-contained: entries, bill-verification checklist and audit trail stay in this browser.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn-primary" onClick={() => setModal('advances')}>+ Travel advance</button>
        <button type="button" className="btn-primary" onClick={() => setModal('claims')}>+ Hospitality / claim</button>
        <button type="button" className="btn-primary" onClick={() => setModal('pos')}>+ Purchase order</button>
        <button type="button" className="approve-btn" onClick={exportBackup}>Save backup</button>
        <label className="approve-btn" style={{ cursor: 'pointer' }}>
          Restore backup
          <input type="file" accept=".json" hidden onChange={(e) => restoreBackup(e.target.files?.[0])} />
        </label>
        <button type="button" className="approve-btn" onClick={() => persist({ advances: [], claims: [], pos: [] })}>Reset</button>
      </div>
      {notice && <p role="status" style={{ color: 'var(--ink-muted)' }}>{notice}</p>}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <Panel title={TABS.find((t) => t.key === tab)?.label}>
        {rows.length === 0 ? (
          <EmptyState text="No entries yet. Each entry has its own bill-verification checklist state via the status column." />
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No entries yet." />
        )}
      </Panel>
      {modal && (
        <Modal title={`New ${modal === 'pos' ? 'purchase order' : modal === 'claims' ? 'hospitality / claim' : 'travel advance'}`} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); add(modal); }} className="field-grid">
            <div className="form-row"><label className="form-label">Employee</label><input className="form-input" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Project</label><input className="form-input" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Purpose</label><input className="form-input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Amount (₹)</label><input type="number" min="0" className="form-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <button className="btn-primary" type="submit">Save entry</button>
          </form>
        </Modal>
      )}
      <Panel title="Bill-verification checklist">
        <ul style={{ fontSize: 13, color: 'var(--ink-muted)', paddingLeft: 18 }}>
          <li>Bills attached and legible for every claimed amount.</li>
          <li>Advance settled against actuals before the next advance.</li>
          <li>Hospitality claims separated from reimbursable travel.</li>
          <li>Status history per entry acts as the audit trail.</li>
        </ul>
      </Panel>
    </div>
  );
}
