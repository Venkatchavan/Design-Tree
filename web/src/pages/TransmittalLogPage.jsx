import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transmittalRegisterApi, downloadCsv } from '../lib/phase3Api.js';
import { projectsApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';

const REG_TABS = [
  { key: 'register', label: 'Transmittal register' },
  { key: 'variance', label: 'Area variance' },
];

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);
const DIR_DOC_TYPES = ['GFC', 'AMD', 'SAN', 'ADV', 'DD', 'SUB', 'TENDER', 'BOQ', 'STAB', 'CONCEPT', 'EXEC', 'APR', 'FEAS', 'FIRESAN', 'BWSSB', 'BESCOM', 'REF', 'WORK', 'INFO'];
const DIR_PRINT_TYPES = ['Blue Prints', 'White Prints', 'Original Tracings', 'CD', 'Document', 'Others'];
const DIR_SERVICES = ['Sanction', 'BOQ & DBR', 'GFC', 'PHE', 'Electrical', 'FIRE', 'HVAC', 'MEPF'];

function fmtRegisterDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function monthYearOf(items) {
  let latest = null;
  for (const r of items) {
    if (!r.date) continue;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  const d = latest ?? new Date();
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export default function TransmittalLogPage({ bootstrap }) {
  const isDirector = DIRECTOR_ROLES.has(bootstrap?.role?.key ?? '');
  const [tab, setTab] = useState('register');
  const [project, setProject] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    project: '', date: new Date().toISOString().slice(0, 10), projectName: '',
    dept: '', print: '', docType: '', service: '', team: '', trNo: '',
    qty: '', sets: '', rev: '', reason: '',
  });
  const qc = useQueryClient();
  const filters = useQuery({ queryKey: ['projects-filters'], queryFn: projectsApi.filters });
  const projects = useQuery({ queryKey: ['projects-register-pick'], queryFn: () => projectsApi.list({}) });
  const register = useQuery({
    queryKey: ['transmittal-register', project, search],
    queryFn: () => transmittalRegisterApi.list({ project, search }),
  });
  const add = useMutation({
    mutationFn: transmittalRegisterApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transmittal-register'] });
      setForm((f) => ({ ...f, trNo: '', qty: '', sets: '', rev: '', reason: '' }));
    },
  });
  const items = register.data?.items ?? [];
  const summary = register.data?.summary ?? {};
  const services = filters.data?.services ?? [];
  const rows = useMemo(() => items, [items]);

  function submit(e) {
    e.preventDefault();
    const selected = (projects.data?.items ?? []).find((p) => p._id === form.project);
    add.mutate({
      ...form,
      projectName: selected?.name ?? form.projectName,
      qty: Number(form.qty) || 0,
      sets: Number(form.sets) || 0,
    });
  }

  const columns = [
    { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.projectName ?? '—' },
    { key: 'dept', label: 'Dept', render: (r) => r.dept ?? '—' },
    { key: 'print', label: 'Print', render: (r) => r.print ?? '—' },
    { key: 'docType', label: 'Document type', render: (r) => r.docType ?? '—' },
    { key: 'service', label: 'Service', render: (r) => r.service ?? '—' },
    { key: 'team', label: 'Team', render: (r) => r.team ?? '—' },
    { key: 'trNo', label: 'TR no.', render: (r) => <span className="mono">{r.trNo ?? '—'}</span> },
    { key: 'qty', label: 'Qty', render: (r) => r.qty ?? 0 },
    { key: 'sets', label: 'Sets', render: (r) => r.sets ?? 0 },
    { key: 'total', label: 'Total', render: (r) => r.total ?? 0 },
    { key: 'rev', label: 'Rev', render: (r) => r.rev ?? '—' },
    { key: 'reason', label: 'Reason for revision', render: (r) => r.reason ?? '—' },
  ];

  if (isDirector) {
    return <DirectorRegisterView />;
  }

  return (
    <div id="view-transmittals">
      <div className="page-head">
        <div className="page-title">Transmittal Log</div>
        <div className="page-sub">Company-wide historical register of printed and issued drawing transmittals.</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Transmittals" value={summary.transmittals ?? 0} accent="blueprint" />
        <KpiCard label="Sheets issued" value={summary.sheets ?? 0} accent="copper" />
        <KpiCard label="Projects" value={summary.projects ?? 0} accent="forest" />
        <KpiCard label="Revisions issued" value={rows.filter((r) => /^R\s*\d+/i.test(r.rev ?? '')).length} accent="violet" />
      </div>
      <Tabs tabs={REG_TABS} active={tab} onChange={setTab} />
      {tab === 'register' ? (
        <>
          <Panel title="Log transmittal">
            <form onSubmit={submit} className="field-grid">
              <div className="form-row">
                <label className="form-label">Project *</label>
                <select className="filter-select" style={{ width: '100%' }} required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                  <option value="">Select project</option>
                  {(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div className="form-row"><label className="form-label">Date *</label><input className="form-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">TR no. *</label><input className="form-input" required value={form.trNo} onChange={(e) => setForm({ ...form, trNo: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Department *</label><input className="form-input" required value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Team member</label><input className="form-input" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Type of print *</label><input className="form-input" required value={form.print} onChange={(e) => setForm({ ...form, print: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Document type *</label><input className="form-input" required value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Service</label><select className="filter-select" style={{ width: '100%' }} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}><option value="">Select service</option>{services.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="form-row"><label className="form-label">Qty (sheets) *</label><input className="form-input" type="number" min="0" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Sets *</label><input className="form-input" type="number" min="0" required value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Revision</label><input className="form-input" value={form.rev} onChange={(e) => setForm({ ...form, rev: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Reason for revision</label><input className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              {add.isError && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{add.error.message}</div>}
              <div><button className="btn-primary" type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Log transmittal'}</button></div>
            </form>
          </Panel>
          <Panel title="Company register">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input className="form-input" style={{ maxWidth: 250 }} placeholder="Search TR, project or team" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-select" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All accessible projects</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
              <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, columns.map((c) => ({ key: c.key, label: c.label, value: c.render ? (r) => {
                if (c.key === 'project') return r.project?.name ?? r.projectName;
                return r[c.key];
              } : undefined })), 'transmittal-register.csv')}>Export CSV</button>
            </div>
            {register.isLoading ? <EmptyState text="Loading register…" /> : (
              <DataTable columns={columns} rows={rows} emptyText="No transmittal records yet." />
            )}
          </Panel>
        </>
      ) : (
        <Panel title="Area variance">
          <EmptyState text="Area variance records will appear here when QS area settlements are linked to the register." />
        </Panel>
      )}
    </div>
  );
}

function DirectorRegisterView() {
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [printType, setPrintType] = useState('');
  const [service, setService] = useState('');
  const register = useQuery({
    queryKey: ['transmittal-register-all'],
    queryFn: () => transmittalRegisterApi.list({}),
  });
  const items = register.data?.items ?? [];
  const rows = useMemo(
    () =>
      (register.data?.items ?? []).filter((r) => {
        const projName = String(r.project?.name ?? r.projectName ?? '').toLowerCase();
        return (
          (!docType || r.docType === docType) &&
          (!printType || r.print === printType) &&
          (!service || r.service === service) &&
          (!search.trim() || projName.includes(search.trim().toLowerCase()))
        );
      }),
    [register.data, docType, printType, service, search],
  );
  const projects = useMemo(() => {
    const s = new Set();
    for (const r of rows) s.add(String(r.project?.name ?? r.projectName ?? '—'));
    return s;
  }, [rows]);
  const sheets = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const revisions = rows.filter((r) => /^R[1-9]/.test(String(r.rev ?? ''))).length;
  const registerLabel = monthYearOf(items);
  const columns = [
    { key: 'date', label: 'Date', render: (r) => fmtRegisterDate(r.date) },
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.projectName ?? '—' },
    { key: 'dept', label: 'Dept', render: (r) => r.dept ?? '—' },
    { key: 'print', label: 'Print', render: (r) => r.print ?? '—' },
    { key: 'docType', label: 'Document Type', render: (r) => r.docType ?? '—' },
    { key: 'service', label: 'Service', render: (r) => r.service ?? '—' },
    { key: 'team', label: 'Team', render: (r) => r.team ?? '—' },
    { key: 'trNo', label: 'TR No.', render: (r) => <span className="mono">{r.trNo ?? '—'}</span> },
    { key: 'qty', label: 'Qty', render: (r) => r.qty ?? 0 },
    { key: 'sets', label: 'Set', render: (r) => r.sets ?? 0 },
    { key: 'total', label: 'Total', render: (r) => r.total ?? 0 },
    { key: 'rev', label: 'Rev', render: (r) => r.rev ?? '—' },
    { key: 'reason', label: 'Reason for revision', render: (r) => r.reason ?? '—' },
  ];
  return (
    <div id="view-transmittals">
      <div className="page-head">
        <div className="page-title">Transmittal Log</div>
        <div className="page-sub">Company-wide register · {registerLabel} · {items.length} transmittals across {new Set(items.map((r) => String(r.project?.name ?? r.projectName ?? '—'))).size} projects</div>
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard label="Transmittals" value={rows.length} accent="blueprint" />
        <KpiCard label="Sheets issued" value={sheets} accent="copper" />
        <KpiCard label="Projects" value={projects.size} accent="forest" />
        <KpiCard label="Revisions issued (R1+)" value={revisions} accent="violet" />
      </div>
      <Panel title="Transmittal Log" sub={`${registerLabel} register`}>
        <div className="page-sub" style={{ marginBottom: 12 }}>Date · Project · Department · Print · Document Type · Service · Team · TR No. · Drawing · Sheets · Revision</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input className="form-input" style={{ maxWidth: 170 }} placeholder="Search project" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={docType} onChange={(e) => setDocType(e.target.value)}><option value="">All document types</option>{DIR_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={printType} onChange={(e) => setPrintType(e.target.value)}><option value="">All print types</option>{DIR_PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{DIR_SERVICES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, columns.map((c) => ({ key: c.key, label: c.label, value: c.render ? (r) => {
            if (c.key === 'date') return fmtRegisterDate(r.date);
            if (c.key === 'project') return r.project?.name ?? r.projectName;
            return r[c.key];
          } : undefined })), 'transmittal-register.csv')}>Export CSV</button>
        </div>
        {register.isLoading ? <EmptyState text="Loading register…" /> : register.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{register.error.message}</div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No transmittals match these filters." />
        )}
      </Panel>
    </div>
  );
}
