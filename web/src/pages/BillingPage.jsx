import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../lib/api.js';
import { billingApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'claims', label: 'Claims' },
  { key: 'stages', label: 'Stage tracker & billing readiness' },
  { key: 'delays', label: 'Delay tracker' },
  { key: 'quotes', label: 'Project quoted fee' },
];
const STATUSES = ['Pending', 'Ready for billing', 'Billed', 'Flagged'];
const WRITERS = new Set(['founding_director', 'working_director', 'admin_billing', 'executive_director']);
const DIRECTOR_READONLY = new Set(['founding_director', 'working_director', 'executive_director']);
const money = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const moneyCr = (v) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 10000000) return `₹${parseFloat((n / 10000000).toFixed(2))}Cr`;
  return money(n);
};
const claimStatusLabel = (s) => {
  if (s === 'Billed') return 'Paid';
  if (s === 'Ready for billing') return 'Awaiting payment';
  return s ?? '—';
};

export default function BillingPage({ bootstrap }) {
  const [tab, setTab] = useState('claims');
  const [claimStatus, setClaimStatus] = useState('');
  const [stageReadiness, setStageReadiness] = useState('');
  const [claim, setClaim] = useState({ project: '', stage: '', amount: '', submissionDate: new Date().toISOString().slice(0, 10) });
  const [quote, setQuote] = useState({ project: '', quotedFee: '', hospitality: false });
  const [stage, setStage] = useState({ project: '', service: '', stage: '', plannedCompletion: '', currentStatus: '', delayDays: '', reason: '', billingReadiness: 'Pending' });
  const role = bootstrap?.role?.key ?? '';
  const canWrite = WRITERS.has(role);
  const isDirector = DIRECTOR_READONLY.has(role);
  const isAdmin = role === 'admin_billing';
  const canPostClaimOrStage = canWrite && !isDirector;
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects-billing'], queryFn: () => projectsApi.list({}) });
  const overview = useQuery({ queryKey: ['billing-overview'], queryFn: billingApi.overview });
  const claims = useQuery({ queryKey: ['billing-claims', claimStatus], queryFn: () => billingApi.claims({ status: claimStatus }) });
  const stages = useQuery({ queryKey: ['billing-stages'], queryFn: () => billingApi.stages({}) });
  const quotes = useQuery({ queryKey: ['quoted-fees'], queryFn: billingApi.quotedFees });
  const addClaim = useMutation({ mutationFn: billingApi.createClaim, onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-claims'] }); qc.invalidateQueries({ queryKey: ['billing-overview'] }); setClaim((f) => ({ ...f, stage: '', amount: '' })); } });
  const claimStatusMut = useMutation({ mutationFn: ({ id, status }) => billingApi.claimStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-claims'] }); qc.invalidateQueries({ queryKey: ['billing-overview'] }); qc.invalidateQueries({ queryKey: ['billing-stages'] }); } });
  const saveStage = useMutation({ mutationFn: billingApi.saveStage, onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-stages'] }); setStage((f) => ({ ...f, service: '', stage: '', plannedCompletion: '', currentStatus: '', delayDays: '', reason: '' })); } });
  const stageBilledMut = useMutation({ mutationFn: (id) => billingApi.updateStage(id, { billingReadiness: 'Billed' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-stages'] }); qc.invalidateQueries({ queryKey: ['billing-overview'] }); } });
  const quoteMut = useMutation({ mutationFn: ({ id, body }) => billingApi.setQuote(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['quoted-fees'] }) });
  const claimRows = claims.data?.items ?? [];
  const recentClaims = useMemo(() => [...(claims.data?.items ?? [])].sort((a, b) =>
    String(b.submissionDate ?? b.createdAt ?? '').localeCompare(String(a.submissionDate ?? a.createdAt ?? '')),
  ), [claims.data]);
  const stageRows = stages.data?.items ?? [];
  const quoteRows = quotes.data?.items ?? [];
  const stageBilled = stageRows.filter((r) => r.billingReadiness === 'Billed').length;
  const stageReady = stageRows.filter((r) => r.billingReadiness === 'Ready for billing').length;
  const stagePending = stageRows.filter((r) => r.billingReadiness === 'Pending').length;
  const stageFiltered = stageReadiness ? stageRows.filter((r) => r.billingReadiness === stageReadiness) : stageRows;
  const fmtShortDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };
  const delayLabel = (r) => ((r.delayDays ?? 0) > 0 ? `${r.delayDays} day(s) late` : 'On time');
  const readinessLabel = (r) => (r.billingReadiness === 'Pending' ? 'Not yet' : (r.billingReadiness ?? '—'));
  const projectName = (id) => (projects.data?.items ?? []).find((p) => p._id === id)?.name ?? '—';
  const totalContract = overview.data?.contractValue ?? 0;
  const claimColumns = useMemo(() => [
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
    { key: 'branch', label: 'Branch', render: (r) => r.project?.branch ?? '—' },
    { key: 'stage', label: 'Milestone', render: (r) => r.stage ?? '—' },
    { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
    { key: 'actions', label: 'Action', render: (r) => canPostClaimOrStage && r.status !== 'Billed' ? <button type="button" className="approve-btn" onClick={() => claimStatusMut.mutate({ id: r._id, status: 'Billed' })}>Mark billed</button> : '—' },
  ], [canPostClaimOrStage, setClaimStatus]);

  function submitClaim(e) {
    e.preventDefault();
    addClaim.mutate({ ...claim, amount: Number(claim.amount) });
  }
  function submitStage(e) {
    e.preventDefault();
    saveStage.mutate({ ...stage, delayDays: Number(stage.delayDays) || 0, plannedCompletion: stage.plannedCompletion || undefined });
  }
  function updateQuote(e) {
    e.preventDefault();
    quoteMut.mutate({ id: quote.project, body: { quotedFee: Number(quote.quotedFee), quotedHospitality: quote.hospitality } });
  }
  const error = addClaim.error?.message ?? saveStage.error?.message ?? quoteMut.error?.message ?? claimStatusMut.error?.message ?? stageBilledMut.error?.message;

  return (
    <div id="view-billing">
      <div className="page-head"><div className="page-title">Billing</div><div className="page-sub">{isAdmin ? 'Company-wide claims and collections, across all branches' : 'Company-wide claims and collections across all branches.'}</div></div>
      {isDirector ? (
      <div className="kpi-grid cols-2">
        <KpiCard label="Total contract value" value={money(totalContract)} accent="blueprint" />
        <KpiCard label="Invoiced to date" value={money(overview.data?.invoiced)} accent="copper" />
      </div>
      ) : (
      <div className="kpi-grid cols-2">
        <KpiCard label="Total contract value" value={moneyCr(totalContract)} accent="blueprint" />
        <KpiCard label="Invoiced to date" value={moneyCr(overview.data?.invoiced)} accent="copper" />
      </div>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {error && <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>}

      {tab === 'claims' && (isDirector ? <>
        <Panel title="Recent claims">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}><span>{claimRows.filter((x) => x.flagged).length > 0 ? `${claimRows.filter((x) => x.flagged).length} claim(s) flagged for review` : 'No claims flagged for review.'}</span><select className="filter-select" value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          {claims.isLoading ? <EmptyState text="Loading claims…" /> : <DataTable columns={claimColumns} rows={claimRows} emptyText="No billing claims have been entered." />}
        </Panel>
      </> : <>
        <Panel title="Recent claims" sub="Across projects, most recent first">
          {claims.isLoading ? <EmptyState text="Loading claims…" /> : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'branch', label: 'Branch', render: (r) => r.project?.branch ?? '—' },
              { key: 'stage', label: 'Milestone', render: (r) => r.stage ?? '—' },
              { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{claimStatusLabel(r.status)}</StatusPill> },
            ]}
            rows={recentClaims}
            emptyText="No billing claims have been entered."
          />
          )}
        </Panel>
        <Panel title="Enter new billing details" sub="Log a claim submission by project, stage and amount"><form onSubmit={submitClaim} className="field-grid">
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={claim.project} onChange={(e) => setClaim({ ...claim, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}</select></div>
          <div className="form-row"><label className="form-label">Stage *</label><input required className="form-input" value={claim.stage} onChange={(e) => setClaim({ ...claim, stage: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Amount (₹) *</label><input required type="number" min="0" className="form-input" value={claim.amount} onChange={(e) => setClaim({ ...claim, amount: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Submission date</label><input type="date" className="form-input" value={claim.submissionDate} onChange={(e) => setClaim({ ...claim, submissionDate: e.target.value })} /></div>
          <button type="submit" className="btn-primary" disabled={addClaim.isPending}>{addClaim.isPending ? 'Saving…' : 'Submit billing entry'}</button>
        </form></Panel>
      </>)}

      {tab === 'stages' && <>
        {canPostClaimOrStage && <Panel title="Update stage tracker"><form onSubmit={submitStage} className="field-grid">
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={stage.project} onChange={(e) => setStage({ ...stage, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Service</label><input className="form-input" value={stage.service} onChange={(e) => setStage({ ...stage, service: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Stage</label><input className="form-input" value={stage.stage} onChange={(e) => setStage({ ...stage, stage: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Planned completion</label><input type="date" className="form-input" value={stage.plannedCompletion} onChange={(e) => setStage({ ...stage, plannedCompletion: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Current status</label><input className="form-input" value={stage.currentStatus} onChange={(e) => setStage({ ...stage, currentStatus: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Delay (days)</label><input type="number" className="form-input" value={stage.delayDays} onChange={(e) => setStage({ ...stage, delayDays: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Billing readiness</label><select className="filter-select" value={stage.billingReadiness} onChange={(e) => setStage({ ...stage, billingReadiness: e.target.value })}>{['Billed', 'Ready for billing', 'Pending'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Reason</label><input className="form-input" value={stage.reason} onChange={(e) => setStage({ ...stage, reason: e.target.value })} /></div>
          <button className="btn-primary" type="submit" disabled={saveStage.isPending}>Save stage status</button>
        </form></Panel>}
        <Panel title="Project status — stage-wise" sub="Live stage per project & service. A completed stage that hasn't been billed yet is flagged “Ready” and the Billing team is notified automatically.">
          <div className="kpi-grid cols-3">
            <KpiCard label="Billed" value={stageBilled} accent="forest" />
            <KpiCard label="Ready for billing" value={stageReady} accent="teal" />
            <KpiCard label="Pending (stage in progress)" value={stagePending} accent="amber" />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <span className="form-label">Filter by billing status</span>
            <select className="filter-select" value={stageReadiness} onChange={(e) => setStageReadiness(e.target.value)}>
              <option value="">All</option>
              <option>Billed</option>
              <option>Ready for billing</option>
              <option>Pending</option>
            </select>
          </div>
          {stages.isLoading ? <EmptyState text="Loading…" /> : (
          <DataTable columns={[
            { key: 'project', label: 'Project', render: (r) => r.project?.name ?? projectName(r.project) },
            { key: 'service', label: 'Service' }, { key: 'stage', label: 'Stage' },
            { key: 'plannedCompletion', label: 'Planned completion', render: (r) => fmtShortDate(r.plannedCompletion) },
            { key: 'currentStatus', label: 'Current status' },
            { key: 'delayDays', label: 'Delay', render: (r) => delayLabel(r) },
            { key: 'billingReadiness', label: 'Billing readiness', render: (r) => <StatusPill status={r.billingReadiness}>{readinessLabel(r)}</StatusPill> },
            { key: 'actions', label: '', render: (r) => r.billingReadiness === 'Ready for billing' ? <button type="button" className="approve-btn" disabled={stageBilledMut.isPending} onClick={() => stageBilledMut.mutate(r._id)}>Mark billed</button> : '—' },
          ]} rows={stageFiltered} emptyText="No stage readiness records yet." />
          )}
        </Panel>
      </>}

      {tab === 'delays' && (isDirector ? (
      <Panel title="Service-wise delays"><DataTable columns={[
        { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
        { key: 'service', label: 'Service / department' }, { key: 'stage', label: 'Current stage' },
        { key: 'plannedCompletion', label: 'Planned completion', render: (r) => r.plannedCompletion ? new Date(r.plannedCompletion).toLocaleDateString() : '—' },
        { key: 'currentStatus', label: 'Actual / current status' }, { key: 'delayDays', label: 'Delay (days)' }, { key: 'reason', label: 'Reason' },
      ]} rows={stageRows.filter((r) => (r.delayDays ?? 0) > 0)} emptyText="No delay records have been entered." /></Panel>
      ) : (
      <Panel title="Service-wise delay tracker" sub="Any service running past its planned completion date — the concerned team is notified automatically, with reason where available"><DataTable columns={[
        { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
        { key: 'service', label: 'Service / Department' }, { key: 'stage', label: 'Current stage' },
        { key: 'plannedCompletion', label: 'Planned completion', render: (r) => fmtShortDate(r.plannedCompletion) },
        { key: 'currentStatus', label: 'Actual / current status' },
        { key: 'delayDays', label: 'Delay (days)', render: (r) => r.delayDays ?? 0 },
        { key: 'reason', label: 'Reason', render: (r) => r.reason || 'Not recorded' },
      ]} rows={stageRows.filter((r) => (r.delayDays ?? 0) > 0)} emptyText="No delay records have been entered." /></Panel>
      ))}

      {tab === 'quotes' && (isDirector ? <>
        {canWrite && <Panel title="Set / update quoted fee"><form onSubmit={updateQuote} className="field-grid">
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={quote.project} onChange={(e) => setQuote({ ...quote, project: e.target.value })}><option value="">Select project</option>{quoteRows.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></div>
          <div className="form-row"><label className="form-label">Quoted fee (₹) *</label><input required type="number" min="0" className="form-input" value={quote.quotedFee} onChange={(e) => setQuote({ ...quote, quotedFee: e.target.value })} /></div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={quote.hospitality} onChange={(e) => setQuote({ ...quote, hospitality: e.target.checked })} /> Hospitality arranged by client</label>
          <button className="btn-primary" type="submit" disabled={quoteMut.isPending}>Save quoted fee</button>
        </form></Panel>}
        <Panel title="Project quoted fee"><DataTable columns={[
          { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br/><span className="proj-code">{r.code}</span></> },
          { key: 'scope', label: 'Scope of work', render: (r) => r.scope?.map((s) => `${s.service}: ${s.scope || '—'}`).join(' · ') || '—' },
          { key: 'quotedFee', label: 'Quoted fee', render: (r) => money(r.quotedFee ?? r.scopedTotal) },
          { key: 'hospitality', label: 'Hospitality', render: (r) => r.hospitality ? 'Client-arranged' : '—' },
        ]} rows={quoteRows} emptyText="Create a project first to see quoted fees." /></Panel>
      </> : <>
        <Panel title="Project quoted fee" sub="The contracted fee per project — read automatically by Finance's Project Cost & Performance tracker, so it only needs to be set here"><DataTable columns={[
          { key: 'name', label: 'Project', render: (r) => <><b>{r.name}</b><br/><span className="proj-code">{r.code}</span></> },
          { key: 'scope', label: 'Scope of work', render: (r) => r.scope?.map((s) => `${s.service}: ${s.scope || '—'}`).join(' · ') || '—' },
          { key: 'quotedFee', label: 'Quoted fee', render: (r) => money(r.quotedFee ?? r.scopedTotal) },
          { key: 'hospitality', label: 'Hospitality (client-arr.)', render: (r) => r.hospitality ? 'Client-arranged' : '—' },
          { key: 'edit', label: '', render: (r) => <button type="button" className="approve-btn" onClick={() => setQuote((q) => ({ ...q, project: r.id }))}>Edit</button> },
        ]} rows={quoteRows} emptyText="Create a project first to see quoted fees." /></Panel>
        <Panel title="Set / update quoted fee"><form onSubmit={updateQuote} className="field-grid">
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={quote.project} onChange={(e) => setQuote({ ...quote, project: e.target.value })}><option value="">--Select project--</option>{quoteRows.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></div>
          <div className="form-row"><label className="form-label">Quoted fee (₹) *</label><input required type="number" min="0" className="form-input" value={quote.quotedFee} onChange={(e) => setQuote({ ...quote, quotedFee: e.target.value })} /></div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={quote.hospitality} onChange={(e) => setQuote({ ...quote, hospitality: e.target.checked })} /> Hospitality arranged by client</label>
          <button className="btn-primary" type="submit" disabled={quoteMut.isPending}>Save quoted fee</button>
        </form></Panel>
      </>)}
    </div>
  );
}
