import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { employeesApi, metaApi, projectsApi } from '../lib/api.js';
import { marketingApi } from '../lib/phase4aApi.js';
import { branchOptionItems, useBranchOptions } from '../lib/branches.js';
import Panel from '../components/Panel.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

// Base option lists: unioned with distinct live values below so dropdowns
// reflect existing data and never render empty on a fresh database.
const BASE_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan',
  'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
const BASE_PROJECT_TYPES = [
  'Residential', 'Commercial', 'Industrial', 'Institutional', 'Healthcare',
  'Hospitality', 'Retail', 'Mixed-use', 'Infrastructure', 'Interior',
];
const BASE_USED_FOR = [
  'Residential apartments', 'Commercial office', 'Retail mall', 'Hospital',
  'Hotel', 'School / campus', 'Industrial plant', 'IT park', 'Villa layout',
];
const PTL_DISCIPLINES = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire'];
const PTL_PLACEHOLDERS = {
  Structural: 'e.g. Meera Krishnan',
  Mechanical: 'e.g. Sneha Kulkarni',
  Electrical: 'e.g. Divya Shenoy',
  Plumbing: 'e.g. Lakshmi Iyer',
  Fire: 'e.g. Anjali Pillai',
};
const CONTACT_KINDS = [
  { key: 'client', label: 'Client Contact', contactType: 'Client' },
  { key: 'architect', label: 'Architect Contact', contactType: 'Architect' },
  { key: 'pmc', label: 'PMC Contact', contactType: 'PMC' },
  { key: 'peerReview', label: 'Peer Review Contact', contactType: 'Peer Review' },
  { key: 'billing', label: 'Contact Person for Billing', contactType: 'Client' },
];

const BLANK = {
  name: '',
  state: '',
  projectType: '',
  branch: '',
  usedFor: '',
  entityName: '',
  location: { label: '', address1: '', address2: '', city: '', state: '', zip: '' },
  scopeText: '',
  fee: '',
  hospitality: '',
  bimWorkOrder: { scope: '', fee: '', description: '' },
  principalTeamLeads: { Structural: '', Mechanical: '', Electrical: '', Plumbing: '', Fire: '' },
  contacts: { client: null, architect: null, pmc: null, peerReview: null, billing: null },
  related: { projectDirector: '', projectDirectorDesignation: '', projectHead: '', projectHeadDesignation: '' },
};

function cloneBlank() {
  return JSON.parse(JSON.stringify(BLANK));
}

