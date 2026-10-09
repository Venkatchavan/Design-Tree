import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { projectsApi } from '../lib/api.js';
import { branchOptionItems, useBranchOptions } from '../lib/branches.js';
import Panel from '../components/Panel.jsx';
import EmptyState from '../components/EmptyState.jsx';

// Must stay in sync with api/src/models/Project.js (SERVICES / PROJECT_STATUSES / STAGES).
// Used as fallback when GET /api/projects/filters is unavailable.
const FALLBACK_SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'BIM',
  'QA/QC',
  'Peer Review',
  'QS/BOQ',
  'Other',
];
const FALLBACK_STATUSES = ['Active', 'On Hold', 'Completed', 'Other'];
const FALLBACK_STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];

const BLANK = {
  name: '',
  code: '',
  state: '',
  projectType: '',
  branch: '',
  usedFor: '',
  entityName: '',
  jobNumber: '',
  clientName: '',
  owner: '',
  startDate: '',
  expectedCompletion: '',
  actualCompletion: '',
  description: '',
  requirements: '',
  complexity: '',
  status: '',
  completion: '',
  currentStage: '',
  hospitalityByClient: false,
  location: { label: '', address1: '', address2: '', city: '', zip: '' },
  scope: [{ service: '', scope: '', fee: '' }],
  bimWorkOrder: { scope: '', fee: '', description: '' },
  principalTeamLeads: [{ service: '', name: '' }],
  contacts: { client: '', architect: '', pmc: '', peerReview: '' },
  billing: { salutation: '', name: '', designation: '', company: '', phone: '', email: '' },
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

function buildPayload(f) {
  return {
    name: f.name,
    code: f.code || undefined,
    state: f.state || undefined,
    projectType: f.projectType || undefined,
    branch: f.branch,
    usedFor: f.usedFor || undefined,
    entityName: f.entityName || undefined,
    jobNumber: f.jobNumber || undefined,
    clientName: f.clientName || undefined,
    owner: f.owner || undefined,
    startDate: f.startDate || undefined,
    expectedCompletion: f.expectedCompletion || undefined,
    actualCompletion: f.actualCompletion || undefined,
    description: f.description || undefined,
    requirements: f.requirements || undefined,
    complexity: f.complexity || undefined,
    status: f.status || undefined,
    completion: numOrUndef(f.completion),
    currentStage: f.currentStage || undefined,
    hospitalityByClient: !!f.hospitalityByClient,
    location: f.location,
    scope: (f.scope ?? [])
      .filter((r) => r.service || r.scope || r.fee !== '')
      .map((r) => ({ service: r.service, scope: r.scope, fee: numOrUndef(r.fee) })),
    bimWorkOrder:
      f.bimWorkOrder.scope || f.bimWorkOrder.fee !== '' || f.bimWorkOrder.description
        ? {
            scope: f.bimWorkOrder.scope || undefined,
            fee: numOrUndef(f.bimWorkOrder.fee),
            description: f.bimWorkOrder.description || undefined,
          }
        : undefined,
    principalTeamLeads: (f.principalTeamLeads ?? [])
      .filter((r) => r.service || r.name)
      .map((r) => ({ service: r.service, name: r.name })),
    contacts: {
      // Backend contact schema is a strict object; plain-text entries are
      // sent as the company name so validation passes.
      client: f.contacts.client ? { company: f.contacts.client } : undefined,
      architect: f.contacts.architect ? { company: f.contacts.architect } : undefined,
      pmc: f.contacts.pmc ? { company: f.contacts.pmc } : undefined,
      peerReview: f.contacts.peerReview ? { company: f.contacts.peerReview } : undefined,
      billing: f.billing,
    },
    related: f.related,
  };
}

function F({ label, children, htmlFor }) {
  return (
    <div className="form-row">
      <label className="form-label" htmlFor={htmlFor}>{label}</label>
      {children}
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
  const fileRef = useRef(null);
  const teamFileRef = useRef(null);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setLoc = (key, value) => setForm((f) => ({ ...f, location: { ...f.location, [key]: value } }));
  const setContact = (key, value) =>
    setForm((f) => ({ ...f, contacts: { ...f.contacts, [key]: value } }));
  const setBilling = (key, value) =>
    setForm((f) => ({ ...f, billing: { ...f.billing, [key]: value } }));
  const setRelated = (key, value) =>
    setForm((f) => ({ ...f, related: { ...f.related, [key]: value } }));
  const setBim = (key, value) =>
    setForm((f) => ({ ...f, bimWorkOrder: { ...f.bimWorkOrder, [key]: value } }));

  const setRow = (list, i, key, value) =>
    setForm((f) => ({
      ...f,
      [list]: f[list].map((r, j) => (j === i ? { ...r, [key]: value } : r)),
    }));

  const branchOptionsQ = useBranchOptions();
  const branchOptions = branchOptionItems(branchOptionsQ.data);

  const filtersQ = useQuery({
    queryKey: ['projects-filters'],
    queryFn: projectsApi.filters,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const serviceOptions =
    filtersQ.data?.services?.length > 0 ? filtersQ.data.services : FALLBACK_SERVICES;
  const statusOptions =
    filtersQ.data?.statuses?.length > 0 ? filtersQ.data.statuses : FALLBACK_STATUSES;
  const stageOptions =
    filtersQ.data?.stages?.length > 0 ? filtersQ.data.stages : FALLBACK_STAGES;

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

  function handleSubmit(e, mode) {
    e.preventDefault();
    setFormError('');
    setSaveMode(mode);
    const missing = [];
    if (!form.name.trim()) missing.push('Project name');
    if (!form.code.trim()) missing.push('Code');
    if (!form.state.trim()) missing.push('State');
    if (!form.projectType.trim()) missing.push('Project type');
    if (!form.branch.trim()) missing.push('Branch');
    if (!form.usedFor.trim()) missing.push('Used for');
    if (!form.entityName.trim()) missing.push('Entity name');
    if (!form.location.label.trim()) missing.push('Location label');
    if (!form.related.projectDirector.trim()) missing.push('Project director');
    if (missing.length > 0) {
      setFormError(`Missing required: ${missing.join(', ')}.`);
      return;
    }
    const badScopeRow = (form.scope ?? []).findIndex(
      (r) => (r.scope?.trim() || String(r.fee ?? '') !== '') && !r.service,
    );
    if (badScopeRow !== -1) {
      setFormError(
        `Scope row ${badScopeRow + 1} needs a Service from the dropdown.`,
      );
      return;
    }
    save.mutate(buildPayload(form));
  }

  async function handleTeamFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const mapped = rows
        .map((r) => {
          const lower = {};
          for (const [k, v] of Object.entries(r)) lower[String(k).toLowerCase().trim()] = v;
          return {
            service: String(lower.service ?? lower.discipline ?? ''),
            name: String(lower.name ?? lower.member ?? lower.lead ?? ''),
          };
        })
        .filter((r) => r.service || r.name);
      if (mapped.length === 0) {
        setFormError('Team file parsed, but no rows with service/name columns were found.');
      } else {
        setForm((f) => ({ ...f, principalTeamLeads: mapped }));
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
        <div className="page-title">New project</div>
        <div className="page-sub">Create a project engagement. Every field maps to the project record.</div>
      </div>

      {formError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{formError}</div>
      )}

      <form
        onSubmit={(e) => handleSubmit(e, 'save')}
      >
        <Panel title="Information">
          <div className="field-grid">
            <F label="Project name *"><input id="np-name" className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></F>
            <F label="Code *"><input className="form-input" value={form.code} onChange={(e) => set('code', e.target.value)} required /></F>
            <F label="State *"><input className="form-input" value={form.state} onChange={(e) => set('state', e.target.value)} required /></F>
            <F label="Project type *"><input className="form-input" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} required /></F>
            <F label="Branch *">
              <select
                className="form-input"
                value={form.branch}
                onChange={(e) => set('branch', e.target.value)}
                required
              >
                <option value="">
                  {branchOptionsQ.isLoading ? 'Loading branches…' : 'Select branch'}
                </option>
                {branchOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {!branchOptionsQ.isLoading && branchOptions.length === 0 && (
                <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  No branches yet — ask HR or Admin to add one on the Branches page.
                </span>
              )}
            </F>
            <F label="Used for *"><input className="form-input" value={form.usedFor} onChange={(e) => set('usedFor', e.target.value)} required /></F>
            <F label="Entity name *"><input className="form-input" value={form.entityName} onChange={(e) => set('entityName', e.target.value)} required /></F>
            <F label="Job number"><input className="form-input" value={form.jobNumber} onChange={(e) => set('jobNumber', e.target.value)} /></F>
            <F label="Client name"><input className="form-input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></F>
            <F label="Owner"><input className="form-input" value={form.owner} onChange={(e) => set('owner', e.target.value)} /></F>
            <F label="Start date"><input type="date" className="form-input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></F>
            <F label="Expected completion"><input type="date" className="form-input" value={form.expectedCompletion} onChange={(e) => set('expectedCompletion', e.target.value)} /></F>
            <F label="Actual completion"><input type="date" className="form-input" value={form.actualCompletion} onChange={(e) => set('actualCompletion', e.target.value)} /></F>
            <F label="Status">
              <select className="form-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">—</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </F>
            <F label="Completion %"><input type="number" min="0" max="100" className="form-input" value={form.completion} onChange={(e) => set('completion', e.target.value)} /></F>
            <F label="Current stage">
              <select className="form-input" value={form.currentStage} onChange={(e) => set('currentStage', e.target.value)}>
                <option value="">—</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </F>
          </div>
          <F label="Description"><textarea className="form-input" value={form.description} onChange={(e) => set('description', e.target.value)} /></F>
          <F label="Project requirements"><textarea className="form-input" value={form.requirements} onChange={(e) => set('requirements', e.target.value)} /></F>
          <F label="Complexity">
            <select className="form-input" value={form.complexity} onChange={(e) => set('complexity', e.target.value)}>
              <option value="">—</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </F>
          <div className="field-grid">
            <F label="Location label *"><input className="form-input" value={form.location.label} onChange={(e) => setLoc('label', e.target.value)} required /></F>
            <F label="Address line 1"><input className="form-input" value={form.location.address1} onChange={(e) => setLoc('address1', e.target.value)} /></F>
            <F label="Address line 2"><input className="form-input" value={form.location.address2} onChange={(e) => setLoc('address2', e.target.value)} /></F>
            <F label="City"><input className="form-input" value={form.location.city} onChange={(e) => setLoc('city', e.target.value)} /></F>
            <F label="ZIP"><input className="form-input" value={form.location.zip} onChange={(e) => setLoc('zip', e.target.value)} /></F>
            <div className="form-row">
              <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.hospitalityByClient} onChange={(e) => set('hospitalityByClient', e.target.checked)} />
                Hospitality by client
              </label>
            </div>
          </div>
        </Panel>

        <Panel title="Scope of work & fee">
          {form.scope.map((r, i) => (
            <div className="field-grid" key={i}>
              <F label={`Service ${i + 1} *`}>
                <select
                  className="form-input"
                  value={r.service}
                  onChange={(e) => setRow('scope', i, 'service', e.target.value)}
                >
                  <option value="">Select service</option>
                  {serviceOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </F>
              <F label="Fee"><input type="number" className="form-input" value={r.fee} onChange={(e) => setRow('scope', i, 'fee', e.target.value)} /></F>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Scope</label>
                <textarea className="form-input" value={r.scope} onChange={(e) => setRow('scope', i, 'scope', e.target.value)} />
              </div>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="approve-btn"
                  onClick={() => setForm((f) => ({ ...f, scope: f.scope.filter((_, j) => j !== i) }))}
                  disabled={form.scope.length === 1}
                >
                  Remove row
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="approve-btn"
            onClick={() => setForm((f) => ({ ...f, scope: [...f.scope, { service: '', scope: '', fee: '' }] }))}
          >
            + Add service row
          </button>
        </Panel>

        <Panel title="BIM work order (optional)">
          <div className="field-grid">
            <F label="Scope"><input className="form-input" value={form.bimWorkOrder.scope} onChange={(e) => setBim('scope', e.target.value)} /></F>
            <F label="Fee"><input type="number" className="form-input" value={form.bimWorkOrder.fee} onChange={(e) => setBim('fee', e.target.value)} /></F>
          </div>
          <F label="Description"><textarea className="form-input" value={form.bimWorkOrder.description} onChange={(e) => setBim('description', e.target.value)} /></F>
        </Panel>

        <Panel title="Principal team leads">
          {form.principalTeamLeads.map((r, i) => (
            <div className="field-grid" key={i}>
              <F label={`Service ${i + 1}`}><input className="form-input" value={r.service} onChange={(e) => setRow('principalTeamLeads', i, 'service', e.target.value)} /></F>
              <F label="Name"><input className="form-input" value={r.name} onChange={(e) => setRow('principalTeamLeads', i, 'name', e.target.value)} /></F>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="approve-btn"
                  onClick={() => setForm((f) => ({ ...f, principalTeamLeads: f.principalTeamLeads.filter((_, j) => j !== i) }))}
                  disabled={form.principalTeamLeads.length === 1}
                >
                  Remove row
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="approve-btn"
              onClick={() => setForm((f) => ({ ...f, principalTeamLeads: [...f.principalTeamLeads, { service: '', name: '' }] }))}
            >
              + Add lead row
            </button>
            <button type="button" className="approve-btn" onClick={() => teamFileRef.current?.click()}>
              Import team from Excel
            </button>
            <input
              ref={teamFileRef}
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              onChange={handleTeamFile}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8 }}>
            Team import is parsed client-side from .xlsx/.csv columns “service” and “name” and fills the rows above. No server call is made.
          </p>
        </Panel>

        <Panel title="Contact details">
          <div className="field-grid">
            <F label="Client contact"><input className="form-input" value={form.contacts.client} onChange={(e) => setContact('client', e.target.value)} /></F>
            <F label="Architect contact"><input className="form-input" value={form.contacts.architect} onChange={(e) => setContact('architect', e.target.value)} /></F>
            <F label="PMC contact"><input className="form-input" value={form.contacts.pmc} onChange={(e) => setContact('pmc', e.target.value)} /></F>
            <F label="Peer review contact"><input className="form-input" value={form.contacts.peerReview} onChange={(e) => setContact('peerReview', e.target.value)} /></F>
            <F label="Billing salutation"><input className="form-input" value={form.billing.salutation} onChange={(e) => setBilling('salutation', e.target.value)} /></F>
            <F label="Billing name"><input className="form-input" value={form.billing.name} onChange={(e) => setBilling('name', e.target.value)} /></F>
            <F label="Billing designation"><input className="form-input" value={form.billing.designation} onChange={(e) => setBilling('designation', e.target.value)} /></F>
            <F label="Billing company"><input className="form-input" value={form.billing.company} onChange={(e) => setBilling('company', e.target.value)} /></F>
            <F label="Billing phone"><input className="form-input" value={form.billing.phone} onChange={(e) => setBilling('phone', e.target.value)} /></F>
            <F label="Billing email"><input type="email" className="form-input" value={form.billing.email} onChange={(e) => setBilling('email', e.target.value)} /></F>
          </div>
        </Panel>

        <Panel title="Related user">
          <div className="field-grid">
            <F label="Project director *"><input className="form-input" value={form.related.projectDirector} onChange={(e) => setRelated('projectDirector', e.target.value)} required /></F>
            <F label="Director designation"><input className="form-input" value={form.related.projectDirectorDesignation} onChange={(e) => setRelated('projectDirectorDesignation', e.target.value)} /></F>
            <F label="Project head"><input className="form-input" value={form.related.projectHead} onChange={(e) => setRelated('projectHead', e.target.value)} /></F>
            <F label="Head designation"><input className="form-input" value={form.related.projectHeadDesignation} onChange={(e) => setRelated('projectHeadDesignation', e.target.value)} /></F>
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
            {save.isPending && saveMode === 'new' ? 'Saving…' : 'Save & New'}
          </button>
        </div>
      </form>

      <Panel title="Import projects">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!importFile || doImport.isPending}
            onClick={() => doImport.mutate(importFile)}
          >
            {doImport.isPending ? 'Importing…' : 'Import Projects'}
          </button>
        </div>
        {importResult?.ok && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13.5 }}>Created {importResult.created} project(s).</p>
            {importResult.errors.length === 0 ? (
              <EmptyState text="No row errors." />
            ) : (
              <table className="data">
                <thead><tr><th>Row</th><th>Reason</th></tr></thead>
                <tbody>
                  {importResult.errors.map((er, i) => (
                    <tr key={i}><td className="mono">{er.row}</td><td>{er.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {importResult && !importResult.ok && (
          <div className="login-error" role="alert" style={{ display: 'block', marginTop: 12 }}>
            {importResult.message}
          </div>
        )}
      </Panel>
    </>
  );
}
