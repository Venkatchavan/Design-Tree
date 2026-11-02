import Combobox from '../components/Combobox.jsx';
import { BASE_PROJECT_TYPES, savedOptions } from '../lib/projectOptions.js';
import ContactPicker from '../components/ContactPicker.jsx';
import SalesforceImportPanel from '../components/SalesforceImportPanel.jsx';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../lib/api.js';
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
const BASE_SERVICES = ['STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'SMEP', 'SMEPF', 'MEP', 'BIM', 'GBS', 'Peer Review'];
const SERVICE_LABELS = { STR: 'Str', PHE: 'Phe', ELE: 'Elec', FIRE: 'Fire', SMEP: 'Smep', SMEPF: 'Smepf', MEP: 'Mep', BIM: 'Bim', GBS: 'Gbs' };
const CONTACT_KINDS = [
  { key: 'client', label: 'Client Contact', contactType: 'Client' },
  { key: 'architect', label: 'Architect Contact', contactType: 'Architect' },
  { key: 'billing', label: 'Contact Person for Billing', contactType: 'Client' },
];

const BLANK = {
  name: '',
  code: '',
  usedFor: '',
  clientName: '',
  related: { projectDirector: '', projectDirectorDesignation: '', projectHead: '', projectHeadDesignation: '' },
  sourcePerson: '', referral: '', startDate: '', expectedCompletion: '', actualCompletion: '',
  state: '',
  projectType: '',
  branch: '',
  services: [],
  entityName: '',
  location: { label: '', address1: '', address2: '', city: '', state: '', zip: '' },
  scopeText: '',
  fee: '',
  hospitality: '',
  jobNumber: '',
  bimWorkOrder: { scope: '', fee: '', description: '' },
  contacts: { client: null, architect: null, pmc: null, peerReview: null, billing: null },
};

function cloneBlank() {
  return JSON.parse(JSON.stringify(BLANK));
}

// Only send the related-user fields that have a value.
function relatedPayload(related) {
  const out = {};
  for (const key of ['projectDirector', 'projectDirectorDesignation', 'projectHead', 'projectHeadDesignation']) {
    const value = String(related?.[key] ?? '').trim();
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function numOrUndef(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function projectContact(contact) {
  if (!contact || typeof contact !== 'object') return undefined;
  const normalized = {
    salutation: contact.salutation || undefined,
    name: contact.name || undefined,
    designation: contact.designation || undefined,
    company: contact.company || contact.organization || undefined,
    phone: contact.phone || undefined,
    email: contact.email || undefined,
  };
  return normalized.name || normalized.email || normalized.company ? normalized : undefined;
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

// Services keep the canonical BASE_SERVICES order; live values not in the
// base list are appended alphabetically.

function F({ label, children }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function NewProjectPage({ bootstrap }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(cloneBlank);
  const [salesforceSource, setSalesforceSource] = useState(null);
  const [jobNumberMode, setJobNumberMode] = useState('automatic');
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

  // Salesforce prefill replaces the fields Salesforce owns; Datum workflow
  // fields (scope, fee, team, SPOC, BIM, billing contacts) are left alone.
  function applySalesforce(item) {
    const p = item.prefill ?? {};
    setForm((f) => ({
      ...f,
      name: p.name ?? '',
      code: p.code ?? '',
      usedFor: p.usedFor ?? '',
      clientName: p.clientName ?? '',
      jobNumber: p.jobNumber ?? '',
      entityName: p.entityName ?? '',
      state: p.state ?? '',
      projectType: p.projectType ?? '',
      branch: p.branch ?? '',
      services: p.services ?? [],
      location: { ...BLANK.location, ...(p.location ?? {}) },
      contacts: { ...f.contacts, client: p.contacts?.client ?? null },
      related: {
        ...f.related,
        projectDirector: p.related?.projectDirector ?? '',
        projectDirectorDesignation: p.related?.projectDirectorDesignation ?? '',
        projectHead: p.related?.projectHead ?? '',
        projectHeadDesignation: p.related?.projectHeadDesignation ?? '',
      },
    }));
    // The job number belongs to Salesforce for imported projects: copied as-is,
    // left blank when Salesforce has none, never auto-generated.
    setJobNumberMode('salesforce');
    setSalesforceSource(item);
    setFormError('');
  }

  function clearSalesforce() {
    const blank = cloneBlank();
    setForm((f) => ({
      ...f,
      name: blank.name,
      code: blank.code,
      usedFor: blank.usedFor,
      clientName: blank.clientName,
      jobNumber: blank.jobNumber,
      entityName: blank.entityName,
      state: blank.state,
      projectType: blank.projectType,
      branch: blank.branch,
      services: blank.services,
      location: blank.location,
      contacts: { ...f.contacts, client: null },
      related: { ...f.related, ...blank.related },
    }));
    setJobNumberMode('automatic');
    setSalesforceSource(null);
    setFormError('');
  }


  const isAdmin = (bootstrap?.role?.key ?? '') === 'admin_billing';

  const branchOptionsQ = useBranchOptions();
  const branchOptions = savedOptions(branchOptionItems(branchOptionsQ.data), [form.branch]);

  const projectsQ = useQuery({ queryKey: ['projects-new-form'], queryFn: () => projectsApi.directory({}) });

  const nextJobQ = useQuery({
    queryKey: ['next-job-number'],
    queryFn: () => projectsApi.nextJobNumber(),
    retry: false,
  });

  const projectRows = projectsQ.data?.items ?? [];

  const stateOptions = unionOptions(BASE_STATES, [...projectRows.map((p) => p.state), form.state]);
  const projectTypeOptions = savedOptions(BASE_PROJECT_TYPES, [...projectRows.map((p) => p.projectType), form.projectType]);
  const serviceOptions = BASE_SERVICES;
  const entityOptions = unionOptions([], projectRows.map((p) => p.entityName));

  const save = useMutation({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      queryClient.invalidateQueries({ queryKey: ['salesforce-projects'] });
      if (saveMode === 'new') {
        setForm(cloneBlank());
        setJobNumberMode('automatic');
        setSalesforceSource(null);
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
      code: form.code.trim() || undefined,
      usedFor: form.usedFor.trim() || undefined,
      clientName: form.clientName.trim() || undefined,
      related: relatedPayload(form.related),
      sourcePerson: form.sourcePerson.trim(), referral: form.referral.trim(),
      startDate: form.startDate || undefined, expectedCompletion: form.expectedCompletion || undefined, actualCompletion: form.actualCompletion || undefined,
      state: form.state || undefined,
      projectType: form.projectType || undefined,
      branch: form.branch || undefined,
      services: form.services ?? [],
      entityName: form.entityName.trim() || undefined,
      jobNumber: jobNumberMode === 'automatic' ? undefined : form.jobNumber.trim() || undefined,
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
      hospitalityByClient: form.hospitality === 'yes' ? true : form.hospitality === 'no' ? false : undefined,
      bimWorkOrder:
        form.bimWorkOrder.scope.trim() || form.bimWorkOrder.fee !== '' || form.bimWorkOrder.description.trim()
          ? {
              scope: form.bimWorkOrder.scope.trim() || undefined,
              fee: numOrUndef(form.bimWorkOrder.fee),
              description: form.bimWorkOrder.description.trim() || undefined,
            }
          : undefined,
      contacts: {
        client: projectContact(form.contacts.client),
        architect: projectContact(form.contacts.architect),
        billing: projectContact(form.contacts.billing),
      },
      ...(salesforceSource?.source?.id
        ? {
            salesforceRecordId: salesforceSource.source.id,
            salesforceObject: salesforceSource.source.object,
            salesforceProjectCode: salesforceSource.source.projectCode || undefined,
            salesforceLastModifiedAt: salesforceSource.source.lastModifiedAt || undefined,
            salesforceInstanceUrl: salesforceSource.source.instanceUrl || undefined,
          }
        : {}),
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
    if (!form.entityName.trim()) {
      setFormError('Missing required: Entity Name.');
      return;
    }
    if (jobNumberMode === 'manual' && !form.jobNumber.trim()) {
      setFormError('Enter a job number or switch to Automatic.');
      return;
    }
    if (!form.location.label.trim()) {
      setFormError('Missing required: Project Location.');
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

      {isAdmin && (
        <SalesforceImportPanel
          selected={salesforceSource}
          onSelect={applySalesforce}
          onClear={clearSalesforce}
        />
      )}

      {salesforceSource?.warnings?.length > 0 && (
        <div
          role="status"
          style={{
            background: 'var(--amber-bg)',
            color: 'var(--amber-dark)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '11px 14px',
            marginBottom: 22,
            fontSize: 13,
          }}
        >
          <b>Review the Salesforce prefill before saving</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {salesforceSource.warnings.map((warning, index) => (
              <li key={`${warning.field}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
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
            {['sourcePerson','referral','startDate','expectedCompletion','actualCompletion'].map((key)=><F key={key} label={({sourcePerson:'Source person',referral:'Referral',startDate:'Start date',expectedCompletion:'Expected completion',actualCompletion:'Actual completion'})[key]}><input className="form-input" aria-label={key} type={key==='sourcePerson'||key==='referral'?'text':'date'} value={form[key]} onChange={e=>set(key,e.target.value)}/></F>)}
            <F label="Job Number">
              <div className="field-grid" style={{ gridTemplateColumns: 'minmax(150px, 0.7fr) minmax(180px, 1fr)', gap: 8 }}>
                {jobNumberMode === 'salesforce' ? (
                  <>
                    <span style={{ alignSelf: 'center', fontSize: 13 }}>From Salesforce</span>
                    <input
                      className="form-input"
                      aria-label="Salesforce job number"
                      value={form.jobNumber}
                      placeholder="No job number in Salesforce"
                      readOnly
                    />
                  </>
                ) : (
                  <>
                    <select
                      className="form-input"
                      aria-label="Job number mode"
                      value={jobNumberMode}
                      onChange={(e) => {
                        setJobNumberMode(e.target.value);
                        if (e.target.value === 'automatic') set('jobNumber', '');
                      }}
                    >
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </select>
                    {jobNumberMode === 'manual' ? (
                      <input className="form-input" placeholder="Enter job number" value={form.jobNumber} onChange={(e) => set('jobNumber', e.target.value)} required />
                    ) : (
                      <span style={{ color: 'var(--ink-muted)', alignSelf: 'center' }}>
                        {nextJobQ.data?.jobNumber ? `Next: ${nextJobQ.data.jobNumber}` : 'Generated automatically'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </F>
            <F label="Entity Name *">
              <Combobox
                aria-label="Entity name"
                placeholder="Search Entities..."
                value={form.entityName}
                onChange={(v) => set('entityName', v)}
                options={entityOptions}
                addLabel={(text) => `Add “${text}” as a new entity`}
                emptyLabel="No matching entities"
                required
              />
              {(() => {
                const typed = form.entityName.trim();
                const exists = typed !== '' && entityOptions.some((x) => x.toLowerCase() === typed.toLowerCase());
                return (
                  <button
                    type="button"
                    className="approve-btn"
                    style={{ marginTop: 6 }}
                    disabled={!typed || exists}
                    title={!typed ? 'Type an entity name first' : exists ? 'This entity is already in the list' : 'Use this as a new entity'}
                    onClick={() => set('entityName', typed)}
                  >
                    Add
                  </button>
                );
              })()}
            </F>
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
            <F label="Project Location *">
              {form.location.label ? <div>{form.location.label}</div> : <span style={{ color: 'var(--ink-muted)' }}>No location set yet.</span>}
              <button type="button" className="approve-btn" style={{ marginTop: 6 }} onClick={() => setLocOpen(true)}>Add Location</button>
            </F>
            <F label="Branch Name">
              <select className="form-input" value={form.branch} onChange={(e) => set('branch', e.target.value)}>
                <option value="">--None--</option>
                {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </F>
            <F label="Building / Street Address 1"><input className="form-input" value={form.location.address1} onChange={(e) => setLoc('address1', e.target.value)} /></F>
            <F label="Building / Street Address 2"><input className="form-input" value={form.location.address2} onChange={(e) => setLoc('address2', e.target.value)} /></F>
            <F label="City and State Zip Code">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="City" value={form.location.city} onChange={(e) => setLoc('city', e.target.value)} />
                <input className="form-input" placeholder="State" value={form.location.state} onChange={(e) => setLoc('state', e.target.value)} />
                <input className="form-input" placeholder="ZIP" value={form.location.zip} onChange={(e) => setLoc('zip', e.target.value)} />
              </div>
            </F>
            <div className="form-row">
              <label className="form-label">Services</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {serviceOptions.map((s) => (
                  <label key={s} className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={(form.services ?? []).includes(s)} onChange={() => toggleService(s)} />
                    {(SERVICE_LABELS[s] ?? s).toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
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

        {/* 02 Nov 2026: Admin no longer assigns principal team leads or the SPOC.
            New projects go straight to the Directors and Design Management,
            who allocate leads and open the project for a coordinator. */}

        <Panel
          title="BIM Work Order (optional)"
          sub="Set up a separate BIM work order for this project, kept apart from its regular work order"
        >
          <F label="BIM scope of work">
            <textarea className="form-input" placeholder="Not applicable to this project" value={form.bimWorkOrder.scope} onChange={(event) => setBim('scope', event.target.value)} />
          </F>
          <div className="field-grid">
            <F label="Fee / value (optional)">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>₹</span>
                <input type="number" min="0" className="form-input" value={form.bimWorkOrder.fee} onChange={(event) => setBim('fee', event.target.value)} />
              </div>
            </F>
          </div>
          <F label="Scope description">
            <textarea className="form-input" placeholder="Describe the BIM deliverable and scope covered" value={form.bimWorkOrder.description} onChange={(event) => setBim('description', event.target.value)} />
          </F>
        </Panel>

        <Panel title="Contact Details" sub="Client, architect and billing contacts. PMC and Peer Review are maintained by the assigned SPOC.">
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
