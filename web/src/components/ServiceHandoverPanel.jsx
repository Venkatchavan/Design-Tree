import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, request, toQuery } from '../lib/api.js';
import { DESIGN_SERVICE_CODES, SERVICE_CODE_LABELS, expandServiceCodes } from '../lib/serviceCodes.js';
import { PROCESS_STAGES } from '../lib/processManual.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';

// 17 Nov 2026: SPOC service handover / intimation. The SPOC tells the next
// service that a completed service's drawings are ready; that team acknowledges.
export const handoverApi = {
  list: (params = {}) => request(`/api/service-handovers${toQuery(params)}`),
  create: (body) => request('/api/service-handovers', { method: 'POST', body: JSON.stringify(body) }),
  acknowledge: (id) => request(`/api/service-handovers/${id}/acknowledge`, { method: 'PATCH' }),
};

const idOf = (v) => String(v?._id ?? v?.id ?? v ?? '');
const serviceLabel = (code) => SERVICE_CODE_LABELS[code] ?? code;
const services = (list = []) => list.map(serviceLabel).join(', ') || '—';
const person = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || '';
const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function columns(acknowledge) {
  return [
    { key: 'project', label: 'Project', render: (h) => h.project?.name ?? '—' },
    { key: 'from', label: 'Completed service', render: (h) => serviceLabel(h.fromService) },
    { key: 'to', label: 'Next service', render: (h) => services(h.toServices) },
    { key: 'stage', label: 'Stage', render: (h) => h.stage || '—' },
    { key: 'note', label: 'Note', render: (h) => h.note || '—' },
    { key: 'team', label: 'Notified team', render: (h) => (h.recipients ?? []).map(person).filter(Boolean).join(', ') || '—' },
    { key: 'sent', label: 'Notified', render: (h) => `${when(h.createdAt)}${h.notifiedBy?.name ? ` · ${h.notifiedBy.name}` : ''}` },
    { key: 'status', label: 'Status', render: (h) => <StatusPill status={h.status === 'Acknowledged' ? 'Approved' : 'Pending'}>{h.status}</StatusPill> },
    { key: 'ack', label: 'Acknowledged', render: (h) => (h.acknowledgedAt ? `${when(h.acknowledgedAt)}${h.acknowledgedBy?.name ? ` · ${h.acknowledgedBy.name}` : ''}` : acknowledge ? acknowledge(h) : '—') },
  ];
}

// SPOC dashboard: send a handover and follow its status.
export function SpocServiceHandover({ canSend = true }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [fromService, setFromService] = useState('');
  const [toServices, setToServices] = useState([]);
  const [stage, setStage] = useState('');
  const [note, setNote] = useState('');
  const projectsQ = useQuery({ queryKey: ['handover-projects'], queryFn: () => projectsApi.list({}) });
  const listQ = useQuery({ queryKey: ['service-handovers'], queryFn: () => handoverApi.list(), refetchInterval: 15000 });
  const projects = projectsQ.data?.items ?? [];
  const chosen = projects.find((p) => idOf(p) === project);
  const projectCodes = expandServiceCodes(chosen?.services ?? []).filter((code) => DESIGN_SERVICE_CODES.includes(code));
  const codes = projectCodes.length ? projectCodes : DESIGN_SERVICE_CODES;
  const send = useMutation({
    meta: { success: 'The next service has been notified.' },
    mutationFn: () => handoverApi.create({ project, fromService, toServices, ...(stage ? { stage } : {}), ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: () => {
      setFromService(''); setToServices([]); setStage(''); setNote('');
      queryClient.invalidateQueries({ queryKey: ['service-handovers'] });
    },
  });
  const toggle = (code) => setToServices((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <>
      {canSend && <Panel title="Service handover" sub="Intimate the next service when a service's drawings are complete and ready to be passed on">
        <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label" htmlFor="handover-project">Project *</label>
              <select id="handover-project" className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => { setProject(e.target.value); setFromService(''); setToServices([]); }}>
                <option value="">{projectsQ.isLoading ? 'Loading…' : 'Select project'}</option>
                {projects.map((p) => <option key={idOf(p)} value={idOf(p)}>{[p.jobNumber, p.name].filter(Boolean).join(' · ')}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="handover-from">Completed service *</label>
              <select id="handover-from" className="filter-select" style={{ width: '100%' }} value={fromService} disabled={!project} onChange={(e) => { setFromService(e.target.value); setToServices((prev) => prev.filter((c) => c !== e.target.value)); }}>
                <option value="">Select service</option>
                {codes.map((code) => <option key={code} value={code}>{serviceLabel(code)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="handover-stage">Stage</label>
              <select id="handover-stage" className="filter-select" style={{ width: '100%' }} value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Select stage</option>
                {PROCESS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <span className="form-label">Notify next service *</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {codes.filter((code) => code !== fromService).map((code) => (
                <label key={code} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" disabled={!fromService} checked={toServices.includes(code)} onChange={() => toggle(code)} />
                  {serviceLabel(code)}
                </label>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="handover-note">Note</label>
            <textarea id="handover-note" className="form-input" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Drawings shared, references, anything the next team should know" />
          </div>
          {send.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{send.error.message}</div>}
          <button type="submit" className="btn-primary" disabled={send.isPending || !project || !fromService || !toServices.length}>
            {send.isPending ? 'Sending…' : 'Notify next service'}
          </button>
        </form>
      </Panel>}
      <Panel title="Handover status" sub="Every handover you sent and whether the next service has acknowledged it">
        {listQ.isError
          ? <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
          : <DataTable columns={columns()} rows={listQ.data?.items ?? []} emptyText={listQ.isLoading ? 'Loading…' : 'No handovers sent yet.'} />}
      </Panel>
    </>
  );
}

// Team side (TL / PTL / ATD): handovers sent to the signed-in person's team.
export function TeamServiceHandover({ projectId = '' }) {
  const queryClient = useQueryClient();
  const listQ = useQuery({ queryKey: ['service-handovers', 'mine'], queryFn: () => handoverApi.list({ mine: '1' }), refetchInterval: 15000 });
  const ack = useMutation({
    meta: { success: 'Handover acknowledged.' },
    mutationFn: (id) => handoverApi.acknowledge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-handovers'] }),
  });
  const rows = (listQ.data?.items ?? []).filter((h) => !projectId || idOf(h.project) === String(projectId));
  if (!listQ.isLoading && !listQ.isError && rows.length === 0) return null;
  return (
    <Panel title="Service handovers" sub="Drawings the SPOC has marked ready for your service">
      {ack.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{ack.error.message}</div>}
      {listQ.isError
        ? <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        : <DataTable
          columns={columns((h) => <button type="button" className="approve-btn" disabled={ack.isPending} onClick={() => ack.mutate(idOf(h))}>Acknowledge</button>)}
          rows={rows}
          emptyText="Loading…"
        />}
    </Panel>
  );
}
