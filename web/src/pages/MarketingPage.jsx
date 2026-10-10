import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { marketingApi } from '../lib/phase4aApi.js';
import { docsApi, fileUrl } from '../lib/docsApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

const SUPER = new Set(['founding_director', 'working_director']);
const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);
const DIRECTOR_CONTACT_TYPES = ['Client', 'Architect', 'Contractor', 'Government Official'];
const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

const TABS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'collateral', label: 'Collateral requests' },
  { key: 'contacts', label: 'Contacts' },
];

export default function MarketingPage({ bootstrap, user, viewKey }) {
  void user;
  void viewKey;
  const role = bootstrap?.role?.key ?? '';
  const canCollateral = SUPER.has(role) || String(role).includes('marketing');
  const qc = useQueryClient();

  const [tab, setTab] = useState('portfolio');
  const [search, setSearch] = useState('');
  const [contactType, setContactType] = useState('');
  const [briefProject, setBriefProject] = useState(null);
  const [briefFiles, setBriefFiles] = useState([]);
  const [briefUploading, setBriefUploading] = useState(false);
  const [briefUploadErr, setBriefUploadErr] = useState('');
  const [briefForm, setBriefForm] = useState({
    highlights: '',
    testimonial: '',
    awards: '',
    description: '',
  });
  const [collateralForm, setCollateralForm] = useState({
    project: '',
    type: '',
    details: '',
  });
  const [contactForm, setContactForm] = useState({
    name: '',
    type: '',
    email: '',
    phone: '',
    organisation: '',
  });

  const portfolio = useQuery({
    queryKey: ['marketing-portfolio'],
    queryFn: () => marketingApi.portfolio({}),
  });
  const contactsSummary = useQuery({
    queryKey: ['marketing-contacts-summary'],
    queryFn: marketingApi.contacts.summary,
  });
  const contacts = useQuery({
    queryKey: ['marketing-contacts', contactType, search],
    queryFn: () =>
      marketingApi.contacts.list({ type: contactType || undefined, search: search || undefined }),
  });
  const collateral = useQuery({
    queryKey: ['marketing-collateral'],
    queryFn: () => marketingApi.collateral.list({}),
  });
  const brief = useQuery({
    queryKey: ['marketing-brief', briefProject?.id ?? briefProject?._id],
    queryFn: () => marketingApi.brief(briefProject?.id ?? briefProject?._id),
    enabled: !!briefProject,
  });

  const saveBrief = useMutation({
    mutationFn: marketingApi.saveBrief,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-brief'] });
      qc.invalidateQueries({ queryKey: ['marketing-portfolio'] });
      setBriefProject(null);
    },
  });
  const createCollateral = useMutation({
    mutationFn: marketingApi.collateral.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-collateral'] });
      setCollateralForm({ project: '', type: '', details: '' });
    },
  });
  const updateCollateral = useMutation({
    mutationFn: ({ id, body }) => marketingApi.collateral.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-collateral'] }),
  });
  const createContact = useMutation({
    mutationFn: marketingApi.contacts.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-contacts'] });
      qc.invalidateQueries({ queryKey: ['marketing-contacts-summary'] });
      setContactForm({ name: '', type: '', email: '', phone: '', organisation: '' });
    },
  });

  const portfolioRows = arr(portfolio.data);
  const summary = portfolio.data?.summary ?? {};
  const contactRows = arr(contacts.data);
  const collateralRows = arr(collateral.data);
  const cs = contactsSummary.data ?? {};

  function openBrief(p) {
    setBriefForm({ highlights: '', testimonial: '', awards: '', description: '' });
    setBriefProject(p);
  }

  function submitBrief(e) {
    e.preventDefault();
    saveBrief.mutate({
      project: briefProject?.id ?? briefProject?._id,
      ...briefForm,
    });
  }

  function submitCollateral(e) {
    e.preventDefault();
    createCollateral.mutate({ ...collateralForm });
  }

  function submitContact(e) {
    e.preventDefault();
    createContact.mutate({ ...contactForm });
  }

  function exportContacts() {
    const ws = XLSX.utils.json_to_sheet(
      contactRows.map((c) => ({
        Name: c.name ?? '',
        Type: c.type ?? '',
        Email: c.email ?? '',
        Phone: c.phone ?? '',
        Organisation: c.organisation ?? c.company ?? '',
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'marketing-contacts.xlsx');
  }

  const briefItem = brief.data?.item ?? null;
  const mutationError =
    saveBrief.error?.message ??
    createCollateral.error?.message ??
    updateCollateral.error?.message ??
    createContact.error?.message;

  if (DIRECTOR_ROLES.has(role)) {
    return <DirectorMarketingView />;
  }

  return (
    <div id="view-marketing">
      <div className="page-head">
        <div className="page-title">Marketing</div>
        <div className="page-sub">
          Project portfolio readiness, collateral requests and the marketing contact book.
        </div>
      </div>

      <div className="kpi-grid cols-6">
        <KpiCard label="Portfolio projects" value={summary.total ?? portfolioRows.length} accent="blueprint" />
        <KpiCard label="Completed" value={summary.completed ?? 0} accent="forest" />
        <KpiCard label="Ongoing" value={summary.ongoing ?? portfolioRows.length} accent="teal" />
        <KpiCard label="Marketing ready" value={summary.ready ?? 0} accent="copper" />
        <KpiCard label="Total contacts" value={cs.total ?? contactRows.length} accent="violet" />
        <KpiCard label="Collateral open" value={collateralRows.filter((c) => !['Done', 'Closed', 'Completed'].includes(String(c.status ?? ''))).length} accent="amber" />
      </div>

      {(portfolio.error || contactsSummary.error) && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {portfolio.error?.message ?? contactsSummary.error?.message}
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {mutationError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {mutationError}
        </div>
      )}

      {tab === 'portfolio' && (
        <Panel title="Project portfolio">
          {portfolio.isLoading ? (
            <EmptyState text="Loading portfolio…" />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br /><span className="proj-code">{r.code}</span></> },
                { key: 'client', label: 'Client', render: (r) => r.client?.name ?? r.client ?? '—' },
                { key: 'stage', label: 'Stage' },
                { key: 'completion', label: 'Completion', render: (r) => (r.completion ?? r.completionPct ?? '—') },
                {
                  key: 'marketingReady',
                  label: 'Marketing ready',
                  render: (r) => (
                    <StatusPill status={r.marketingReady ? 'Ready' : 'Not ready'}>
                      {r.marketingReady ? 'Ready' : 'Not ready'}
                    </StatusPill>
                  ),
                },
                {
                  key: 'brief',
                  label: 'Brief',
                  render: (r) => (
                    <button type="button" className="approve-btn" onClick={() => openBrief(r)}>
                      Edit brief
                    </button>
                  ),
                },
              ]}
              rows={portfolioRows}
              emptyText="No portfolio projects yet."
            />
          )}
        </Panel>
      )}

      {tab === 'collateral' && (
        <>
          {canCollateral && (
            <Panel title="New collateral request">
              <form onSubmit={submitCollateral} className="field-grid">
                <div className="form-row">
                  <label className="form-label">Project *</label>
                  <select
                    required
                    className="filter-select"
                    style={{ width: '100%' }}
                    value={collateralForm.project}
                    onChange={(e) => setCollateralForm({ ...collateralForm, project: e.target.value })}
                  >
                    <option value="">Select project</option>
                    {portfolioRows.map((p) => (
                      <option key={p._id ?? p.id} value={p._id ?? p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Type *</label>
                  <input
                    required
                    className="form-input"
                    value={collateralForm.type}
                    onChange={(e) => setCollateralForm({ ...collateralForm, type: e.target.value })}
                    placeholder="Brochure, flyer, hoarding…"
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Details</label>
                  <input
                    className="form-input"
                    value={collateralForm.details}
                    onChange={(e) => setCollateralForm({ ...collateralForm, details: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={createCollateral.isPending}>
                  {createCollateral.isPending ? 'Saving…' : 'Raise request'}
                </button>
              </form>
            </Panel>
          )}
          <Panel title="Collateral log">
            {collateral.isLoading ? (
              <EmptyState text="Loading collateral requests…" />
            ) : collateral.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {collateral.error.message}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (r) => r.project?.name ?? r.project ?? '—' },
                  { key: 'type', label: 'Type' },
                  { key: 'details', label: 'Details' },
                  { key: 'createdAt', label: 'Raised', render: (r) => fmtDate(r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  {
                    key: 'actions',
                    label: 'Action',
                    render: (r) =>
                      canCollateral ? (
                        <select
                          className="filter-select"
                          value={r.status ?? ''}
                          onChange={(e) => updateCollateral.mutate({ id: r._id ?? r.id, body: { status: e.target.value } })}
                        >
                          {(r.status ? [r.status] : []).concat(['Open', 'In Progress', 'Done']).filter((v, i, a) => a.indexOf(v) === i).map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        '—'
                      ),
                  },
                ]}
                rows={collateralRows}
                emptyText="No collateral requests yet."
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'contacts' && (
        <>
          <Panel title="Add contact">
            <form onSubmit={submitContact} className="field-grid">
              <div className="form-row">
                <label className="form-label">Name *</label>
                <input required className="form-input" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">Type</label>
                <input className="form-input" value={contactForm.type} onChange={(e) => setContactForm({ ...contactForm, type: e.target.value })} placeholder="Client, vendor, media…" />
              </div>
              <div className="form-row">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">Phone</label>
                <input className="form-input" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">Organisation</label>
                <input className="form-input" value={contactForm.organisation} onChange={(e) => setContactForm({ ...contactForm, organisation: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" disabled={createContact.isPending}>
                {createContact.isPending ? 'Saving…' : 'Add contact'}
              </button>
            </form>
          </Panel>
          <Panel title="Contact book">
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="Search contacts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 240 }}
              />
              <select className="filter-select" value={contactType} onChange={(e) => setContactType(e.target.value)}>
                <option value="">All types</option>
                <option value="Client">Client</option>
                <option value="Vendor">Vendor</option>
                <option value="Media">Media</option>
              </select>
              <button type="button" className="btn-primary" onClick={exportContacts} disabled={contactRows.length === 0}>
                Export Excel
              </button>
            </div>
            {contacts.isLoading ? (
              <EmptyState text="Loading contacts…" />
            ) : contacts.error ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {contacts.error.message}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'type', label: 'Type' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'organisation', label: 'Organisation', render: (r) => r.organisation ?? r.company ?? '—' },
                ]}
                rows={contactRows}
                emptyText="No contacts yet."
              />
            )}
          </Panel>
        </>
      )}

      {briefProject && (
        <Modal title={`Marketing brief — ${briefProject.name}`} onClose={() => setBriefProject(null)} wide>
          {brief.isLoading ? (
            <EmptyState text="Loading brief…" />
          ) : brief.error ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {brief.error.message}
            </div>
          ) : (
            <form onSubmit={submitBrief} className="field-grid">
              {briefItem === null && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  No brief saved for this project yet — saving creates one.
                </p>
              )}
              <div className="form-row">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  defaultValue={briefItem?.description ?? ''}
                  onChange={(e) => setBriefForm({ ...briefForm, description: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Highlights</label>
                <input
                  className="form-input"
                  defaultValue={briefItem?.highlights ?? ''}
                  onChange={(e) => setBriefForm({ ...briefForm, highlights: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Testimonial</label>
                <input
                  className="form-input"
                  defaultValue={briefItem?.testimonial ?? ''}
                  onChange={(e) => setBriefForm({ ...briefForm, testimonial: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Awards</label>
                <input
                  className="form-input"
                  defaultValue={briefItem?.awards ?? ''}
                  onChange={(e) => setBriefForm({ ...briefForm, awards: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={saveBrief.isPending}>
                {saveBrief.isPending ? 'Saving…' : 'Save brief'}
              </button>
            </form>
          )}
          {briefItem && (
            <div style={{ marginTop: 16 }}>
              <div className="section-label">Photos / renders</div>
              {(briefItem.photos ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(briefItem.photos ?? []).map((p, i) => (
                    <a key={i} href={fileUrl(p)} download>
                      Photo {i + 1}
                    </a>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => setBriefFiles([...(e.target.files ?? [])])}
                />
                <button
                  type="button"
                  className="approve-btn"
                  disabled={briefUploading || briefFiles.length === 0}
                  onClick={async () => {
                    const pid = briefProject?.id ?? briefProject?._id;
                    if (!pid) return;
                    setBriefUploading(true);
                    setBriefUploadErr('');
                    try {
                      await docsApi.briefPhotos(pid, briefFiles);
                      setBriefFiles([]);
                      qc.invalidateQueries({ queryKey: ['marketing-brief'] });
                    } catch (err) {
                      setBriefUploadErr(err.message);
                    } finally {
                      setBriefUploading(false);
                    }
                  }}
                >
                  {briefUploading ? 'Uploading…' : 'Upload photos'}
                </button>
              </div>
              {briefUploadErr && (
                <div className="login-error" role="alert" style={{ display: 'block' }}>{briefUploadErr}</div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function stageDisplay(r) {
  if (r.status === 'Completed') return 'Complete';
  if (r.status === 'On Hold') return `${r.stage ?? ''} (on hold)`.trim();
  if ((r.completion ?? 0) === 0) return 'Not started';
  return r.stage ?? '—';
}

function DirectorMarketingView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [contactType, setContactType] = useState('');
  const [briefProjectId, setBriefProjectId] = useState('');
  const [contactForm, setContactForm] = useState({
    type: 'Client',
    name: '',
    organization: '',
    designation: '',
    phone: '',
    email: '',
    city: '',
    project: '',
    notes: '',
  });

  const portfolio = useQuery({
    queryKey: ['marketing-portfolio'],
    queryFn: () => marketingApi.portfolio({}),
  });
  const allContacts = useQuery({
    queryKey: ['marketing-contacts-all'],
    queryFn: () => marketingApi.contacts.list({}),
  });
  const contacts = useQuery({
    queryKey: ['marketing-contacts', contactType, search],
    queryFn: () =>
      marketingApi.contacts.list({ type: contactType || undefined, search: search || undefined }),
  });
  const createContact = useMutation({
    mutationFn: marketingApi.contacts.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-contacts'] });
      qc.invalidateQueries({ queryKey: ['marketing-contacts-all'] });
      qc.invalidateQueries({ queryKey: ['marketing-contacts-summary'] });
      setContactForm({
        type: 'Client', name: '', organization: '', designation: '',
        phone: '', email: '', city: '', project: '', notes: '',
      });
    },
  });

  const portfolioRows = arr(portfolio.data);
  const summary = portfolio.data?.summary ?? {};
  const selectedId = briefProjectId || portfolioRows[0]?.id || '';
  const selected = portfolioRows.find((p) => p.id === selectedId) ?? null;
  const brief = useQuery({
    queryKey: ['marketing-brief', selectedId],
    queryFn: () => marketingApi.brief(selectedId),
    enabled: !!selectedId,
  });
  const briefItem = brief.data?.item ?? null;

  const allRows = arr(allContacts.data);
  const countBy = (t) => allRows.filter((c) => c.type === t).length;
  const contactRows = arr(contacts.data);

  function submitContact(e) {
    e.preventDefault();
    createContact.mutate({
      type: contactForm.type,
      name: contactForm.name.trim(),
      organization: contactForm.organization.trim(),
      designation: contactForm.designation.trim() || undefined,
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim() || undefined,
      city: contactForm.city.trim() || undefined,
      project: contactForm.project || undefined,
      notes: contactForm.notes.trim() || undefined,
    });
  }

  function exportContacts() {
    const ws = XLSX.utils.json_to_sheet(
      contactRows.map((c) => ({
        Type: c.type ?? '',
        Name: c.name ?? '',
        'Organization / Dept.': c.organization ?? '',
        Designation: c.designation ?? '',
        Phone: c.phone ?? '',
        Email: c.email ?? '',
        City: c.city ?? '',
        'Related project': c.project?.name ?? c.project ?? '',
        'Trade / Jurisdiction': c.trade ?? c.department ?? '',
        Notes: c.notes ?? '',
        'Added by': c.addedBy?.name ?? c.addedBy ?? '',
        'Added on': c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'marketing-contacts.xlsx');
  }

  const mutationError = createContact.error?.message;

  return (
    <div id="view-marketing">
      <div className="page-head">
        <div className="page-title">Marketing Dashboard</div>
        <div className="page-sub">Project details for marketing and portfolio use — no billing, staffing or technical data</div>
      </div>

      <div className="kpi-grid cols-4">
        <KpiCard label="Portfolio projects" value={summary.portfolio ?? portfolioRows.length} accent="blueprint" />
        <KpiCard label="Completed" value={summary.completed ?? 0} accent="forest" />
        <KpiCard label="Ongoing" value={portfolioRows.filter((x) => x.status === "Active").length} accent="teal" />
        <KpiCard label="Marketing-ready" value={summary.ready ?? 0} accent="copper" />
      </div>

      {(portfolio.error || allContacts.error) && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {portfolio.error?.message ?? allContacts.error?.message}
        </div>
      )}
      {mutationError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{mutationError}</div>
      )}

      <Panel title="Portfolio projects" sub="Click a project for its marketing brief">
        {portfolio.isLoading ? (
          <EmptyState text="Loading portfolio…" />
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br /><span className="proj-code">{r.code}</span></> },
              { key: 'client', label: 'Client', render: (r) => r.client ?? '—' },
              { key: 'location', label: 'Location', render: (r) => r.location ?? '—' },
              { key: 'category', label: 'Category', render: (r) => r.category || '—' },
              { key: 'stage', label: 'Stage', render: (r) => stageDisplay(r) },
              { key: 'completion', label: 'Completion', render: (r) => (r.completion ?? '—') === '—' ? '—' : `${r.completion}%` },
              {
                key: 'marketingReady',
                label: 'Marketing-ready',
                render: (r) => (
                  <StatusPill status={r.marketingReady ? 'Ready' : 'Not ready'}>
                    {r.marketingReady ? 'Yes' : 'Not yet'}
                  </StatusPill>
                ),
              },
            ]}
            rows={portfolioRows}
            emptyText="No portfolio projects yet."
            onRowClick={(r) => setBriefProjectId(r.id)}
          />
        )}
      </Panel>

      {selected && (
        <Panel title="Project marketing brief" sub="Description, highlights and collateral status for use in proposals, the website or case studies">
          <div className="field-grid">
            <div className="form-row"><span className="form-label">{selected.name}</span></div>
            <div className="form-row"><label className="form-label">Client</label><div>{selected.client ?? '—'}</div></div>
            <div className="form-row"><label className="form-label">Location</label><div>{selected.location ?? '—'}</div></div>
            <div className="form-row"><label className="form-label">Category</label><div>{selected.category || '—'}</div></div>
            <div className="form-row"><label className="form-label">Architect</label><div>{selected.architect ?? '—'}</div></div>
            <div className="form-row"><label className="form-label">Stage</label><div>{stageDisplay(selected)}</div></div>
            <div className="form-row"><label className="form-label">Completion</label><div>{selected.completion ?? '—'}{selected.completion != null ? '%' : ''}</div></div>
          </div>
          {brief.isLoading ? (
            <EmptyState text="Loading brief…" />
          ) : (
            <div className="field-grid" style={{ marginTop: 12 }}>
              <div className="form-row"><label className="form-label">Description</label><div>{briefItem?.description || selected.description || '—'}</div></div>
              <div className="form-row"><label className="form-label">Key highlights</label><div>{(briefItem?.highlights ?? []).length > 0 ? briefItem.highlights.join(' · ') : '—'}</div></div>
              <div className="form-row"><label className="form-label">Client testimonial</label><div>{briefItem?.testimonial || 'Pending — project ongoing'}</div></div>
              <div className="form-row"><label className="form-label">Awards / recognition</label><div>{briefItem?.awards || 'None yet'}</div></div>
              <div className="form-row"><label className="form-label">Photos / renders</label><div>{(briefItem?.photos ?? []).length > 0 ? briefItem.photos.map((p, i) => <span key={i}><a href={fileUrl(p)} download>Photo {i + 1}</a>{i < briefItem.photos.length - 1 ? ' · ' : ''}</span>) : 'Pending — under construction'}</div></div>
            </div>
          )}
        </Panel>
      )}

      <Panel title="Contacts database" sub="Clients, architects, contractors and government officials — add new contacts as they come in and download the full list as Excel">
        <div className="kpi-grid cols-5">
          <KpiCard label="Total contacts" value={allRows.length} accent="blueprint" />
          <KpiCard label="Clients" value={countBy('Client')} accent="forest" />
          <KpiCard label="Architects" value={countBy('Architect')} accent="teal" />
          <KpiCard label="Contractors" value={countBy('Contractor')} accent="copper" />
          <KpiCard label="Govt. officials" value={countBy('Government Official')} accent="violet" />
        </div>
        <div className="section-label">Add new contact</div>
        <form onSubmit={submitContact} className="field-grid">
          <div className="form-row"><label className="form-label">Contact type *</label><select required className="filter-select" style={{ width: '100%' }} value={contactForm.type} onChange={(e) => setContactForm({ ...contactForm, type: e.target.value })}>{DIRECTOR_CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Full name *</label><input required className="form-input" placeholder="Person or point of contact" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Organization / Company *</label><input required className="form-input" placeholder="e.g. Skyline Developers" value={contactForm.organization} onChange={(e) => setContactForm({ ...contactForm, organization: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Designation / Role</label><input className="form-input" placeholder="e.g. Director, Site Engineer" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Phone *</label><input required className="form-input" placeholder="+91 XXXXX XXXXX" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="name@example.com" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">City / Location</label><input className="form-input" placeholder="e.g. Bengaluru" value={contactForm.city} onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Related project</label><select className="filter-select" style={{ width: '100%' }} value={contactForm.project} onChange={(e) => setContactForm({ ...contactForm, project: e.target.value })}><option value="">Not project-specific</option>{portfolioRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Notes</label><input className="form-input" placeholder="Any additional detail" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} /></div>
          <button type="submit" className="btn-primary" disabled={createContact.isPending}>{createContact.isPending ? 'Saving…' : 'Add contact'}</button>
        </form>
      </Panel>

      <Panel title="All contacts" sub={`${contactRows.length} of ${allRows.length} contacts shown`}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search name, org, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <select className="filter-select" value={contactType} onChange={(e) => setContactType(e.target.value)}>
            <option value="">All types</option>
            {DIRECTOR_CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" className="btn-primary" onClick={exportContacts} disabled={contactRows.length === 0}>
            Download Excel
          </button>
        </div>
        {contacts.isLoading ? (
          <EmptyState text="Loading contacts…" />
        ) : contacts.error ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{contacts.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'name', label: 'Name' },
              { key: 'organization', label: 'Organization / Dept.', render: (r) => r.organization ?? '—' },
              { key: 'designation', label: 'Designation', render: (r) => r.designation ?? '—' },
              { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
              { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
              { key: 'city', label: 'City', render: (r) => r.city ?? '—' },
              { key: 'project', label: 'Related project', render: (r) => r.project?.name ?? '—' },
              { key: 'trade', label: 'Trade / Jurisdiction', render: (r) => r.trade ?? r.department ?? '—' },
              { key: 'notes', label: 'Notes', render: (r) => r.notes ?? '—' },
              { key: 'addedBy', label: 'Added by', render: (r) => r.addedBy?.name ?? '—' },
              { key: 'createdAt', label: 'Added on', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—' },
            ]}
            rows={contactRows}
            emptyText="No contacts yet."
          />
        )}
      </Panel>
    </div>
  );
}