function numOrUndef(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function union(base, live) {
  const seen = new Set();
  const out = [];
  for (const v of [...base, ...live]) {
    const t = String(v ?? '').trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function empDisplayName(e) {
  return [e.salutation, e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
}

function unionOptions(base, live) {
  return union(base, live);
}

function F({ label, children }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function ContactPicker({ label, contactType, value, onPick, onClear }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', organization: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const searchQ = useQuery({
    queryKey: ['contact-search', q],
    queryFn: () => marketingApi.contacts.list({ search: q }),
    enabled: q.trim().length >= 2,
  });
  const create = useMutation({
    mutationFn: (body) => marketingApi.contacts.create(body),
    onSuccess: (data) => {
      onPick(data?.item ?? data);
      setAdding(false);
      setDraft({ name: '', organization: '', phone: '', email: '' });
      setErr('');
      setQ('');
    },
    onError: (e) => setErr(e.message),
  });

  if (value) {
    return (
      <div className="form-row">
        <label className="form-label">{label}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><b>{value.name}</b>{value.organization ? ` · ${value.organization}` : ''}{value.phone ? ` · ${value.phone}` : ''}</span>
          <button type="button" className="approve-btn" onClick={onClear}>Change</button>
        </div>
      </div>
    );
  }
  if (adding) {
    return (
      <div className="form-row">
        <label className="form-label">{label} — new</label>
        <div className="field-grid">
          <F label="Name *"><input required className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
          <F label="Organization *"><input required className="form-input" value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></F>
          <F label="Phone *"><input required className="form-input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></F>
          <F label="Email"><input type="email" className="form-input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></F>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={create.isPending || !draft.name.trim() || !draft.organization.trim() || !draft.phone.trim()}
            onClick={() => create.mutate({
              type: contactType,
              name: draft.name.trim(),
              organization: draft.organization.trim(),
              phone: draft.phone.trim(),
              email: draft.email.trim() || undefined,
            })}
          >
            {create.isPending ? 'Saving…' : 'Save contact'}
          </button>
          <button type="button" className="approve-btn" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  const hits = searchQ.data?.items ?? arr(searchQ.data);
  function arr(v) {
    return Array.isArray(v) ? v : (v?.items ?? []);
  }
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="Search Contacts..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="approve-btn" onClick={() => { setAdding(true); setDraft((d) => ({ ...d, name: q })); }}>Add</button>
      </div>
      {q.trim().length >= 2 && (
        <div className="location-results">
          {searchQ.isLoading ? <div className="location-result-row">Searching…</div>
            : hits.length === 0 ? <div className="location-result-row">No matches — use Add to create it.</div>
              : hits.slice(0, 8).map((c) => (
                <div
                  key={c._id ?? c.id}
                  className="location-result-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => { onPick({ company: c.organization, name: c.name, phone: c.phone, email: c.email }); setQ(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onPick({ company: c.organization, name: c.name, phone: c.phone, email: c.email }); setQ(''); } }}
                >
                  <b>{c.name}</b>{c.organization ? ` · ${c.organization}` : ''}{c.phone ? ` · ${c.phone}` : ''}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

function LocationModal({ onSave, onClose }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [manual, setManual] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [fullAddress, setFullAddress] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const geoQ = useQuery({
    queryKey: ['geocode', debounced],
    queryFn: () => metaApi.geocode(debounced),
    enabled: debounced.length >= 3,
    retry: false,
  });
  const hits = geoQ.data?.items ?? [];

  return (
    <Modal title="Set project location" onClose={onClose} wide>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
        Search for the project / site location — no need to paste a Google Maps link
      </p>
      <div className="form-row">
        <label className="form-label">Search location</label>
        <input
          className="form-input"
          placeholder="e.g. Whitefield, Bengaluru"
          value={q}
          onChange={(e) => { setQ(e.target.value); setManual(false); }}
        />
      </div>
      {debounced.length >= 3 && (
        <div className="location-results">
          {geoQ.isLoading ? <div className="location-result-row">Searching…</div>
            : geoQ.isError ? <div className="location-result-row">Search is unavailable right now.</div>
              : hits.length === 0 ? <div className="location-result-row">No matches found.</div>
                : hits.map((h) => {
                    const sub = [h.address1, h.city, h.state, h.zip].filter(Boolean).join(', ');
                    return (
                      <div
                        key={`${h.label}-${sub}`}
                        className="location-result-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => onSave(h)}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSave(h); }}
                      >
                        <b>{h.label || '—'}</b>
                        {sub && (
                          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{sub}</div>
                        )}
                      </div>
                    );
                  })}
        </div>
      )}
      <p style={{ fontSize: 13, marginTop: 12 }}>
        Can&apos;t find it? Enter the site address manually.
      </p>
      {!manual ? (
        <button type="button" className="approve-btn" onClick={() => setManual(true)}>Custom address</button>
      ) : (
        <>
          <div className="form-row">
            <label className="form-label">Custom address</label>
            <input className="form-input" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Whitefield, Bengaluru" />
          </div>
          <div className="form-row">
            <label className="form-label">Full project / site address</label>
            <textarea className="form-input" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} />
          </div>
        </>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Location search © OpenStreetMap contributors</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {manual && (
          <button
            type="button"
            className="btn-primary"
            disabled={!customLabel.trim()}
            onClick={() => onSave({ label: customLabel.trim(), address1: fullAddress.trim(), address2: '', city: '', state: '', zip: '' })}
          >
            Save Location
          </button>
        )}
        <button type="button" className="approve-btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function NewProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(cloneBlank);
  const [formError, setFormError] = useState('');
  const [saveMode, setSaveMode] = useState('save');
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [locOpen, setLocOpen] = useState(false);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setLoc = (key, value) => setForm((f) => ({ ...f, location: { ...f.location, [key]: value } }));
  const setPtl = (discipline, value) =>
    setForm((f) => ({ ...f, principalTeamLeads: { ...f.principalTeamLeads, [discipline]: value } }));
  const setContactPicked = (kind, value) =>
    setForm((f) => ({ ...f, contacts: { ...f.contacts, [kind]: value } }));
  const setRelated = (key, value) =>
    setForm((f) => ({ ...f, related: { ...f.related, [key]: value } }));
  const setBim = (key, value) =>
    setForm((f) => ({ ...f, bimWorkOrder: { ...f.bimWorkOrder, [key]: value } }));

  const branchOptionsQ = useBranchOptions();
  const branchOptions = branchOptionItems(branchOptionsQ.data);

  const codeQ = useQuery({ queryKey: ['next-code'], queryFn: projectsApi.nextCode, retry: false, staleTime: Infinity });
  const jobQ = useQuery({ queryKey: ['next-job-number'], queryFn: projectsApi.nextJobNumber, retry: false, staleTime: Infinity });
  const projectsQ = useQuery({ queryKey: ['projects-new-form'], queryFn: () => projectsApi.list({}) });
  const employeesQ = useQuery({ queryKey: ['employees-new-form'], queryFn: () => employeesApi.list({}) });

  const projectRows = projectsQ.data?.items ?? [];
  const employeeRows = (employeesQ.data?.items ?? []).filter(
    (e) => String(e.status ?? 'Active').toLowerCase() !== 'exited',
  );

  const stateOptions = unionOptions(BASE_STATES, projectRows.map((p) => p.state));
  const projectTypeOptions = unionOptions(BASE_PROJECT_TYPES, projectRows.map((p) => p.projectType));
  const usedForOptions = unionOptions(BASE_USED_FOR, projectRows.map((p) => p.usedFor));
  const entityOptions = unionOptions([], projectRows.map((p) => p.entityName));
  const designationOptions = unionOptions([], employeeRows.map((e) => e.designation));

  const save = useMutation({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      queryClient.invalidateQueries({ queryKey: ['next-code'] });
      queryClient.invalidateQueries({ queryKey: ['next-job-number'] });
      if (saveMode === 'new') {
        setForm(cloneBlank());
        setFormError('');
      } else {
        const id = data?.project?._id ?? data?._id;
        navigate(id ? `/projects/${id}` : '/');
      }
    },
    onError: (e) => {
      const issues = e.data?.issues ?? e.data?.errors ?? [];
      if (Array.isArray(issues) && issues.length > 0) {
        const fields = issues
          .map((i) => (Array.isArray(i.path) ? i.path.join('.') : i.path ?? ''))
          .filter(Boolean)
          .slice(0, 5)
          .join(', ');
        setFormError(fields ? `${e.message} Check: ${fields}.` : e.message);
      } else {
        setFormError(e.message);
      }
    },
  });

  const doImport = useMutation({
    mutationFn: (file) => projectsApi.importFile(file),
    onSuccess: (data) => {
      setImportResult({ ok: true, created: data.created ?? 0, errors: data.errors ?? [] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      queryClient.invalidateQueries({ queryKey: ['next-code'] });
      queryClient.invalidateQueries({ queryKey: ['next-job-number'] });
    },
    onError: (e) => setImportResult({ ok: false, message: e.message, errors: e.data?.errors ?? [] }),
  });

  function buildPayload() {
    const fee = numOrUndef(form.fee);
    return {
      name: form.name.trim(),
      code: codeQ.data?.code,
      state: form.state || undefined,
      projectType: form.projectType || undefined,
      branch: form.branch,
      usedFor: form.usedFor || undefined,
      entityName: form.entityName.trim() || undefined,
      jobNumber: jobQ.data?.jobNumber,
      location: {
        label: form.location.label.trim(),
        address1: form.location.address1.trim() || undefined,
        address2: form.location.address2.trim() || undefined,
        city: form.location.city.trim() || undefined,
        state: form.location.state.trim() || undefined,
        zip: form.location.zip.trim() || undefined,
      },
      scope: form.scopeText.trim() || fee !== undefined
        ? [{ scope: form.scopeText.trim() || undefined, fee }]
        : [],
      hospitalityByClient: form.hospitality === 'yes' ? true : form.hospitality === 'no' ? false : undefined,
      bimWorkOrder:
        form.bimWorkOrder.scope.trim() || form.bimWorkOrder.fee !== '' || form.bimWorkOrder.description.trim()
          ? {
              scope: form.bimWorkOrder.scope.trim() || undefined,
              fee: numOrUndef(form.bimWorkOrder.fee),
              description: form.bimWorkOrder.description.trim() || undefined,
            }
          : undefined,
      principalTeamLeads: PTL_DISCIPLINES.filter((d) => form.principalTeamLeads[d]?.trim()).map((d) => ({
        service: d,
        name: form.principalTeamLeads[d].trim(),
      })),
      contacts: {
        client: form.contacts.client ?? undefined,
        architect: form.contacts.architect ?? undefined,
        pmc: form.contacts.pmc ?? undefined,
        peerReview: form.contacts.peerReview ?? undefined,
        billing: form.contacts.billing ?? undefined,
      },
      related: {
        projectDirector: form.related.projectDirector,
        projectDirectorDesignation: form.related.projectDirectorDesignation || undefined,
        projectHead: form.related.projectHead || undefined,
        projectHeadDesignation: form.related.projectHeadDesignation || undefined,
      },
    };
  }

  function handleSubmit(e, mode) {
    e.preventDefault();
    setFormError('');
    setSaveMode(mode);
    const missing = [];
    if (!form.name.trim()) missing.push('Project name');
    if (!codeQ.data?.code) missing.push('Project code (auto-generation failed — retry)');
    if (!form.state) missing.push('State');
    if (!form.projectType) missing.push('Project type');
    if (!form.branch) missing.push('Branch');
    if (!form.usedFor) missing.push('Used for');
    if (!form.entityName.trim()) missing.push('Entity name');
    if (!jobQ.data?.jobNumber) missing.push('Job number (auto-generation failed — retry)');
    if (!form.location.label.trim()) missing.push('Project location (use Add Location)');
    if (!form.related.projectDirector) missing.push('Project director');
    if (missing.length > 0) {
      setFormError(`Missing required: ${missing.join(', ')}.`);
      return;
    }
    save.mutate(buildPayload());
  }

  async function handleTeamFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const byDisc = {};
      let matched = 0;
      for (const r of rows) {
        const lower = {};
        for (const [k, v] of Object.entries(r)) lower[String(k).toLowerCase().trim()] = v;
        const service = String(lower.service ?? lower.discipline ?? '').trim();
        const name = String(lower.name ?? lower.member ?? lower.lead ?? '').trim();
        const key = PTL_DISCIPLINES.find((d) => d.toLowerCase() === service.toLowerCase());
        if (key && name) {
          byDisc[key] = name;
          matched += 1;
        }
      }
      if (matched === 0) {
        setFormError('Team file parsed, but no rows matched the five disciplines (Structural, Mechanical, Electrical, Plumbing, Fire) with a name.');
      } else {
        setForm((f) => ({ ...f, principalTeamLeads: { ...f.principalTeamLeads, ...byDisc } }));
      }
    } catch {
      setFormError('Could not parse the team file. Use .xlsx or .csv with service and name columns.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← Back to dashboard
      </button>
      <div className="page-head">
        <div className="page-title">New Project</div>
        <div className="page-sub">These fields become the basis for every filter downstream — branch, service, and team lead</div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>* = Required Information</p>

      {formError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{formError}</div>
      )}

      <form
        onSubmit={(e) => handleSubmit(e, 'save')}
      >
        <Panel title="Import Projects">
          <div className="form-row">
            <label className="form-label">Excel / CSV file</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          </div>
          <button type="button" className="btn-primary" disabled={!importFile || doImport.isPending} onClick={() => doImport.mutate(importFile)}>
            {doImport.isPending ? 'Importing…' : 'Import Projects'}
          </button>
          {importResult?.ok && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 13.5 }}>Created {importResult.created} project(s).</p>
              {importResult.errors.length === 0 ? (
                <EmptyState text="All rows imported cleanly." />
              ) : (
                <ul style={{ fontSize: 12.5, paddingLeft: 18 }}>
                  {importResult.errors.map((er, i) => (
                    <li key={i}>Row {er.row}: {er.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importResult && !importResult.ok && (
            <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>{importResult.message}</div>
          )}
        </Panel>

        <Panel title="Information">
          <div className="field-grid">
            <F label="Project Name *"><input className="form-input" placeholder="e.g. Business park - Tower A" value={form.name} onChange={(e) => set('name', e.target.value)} required /></F>
            <F label="State *">
              <select className="form-input" value={form.state} onChange={(e) => set('state', e.target.value)} required>
                <option value="">--None--</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Project Type *">
              <select className="form-input" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} required>
                <option value="">--None--</option>
                {projectTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Branch Name *">
              <select className="form-input" value={form.branch} onChange={(e) => set('branch', e.target.value)} required>
                <option value="">--None--</option>
                {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </F>
            <F label="Building / Street Address 2"><input className="form-input" value={form.location.address2} onChange={(e) => setLoc('address2', e.target.value)} /></F>
            <F label="Used For *">
              <select className="form-input" value={form.usedFor} onChange={(e) => set('usedFor', e.target.value)} required>
                <option value="">--None--</option>
                {usedForOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Project Code *"><input className="form-input" readOnly value={codeQ.data?.code ?? 'Auto-generated'} /></F>
            <F label="Entity Name *">
              <input
                className="form-input"
                list="np-entities"
                placeholder="Search Entities..."
                value={form.entityName}
                onChange={(e) => set('entityName', e.target.value)}
                required
              />
              <datalist id="np-entities">
                {entityOptions.map((x) => <option key={x} value={x} />)}
              </datalist>
            </F>
            <div className="form-row">
              <button type="button" className="approve-btn" onClick={() => set('entityName', form.entityName.trim())}>Add</button>
            </div>
            <F label="Project Location *">
              {form.location.label ? <div>{form.location.label}</div> : <span style={{ color: 'var(--ink-muted)' }}>No location set yet.</span>}
            </F>
            <div className="form-row">
              <button type="button" className="approve-btn" onClick={() => setLocOpen(true)}>Add Location</button>
            </div>
            <F label="Building / Street Address 1"><input className="form-input" value={form.location.address1} onChange={(e) => setLoc('address1', e.target.value)} /></F>
            <F label="City and State Zip Code">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="City" value={form.location.city} onChange={(e) => setLoc('city', e.target.value)} />
                <input className="form-input" placeholder="State" value={form.location.state} onChange={(e) => setLoc('state', e.target.value)} />
                <input className="form-input" placeholder="ZIP" value={form.location.zip} onChange={(e) => setLoc('zip', e.target.value)} />
              </div>
            </F>
            <F label="Job Number"><input className="form-input" readOnly value={jobQ.data?.jobNumber ?? 'Auto-generated'} /></F>
          </div>
        </Panel>

        <Panel title="Scope of Work & Fee" sub="Set here so Billing has the fee on record as soon as the project is created">
          <F label="Scope of work"><textarea className="form-input" placeholder="e.g. Structural, HVAC, electrical, plumbing, fire and BIM design consultancy" value={form.scopeText} onChange={(e) => set('scopeText', e.target.value)} /></F>
          <div className="field-grid">
            <F label="Fee value"><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span>₹</span><input type="number" min="0" className="form-input" value={form.fee} onChange={(e) => set('fee', e.target.value)} /></div></F>
            <F label="Hospitality taken care by client?">
              <select className="form-input" value={form.hospitality} onChange={(e) => set('hospitality', e.target.value)}>
                <option value="">--Select--</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </F>
          </div>
        </Panel>

        <Panel title="Principal team leads" sub="Assigning a lead here adds the project to their workload, and makes it searchable by their name">
          <div className="form-row" style={{ marginBottom: 10 }}>
            <label className="form-label">Import team from Excel</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleTeamFile} />
          </div>
          <datalist id="np-ptl-emps">
            {employeeRows.map((x) => <option key={x._id} value={empDisplayName(x)} />)}
          </datalist>
          <div className="field-grid">
            {PTL_DISCIPLINES.map((d) => (
              <F key={d} label={d}>
                <input
                  className="form-input"
                  list="np-ptl-emps"
                  placeholder={PTL_PLACEHOLDERS[d]}
                  value={form.principalTeamLeads[d]}
                  onChange={(e) => setPtl(d, e.target.value)}
                />
              </F>
            ))}
          </div>
        </Panel>

        <Panel title="BIM Work Order (optional)" sub="Set up a separate BIM work order for this project, kept apart from its regular work order">
          <F label="BIM scope of work"><textarea className="form-input" placeholder="Not applicable to this project" value={form.bimWorkOrder.scope} onChange={(e) => setBim('scope', e.target.value)} /></F>
          <div className="field-grid">
            <F label="Fee / value (optional)"><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span>₹</span><input type="number" min="0" className="form-input" value={form.bimWorkOrder.fee} onChange={(e) => setBim('fee', e.target.value)} /></div></F>
          </div>
          <F label="Scope description"><textarea className="form-input" placeholder="Describe the BIM deliverable and scope covered" value={form.bimWorkOrder.description} onChange={(e) => setBim('description', e.target.value)} /></F>
        </Panel>

        <Panel title="Contact Details" sub="Client, architect, PMC and peer review points of contact for this project, and who to reach for billing">
          {CONTACT_KINDS.map((c) => (
            <ContactPicker
              key={c.key}
              label={c.label}
              contactType={c.contactType}
              value={form.contacts[c.key]}
              onPick={(v) => setContactPicked(c.key, v)}
              onClear={() => setContactPicked(c.key, null)}
            />
          ))}
        </Panel>

        <Panel title="Related User">
          <div className="field-grid">
            <F label="Project Director *">
              <select className="form-input" value={form.related.projectDirector} onChange={(e) => setRelated('projectDirector', e.target.value)} required>
                <option value="">--None--</option>
                {employeeRows.map((x) => <option key={x._id} value={empDisplayName(x)}>{empDisplayName(x)}{x.designation ? ` · ${x.designation}` : ''}</option>)}
              </select>
            </F>
            <F label="Project Director Designation">
              <select className="form-input" value={form.related.projectDirectorDesignation} onChange={(e) => setRelated('projectDirectorDesignation', e.target.value)}>
                <option value="">--None--</option>
                {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </F>
            <F label="Project Head">
              <select className="form-input" value={form.related.projectHead} onChange={(e) => setRelated('projectHead', e.target.value)}>
                <option value="">--None--</option>
                {employeeRows.map((x) => <option key={x._id} value={empDisplayName(x)}>{empDisplayName(x)}{x.designation ? ` · ${x.designation}` : ''}</option>)}
              </select>
            </F>
            <F label="Project Head Designation">
              <select className="form-input" value={form.related.projectHeadDesignation} onChange={(e) => setRelated('projectHeadDesignation', e.target.value)}>
                <option value="">--None--</option>
                {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </F>
          </div>
        </Panel>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending && saveMode === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="approve-btn"
            disabled={save.isPending}
            onClick={(e) => handleSubmit(e, 'new')}
          >
            {save.isPending && saveMode === 'new' ? 'Saving…' : 'Save & add another'}
          </button>
        </div>
      </form>

      {locOpen && (
        <LocationModal
          onSave={(loc) => {
            setForm((f) => ({ ...f, location: { ...f.location, ...loc } }));
            setLocOpen(false);
          }}
          onClose={() => setLocOpen(false)}
        />
      )}
    </>
  );
}
