import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import Tabs from './Tabs.jsx';
import DataTable from './DataTable.jsx';
import KpiCard from './KpiCard.jsx';
import Field from './Field.jsx';
import StatusPill from './StatusPill.jsx';
import { discApi, serviceDashboardApi } from '../lib/functionsApi.js';
import { fmtDashDate } from '../lib/dates.js';

// Mirrors the server write lists; superusers pass server-side.
const DASHBOARD_WRITERS = new Set([
  'founding_director',
  'working_director',
  'qaqc',
  'qaqc_head',
  'team_lead',
  'technical_director',
  'executive_director',
]);
const ALERT_WRITERS = new Set(['founding_director', 'working_director', 'executive_director', 'qaqc', 'team_lead']);

const QAQC_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'alerts', label: 'Design alerts' },
  { key: 'weekly', label: 'Weekly report' },
];
const ALERT_STATUSES = ['Open', 'In Progress', 'Closed'];
const ALERT_LABELS = { Open: 'Open', 'In Progress': 'In Progress', Closed: 'Resolved' };

const str = (v) => String(v ?? '').trim() || undefined;
const num = (v) => (v === '' || v == null ? undefined : Number(v));

function weekLabel(r) {
  if (r.weekLabel) return r.weekLabel;
  const a = r.weekStart ? new Date(r.weekStart) : null;
  const b = r.weekEnd ? new Date(r.weekEnd) : null;
  if (a && !Number.isNaN(a.getTime()) && b && !Number.isNaN(b.getTime())) {
    const mon = a.toLocaleString('en-GB', { month: 'short' });
    return `${mon} ${a.getDate()}-${b.getDate()}`;
  }
  return fmtDashDate(r.weekStart);
}

