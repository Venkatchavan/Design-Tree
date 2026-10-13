import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import Tabs from './Tabs.jsx';
import DataTable from './DataTable.jsx';
import KpiCard from './KpiCard.jsx';
import Field from './Field.jsx';
import StatusPill from './StatusPill.jsx';
import { serviceDashboardApi, workItemApi } from '../lib/functionsApi.js';
import { dateInput, fmtDashDate } from '../lib/dates.js';

// Mirrors the server write lists; superusers pass server-side.
const DASHBOARD_WRITERS = new Set([
  'founding_director',
  'working_director',
  'qs',
  'qs_head',
  'team_lead',
  'technical_director',
  'assoc_technical_director',
  'associate_director',
  'executive_director',
]);
const ITEM_WRITERS = new Set([
  'founding_director',
  'working_director',
  'qs',
  'qs_head',
  'team_lead',
  'design_mgmt_head',
  'technical_director',
  'assoc_technical_director',
  'associate_director',
  'executive_director',
]);

const WORK_ITEM_TYPES = ['BOQ', 'BBS'];
const WORK_ITEM_STATUSES = ['Approved', 'Revision required', 'Pending review', 'Awaiting info'];
const QS_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'worklog', label: 'Work log' },
  { key: 'review', label: 'Team lead review' },
];
const EMPTY_ITEM = { wuNo: '', type: 'BOQ', activity: '', subActivity: '', progressPct: '', status: 'Pending review', waitingOn: '', date: '', notes: '' };
const EMPTY_REV = { name: '', date: '', reason: '', preparedBy: '', approvedBy: '', document: '' };

