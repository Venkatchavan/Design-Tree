import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../lib/api.js';
import { marketingApi } from '../lib/phase4aApi.js';
import { branchOptionItems, useBranchOptions } from '../lib/branches.js';
import Panel from '../components/Panel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LocationModal from '../components/LocationModal.jsx';

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
const BASE_SERVICES = [
  'SMEPF', 'SMEP', 'MEP', 'STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'BIM', 'GBS',
];
const BASE_SOURCES = [
  'Referral', 'Direct', 'Tender', 'Repeat Client', 'Marketing', 'Other',
];
const CONTACT_KINDS = [
  { key: 'client', label: 'Client Contact', contactType: 'Client' },
  { key: 'architect', label: 'Architect Contact', contactType: 'Architect' },
  { key: 'billing', label: 'Contact Person for Billing', contactType: 'Client' },
];
// NOTE: PMC and Peer Review contacts are entered by the SPOC after allocation
// (My coordination → PMC & Peer Review contacts), not here.

const BLANK = {
  name: '',
  state: '',
  projectType: '',
  branch: '',
  services: [],
  source: '',
  entityName: '',
  location: { label: '', address1: '', address2: '', city: '', state: '', zip: '' },
  scopeText: '',
  fee: '',
  hospitality: '',
  priority: '',
  category: '',
  referral: '',
  sourcePerson: '',
  clientSpoc: '',
  workOrderDate: '',
  workOrderDocument: '',
  bimWorkOrder: { no: '', date: '', scope: '', fee: '', description: '', status: '' },
  contacts: { client: null, architect: null, billing: null },
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
  const setContactPicked = (kind, value) =>
    setForm((f) => ({ ...f, contacts: { ...f.contacts, [kind]: value } }));
  const setBim = (key, value) =>
    setForm((f) => ({ ...f, bimWorkOrder: { ...f.bimWorkOrder, [key]: value } }));
  function toggleService(s) {
    setForm((f) => ({
      ...f,
      services: (f.services ?? []).includes(s)
        ? (f.services ?? []).filter((x) => x !== s)
        : [...(f.services ?? []), s],
    }));
  }

  const branchOptionsQ = useBranchOptions();
  const branchOptions = branchOptionItems(branchOptionsQ.data);

  const projectsQ = useQuery({ queryKey: ['projects-new-form'], queryFn: () => projectsApi.list({}) });

  const projectRows = projectsQ.data?.items ?? [];

  const stateOptions = unionOptions(BASE_STATES, projectRows.map((p) => p.state));
  const projectTypeOptions = unionOptions(BASE_PROJECT_TYPES, projectRows.map((p) => p.projectType));
  const serviceOptions = unionOptions(BASE_SERVICES, projectRows.flatMap((p) => p.services ?? []));
  const sourceOptions = unionOptions(BASE_SOURCES, projectRows.map((p) => p.source));
  const entityOptions = unionOptions([], projectRows.map((p) => p.entityName));

  const save = useMutation({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
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
    },
    onError: (e) => setImportResult({ ok: false, message: e.message, errors: e.data?.errors ?? [] }),
  });

  function buildPayload() {
    const fee = numOrUndef(form.fee);
    return {
      name: form.name.trim(),
      state: form.state || undefined,
      projectType: form.projectType || undefined,
      branch: form.branch || undefined,
      services: form.services ?? [],
      source: form.source.trim() || undefined,
      entityName: form.entityName.trim() || undefined,
      location: form.location.label.trim()
        ? {
            label: form.location.label.trim(),
            address1: form.location.address1.trim() || undefined,
            address2: form.location.address2.trim() || undefined,
            city: form.location.city.trim() || undefined,
            state: form.location.state.trim() || undefined,
            zip: form.location.zip.trim() || undefined,
          }
        : undefined,
      scope: form.scopeText.trim() || fee !== undefined
        ? [{ scope: form.scopeText.trim() || undefined, fee }]
        : [],
      priority: form.priority || undefined,
      category: form.category || undefined,
      referral: form.referral.trim() || undefined,
      sourcePerson: form.sourcePerson.trim() || undefined,
      clientSpoc: form.clientSpoc.trim() || undefined,
      workOrderDate: form.workOrderDate || undefined,
      workOrderDocument: form.workOrderDocument.trim() || undefined,
      hospitalityByClient: form.hospitality === 'yes' ? true : form.hospitality === 'no' ? false : undefined,
      bimWorkOrder:
        form.bimWorkOrder.scope.trim() || form.bimWorkOrder.fee !== '' || form.bimWorkOrder.description.trim() || form.bimWorkOrder.no.trim() || form.bimWorkOrder.date || form.bimWorkOrder.status.trim()
          ? {
              no: form.bimWorkOrder.no.trim() || undefined,
              date: form.bimWorkOrder.date || undefined,
              scope: form.bimWorkOrder.scope.trim() || undefined,
              fee: numOrUndef(form.bimWorkOrder.fee),
              description: form.bimWorkOrder.description.trim() || undefined,
              status: form.bimWorkOrder.status.trim() || undefined,
            }
          : undefined,
      contacts: {
        client: (form.contacts.client && typeof form.contacts.client === 'object' && (form.contacts.client.name || form.contacts.client.email || form.contacts.client.company)) ? form.contacts.client : undefined,
        architect: (form.contacts.architect && typeof form.contacts.architect === 'object' && (form.contacts.architect.name || form.contacts.architect.email || form.contacts.architect.company)) ? form.contacts.architect : undefined,
        billing: (form.contacts.billing && typeof form.contacts.billing === 'object' && (form.contacts.billing.name || form.contacts.billing.email || form.contacts.billing.company)) ? form.contacts.billing : undefined,
      },
    };
  }

  function handleSubmit(e, mode) {
    e.preventDefault();
    setFormError('');
    setSaveMode(mode);
    if (!form.name.trim()) {
      setFormError('Missing required: Project name.');
      return;
    }
    save.mutate(buildPayload());
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
            <F label="Project Name"><input className="form-input" placeholder="e.g. Business park - Tower A" value={form.name} onChange={(e) => set('name', e.target.value)} required /></F>
            <F label="State">
              <select className="form-input" value={form.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">--None--</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Project Type">
              <select className="form-input" value={form.projectType} onChange={(e) => set('projectType', e.target.value)}>
                <option value="">--None--</option>
                {projectTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Branch Name">
              <select className="form-input" value={form.branch} onChange={(e) => set('branch', e.target.value)}>
                <option value="">--None--</option>
                {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </F>
            <F label="Building / Street Address 2"><input className="form-input" value={form.location.address2} onChange={(e) => setLoc('address2', e.target.value)} /></F>
            <div className="form-row">
              <label className="form-label">Services</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {serviceOptions.map((s) => (
                  <label key={s} className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={(form.services ?? []).includes(s)} onChange={() => toggleService(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <F label="Project Sources">
              <select
                className="form-input"
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
              >
                <option value="">--None--</option>
                {sourceOptions.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </F>
            <F label="Priority">
              <select className="form-input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="">--None--</option>
                {['High', 'Medium', 'Low'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </F>
            <F label="Category">
              <select className="form-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">--None--</option>
                {['Category A', 'Category B', 'Category C'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </F>
            <F label="Referral"><input className="form-input" value={form.referral} onChange={(e) => set('referral', e.target.value)} /></F>
            <F label="Source person"><input className="form-input" value={form.sourcePerson} onChange={(e) => set('sourcePerson', e.target.value)} /></F>
            <F label="Client SPOC"><input className="form-input" value={form.clientSpoc} onChange={(e) => set('clientSpoc', e.target.value)} /></F>
            <F label="Entity Name">
              <input
                className="form-input"
                list="np-entities"
                placeholder="Search Entities..."
                value={form.entityName}
                onChange={(e) => set('entityName', e.target.value)}
              />
              <datalist id="np-entities">
                {entityOptions.map((x) => <option key={x} value={x} />)}
              </datalist>
            </F>
            <div className="form-row">
              <button type="button" className="approve-btn" onClick={() => set('entityName', form.entityName.trim())}>Add</button>
            </div>
            <F label="Project Location">
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
            <F label="Work order date"><input type="date" className="form-input" value={form.workOrderDate} onChange={(e) => set('workOrderDate', e.target.value)} /></F>
            <F label="Work order document"><input className="form-input" placeholder="e.g. WO_PRJ045_signed.pdf" value={form.workOrderDocument} onChange={(e) => set('workOrderDocument', e.target.value)} /></F>
          </div>
        </Panel>

        <Panel title="BIM Work Order (optional)" sub="Set up a separate BIM work order for this project, kept apart from its regular work order">
          <F label="BIM scope of work"><textarea className="form-input" placeholder="Not applicable to this project" value={form.bimWorkOrder.scope} onChange={(e) => setBim('scope', e.target.value)} /></F>
          <div className="field-grid">
            <F label="Fee / value (optional)"><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span>₹</span><input type="number" min="0" className="form-input" value={form.bimWorkOrder.fee} onChange={(e) => setBim('fee', e.target.value)} /></div></F>
          </div>
          <div className="field-grid">
            <F label="BIM work order no."><input className="form-input" value={form.bimWorkOrder.no} onChange={(e) => setBim('no', e.target.value)} /></F>
            <F label="BIM work order date"><input type="date" className="form-input" value={form.bimWorkOrder.date} onChange={(e) => setBim('date', e.target.value)} /></F>
            <F label="BIM work order status"><input className="form-input" placeholder="e.g. Active" value={form.bimWorkOrder.status} onChange={(e) => setBim('status', e.target.value)} /></F>
          </div>
          <F label="Scope description"><textarea className="form-input" placeholder="Describe the BIM deliverable and scope covered" value={form.bimWorkOrder.description} onChange={(e) => setBim('description', e.target.value)} /></F>
        </Panel>

        <Panel title="Contact Details" sub="Client and architect points of contact for this project, and who to reach for billing. PMC and Peer Review contacts are entered by the SPOC.">
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
