import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transmittalRegisterApi, downloadCsv } from '../lib/phase3Api.js';
import { employeesApi, projectsApi } from '../lib/api.js';
import { teamsMineApi } from '../lib/workApi.js';
import { spocApi } from '../lib/spocApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

const REG_TABS = [
  { key: 'register', label: 'Transmittal register' },
  { key: 'variance', label: 'Area variance' },
];

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director', 'design_mgmt_head']);
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
  const roleKey = bootstrap?.role?.key ?? '';
  const isDirector = DIRECTOR_ROLES.has(roleKey);
  const isAssocTD = roleKey === 'assoc_technical_director';
  const isSpoc = roleKey === 'coordinator';
  const isPTL = roleKey === 'team_lead';
  const isEng = roleKey === 'engineer_drafter';
  const [tab, setTab] = useState('register');
  const [project, setProject] = useState('');
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [printType, setPrintType] = useState('');
  const [service, setService] = useState('');
  const projects = useQuery({ queryKey: ['projects-register-pick'], queryFn: () => projectsApi.list({}) });
  const register = useQuery({
    queryKey: ['transmittal-register', project, search],
    queryFn: () => transmittalRegisterApi.list({ project, search }),
  });
  const items = register.data?.items ?? [];
  const summary = register.data?.summary ?? {};
  const rows = useMemo(() => items.filter((r) =>
    (!docType || r.docType === docType) &&
    (!printType || r.print === printType) &&
    (!service || r.service === service),
  ), [items, docType, printType, service]);

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

  if (isAssocTD) {
    return <DirectorRegisterView scoped />;
  }

  if (roleKey === 'hr') {
    return <DirectorRegisterView hr />;
  }

  if (isSpoc || isPTL || isEng) {
    return <AssignedRegisterView roleKey={roleKey} />;
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
            <LogTransmittalForm />
          </Panel>
          <Panel title="Company register">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input className="form-input" style={{ maxWidth: 250 }} placeholder="Search TR, project or team" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-select" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All accessible projects</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
              <select className="filter-select" value={docType} onChange={(e) => setDocType(e.target.value)}><option value="">All document types</option>{DIR_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <select className="filter-select" value={printType} onChange={(e) => setPrintType(e.target.value)}><option value="">All print types</option>{DIR_PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <select className="filter-select" value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{DIR_SERVICES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, columns.map((c) => ({ key: c.key, label: c.label, value: c.render ? (r) => {
                if (c.key === 'project') return r.project?.name ?? r.projectName;
                return r[c.key];
              } : undefined })), 'transmittal-register.csv')}>Export CSV</button><button type="button" className="approve-btn" onClick={() => transmittalRegisterApi.pdf({ projects: [...new Set(rows.map(r => String(r.project?._id ?? r.project ?? '')))].join(',') || 'none', search, docType, print: printType, service }).catch(e => window.alert(e.message))}>Download PDF</button>
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

function LogTransmittalForm({ onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    project: '', date: new Date().toISOString().slice(0, 10), projectName: '',
    dept: '', print: '', docType: '', service: '', team: '', trNo: '',
    qty: '', sets: '', rev: '', reason: '',
  });
  const filters = useQuery({ queryKey: ['projects-filters'], queryFn: projectsApi.filters });
  const projects = useQuery({ queryKey: ['projects-register-pick'], queryFn: () => projectsApi.list({}) });
  const employees = useQuery({ queryKey: ['employees-register-pick'], queryFn: () => employeesApi.list({}) });
  const services = filters.data?.services ?? [];
  const add = useMutation({
    mutationFn: transmittalRegisterApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transmittal-register'] });
      qc.invalidateQueries({ queryKey: ['transmittal-register-all'] });
      setForm((f) => ({ ...f, trNo: '', qty: '', sets: '', rev: '', reason: '' }));
      onDone?.();
    },
  });

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

  return (
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
      <div className="form-row"><label className="form-label">Department *</label><select className="filter-select" style={{ width: '100%' }} required value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}><option value="">Select department</option>{services.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="form-row"><label className="form-label">Team member</label><input className="form-input" list="tr-team-emps" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="Select or type" /><datalist id="tr-team-emps">{(employees.data?.items ?? []).map((e) => { const n = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.empId; return <option key={e._id ?? e.id} value={n} />; })}</datalist></div>
      <div className="form-row"><label className="form-label">Type of print *</label><select className="filter-select" style={{ width: '100%' }} required value={form.print} onChange={(e) => setForm({ ...form, print: e.target.value })}><option value="">Select print</option>{DIR_PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      <div className="form-row"><label className="form-label">Document type *</label><select className="filter-select" style={{ width: '100%' }} required value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}><option value="">Select type</option>{DIR_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      <div className="form-row"><label className="form-label">Service</label><select className="filter-select" style={{ width: '100%' }} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}><option value="">Select service</option>{services.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="form-row"><label className="form-label">Qty (sheets) *</label><input className="form-input" type="number" min="0" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
      <div className="form-row"><label className="form-label">Sets *</label><input className="form-input" type="number" min="0" required value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></div>
      <div className="form-row"><label className="form-label">Revision</label><input className="form-input" value={form.rev} onChange={(e) => setForm({ ...form, rev: e.target.value })} /></div>
      <div className="form-row"><label className="form-label">Reason for revision</label><input className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
      {add.isError && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{add.error.message}</div>}
      <div><button className="btn-primary" type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Log transmittal'}</button></div>
    </form>
  );
}

function AssignedRegisterView({ roleKey }) {
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [printType, setPrintType] = useState('');
  const [service, setService] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const allocQ = useQuery({ queryKey: ['spoc-allocations-mine'], queryFn: spocApi.allocationsMine, enabled: roleKey === 'coordinator' });
  const teamsQ = useQuery({ queryKey: ['teams-mine-transmittal'], queryFn: teamsMineApi.list, enabled: roleKey === 'team_lead' || roleKey === 'engineer_drafter' });
  const register = useQuery({
    queryKey: ['transmittal-register-all'],
    queryFn: () => transmittalRegisterApi.list({}),
  });
  const myIds = useMemo(() => {
    if (roleKey === 'coordinator') {
      const ids = (allocQ.data?.items ?? []).map((a) => {
        const p = a?.project;
        return String(p?._id ?? p?.id ?? p ?? '');
      }).filter(Boolean);
      return new Set(ids);
    }
    const teams = teamsQ.data?.items ?? teamsQ.data?.teams ?? (Array.isArray(teamsQ.data) ? teamsQ.data : []);
    const ids = [];
    for (const t of teams) {
      for (const p of t.projects ?? []) {
        ids.push(String(p?._id ?? p?.id ?? p ?? ''));
      }
    }
    return new Set(ids.filter(Boolean));
  }, [allocQ.data, teamsQ.data, roleKey]);
  const rows = useMemo(
    () =>
      (register.data?.items ?? []).filter((r) => {
        const pid = String(r.project?._id ?? r.project ?? '');
        if (myIds.size > 0 && !myIds.has(pid)) return false;
        const projName = String(r.project?.name ?? r.projectName ?? '').toLowerCase();
        return (
          (!docType || r.docType === docType) &&
          (!printType || r.print === printType) &&
          (!service || r.service === service) &&
          (!search.trim() || projName.includes(search.trim().toLowerCase()))
        );
      }),
    [register.data, docType, printType, service, search, myIds],
  );
  const items = register.data?.items ?? [];
  const projectCount = new Set(rows.map((r) => String(r.project?._id ?? r.project ?? r.projectName ?? '—'))).size;
  const sheets = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const revisions = rows.filter((r) => /^R[1-9]/.test(String(r.rev ?? ''))).length;
  const registerLabel = monthYearOf(items);
  const loading = register.isLoading || allocQ.isLoading || teamsQ.isLoading;
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
        <div className="page-sub">{`Your assigned projects · ${registerLabel} · ${loading ? '…' : myIds.size} projects`}</div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
        Showing transmittals for your assigned projects only. Founding/Working Directors, the Executive Director, Admin/Billing and Associate/Technical Directors can see the complete company register.
      </p>
      <div className="kpi-grid cols-4">
        <KpiCard label="Transmittals" value={rows.length} accent="blueprint" />
        <KpiCard label="Sheets issued" value={sheets} accent="copper" />
        <KpiCard label="Projects" value={projectCount} accent="forest" />
        <KpiCard label="Revisions issued (R1+)" value={revisions} accent="violet" />
      </div>
      <Panel title="Transmittal Log">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-muted)', marginBottom: 12, paddingLeft: 4 }}>
          <span>Date</span> · <span>Project</span> · <span>Dept</span> · <span>Print</span> · <span>Document Type</span> · <span>Service</span> · <span>Team</span> · <span>TR No.</span> · <span>Drawing</span> · <span>Sheets</span> · <span>Revision</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input className="form-input" style={{ maxWidth: 170 }} placeholder="Search project" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={docType} onChange={(e) => setDocType(e.target.value)}><option value="">All document types</option>{DIR_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={printType} onChange={(e) => setPrintType(e.target.value)}><option value="">All print types</option>{DIR_PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{DIR_SERVICES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <button type="button" className="btn-primary" onClick={() => setLogOpen(true)}>Log transmittal</button>
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, columns.map((c) => ({ key: c.key, label: c.label, value: c.render ? (r) => {
            if (c.key === 'date') return fmtRegisterDate(r.date);
            if (c.key === 'project') return r.project?.name ?? r.projectName;
            return r[c.key];
          } : undefined })), 'transmittal-register.csv')}>Export CSV</button><button type="button" className="approve-btn" onClick={() => transmittalRegisterApi.pdf({ projects: [...new Set(rows.map(r => String(r.project?._id ?? r.project ?? '')))].join(',') || 'none', search, docType, print: printType, service }).catch(e => window.alert(e.message))}>Download PDF</button>
        </div>
        {loading ? <EmptyState text="Loading register…" /> : register.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{register.error.message}</div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No transmittals match these filters." />
        )}
      </Panel>
      {logOpen && (
        <Modal title="Log transmittal" onClose={() => setLogOpen(false)} wide>
          <LogTransmittalForm onDone={() => setLogOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

function DirectorRegisterView({ scoped = false, hr = false }) {
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [printType, setPrintType] = useState('');
  const [service, setService] = useState('');
  const [logOpen, setLogOpen] = useState(false);
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
  const projectCount = scoped
    ? new Set(items.map((r) => String(r.project?._id ?? r.project ?? r.projectName ?? '—'))).size
    : new Set(items.map((r) => String(r.project?.name ?? r.projectName ?? '—'))).size;
  return (
    <div id="view-transmittals">
      <div className="page-head">
        <div className="page-title">Transmittal Log</div>
        <div className="page-sub">{scoped ? `Your assigned projects · ${registerLabel} · ${projectCount} projects` : `Company-wide register · ${registerLabel} · ${items.length} transmittals across ${projectCount} projects`}</div>
      </div>
      {scoped && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Showing transmittals for your assigned projects only. Founding/Working Directors, the Executive Director, Admin/Billing and Associate/Technical Directors can see the complete company register.
        </p>
      )}
      {!hr && (
      <div className="kpi-grid cols-4">
        <KpiCard label="Transmittals" value={rows.length} accent="blueprint" />
        <KpiCard label="Sheets issued" value={sheets} accent="copper" />
        <KpiCard label="Projects" value={projects.size} accent="forest" />
        <KpiCard label="Revisions issued (R1+)" value={revisions} accent="violet" />
      </div>
      )}
      <Panel title={hr ? `${registerLabel} register` : 'Transmittal Log'}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-muted)', marginBottom: 12, paddingLeft: 4 }}>
          <span>Date</span> · <span>Project</span> · <span>Dept</span> · <span>Print</span> · <span>Document Type</span> · <span>Service</span> · <span>Team</span> · <span>TR No.</span> · <span>Drawing</span> · <span>Sheets</span> · <span>Revision</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input className="form-input" style={{ maxWidth: 170 }} placeholder="Search project" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={docType} onChange={(e) => setDocType(e.target.value)}><option value="">All document types</option>{DIR_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={printType} onChange={(e) => setPrintType(e.target.value)}><option value="">All print types</option>{DIR_PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="filter-select" value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{DIR_SERVICES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          {(scoped || hr) && <button type="button" className="btn-primary" onClick={() => setLogOpen(true)}>Log transmittal</button>}
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, columns.map((c) => ({ key: c.key, label: c.label, value: c.render ? (r) => {
            if (c.key === 'date') return fmtRegisterDate(r.date);
            if (c.key === 'project') return r.project?.name ?? r.projectName;
            return r[c.key];
          } : undefined })), 'transmittal-register.csv')}>Export CSV</button>{!hr && <button type="button" className="approve-btn" onClick={() => transmittalRegisterApi.pdf({ projects: [...new Set(rows.map(r => String(r.project?._id ?? r.project ?? '')))].join(',') || 'none', search, docType, print: printType, service }).catch(e => window.alert(e.message))}>Download PDF</button>}
        </div>
        {register.isLoading ? <EmptyState text="Loading register…" /> : register.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{register.error.message}</div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No transmittals match these filters." />
        )}
      </Panel>
      {(scoped || hr) && logOpen && (
        <Modal title="Log transmittal" onClose={() => setLogOpen(false)} wide>
          <LogTransmittalForm onDone={() => setLogOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
