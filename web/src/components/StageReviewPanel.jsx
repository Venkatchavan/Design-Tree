import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { stageReviewApi } from '../lib/functionsApi.js';
import { fmtDashDate } from '../lib/dates.js';

const STAGES = ['Preliminary concept', 'Concept', 'Schematic', 'Design development', 'Tender', 'GFC'];
const OUTCOMES = ['Pending', 'Approved', 'Approved with comments', 'Rejected'];
// Mirrors the write list on the stage reviews API; superusers pass server-side.
const WRITER_ROLES = new Set([
  'founding_director',
  'working_director',
  'design_mgmt_head',
  'technical_director',
  'associate_director',
  'executive_director',
]);
const EMPTY_FORM = { date: '', stage: '', reviewer: '', waitingOn: '', outcome: 'Pending' };

export default function StageReviewPanel({ projectId, reviews, role }) {
  const canWrite = WRITER_ROLES.has(role);
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-stage-reviews', projectId] });

  const save = useMutation({
    mutationFn: (body) => stageReviewApi.create(body),
    onSuccess: () => {
      setForm(null);
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => stageReviewApi.update(id, body),
    onSuccess: invalidate,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function submitForm(e) {
    e.preventDefault();
    save.mutate({
      project: projectId,
      date: form.date || undefined,
      stage: form.stage || undefined,
      reviewer: form.reviewer.trim() || undefined,
      waitingOn: form.waitingOn.trim() || undefined,
      outcome: form.outcome,
    });
  }

  const error = save.error?.message ?? update.error?.message;

  return (
    <Panel title="Review log" sub="Cross-discipline technical directors reviewing each other's stage outputs before client issue">
      {error && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{error}</div>
      )}

      {canWrite && !form && (
        <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={() => setForm({ ...EMPTY_FORM })}>
          + Add review
        </button>
      )}

      {form && (
        <form onSubmit={submitForm} style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} onChange={set('date')} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Stage reviewed</label>
              <select className="filter-select" style={{ width: '100%' }} value={form.stage} onChange={set('stage')}>
                <option value="">Select…</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Reviewer</label>
              <input className="form-input" placeholder="e.g. Karthik Iyer (Structural TD)" value={form.reviewer} onChange={set('reviewer')} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Waiting on</label>
              <input className="form-input" placeholder="e.g. Internal - Structural" value={form.waitingOn} onChange={set('waitingOn')} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Outcome</label>
              <select className="filter-select" style={{ width: '100%' }} value={form.outcome} onChange={set('outcome')}>
                {OUTCOMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button type="submit" className="btn-primary" disabled={save.isPending || !form.reviewer.trim()}>
              {save.isPending ? 'Saving…' : 'Add review'}
            </button>
            <button type="button" className="approve-btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'date', label: 'Date', render: (r) => fmtDashDate(r.date, '2-digit') },
          { key: 'stage', label: 'Stage reviewed', render: (r) => r.stage || '—' },
          { key: 'reviewer', label: 'Reviewer', render: (r) => r.reviewer || '—' },
          { key: 'waitingOn', label: 'Waiting on', render: (r) => r.waitingOn || '—' },
          {
            key: 'outcome',
            label: 'Outcome',
            render: (r) =>
              canWrite ? (
                <select
                  className="filter-select"
                  value={r.outcome}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: r._id, body: { outcome: e.target.value } })}
                >
                  {OUTCOMES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <StatusPill status={r.outcome}>{r.outcome}</StatusPill>
              ),
          },
        ]}
        rows={reviews}
        emptyText="No stage reviews recorded for this project yet."
      />
    </Panel>
  );
}
