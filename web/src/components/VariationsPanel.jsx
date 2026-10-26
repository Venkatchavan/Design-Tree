import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { variationApi } from '../lib/functionsApi.js';

const VARIATION_STEPS = [
  'Additional requirement identified',
  'Technical team records variation',
  'Technical or management approval',
  'Billing impact identified',
  'Billing team notified',
  'Additional work added to billing',
];

const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'];
const SERVICE_OPTIONS = ['BIM', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'QS', 'QAQC', 'GBS', 'Peer review'];
// Mirrors the write list on the variations API; superusers pass server-side.
const WRITER_ROLES = new Set([
  'founding_director',
  'working_director',
  'team_lead',
  'coordinator',
  'design_mgmt_head',
  'admin_billing',
  'executive_director',
  'technical_director',
  'associate_director',
]);
const EMPTY_FORM = {
  service: '',
  reason: '',
  effectiveDate: '',
  areaChange: '',
  requestedBy: '',
  additionalScope: '',
  approvalStatus: 'Pending',
  currentStep: 1,
};

function fmtVariationDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function stepLabel(n) {
  const i = Number(n) - 1;
  return `${n}. ${VARIATION_STEPS[i] ?? ''}`;
}

export default function VariationsPanel({ projectId, variations, role }) {
  const canWrite = WRITER_ROLES.has(role);
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-variations', projectId] });

  const save = useMutation({
    mutationFn: (body) => variationApi.create(body),
    onSuccess: () => {
      setForm(null);
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => variationApi.update(id, body),
    onSuccess: invalidate,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function submitForm(e) {
    e.preventDefault();
    save.mutate({
      project: projectId,
      service: form.service || undefined,
      reason: form.reason.trim() || undefined,
      effectiveDate: form.effectiveDate || undefined,
      areaChange: form.areaChange.trim() || undefined,
      requestedBy: form.requestedBy.trim() || undefined,
      additionalScope: form.additionalScope.trim() || undefined,
      approvalStatus: form.approvalStatus,
      currentStep: Number(form.currentStep),
    });
  }

  const error = save.error?.message ?? update.error?.message;

  return (
    <>
      <Panel title="Variation workflow" sub="Every variation moves through these steps, from requirement to billing">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {VARIATION_STEPS.map((label, i) => (
            <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-muted)' }}>{i + 1}</div>
              <div style={{ fontSize: 13.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </Panel>

      {error && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>
      )}

      {form && (
        <Panel title="Record variation">
          <form onSubmit={submitForm}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Service</label>
                <select className="filter-select" style={{ width: '100%' }} value={form.service} onChange={set('service')}>
                  <option value="">Select…</option>
                  {SERVICE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason</label>
                <input className="form-input" value={form.reason} onChange={set('reason')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Effective date</label>
                <input type="date" className="form-input" value={form.effectiveDate} onChange={set('effectiveDate')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Area change</label>
                <input className="form-input" placeholder="e.g. 45,000 → 52,000 sq.ft" value={form.areaChange} onChange={set('areaChange')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Requested by</label>
                <input className="form-input" value={form.requestedBy} onChange={set('requestedBy')} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Approval status</label>
                <select className="filter-select" style={{ width: '100%' }} value={form.approvalStatus} onChange={set('approvalStatus')}>
                  {APPROVAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Workflow step</label>
                <select className="filter-select" style={{ width: '100%' }} value={form.currentStep} onChange={set('currentStep')}>
                  {VARIATION_STEPS.map((_, i) => <option key={i + 1} value={i + 1}>{stepLabel(i + 1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label className="form-label">Additional scope</label>
              <textarea className="form-input" value={form.additionalScope} onChange={set('additionalScope')} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Record variation'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Variation log" sub="Additional work and scope changes recorded for this project">
        {canWrite && !form && role !== 'technical_director' && (
          <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={() => setForm({ ...EMPTY_FORM })}>
            + Record variation
          </button>
        )}
        <DataTable
          columns={[
            { key: 'service', label: 'Service', render: (v) => v.service || '—' },
            { key: 'reason', label: 'Reason', render: (v) => v.reason || '—' },
            { key: 'effectiveDate', label: 'Effective date', render: (v) => fmtVariationDate(v.effectiveDate) },
            { key: 'areaChange', label: 'Area change', render: (v) => v.areaChange || '—' },
            { key: 'requestedBy', label: 'Requested by', render: (v) => v.requestedBy || '—' },
            { key: 'additionalScope', label: 'Additional scope', render: (v) => v.additionalScope || '—' },
            {
              key: 'approvalStatus',
              label: 'Approval status',
              render: (v) =>
                canWrite ? (
                  <select
                    className="filter-select"
                    value={v.approvalStatus}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ id: v._id, body: { approvalStatus: e.target.value } })}
                  >
                    {APPROVAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <StatusPill status={v.approvalStatus}>{v.approvalStatus}</StatusPill>
                ),
            },
            {
              key: 'currentStep',
              label: 'Workflow step',
              render: (v) =>
                canWrite ? (
                  <select
                    className="filter-select"
                    value={v.currentStep ?? 1}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ id: v._id, body: { currentStep: Number(e.target.value) } })}
                  >
                    {VARIATION_STEPS.map((_, i) => <option key={i + 1} value={i + 1}>{stepLabel(i + 1)}</option>)}
                  </select>
                ) : (
                  stepLabel(v.currentStep ?? 1)
                ),
            },
          ]}
          rows={variations}
          emptyText="No variations recorded for this project yet."
        />
      </Panel>
    </>
  );
}
