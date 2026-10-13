import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import Field from './Field.jsx';
import { serviceDashboardApi } from '../lib/functionsApi.js';
import { dateInput, fmtDashDate } from '../lib/dates.js';

// Mirrors the write list on the service dashboards API; superusers pass server-side.
const WRITER_ROLES = new Set([
  'founding_director',
  'working_director',
  'bim',
  'bim_head',
  'gbs',
  'gbs_head',
  'team_lead',
  'technical_director',
  'assoc_technical_director',
  'associate_director',
  'executive_director',
]);

const COUNT_FIELDS = {
  BIM: [
    { key: 'modelers', label: 'Modelers' },
    { key: 'coordinators', label: 'Coordinators' },
  ],
  GBS: [
    { key: 'teamMembers', label: 'Team members' },
    { key: 'coordinators', label: 'Coordinators' },
  ],
};

export default function ServiceTeamPanel({ projectId, service, dashboard, principalTeamLeads, role, gbsSteps = [], readOnly = false }) {
  const canWrite = WRITER_ROLES.has(role) && !readOnly;
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);
  const d = dashboard ?? {};
  const isBim = service === 'BIM';
  const countFields = COUNT_FIELDS[service];

  const ptl = (principalTeamLeads ?? [])
    .filter((t) => String(t.service ?? '') === service)
    .flatMap((t) => [t.name, ...(t.names ?? [])])
    .filter(Boolean)
    .join(', ');

  const save = useMutation({
    mutationFn: (body) => serviceDashboardApi.save({ project: projectId, service, ...body }),
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['project-service-dashboards', projectId] });
    },
  });

  function startEdit() {
    const next = {
      technicalDirector: d.technicalDirector ?? '',
      modelVersion: d.modelVersion ?? '',
      lod: d.lod ?? '',
      lastClashRun: dateInput(d.lastClashRun),
      clashesFound: d.clashesFound ?? '',
      clashesResolved: d.clashesResolved ?? '',
    };
    for (const f of countFields) next[f.key] = d[f.key] ?? '';
    setDraft(next);
  }

  const set = (key) => (e) => setDraft((x) => ({ ...x, [key]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const num = (v) => (v === '' || v == null ? undefined : Number(v));
    const str = (v) => String(v ?? '').trim() || undefined;
    const body = { technicalDirector: str(draft.technicalDirector) };
    for (const f of countFields) body[f.key] = num(draft[f.key]);
    if (isBim) {
      body.modelVersion = str(draft.modelVersion);
      body.lod = str(draft.lod);
      body.lastClashRun = draft.lastClashRun || undefined;
      body.clashesFound = num(draft.clashesFound);
      body.clashesResolved = num(draft.clashesResolved);
    }
    save.mutate(body);
  }

  const found = Number(d.clashesFound ?? 0);
  const resolved = Number(d.clashesResolved ?? 0);
  const open = Math.max(0, found - resolved);

  const done = gbsSteps.filter((s) => s.status === 'Completed').length;
  const currentStep = gbsSteps.find((s) => s.status !== 'Completed');
  const lastStepDate = gbsSteps.map((s) => s.date).filter(Boolean).sort().pop();

  return (
    <>
      <Panel
        title="Team"
        sub={`${service} team and leads`}
      >
        {canWrite && !draft && (
          <button type="button" className="approve-btn" style={{ marginBottom: 12 }} onClick={startEdit}>
            Edit team{isBim ? ' & model status' : ''}
          </button>
        )}
        {draft ? (
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label">Technical director</label>
                <input className="form-input" value={draft.technicalDirector} onChange={set('technicalDirector')} />
              </div>
              {countFields.map((f) => (
                <div key={f.key} className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">{f.label}</label>
                  <input type="number" min="0" className="form-input" value={draft[f.key]} onChange={set(f.key)} />
                </div>
              ))}
              {isBim && (
                <>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Model version</label>
                    <input className="form-input" value={draft.modelVersion} onChange={set('modelVersion')} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">LOD</label>
                    <input className="form-input" value={draft.lod} onChange={set('lod')} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Last clash run</label>
                    <input type="date" className="form-input" value={draft.lastClashRun} onChange={set('lastClashRun')} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Clashes found this run</label>
                    <input type="number" min="0" className="form-input" value={draft.clashesFound} onChange={set('clashesFound')} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Clashes resolved</label>
                    <input type="number" min="0" className="form-input" value={draft.clashesResolved} onChange={set('clashesResolved')} />
                  </div>
                </>
              )}
            </div>
            {save.isError && (
              <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>{save.error.message}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="approve-btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="field-grid">
            <Field label="Technical director" value={d.technicalDirector} />
            <Field label="Principal team lead" value={ptl} />
            {countFields.map((f) => (
              <Field key={f.key} label={f.label} value={d[f.key]} />
            ))}
          </div>
        )}
      </Panel>

      {isBim ? (
        <Panel title="Federated model status">
          <div className="field-grid">
            <Field label="Model version" value={d.modelVersion} />
            <Field label="LOD" value={d.lod} />
            <Field label="Last clash run" value={fmtDashDate(d.lastClashRun)} />
            <Field label="Clashes this run" value={d.clashesFound != null ? `${d.clashesFound} found` : null} />
          </div>
          <p style={{ fontSize: 13.5, marginTop: 12 }}>
            {d.clashesFound != null || d.lastClashRun
              ? `${resolved} of ${found} clashes resolved · ${open} open, feeding the coordination clash log`
              : 'No clash run recorded yet.'}
          </p>
        </Panel>
      ) : (
        <Panel title="Certification status" sub="Derived from the certification steps below">
          <div className="field-grid">
            <Field label="Steps completed" value={gbsSteps.length ? `${done} of ${gbsSteps.length}` : null} />
            <Field label="Current step" value={currentStep ? currentStep.phase : gbsSteps.length ? 'All steps completed' : null} />
            <Field label="Last step date" value={fmtDashDate(lastStepDate)} />
          </div>
        </Panel>
      )}
    </>
  );
}