const fmtSq = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString('en-IN')} sq.ft`);
const statusLabel = (i) => (i.status === 'Awaiting info' && i.waitingOn ? `Awaiting info - ${i.waitingOn}` : i.status);
const isSet = (v) => v != null && v !== '';
const str = (v) => String(v ?? '').trim() || undefined;
const num = (v) => (v === '' || v == null ? undefined : Number(v));

export default function QsServicePanel({ projectId, codes, dashboard, principalTeamLeads, workItems, role, readOnly = false }) {
  const d = dashboard ?? {};
  const canEdit = DASHBOARD_WRITERS.has(role) && !readOnly;
  const canItems = ITEM_WRITERS.has(role) && !readOnly;
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(null);
  const [revDraft, setRevDraft] = useState(EMPTY_REV);
  const [itemForm, setItemForm] = useState(null);

  const invalidateDash = () => qc.invalidateQueries({ queryKey: ['project-service-dashboards', projectId] });
  const invalidateItems = () => qc.invalidateQueries({ queryKey: ['project-work-items', projectId] });

  const saveDash = useMutation({
    mutationFn: (body) => serviceDashboardApi.save({ project: projectId, service: 'QS', ...body }),
    onSuccess: () => {
      setDraft(null);
      invalidateDash();
    },
  });
  const createItem = useMutation({
    mutationFn: (body) => workItemApi.create(body),
    onSuccess: () => {
      setItemForm(null);
      invalidateItems();
    },
  });
  const updateItem = useMutation({
    mutationFn: ({ id, body }) => workItemApi.update(id, body),
    onSuccess: invalidateItems,
  });

  const items = workItems ?? [];
  const byWu = [...items].sort((a, b) => String(a.wuNo).localeCompare(String(b.wuNo)));
  const recent = [...items].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 4);
  const queue = byWu.filter((i) => i.status !== 'Approved');
  const approvedCount = items.filter((i) => i.status === 'Approved').length;
  const attentionCount = items.filter((i) => ['Revision required', 'Awaiting info'].includes(i.status)).length;
  const pendingCount = items.filter((i) => i.status === 'Pending review').length;

  const ptl = (principalTeamLeads ?? [])
    .filter((t) => codes.includes(String(t.service ?? '')))
    .flatMap((t) => [t.name, ...(t.names ?? [])])
    .filter(Boolean)
    .join(', ');

  const hasArea = isSet(d.boqBuiltUpArea) && isSet(d.workOrderQuotedArea);
  const variance = hasArea ? Number(d.boqBuiltUpArea) - Number(d.workOrderQuotedArea) : null;
  const variancePct = hasArea && Number(d.workOrderQuotedArea) > 0 ? (variance / Number(d.workOrderQuotedArea)) * 100 : null;
  const sign = variance != null && variance < 0 ? '−' : '+';
  const varianceText =
    variance == null
      ? '—'
      : `${sign}${Math.abs(variance).toLocaleString('en-IN')} sq.ft${variancePct == null ? '' : ` (${sign}${Math.abs(variancePct).toFixed(1)}%)`}`;

  const revisions = d.areaRevisions ?? [];

  function startEdit() {
    setDraft({
      technicalDirector: d.technicalDirector ?? '',
      designers: d.designers ?? '',
      drafters: d.drafters ?? '',
      boqBuiltUpArea: d.boqBuiltUpArea ?? '',
      boqEnteredBy: d.boqEnteredBy ?? '',
      boqEnteredOn: dateInput(d.boqEnteredOn),
      workOrderQuotedArea: d.workOrderQuotedArea ?? '',
      initialArea: d.initialArea ?? '',
      revisedArea: d.revisedArea ?? '',
      revisedAreaLabel: d.revisedAreaLabel ?? '',
      areaFinal: d.areaFinal ?? '',
      areaAlertSentOn: dateInput(d.areaAlertSentOn),
      revisions: revisions.map((r) => ({
        name: r.name ?? '',
        date: dateInput(r.date),
        reason: r.reason ?? '',
        preparedBy: r.preparedBy ?? '',
        approvedBy: r.approvedBy ?? '',
        document: r.document ?? '',
      })),
    });
    setRevDraft(EMPTY_REV);
  }

  const setDraftField = (key) => (e) => setDraft((x) => ({ ...x, [key]: e.target.value }));
  const setRevField = (key) => (e) => setRevDraft((x) => ({ ...x, [key]: e.target.value }));

  function addRevision() {
    if (!revDraft.name.trim()) return;
    setDraft((x) => ({ ...x, revisions: [...x.revisions, revDraft] }));
    setRevDraft(EMPTY_REV);
  }

  function submitDraft(e) {
    e.preventDefault();
    saveDash.mutate({
      technicalDirector: str(draft.technicalDirector),
      designers: num(draft.designers),
      drafters: num(draft.drafters),
      boqBuiltUpArea: num(draft.boqBuiltUpArea),
      boqEnteredBy: str(draft.boqEnteredBy),
      boqEnteredOn: draft.boqEnteredOn || undefined,
      workOrderQuotedArea: num(draft.workOrderQuotedArea),
      initialArea: num(draft.initialArea),
      revisedArea: num(draft.revisedArea),
      revisedAreaLabel: str(draft.revisedAreaLabel),
      areaFinal: str(draft.areaFinal),
      areaAlertSentOn: draft.areaAlertSentOn || undefined,
      areaRevisions: draft.revisions.map((r) => ({
        name: str(r.name),
        date: r.date || undefined,
        reason: str(r.reason),
        preparedBy: str(r.preparedBy),
        approvedBy: str(r.approvedBy),
        document: str(r.document),
      })),
    });
  }

  const [item, setItem] = useState(EMPTY_ITEM);
  const setItemField = (key) => (e) => setItem((x) => ({ ...x, [key]: e.target.value }));

  function submitItem(e) {
    e.preventDefault();
    createItem.mutate({
      project: projectId,
      wuNo: item.wuNo.trim(),
      type: item.type,
      activity: str(item.activity),
      subActivity: str(item.subActivity),
      progressPct: num(item.progressPct),
      status: item.status,
      waitingOn: item.status === 'Awaiting info' ? str(item.waitingOn) : undefined,
      date: item.date || undefined,
      notes: str(item.notes),
    });
  }

  const error =
    saveDash.error?.message ?? createItem.error?.message ?? updateItem.error?.message;

  return (
    <>
      {error && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>
      )}

      {canEdit && !draft && (
        <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={startEdit}>
          Edit QS details
        </button>
      )}

      {draft && (
        <Panel title="Edit QS details">
          <form onSubmit={submitDraft}>
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
                <label className="form-label">BOQ built-up area (sq.ft)</label>
                <input type="number" min="0" className="form-input" value={draft.boqBuiltUpArea} onChange={setDraftField('boqBuiltUpArea')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Entered by</label>
                <input className="form-input" value={draft.boqEnteredBy} onChange={setDraftField('boqEnteredBy')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Entered on</label>
                <input type="date" className="form-input" value={draft.boqEnteredOn} onChange={setDraftField('boqEnteredOn')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Work order quoted area (sq.ft)</label>
                <input type="number" min="0" className="form-input" value={draft.workOrderQuotedArea} onChange={setDraftField('workOrderQuotedArea')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Initial area (sq.ft)</label>
                <input type="number" min="0" className="form-input" value={draft.initialArea} onChange={setDraftField('initialArea')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Revised area (sq.ft)</label>
                <input type="number" min="0" className="form-input" value={draft.revisedArea} onChange={setDraftField('revisedArea')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Revision label</label>
                <input className="form-input" placeholder="e.g. R02" value={draft.revisedAreaLabel} onChange={setDraftField('revisedAreaLabel')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Final area</label>
                <input className="form-input" placeholder="e.g. Pending" value={draft.areaFinal} onChange={setDraftField('areaFinal')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Area alert sent on</label>
                <input type="date" className="form-input" value={draft.areaAlertSentOn} onChange={setDraftField('areaAlertSentOn')} />
              </div>
            </div>

            <div className="section-label" style={{ marginTop: 16 }}>Area revisions</div>
            {draft.revisions.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, marginBottom: 6 }}>
                <span style={{ flex: 1 }}>{r.name} · {r.date ? fmtDashDate(r.date) : '—'} · {r.reason || '—'}</span>
                <button
                  type="button"
                  className="back-link"
                  onClick={() => setDraft((x) => ({ ...x, revisions: x.revisions.filter((_, j) => j !== i) }))}
                >
                  Remove
                </button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 8 }}>
              <input className="form-input" placeholder="Revision (e.g. R01 - baseline)" value={revDraft.name} onChange={setRevField('name')} />
              <input type="date" className="form-input" value={revDraft.date} onChange={setRevField('date')} />
              <input className="form-input" placeholder="Reason" value={revDraft.reason} onChange={setRevField('reason')} />
              <input className="form-input" placeholder="Prepared by" value={revDraft.preparedBy} onChange={setRevField('preparedBy')} />
              <input className="form-input" placeholder="Approved by" value={revDraft.approvedBy} onChange={setRevField('approvedBy')} />
              <input className="form-input" placeholder="Supporting document" value={revDraft.document} onChange={setRevField('document')} />
            </div>
            <button type="button" className="approve-btn" style={{ marginTop: 8 }} onClick={addRevision}>+ Add revision</button>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saveDash.isPending}>
                {saveDash.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Team">
        <div className="field-grid">
          <Field label="Technical director" value={d.technicalDirector} />
          <Field label="Principal team lead" value={ptl} />
          <Field label="Designers" value={d.designers} />
          <Field label="Drafters" value={d.drafters} />
        </div>
      </Panel>

      <Panel title="BOQ built-up area" sub="Entered by QS once quantities are finalized">
        <div className="field-grid">
          <Field label="BOQ built-up area" value={d.boqBuiltUpArea != null ? fmtSq(d.boqBuiltUpArea) : null} />
          <Field
            label="Entered by"
            value={d.boqEnteredBy ? `${d.boqEnteredBy}${d.boqEnteredOn ? ` · ${fmtDashDate(d.boqEnteredOn)}` : ''}` : null}
          />
          <Field label="Work order quoted area" value={d.workOrderQuotedArea != null ? fmtSq(d.workOrderQuotedArea) : null} />
          <Field label="Variance" value={varianceText} />
        </div>
        {variance != null && variance > 0 && (
          <p style={{ fontSize: 13.5, marginTop: 12 }}>Flagged to admin for billing review</p>
        )}
      </Panel>

      <Panel title="Area statement history">
        <div className="field-grid">
          <Field label="Initial area" value={fmtSq(d.initialArea)} />
          <Field label={`Revised area${d.revisedAreaLabel ? ` (${d.revisedAreaLabel})` : ''}`} value={fmtSq(d.revisedArea)} />
          <Field label="Final area" value={d.areaFinal || 'Pending'} />
        </div>
        <div className="section-label" style={{ marginTop: 12 }}>Revision history</div>
        {revisions.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>No area revisions recorded yet.</p>
        ) : (
          revisions.map((r, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div className="field-grid">
                <Field label="Revision" value={r.name} />
                <Field label="Date" value={fmtDashDate(r.date)} />
                <Field label="Reason" value={r.reason} />
                <Field label="Prepared by" value={r.preparedBy} />
                {r.approvedBy && <Field label="Approved by" value={r.approvedBy} />}
                {r.document && <Field label="Supporting document" value={r.document} />}
              </div>
            </div>
          ))
        )}
        {d.areaAlertSentOn && (
          <p style={{ fontSize: 13.5, marginTop: 12 }}>
            Area revision alert sent to project team on {fmtDashDate(d.areaAlertSentOn)}
          </p>
        )}
      </Panel>

      <Tabs tabs={QS_TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <div className="kpi-grid cols-4">
            <KpiCard label="Total work items" value={items.length} accent="blueprint" />
            <KpiCard label="Approved" value={approvedCount} accent="forest" />
            <KpiCard label="Needs attention" value={attentionCount} accent="rust" />
            <KpiCard label="Pending review" value={pendingCount} accent="amber" />
          </div>
          <Panel title="Recent work updates">
            <DataTable
              columns={[
                { key: 'wuNo', label: 'WI no.', render: (r) => r.wuNo },
                { key: 'activity', label: 'Activity', render: (r) => r.activity || '—' },
                { key: 'progress', label: '%', render: (r) => (r.progressPct != null ? `${r.progressPct}%` : '—') },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{statusLabel(r)}</StatusPill> },
                { key: 'date', label: 'Date', render: (r) => fmtDashDate(r.date, '2-digit') },
              ]}
              rows={recent}
              emptyText="No work items recorded for this project yet."
            />
          </Panel>
        </>
      )}

      {tab === 'worklog' && (
        <Panel title="Work log" sub="All logged BOQ and BBS work items for this project">
          {canItems && !itemForm && (
            <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={() => setItemForm(true)}>
              + Add work item
            </button>
          )}
          {itemForm && (
            <form onSubmit={submitItem} style={{ marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">WI no.</label>
                  <input className="form-input" required value={item.wuNo} onChange={setItemField('wuNo')} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type</label>
                  <select className="filter-select" style={{ width: '100%' }} value={item.type} onChange={setItemField('type')}>
                    {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Activity</label>
                  <input className="form-input" value={item.activity} onChange={setItemField('activity')} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Sub-activity</label>
                  <input className="form-input" value={item.subActivity} onChange={setItemField('subActivity')} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">%</label>
                  <input type="number" min="0" max="100" className="form-input" value={item.progressPct} onChange={setItemField('progressPct')} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status</label>
                  <select className="filter-select" style={{ width: '100%' }} value={item.status} onChange={setItemField('status')}>
                    {WORK_ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {item.status === 'Awaiting info' && (
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Waiting on</label>
                    <input className="form-input" placeholder="e.g. Architect" value={item.waitingOn} onChange={setItemField('waitingOn')} />
                  </div>
                )}
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={item.date} onChange={setItemField('date')} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={item.notes} onChange={setItemField('notes')} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="submit" className="btn-primary" disabled={createItem.isPending || !item.wuNo.trim()}>
                  {createItem.isPending ? 'Saving…' : 'Add work item'}
                </button>
                <button type="button" className="approve-btn" onClick={() => { setItemForm(null); setItem(EMPTY_ITEM); }}>Cancel</button>
              </div>
            </form>
          )}
          <DataTable
            columns={[
              { key: 'wuNo', label: 'WI no.', render: (r) => r.wuNo },
              { key: 'type', label: 'Type', render: (r) => r.type },
              { key: 'activity', label: 'Activity', render: (r) => r.activity || '—' },
              { key: 'subActivity', label: 'Sub-activity', render: (r) => r.subActivity || '—' },
              { key: 'progress', label: '%', render: (r) => (r.progressPct != null ? `${r.progressPct}%` : '—') },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{statusLabel(r)}</StatusPill> },
              { key: 'date', label: 'Date', render: (r) => fmtDashDate(r.date, '2-digit') },
            ]}
            rows={byWu}
            emptyText="No work items logged for this project yet."
          />
        </Panel>
      )}

      {tab === 'review' && (
        <Panel title="Team lead review queue" sub={`${ptl || 'Principal team lead'} to review`}>
          <DataTable
            columns={[
              { key: 'wuNo', label: 'WI no.', render: (r) => r.wuNo },
              { key: 'activity', label: 'Activity', render: (r) => r.activity || '—' },
              { key: 'notes', label: 'Notes', render: (r) => r.notes || '—' },
              {
                key: 'status',
                label: 'Status',
                render: (r) =>
                  canItems ? (
                    <select
                      className="filter-select"
                      value={r.status}
                      disabled={updateItem.isPending}
                      onChange={(e) => updateItem.mutate({ id: r._id, body: { status: e.target.value } })}
                    >
                      {WORK_ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    statusLabel(r)
                  ),
              },
            ]}
            rows={queue}
            emptyText="Nothing waiting for team lead review."
          />
        </Panel>
      )}
    </>
  );
}