export default function QaqcServicePanel({ projectId, codes, dashboard, principalTeamLeads, visits, discrepancies, weeklyRows, role, readOnly = false }) {
  const d = dashboard ?? {};
  const canEdit = DASHBOARD_WRITERS.has(role) && !readOnly;
  const canAlerts = ALERT_WRITERS.has(role) && !readOnly;
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(null);

  const saveDash = useMutation({
    mutationFn: (body) => serviceDashboardApi.save({ project: projectId, service: 'QAQC', ...body }),
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['project-service-dashboards', projectId] });
    },
  });
  const updateAlert = useMutation({
    mutationFn: ({ id, status }) => discApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-discs', projectId] }),
  });

  const ptl = (principalTeamLeads ?? [])
    .filter((t) => codes.includes(String(t.service ?? '')))
    .flatMap((t) => [t.name, ...(t.names ?? [])])
    .filter(Boolean)
    .join(', ');

  const visitList = [...visits].sort((a, b) => String(b.visitId ?? '').localeCompare(String(a.visitId ?? '')));
  const additionalCount = visits.filter((v) => v.additionalVisit).length;
  const issueCount = visits.filter((v) => v.discrepancyFound).length;
  const visitById = new Map(visits.map((v) => [String(v._id), v]));

  const alerts = discrepancies
    .filter((x) => x.kind === 'Drawing' && x.siteVisit)
    .sort((a, b) => String(b.raised ?? b.createdAt ?? '').localeCompare(String(a.raised ?? a.createdAt ?? '')));

  const weekRows = weeklyRows.map((r) => {
    const start = r.weekStart ? new Date(r.weekStart) : null;
    const end = r.weekEnd ? new Date(r.weekEnd) : null;
    const count = visits.filter((v) => {
      const t = new Date(v.date ?? v.createdAt);
      if (Number.isNaN(t.getTime())) return false;
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    }).length;
    return {
      _id: r._id,
      week: weekLabel(r),
      visits: count,
      status: r.status ?? 'Submitted',
      submitted: r.submittedAt,
      approved: r.approvedAt,
      waiting: r.status === 'Approved' ? '—' : 'Awaiting QA/QC Specs Head',
    };
  });

  function startEdit() {
    setDraft({
      technicalDirector: d.technicalDirector ?? '',
      auditors: d.auditors ?? '',
      reviewers: d.reviewers ?? '',
    });
  }

  const setDraftField = (key) => (e) => setDraft((x) => ({ ...x, [key]: e.target.value }));

  function submitDraft(e) {
    e.preventDefault();
    saveDash.mutate({
      technicalDirector: str(draft.technicalDirector),
      auditors: num(draft.auditors),
      reviewers: num(draft.reviewers),
    });
  }

  const error = saveDash.error?.message ?? updateAlert.error?.message;

  return (
    <>
      {error && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>
      )}

      <Panel title="Team">
        {canEdit && !draft && (
          <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={startEdit}>
            Edit team
          </button>
        )}
        {draft && (
          <form onSubmit={submitDraft} style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Technical director</label>
                <input className="form-input" value={draft.technicalDirector} onChange={setDraftField('technicalDirector')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Auditors</label>
                <input type="number" min="0" className="form-input" value={draft.auditors} onChange={setDraftField('auditors')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Reviewers</label>
                <input type="number" min="0" className="form-input" value={draft.reviewers} onChange={setDraftField('reviewers')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={saveDash.isPending}>
                {saveDash.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="field-grid">
          <Field label="Technical director" value={d.technicalDirector} />
          <Field label="Principal team lead" value={ptl} />
          <Field label="Auditors" value={d.auditors} />
          <Field label="Reviewers" value={d.reviewers} />
        </div>
      </Panel>

      <Tabs tabs={QAQC_TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="No. of visits" value={visits.length} accent="blueprint" />
            <KpiCard label="Additional visits" value={additionalCount} accent="teal" />
            <KpiCard label="Drawing issues found" value={issueCount} accent="rust" />
          </div>
          <Panel title="Recent site visits">
            <DataTable
              columns={[
                { key: 'visitId', label: 'Visit no.', render: (v) => v.visitId ?? '—' },
                { key: 'phase', label: 'Phase', render: (v) => v.phase ?? '—' },
                { key: 'type', label: 'Type', render: (v) => v.visitType ?? '—' },
                { key: 'date', label: 'Date', render: (v) => fmtDashDate(v.date ?? v.createdAt, '2-digit') },
                { key: 'issue', label: 'Drawing issue?', render: (v) => (v.discrepancyFound ? 'Yes' : 'No') },
              ]}
              rows={visitList}
              emptyText="No site visits recorded for this project yet."
            />
          </Panel>
        </>
      )}

      {tab === 'alerts' && (
        <Panel title="Designer alerts" sub="Raised automatically when a site visit finds a drawing discrepancy">
          <DataTable
            columns={[
              { key: 'alert', label: 'Alert', render: (r) => r.discId ?? '—' },
              { key: 'visit', label: 'Visit', render: (r) => visitById.get(String(r.siteVisit))?.visitId ?? '—' },
              { key: 'issue', label: 'Issue', render: (r) => r.issue || '—' },
              { key: 'raised', label: 'Raised', render: (r) => fmtDashDate(r.raised ?? r.createdAt, '2-digit') },
              {
                key: 'status',
                label: 'Status',
                render: (r) =>
                  canAlerts ? (
                    <select
                      className="filter-select"
                      value={r.status ?? 'Open'}
                      disabled={updateAlert.isPending}
                      onChange={(e) => updateAlert.mutate({ id: r._id, status: e.target.value })}
                    >
                      {ALERT_STATUSES.map((s) => <option key={s} value={s}>{ALERT_LABELS[s]}</option>)}
                    </select>
                  ) : (
                    <StatusPill status={r.status ?? 'Open'}>{ALERT_LABELS[r.status] ?? r.status ?? 'Open'}</StatusPill>
                  ),
              },
            ]}
            rows={alerts}
            emptyText="No alerts raised for this project yet."
          />
        </Panel>
      )}

      {tab === 'weekly' && (
        <Panel title="Weekly report and PTL approval">
          <DataTable
            columns={[
              { key: 'week', label: 'Week', render: (r) => r.week },
              { key: 'visits', label: 'Visits', render: (r) => r.visits },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
              { key: 'submitted', label: 'Submitted', render: (r) => fmtDashDate(r.submitted, '2-digit') },
              { key: 'approved', label: 'Approved', render: (r) => fmtDashDate(r.approved, '2-digit') },
              { key: 'waiting', label: 'Waiting on', render: (r) => r.waiting },
            ]}
            rows={weekRows}
            emptyText="No weekly reports submitted for this project yet."
          />
        </Panel>
      )}
    </>
  );
}
