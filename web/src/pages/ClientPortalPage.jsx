import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}

function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}

export default function ClientPortalPage({ bootstrap, user, viewKey }) {
  const [tab, setTab] = useState('details');
  const [selectedId, setSelectedId] = useState('');
  const [ackDrawing, setAckDrawing] = useState('');
  const [ackRemarks, setAckRemarks] = useState('');
  const [ackErr, setAckErr] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const queryClient = useQueryClient();

  const q = useQuery({ queryKey: ['portal-mine'], queryFn: portalApi.mine });

  const data = q.data ?? {};
  const projects = data.projects ?? data.items ?? [];
  const stages = data.stages ?? [];
  const revisions = data.revisions ?? [];
  const pendingRequests = data.pendingRequests ?? data.requests ?? [];
  const drawings = data.drawings ?? [];
  const certificates = data.certificates ?? [];
  const certRequests = data.certRequests ?? data.certificateRequests ?? [];

  const effective = useMemo(() => {
    if (projects.length === 0) return null;
    if (selectedId) return projects.find((p) => String(p.id ?? p._id) === String(selectedId)) ?? projects[0];
    return projects[0];
  }, [projects, selectedId]);

  const unacked = useMemo(() => drawings.filter((d) => !d.acknowledged && d.ack !== true), [drawings]);

  const ack = useMutation({
    mutationFn: (body) => portalApi.acknowledge(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mine'] });
      setAckDrawing('');
      setAckRemarks('');
      setAckErr('');
    },
    onError: (e) => setAckErr(e.message),
  });

  function handleAck(e) {
    e.preventDefault();
    setAckErr('');
    if (!ackDrawing) {
      setAckErr('Select a drawing to acknowledge.');
      return;
    }
    ack.mutate({ drawing: ackDrawing, remarks: ackRemarks || undefined });
  }

  async function handleUpload(requestId, file) {
    if (!file) return;
    setUploadErr('');
    setUploadingId(requestId);
    try {
      await portalApi.uploadRequest(requestId, file);
      queryClient.invalidateQueries({ queryKey: ['portal-mine'] });
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  if (q.isError) {
    return (
      <>
        <div className="page-head">
          <div className="page-title">Project portal</div>
          <div className="page-sub">Client view of project progress.</div>
        </div>
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      </>
    );
  }

  if (q.isLoading) {
    return (
      <>
        <div className="page-head"><div className="page-title">Project portal</div></div>
        <EmptyState text="Loading…" />
      </>
    );
  }

  if (projects.length === 0) {
    return (
      <>
        <div className="page-head">
          <div className="page-title">Project portal</div>
          <div className="page-sub">No projects linked to this login.</div>
        </div>
        <Panel title="Projects"><EmptyState text="No projects linked to this login yet." /></Panel>
      </>
    );
  }

  const clientName = effective?.clientName ?? effective?.client ?? data.clientName ?? data.client ?? '—';

  return (
    <>
      <div className="page-head">
        <div className="page-title">Project portal</div>
        <div className="page-sub">
          {clientName} · {effective?.name ?? '—'} {effective?.code ? `(${effective.code})` : ''}
        </div>
      </div>
      {projects.length > 1 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select className="filter-select" value={String(effective?.id ?? effective?._id ?? '')} onChange={(e) => setSelectedId(e.target.value)}>
            {projects.map((p) => (
              <option key={String(p.id ?? p._id)} value={String(p.id ?? p._id)}>
                {p.name ?? p.code ?? '—'}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="kpi-grid">
        <KpiCard label="Completion" value={effective?.completion != null ? `${effective.completion}%` : '—'} accent="forest" />
        <KpiCard label="Current stage" value={effective?.currentStage ?? effective?.stage ?? '—'} accent="blueprint" />
        <KpiCard label="Pending responses" value={pendingRequests.length} accent="amber" />
        <KpiCard label="Docs to acknowledge" value={unacked.length} accent="rust" />
      </div>
      <Tabs
        tabs={[
          { key: 'details', label: 'Project details' },
          { key: 'stages', label: 'Status by stage' },
          { key: 'revisions', label: 'Revision log' },
          { key: 'pending', label: 'Pending requests' },
          { key: 'drawings', label: 'Drawings & submissions' },
          { key: 'certs', label: 'Completion certificates' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'details' && (
        <Panel title="Project details">
          <div className="field-grid">
            <Field label="Project" value={effective?.name} />
            <Field label="Code" value={effective?.code} mono />
            <Field label="Client" value={clientName} />
            <Field label="Location" value={effective?.location} />
            <Field label="Project type" value={effective?.projectType ?? effective?.type} />
            <Field label="Start date" value={fmtDate(effective?.startDate)} />
            <Field label="Expected completion" value={fmtDate(effective?.expectedCompletion ?? effective?.endDate)} />
            <Field label="Completion" value={effective?.completion != null ? `${effective.completion}%` : undefined} />
            <Field label="Current stage" value={effective?.currentStage ?? effective?.stage} />
          </div>
          <div className="section-label">Description</div>
          <p style={{ fontSize: 13.5 }}>{effective?.description ?? '—'}</p>
          <div className="section-label">Scope</div>
          <p style={{ fontSize: 13.5 }}>{effective?.scope ?? '—'}</p>
        </Panel>
      )}
      {tab === 'stages' && (
        <Panel title="Status by stage">
          <DataTable
            columns={[
              { key: 'stage', label: 'Stage', render: (r) => r.stage ?? r.name ?? '—' },
              { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.updatedAt) },
              { key: 'note', label: 'Note', render: (r) => r.note ?? r.remarks ?? '—' },
            ]}
            rows={stages}
            emptyText="No stage status yet."
          />
        </Panel>
      )}
      {tab === 'revisions' && (
        <Panel title="Revision log">
          <DataTable
            columns={[
              { key: 'ref', label: 'Ref', render: (r) => r.refNo ?? r.revNo ?? r.title ?? r._id ?? '—' },
              { key: 'details', label: 'Details', render: (r) => r.details ?? r.description ?? '—' },
              { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
            ]}
            rows={revisions}
            emptyText="No revisions yet."
          />
        </Panel>
      )}
      {tab === 'pending' && (
        <Panel title="Pending requests">
          <DataTable
            columns={[
              { key: 'subject', label: 'Request', render: (r) => r.subject ?? r.title ?? r.description ?? r._id ?? '—' },
              { key: 'type', label: 'Type', render: (r) => r.type ?? r.category ?? '—' },
              { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
              { key: 'date', label: 'Raised', render: (r) => fmtDate(r.createdAt ?? r.date) },
            ]}
            rows={pendingRequests}
            emptyText="No pending requests."
          />
        </Panel>
      )}
      {tab === 'drawings' && (
        <>
          <Panel title="Drawings & submissions">
            <DataTable
              columns={[
                { key: 'drawingNo', label: 'No', render: (r) => r.drawingNo ?? r.no ?? '—' },
                { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
                { key: 'service', label: 'Service', render: (r) => r.service ?? '—' },
                { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                { key: 'rev', label: 'Rev', render: (r) => r.rev ?? r.revision ?? '—' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date ?? r.createdAt) },
                { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
                {
                  key: 'ack',
                  label: 'Ack',
                  render: (r) => (r.acknowledged ? <StatusPill tone="forest">Received</StatusPill> : <StatusPill tone="amber">Pending</StatusPill>),
                },
              ]}
              rows={drawings}
              emptyText="No drawings shared yet."
            />
          </Panel>
          <Panel title="Acknowledge receipt">
            {unacked.length === 0 ? (
              <EmptyState text="Nothing to acknowledge — all drawings received." />
            ) : (
              <form onSubmit={handleAck}>
                <div className="form-row">
                  <label className="form-label">Drawing (unacknowledged)</label>
                  <select className="filter-select" style={{ width: '100%' }} value={ackDrawing} onChange={(e) => setAckDrawing(e.target.value)}>
                    <option value="">Select drawing</option>
                    {unacked.map((d) => (
                      <option key={String(d.id ?? d._id)} value={String(d.id ?? d._id)}>
                        {(d.drawingNo ?? '')} {(d.title ?? '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Remarks</label>
                  <input className="form-input" value={ackRemarks} onChange={(e) => setAckRemarks(e.target.value)} placeholder="Optional remarks" />
                </div>
                {ackErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{ackErr}</div>}
                <button type="submit" className="btn-primary" disabled={ack.isPending}>
                  {ack.isPending ? 'Confirming…' : 'Confirm received'}
                </button>
              </form>
            )}
          </Panel>
        </>
      )}
      {tab === 'certs' && (
        <>
          <Panel title="Issued certificates">
            <DataTable
              columns={[
                { key: 'name', label: 'Certificate', render: (r) => r.name ?? r.title ?? r.category ?? projLabel(r.project) },
                { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                { key: 'date', label: 'Issued', render: (r) => fmtDate(r.issuedAt ?? r.date ?? r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
              ]}
              rows={certificates}
              emptyText="No certificates issued yet."
            />
          </Panel>
          <Panel title="My certificate requests">
            {uploadErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{uploadErr}</div>}
            <DataTable
              columns={[
                { key: 'subject', label: 'Request', render: (r) => r.subject ?? r.title ?? r._id ?? '—' },
                { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
                {
                  key: 'upload',
                  label: 'Upload',
                  render: (r) => (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
                      <input
                        type="file"
                        aria-label={`Upload for request ${r._id ?? r.id ?? ''}`}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(r._id ?? r.id, f);
                          e.target.value = '';
                        }}
                      />
                      {uploadingId === (r._id ?? r.id) ? 'Uploading…' : ''}
                    </label>
                  ),
                },
              ]}
              rows={certRequests}
              emptyText="No certificate requests yet."
            />
          </Panel>
        </>
      )}
    </>
  );
}
