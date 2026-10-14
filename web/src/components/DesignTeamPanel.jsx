import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import Field from './Field.jsx';
import StatusPill from './StatusPill.jsx';
import { discApi, serviceDashboardApi } from '../lib/functionsApi.js';
import { dateInput, fmtDashDate } from '../lib/dates.js';

// Mirrors the write list on the service dashboards API; superusers pass server-side.
const DASHBOARD_WRITERS = new Set([
  'founding_director',
  'working_director',
  'team_lead',
  'technical_director',
  'assoc_technical_director',
  'associate_director',
  'executive_director',
]);
// Mirrors the write list on the discrepancy API; superusers pass server-side.
const COORDINATION_WRITERS = new Set(['founding_director', 'working_director', 'executive_director', 'team_lead', 'qaqc']);

const SCOPE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const COORD_STATUSES = ['Open', 'In Progress', 'Closed'];
const COORD_LABELS = { Open: 'Open', 'In Progress': 'In Progress', Closed: 'Resolved' };
const WITH_OPTIONS = ['Structural', 'Electrical', 'Mechanical', 'Plumbing', 'Fire', 'QS', 'QAQC', 'GBS', 'BIM', 'Peer review', 'Architect', 'Client'];

export default function DesignTeamPanel({ projectId, service, dashboard, principalTeamLeads, teamMembers, employees, drawings, acks, discrepancies, role, readOnly = false }) {
  const codes = service.codes;
  const d = dashboard ?? {};
  const canEdit = DASHBOARD_WRITERS.has(role) && !readOnly;
  const canRecord = COORDINATION_WRITERS.has(role) && !readOnly;
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [coordForm, setCoordForm] = useState(null);

  const ptl = (principalTeamLeads ?? [])
    .filter((t) => codes.includes(String(t.service ?? '')))
    .flatMap((t) => [t.name, ...(t.names ?? [])])
    .filter(Boolean)
    .join(', ');
  const expById = new Map((employees ?? []).map((e) => [String(e._id), e.experience]));

  const saveDashboard = useMutation({
    mutationFn: (body) => serviceDashboardApi.save({ project: projectId, service: service.dash, ...body }),
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['project-service-dashboards', projectId] });
    },
  });
  const recordCoordination = useMutation({
    mutationFn: (body) => discApi.create(body),
    onSuccess: () => {
      setCoordForm(null);
      qc.invalidateQueries({ queryKey: ['project-discs', projectId] });
    },
  });
  const updateCoordination = useMutation({
    mutationFn: ({ id, status }) => discApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-discs', projectId] }),
  });

  function startEdit() {
    setDraft({
      technicalDirector: d.technicalDirector ?? '',
      designers: d.designers ?? '',
      drafters: d.drafters ?? '',
      scopeStatus: d.scopeStatus ?? '',
      scopeStartDate: dateInput(d.scopeStartDate),
      scopeCompletedDate: dateInput(d.scopeCompletedDate),
      milestoneLabel: d.milestoneLabel ?? '',
      milestoneValue: d.milestoneValue ?? '',
    });
  }

  const setDraftField = (key) => (e) => setDraft((x) => ({ ...x, [key]: e.target.value }));

  function submitDashboard(e) {
    e.preventDefault();
    const num = (v) => (v === '' || v == null ? undefined : Number(v));
    const str = (v) => String(v ?? '').trim() || undefined;
    saveDashboard.mutate({
      technicalDirector: str(draft.technicalDirector),
      designers: num(draft.designers),
      drafters: num(draft.drafters),
      scopeStatus: str(draft.scopeStatus),
      scopeStartDate: draft.scopeStartDate || undefined,
      scopeCompletedDate: draft.scopeCompletedDate || undefined,
      milestoneLabel: str(draft.milestoneLabel),
      milestoneValue: str(draft.milestoneValue),
    });
  }

  const [coordWith, setCoordWith] = useState('');
  const [coordIssue, setCoordIssue] = useState('');
  const [coordStatus, setCoordStatus] = useState('Open');

  function submitCoordination(e) {
    e.preventDefault();
    recordCoordination.mutate({
      project: projectId,
      discipline: service.label,
      withDiscipline: coordWith,
      issue: coordIssue.trim(),
      status: coordStatus,
    });
  }

  const coordRows = (discrepancies ?? [])
    .filter((x) => codes.includes(String(x.discipline ?? '')) || codes.includes(String(x.withDiscipline ?? '')))
    .map((x) => {
      const mine = codes.includes(String(x.discipline ?? ''));
      return {
        _id: x._id,
        date: x.raised ?? x.createdAt,
        with: mine ? (x.withDiscipline || '—') : (x.discipline || '—'),
        issue: x.issue,
        status: x.status ?? 'Open',
      };
    });

  const error = saveDashboard.error?.message ?? recordCoordination.error?.message ?? updateCoordination.error?.message;

  return (
    <>
      {error && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>
      )}

      <Panel title="Team">
        {canEdit && !draft && (
          <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={startEdit}>
            Edit team & scope status
          </button>
        )}
        {draft ? (
          <form onSubmit={submitDashboard} style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Technical director</label>
                <input className="form-input" value={draft.technicalDirector} onChange={setDraftField('technicalDirector')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Designers</label>
                <input type="number" min="0" className="form-input" value={draft.designers} onChange={setDraftField('designers')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Drafters</label>
                <input type="number" min="0" className="form-input" value={draft.drafters} onChange={setDraftField('drafters')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Scope status</label>
                <select className="filter-select" style={{ width: '100%' }} value={draft.scopeStatus} onChange={setDraftField('scopeStatus')}>
                  <option value="">Select…</option>
                  {SCOPE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Start date</label>
                <input type="date" className="form-input" value={draft.scopeStartDate} onChange={setDraftField('scopeStartDate')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Completed on</label>
                <input type="date" className="form-input" value={draft.scopeCompletedDate} onChange={setDraftField('scopeCompletedDate')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Milestone</label>
                <input className="form-input" placeholder="e.g. Column layout locked at" value={draft.milestoneLabel} onChange={setDraftField('milestoneLabel')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Milestone value</label>
                <input className="form-input" placeholder="e.g. 52,000 sq.ft" value={draft.milestoneValue} onChange={setDraftField('milestoneValue')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={saveDashboard.isPending}>
                {saveDashboard.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        ) : null}
        <div className="field-grid">
          <Field label="Technical director" value={d.technicalDirector} />
          <Field label="Principal team lead" value={ptl} />
          <Field label="Designers" value={d.designers} />
          <Field label="Drafters" value={d.drafters} />
        </div>
        {readOnly && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>Project team members</div>
            {(teamMembers ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No team members allocated for this service.</p>
            ) : (
              (teamMembers ?? []).map((m, i) => {
                const e = m.employee && typeof m.employee === 'object' ? m.employee : {};
                const name = [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
                const id = String(m.employee?._id ?? m.employee ?? '');
                const exp = m.employee?.experience ?? expById.get(id);
                return (
                  <div key={id || i} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 14 }}>{name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{exp ? `${exp} exp.` : '—'}</div>
                  </div>
                );
              })
            )}
          </>
        )}
      </Panel>

      {!readOnly && (
      <Panel title="Project team members">
        <DataTable
          columns={[
            { key: 'name', label: 'Name', render: (m) => {
              const e = m.employee && typeof m.employee === 'object' ? m.employee : {};
              return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
            } },
            { key: 'experience', label: 'Experience', render: (m) => {
              const id = String(m.employee?._id ?? m.employee ?? '');
              const exp = m.employee?.experience ?? expById.get(id);
              return exp ? `${exp} exp.` : '—';
            } },
          ]}
          rows={teamMembers ?? []}
          emptyText="No team members allocated for this service."
        />
      </Panel>
      )}

      <Panel title="Scope status">
        <div className="field-grid">
          <Field label="Status" value={d.scopeStatus ? <StatusPill status={d.scopeStatus}>{d.scopeStatus}</StatusPill> : null} />
          <Field label="Start date" value={fmtDashDate(d.scopeStartDate)} />
          <Field label="Completed" value={fmtDashDate(d.scopeCompletedDate)} />
          {(d.milestoneLabel || d.milestoneValue) && (
            <Field label={d.milestoneLabel || 'Milestone'} value={d.milestoneValue} />
          )}
        </div>
      </Panel>

      <Panel title="Drawings submitted">
        <DataTable
          columns={[
            { key: 'stage', label: 'Stage', render: (r) => r.stage || '—' },
            { key: 'drawingNo', label: 'Drawing no.', render: (r) => r.drawingNo || '—' },
            { key: 'rev', label: 'Rev', render: (r) => r.rev || '—' },
            { key: 'date', label: 'Submitted', render: (r) => fmtDashDate(r.date ?? r.createdAt, '2-digit') },
            { key: 'to', label: 'To', render: (r) => r.issuedTo || '—' },
            { key: 'method', label: 'Method', render: (r) => r.method || '—' },
            { key: 'ack', label: 'Ack.', render: (r) => (acks.has(String(r._id)) ? 'Received' : 'Pending') },
          ]}
          rows={drawings}
          emptyText="No drawings submitted for this service yet."
        />
      </Panel>

      <Panel title="Open coordination items">
        {canRecord && !coordForm && (
          <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={() => setCoordForm(true)}>
            + Record coordination item
          </button>
        )}
        {coordForm && (
          <form onSubmit={submitCoordination} style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">With</label>
                <select className="filter-select" style={{ width: '100%' }} required value={coordWith} onChange={(e) => setCoordWith(e.target.value)}>
                  <option value="">Select…</option>
                  {WITH_OPTIONS.filter((o) => o !== service.label).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Item</label>
                <input className="form-input" required value={coordIssue} onChange={(e) => setCoordIssue(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="filter-select" style={{ width: '100%' }} value={coordStatus} onChange={(e) => setCoordStatus(e.target.value)}>
                  {COORD_STATUSES.map((s) => <option key={s} value={s}>{COORD_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={recordCoordination.isPending || !coordWith || !coordIssue.trim()}>
                {recordCoordination.isPending ? 'Saving…' : 'Record item'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setCoordForm(null)}>Cancel</button>
            </div>
          </form>
        )}
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDashDate(r.date, '2-digit') },
            { key: 'with', label: 'With', render: (r) => r.with },
            { key: 'issue', label: 'Item', render: (r) => r.issue || '—' },
            {
              key: 'status',
              label: 'Status',
              render: (r) =>
                canRecord ? (
                  <select
                    className="filter-select"
                    value={r.status}
                    disabled={updateCoordination.isPending}
                    onChange={(e) => updateCoordination.mutate({ id: r._id, status: e.target.value })}
                  >
                    {COORD_STATUSES.map((s) => <option key={s} value={s}>{COORD_LABELS[s]}</option>)}
                  </select>
                ) : (
                  COORD_LABELS[r.status] ?? r.status
                ),
            },
          ]}
          rows={coordRows}
          emptyText="No open coordination items for this service."
        />
      </Panel>
    </>
  );
}
