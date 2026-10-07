import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { marketingApi } from '../lib/phase4aApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

const SUPER = new Set(['founding_director', 'working_director']);
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
        </Modal>
      )}
    </div>
  );
}
