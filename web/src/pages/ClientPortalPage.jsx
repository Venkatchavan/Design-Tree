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
import Modal from '../components/Modal.jsx';

function fmtStamp(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function projIdOf(p) {
  return String(p?.id ?? p?._id ?? p ?? '');
}

function sameProject(itemProject, project) {
  if (!project) return true;
  return String(itemProject?._id ?? itemProject ?? '') === projIdOf(project);
}

function normService(s) {
  return String(s ?? '').trim().toLowerCase();
}

export default function ClientPortalPage({ bootstrap, user, viewKey }) {
  void bootstrap;
  void user;
  void viewKey;
  const [tab, setTab] = useState('details');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [ackDrawing, setAckDrawing] = useState('');
  const [ackRemarks, setAckRemarks] = useState('');
  const [ackErr, setAckErr] = useState('');
  const [respondId, setRespondId] = useState('');
  const [respondRemarks, setRespondRemarks] = useState('');
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

  const searchHits = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return projects;
    return projects.filter((p) => `${p.name ?? ''} ${p.code ?? ''}`.toLowerCase().includes(t));
  }, [projects, search]);

  const effective = useMemo(() => {
    if (projects.length === 0) return null;
    if (selectedId) return projects.find((p) => projIdOf(p) === String(selectedId)) ?? projects[0];
    return projects[0];
  }, [projects, selectedId]);

  const singleProject = projects.length <= 1;
  const pStages = useMemo(
    () => (singleProject ? stages : stages.filter((s) => sameProject(s.project, effective))),
    [stages, singleProject, effective],
  );
  const pRevisions = useMemo(
    () => (singleProject ? revisions : revisions.filter((r) => sameProject(r.project, effective))),
    [revisions, singleProject, effective],
  );
  const pRequests = useMemo(
    () => (singleProject ? pendingRequests : pendingRequests.filter((r) => sameProject(r.project, effective))),
    [pendingRequests, singleProject, effective],
  );
  const pCerts = useMemo(
    () => (singleProject ? certificates : certificates.filter((c) => sameProject(c.project, effective))),
    [certificates, singleProject, effective],
  );
  const pCertRequests = useMemo(
    () => (singleProject ? certRequests : certRequests.filter((r) => sameProject(r.project, effective))),
    [certRequests, singleProject, effective],
  );

  const unacked = useMemo(() => drawings.filter((d) => !d.acknowledged && d.ack !== true), [drawings]);
  const ackDefault = unacked.length > 0 ? String(unacked[0].id ?? unacked[0]._id ?? '') : '';

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

  const ackStage = useMutation({
    mutationFn: (id) => portalApi.acknowledgeStage(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mine'] });
    },
  });

  const respond = useMutation({
    mutationFn: ({ id, remarks }) => portalApi.respond(id, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mine'] });
      setRespondId('');
      setRespondRemarks('');
    },
  });

  function handleAck(e) {
    e.preventDefault();
    setAckErr('');
    const drawingId = ackDrawing || ackDefault;
    if (!drawingId) {
      setAckErr('Select a drawing to acknowledge.');
      return;
    }
    ack.mutate({ drawing: drawingId, remarks: ackRemarks || undefined });
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

  // Scope services joined with the latest stage row per service.
  const scopeRows = useMemo(() => {
    const list = effective?.scope ?? [];
    return list.map((s, i) => {
      const matches = pStages.filter((r) => normService(r.service) === normService(s.service));
      matches.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
      const st = matches[0];
      return {
        key: `${s.service ?? i}`,
        service: s.service ?? '—',
        stage: st?.stage ?? '—',
        status: st?.currentStatus ?? '—',
      };
    });
  }, [effective, pStages]);

  // Stage groups in planned order for the stage-wise table.
  const stageGroups = useMemo(() => {
    const m = new Map();
    for (const r of pStages) {
      const k = r.stage ?? '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    const start = effective?.startDate ? new Date(effective.startDate).getTime() : null;
    const groups = [...m.entries()].map(([stage, rows]) => {
      const dates = rows.map((r) => (r.plannedCompletion ? new Date(r.plannedCompletion).getTime() : null)).filter((n) => n != null && !Number.isNaN(n));
      const minDate = dates.length > 0 ? Math.min(...dates) : null;
      const complete = rows.length > 0 && rows.every((r) => String(r.currentStatus ?? '').toLowerCase() === 'completed');
      const inProgress = rows.some((r) => ['in progress', 'inprogress', 'ongoing'].includes(String(r.currentStatus ?? '').toLowerCase()));
      const maxDelay = Math.max(0, ...rows.map((r) => Number(r.delayDays ?? 0)));
      const acked = rows.length > 0 && rows.every((r) => r.acknowledged);
      return { stage, rows, minDate, complete, inProgress, maxDelay, acked };
    });
    groups.sort((a, b) => {
      if (a.minDate == null && b.minDate == null) return 0;
      if (a.minDate == null) return 1;
      if (b.minDate == null) return -1;
      return a.minDate - b.minDate;
    });
    let prev = start;
    for (const g of groups) {
      if (g.minDate != null && prev != null && !Number.isNaN(prev)) {
        g.plannedDays = Math.max(0, Math.round((g.minDate - prev) / 86400000));
        prev = g.minDate;
      } else {
        g.plannedDays = null;
        if (g.minDate != null) prev = g.minDate;
      }
      if (g.complete) {
        g.actualDays = g.plannedDays == null ? null : g.plannedDays + g.maxDelay;
        g.status = 'Complete';
      } else if (g.inProgress) {
        g.actualDays = 'Ongoing';
        g.status = 'In progress';
      } else {
        g.actualDays = 'Not started';
        g.status = 'Not started';
      }
    }
    return groups;
  }, [pStages, effective]);

  // Revisions grouped by stage, latest activity first.
  const revisionGroups = useMemo(() => {
    const m = new Map();
    for (const r of pRevisions) {
      const k = r.stage ?? '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    const groups = [...m.entries()].map(([stage, rows]) => {
      rows.sort((a, b) => String(b.dateRaised ?? b.createdAt ?? '').localeCompare(String(a.dateRaised ?? a.createdAt ?? '')));
      return { stage, rows, latest: rows[0] ? String(rows[0].dateRaised ?? rows[0].createdAt ?? '') : '' };
    });
    groups.sort((a, b) => b.latest.localeCompare(a.latest));
    return groups;
  }, [pRevisions]);

  const uploadedFileFor = (req) => {
    const hit = [...pCerts]
      .filter((c) => c.status === 'Uploaded' && (c.certType ?? '') === (req.category ?? ''))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
    if (!hit?.file) return null;
    return String(hit.file).split('/').pop();
  };

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
  const responding = pRequests.find((r) => String(r._id ?? r.id) === respondId) ?? null;

  return (
    <>
      <div className="page-head">
        <div className="page-title">Project Portal</div>
        <div className="page-sub">Search projects</div>
      </div>
      {!singleProject && (
        <div style={{ marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ maxWidth: 260 }}
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() !== '' && (
            <div className="search-results">
              {searchHits.length === 0 ? <div className="search-result-row">No matches.</div> : searchHits.map((p) => (
                <div
                  key={projIdOf(p)}
                  className={`search-result-row${projIdOf(p) === projIdOf(effective) ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setSelectedId(projIdOf(p)); setSearch(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedId(projIdOf(p)); setSearch(''); } }}
                >
                  {p.name ?? p.code ?? '—'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="page-head">
        <div className="page-title">Client Portal</div>
        <div className="page-sub">{clientName} · {effective?.name ?? '—'}</div>
      </div>
      <div className="kpi-grid">
        <KpiCard label="Project completion" value={effective?.completion != null ? `${effective.completion}%` : '—'} accent="forest" />
        <KpiCard label="Current stage" value={effective?.currentStage ?? effective?.stage ?? '—'} accent="blueprint" />
        <KpiCard label="Pending your response" value={pRequests.length} accent="amber" />
        <KpiCard label="Documents to acknowledge" value={unacked.length} accent="rust" />
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
        <Panel title="Project details" sub="View only">
          <div className="field-grid">
            <Field label="Project" value={effective?.name} />
            <Field label="Code" value={effective?.code} mono />
            <Field label="Location" value={effective?.location ?? '—'} />
            <Field label="Project type" value={effective?.projectType ?? '—'} />
            <Field label="Start date" value={fmtStamp(effective?.startDate)} />
            <Field label="Expected completion" value={fmtStamp(effective?.expectedCompletion)} />
          </div>
          <div className="section-label">Description</div>
          <p style={{ fontSize: 13.5 }}>{effective?.description ?? '—'}</p>
          <div className="section-label">Scope and services</div>
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'stage', label: 'Stage' },
              { key: 'status', label: 'Status', render: (r) => r.status && r.status !== '—' ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
            ]}
            rows={scopeRows}
            emptyText="No scope services yet."
          />
        </Panel>
      )}
      {tab === 'stages' && (
        <Panel title="Status by stage" sub="Acknowledge each stage once you've reviewed the submission">
          <DataTable
            columns={[
              { key: 'stage', label: 'Stage' },
              { key: 'planned', label: 'Planned', render: (r) => (r.plannedDays == null ? '—' : `${r.plannedDays} days`) },
              { key: 'actual', label: 'Actual', render: (r) => (r.actualDays == null ? '—' : typeof r.actualDays === 'number' ? `${r.actualDays} days` : r.actualDays) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
              {
                key: 'ack', label: 'Acknowledgement', render: (r) => {
                  if (r.status !== 'Complete') return 'Not yet submitted';
                  if (r.rows.every((x) => x.acknowledged)) return 'Acknowledged';
                  return <button type="button" className="approve-btn" disabled={ackStage.isPending} onClick={() => ackStage.mutate(r.rows[0]._id)}>Acknowledge</button>;
                },
              },
            ]}
            rows={stageGroups}
            emptyText="No stage status yet."
          />
          {ackStage.isError && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 8 }}>{ackStage.error.message}</div>}
        </Panel>
      )}
      {tab === 'revisions' && (
        <Panel title="Revision log" sub="Revisions arising from your requirements, by stage">
          {revisionGroups.length === 0 ? <EmptyState text="No revisions yet." /> : revisionGroups.map((g) => (
            <div key={g.stage} style={{ marginBottom: 14 }}>
              <div className="section-label">{g.stage}</div>
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (r) => fmtStamp(r.dateRaised ?? r.createdAt) },
                  { key: 'description', label: 'Description', render: (r) => r.details ?? '—' },
                  { key: 'raisedBy', label: 'Raised by', render: (r) => (typeof r.raisedBy === 'object' && r.raisedBy ? (r.raisedBy.name ?? '—') : (r.raisedBy ?? 'Client')) },
                ]}
                rows={g.rows}
                emptyText="No revisions."
              />
            </div>
          ))}
        </Panel>
      )}
      {tab === 'pending' && (
        <Panel title="Requests needing your response" sub="Raised by the relevant DesignTree service - only items needing your action are shown">
          <DataTable
            columns={[
              { key: 'raisedBy', label: 'Raised by', render: (r) => r.team ?? r.assignedTo ?? '—' },
              { key: 'request', label: 'Request', render: (r) => r.description ?? '—' },
              { key: 'since', label: 'Since', render: (r) => fmtStamp(r.createdAt) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
              {
                key: 'respond', label: '', render: (r) => (
                  <button type="button" className="approve-btn" onClick={() => { setRespondId(String(r._id ?? r.id)); setRespondRemarks(''); }}>Respond</button>
                ),
              },
            ]}
            rows={pRequests}
            emptyText="No pending requests."
          />
          {responding && (
            <Modal title="Respond to request" onClose={() => setRespondId('')}>
              <p style={{ fontSize: 13.5 }}>{responding.description}</p>
              <div className="form-row">
                <label className="form-label">Remarks (optional)</label>
                <input className="form-input" value={respondRemarks} onChange={(e) => setRespondRemarks(e.target.value)} placeholder="Any comments" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: responding._id ?? responding.id, remarks: respondRemarks || undefined })}
                >
                  {respond.isPending ? 'Sending…' : 'Send response'}
                </button>
              </div>
              {respond.isError && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 8 }}>{respond.error.message}</div>}
            </Modal>
          )}
        </Panel>
      )}
      {tab === 'drawings' && (
        <>
          <Panel title="Drawing submission log" sub="Live from the DesignTree drawing register - only drawings for this project">
            <DataTable
              columns={[
                { key: 'service', label: 'Service', render: (r) => r.service ?? '—' },
                { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                { key: 'drawingNo', label: 'Drawing no.', render: (r) => r.drawingNo ?? '—' },
                { key: 'rev', label: 'Rev', render: (r) => r.rev ?? '—' },
                { key: 'date', label: 'Submitted', render: (r) => fmtStamp(r.date) },
                { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
                {
                  key: 'ack', label: 'Acknowledgement', render: (r) => (r.acknowledged
                    ? <StatusPill tone="forest">Received{r.ackAt ? ` ${fmtStamp(r.ackAt)}` : ''}</StatusPill>
                    : <StatusPill tone="amber">Pending acknowledgement</StatusPill>),
                },
              ]}
              rows={drawings}
              emptyText="No drawings shared yet."
            />
          </Panel>
          <Panel title="Acknowledge a submission">
            {unacked.length === 0 ? (
              <EmptyState text="Nothing to acknowledge — all drawings received." />
            ) : (
              <form onSubmit={handleAck}>
                <div className="form-row">
                  <label className="form-label">Drawing no.</label>
                  <select className="filter-select" style={{ width: '100%' }} value={ackDrawing || ackDefault} onChange={(e) => setAckDrawing(e.target.value)}>
                    <option value="">Select drawing</option>
                    {unacked.map((d) => (
                      <option key={String(d.id ?? d._id)} value={String(d.id ?? d._id)}>
                        {d.drawingNo ?? ''} - {d.service ?? ''}, {d.rev ?? ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Remarks (optional)</label>
                  <input className="form-input" value={ackRemarks} onChange={(e) => setAckRemarks(e.target.value)} placeholder="Any comments" />
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
          <Panel title="Completion certificates">
            <DataTable
              columns={[
                { key: 'service', label: 'Service', render: (r) => r.certType ?? '—' },
                { key: 'cert', label: 'Certificate', render: (r) => r.certNo ?? (r.file ? String(r.file).split('/').pop() : '—') },
                { key: 'issued', label: 'Issued', render: (r) => (r.status === 'Issued' || r.file) ? fmtStamp(r.issuedDate ?? r.createdAt) : '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? (r.file ? 'Issued' : 'Not yet due')}</StatusPill> },
              ]}
              rows={pCerts}
              emptyText="No certificates issued yet."
            />
          </Panel>
          <Panel title="Certificate requests from Datum" sub="Upload the requested certificate so Datum can keep a copy on file">
            {uploadErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{uploadErr}</div>}
            <DataTable
              columns={[
                { key: 'category', label: 'Category' },
                { key: 'requested', label: 'Requested', render: (r) => fmtStamp(r.createdAt) },
                { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
                {
                  key: 'file', label: 'Uploaded file', render: (r) => {
                    const name = uploadedFileFor(r);
                    if (name) return `Uploaded — ${name}`;
                    return (
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
                    );
                  },
                },
              ]}
              rows={pCertRequests}
              emptyText="No certificate requests yet."
            />
          </Panel>
        </>
      )}
    </>
  );
}
