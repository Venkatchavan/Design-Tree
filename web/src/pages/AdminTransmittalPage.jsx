import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transmittalsApi } from '../lib/phase3Api.js';
import { projectsApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

const STATUSES = ['Pending', 'Prepared', 'Sent', 'Acknowledged', 'Returned for revision', 'Cancelled'];
const RECIPIENTS = ['Client', 'Architect', 'PMC', 'Contractor', 'Authority', 'Other'];
const METHODS = ['Portal', 'Email', 'Courier', 'Hand delivery', 'Transmittal'];
const TABS = [
  { key: 'log', label: 'Transmittal log' },
  { key: 'drawings', label: 'TL drawing lists' },
  { key: 'import', label: 'Import from Excel' },
];

function drawingOf(row) { return row.drawing ?? {}; }
function projectName(row) { return drawingOf(row).project?.name ?? '—'; }

export default function AdminTransmittalPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('log');
  const [search, setSearch] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [issuedTo, setIssuedTo] = useState('Client');
  const [method, setMethod] = useState('Portal');
  const [remarks, setRemarks] = useState('');
  const [drawingId, setDrawingId] = useState('');
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [importError, setImportError] = useState('');

  const projects = useQuery({ queryKey: ['projects-transmittal'], queryFn: () => projectsApi.list({}) });
  const log = useQuery({
    queryKey: ['transmittals', project, status, search],
    queryFn: () => transmittalsApi.list({ project, status, search }),
  });
  const drawings = useQuery({
    queryKey: ['tl-drawings', project],
    queryFn: () => transmittalsApi.drawings({ project }),
  });
  const rows = log.data?.items ?? [];
  const drawingRows = drawings.data?.items ?? [];
  const create = useMutation({
    mutationFn: transmittalsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      qc.invalidateQueries({ queryKey: ['tl-drawings'] });
      setModalOpen(false);
    },
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, next }) => transmittalsApi.setStatus(id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      qc.invalidateQueries({ queryKey: ['tl-drawings'] });
    },
  });
  const batchCreate = useMutation({
    mutationFn: () => transmittalsApi.createFromDrawings({
      drawingIds: selected,
      date: new Date().toISOString().slice(0, 10),
      issuedTo,
      method,
      remarks: remarks || undefined,
    }),
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      qc.invalidateQueries({ queryKey: ['tl-drawings'] });
    },
  });
  const count = (s) => rows.filter((x) => x.status === s).length;
  const pendingDrawings = drawingRows.filter((x) => x.gfc && !x.transmitted).length;

  const columns = useMemo(() => [
    { key: 'id', label: 'ID', render: (r) => <span className="mono">{String(r._id ?? '').slice(-6)}</span> },
    { key: 'trNo', label: 'TR no.', render: (r) => <span className="mono">{r.trNo}</span> },
    { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'project', label: 'Project', render: projectName },
    { key: 'drawing', label: 'Drawing', render: (r) => <><b>{drawingOf(r).drawingNo ?? '—'}</b><br /><span style={{ color: 'var(--ink-muted)' }}>{drawingOf(r).title ?? '—'} · {drawingOf(r).service ?? '—'} · {drawingOf(r).stage ?? '—'}</span></> },
    { key: 'rev', label: 'Rev', render: (r) => r.rev ?? '—' },
    { key: 'issuedTo', label: 'Issued to' },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', render: (r) => <select aria-label={`Status for ${r.trNo}`} className="filter-select" value={r.status} onChange={(e) => changeStatus.mutate({ id: r._id, next: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select> },
    { key: 'sentAt', label: 'Sent', render: (r) => r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—' },
    { key: 'ackAt', label: 'Acknowledged', render: (r) => r.ackAt ? new Date(r.ackAt).toLocaleDateString() : '—' },
    { key: 'handledBy', label: 'Handled by' },
    { key: 'remarks', label: 'Remarks' },
  ], [changeStatus]);

  function openCreate() {
    setDrawingId(''); setIssuedTo('Client'); setMethod('Portal'); setRemarks(''); setModalOpen(true);
  }
  function submitCreate(e) {
    e.preventDefault();
    create.mutate({ drawing: drawingId, issuedTo, method, remarks: remarks || undefined });
  }
  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name); setImportError(''); setBatchId('');
    try { setPreview(await transmittalsApi.previewImport(file)); }
    catch (err) { setPreview(null); setImportError(err.message); }
  }
  async function confirmImport() {
    const rowsToImport = (preview?.rows ?? [])
      .filter((r) => r.action === 'New' || (r.action === 'Update' && updateExisting))
      .map((r) => ({ action: r.action, data: r.data, trNo: r.data.trNo || undefined, entryId: r.entryId }));
    try {
      const result = await transmittalsApi.confirmImport({ rows: rowsToImport, updateExisting, fileName });
      setBatchId(result.batchId);
      setImportError(`Imported ${result.created} new, updated ${result.updated}.`);
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      qc.invalidateQueries({ queryKey: ['tl-drawings'] });
    } catch (err) { setImportError(err.message); }
  }
  async function undoImport() {
    try {
      const result = await transmittalsApi.undoImport(batchId);
      setImportError(`Import undone. ${result.restored} rows restored.`);
      setBatchId('');
      qc.invalidateQueries({ queryKey: ['transmittals'] });
      qc.invalidateQueries({ queryKey: ['tl-drawings'] });
    } catch (err) { setImportError(err.message); }
  }

  return (
    <div id="view-admtransmittal">
      <div className="page-head">
        <div className="page-title">Transmittal</div>
        <div className="page-sub">Admin · create and manage transmittals from drawing lists shared by Team Leads.</div>
      </div>
      <div className="kpi-grid cols-5">
        <KpiCard label="Transmittal entries" value={rows.length} accent="blueprint" />
        <KpiCard label="GFC drawings awaiting" value={pendingDrawings} accent="amber" />
        <KpiCard label="Pending / prepared" value={count('Pending') + count('Prepared')} accent="violet" />
        <KpiCard label="Sent, awaiting acknowledgement" value={count('Sent')} accent="copper" />
        <KpiCard label="Acknowledged" value={count('Acknowledged')} accent="forest" />
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'log' && (
        <Panel title="Transmittal log">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input className="form-input" style={{ maxWidth: 250 }} placeholder="Search TR, drawing, title or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="filter-select" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
            <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn-primary" type="button" onClick={openCreate}>Add transmittal</button>
            <button className="approve-btn" type="button" onClick={() => transmittalsApi.export().catch((e) => setImportError(e.message))}>Export to Excel</button>
            <button className="approve-btn" type="button" onClick={() => transmittalsApi.resync({ project }).then((r) => setImportError(`Checked ${r.checked} entries; ${r.issues.length} source drawing issues.`)).catch((e) => setImportError(e.message))}>Re-sync with TL list</button>
          </div>
          {changeStatus.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{changeStatus.error.message}</div>}
          {log.isLoading ? <EmptyState text="Loading transmittals…" /> : <DataTable columns={columns} rows={rows} emptyText="No transmittal entries yet." />}
          {importError && <p style={{ color: 'var(--ink-muted)', marginTop: 10 }}>{importError}</p>}
        </Panel>
      )}

      {tab === 'drawings' && (
        <Panel title="TL drawing lists">
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            <select className="filter-select" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
            <button className="approve-btn" type="button" onClick={() => setSelected(drawingRows.filter((d) => d.gfc && !d.transmitted).map((d) => d.id))}>Select all awaiting</button>
            <button className="approve-btn" type="button" onClick={() => setSelected([])}>Clear selection</button>
          </div>
          <DataTable columns={[
            { key: 'select', label: 'Select', render: (d) => d.gfc && !d.transmitted ? <input type="checkbox" checked={selected.includes(d.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id))} /> : '—' },
            { key: 'project', label: 'Project', render: (d) => d.project?.name ?? '—' },
            { key: 'drawingNo', label: 'Drawing no.' },
            { key: 'title', label: 'Title' },
            { key: 'rev', label: 'Rev' },
            { key: 'service', label: 'Service' },
            { key: 'stage', label: 'Stage', render: (d) => <StatusPill status={d.gfc ? 'GFC' : 'Not at GFC stage'}>{d.stage ?? '—'}</StatusPill> },
            { key: 'sharedBy', label: 'Shared by TL', render: (d) => d.sharedBy?.name ?? d.sharedBy ?? '—' },
            { key: 'date', label: 'Date shared', render: (d) => d.date ? new Date(d.date).toLocaleDateString() : '—' },
            { key: 'transmitted', label: 'Transmittal status', render: (d) => d.transmitted ? 'Logged' : d.gfc ? 'Awaiting transmittal' : 'Not at GFC stage' },
          ]} rows={drawingRows} emptyText="No drawings have been shared by Team Leads yet." />
          {selected.length > 0 && <div style={{ marginTop: 14 }} className="field-grid">
            <div><label className="form-label">Issued to</label><select className="filter-select" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)}>{RECIPIENTS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="form-label">Method</label><select className="filter-select" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="form-label">Remarks</label><input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
            <div style={{ alignSelf: 'end' }}><button className="btn-primary" type="button" disabled={batchCreate.isPending} onClick={() => batchCreate.mutate()}>{batchCreate.isPending ? 'Creating…' : `Create ${selected.length} entries`}</button></div>
          </div>}
          {batchCreate.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{batchCreate.error.message}</div>}
          {batchCreate.isSuccess && <p style={{ color: 'var(--forest-dark)', marginTop: 10 }}>Transmittal entries created. The Team Lead notification was recorded.</p>}
        </Panel>
      )}

      {tab === 'import' && (
        <Panel title="Import from Excel">
          <p style={{ color: 'var(--ink-muted)', marginBottom: 12 }}>Choose an .xlsx or .csv file. Review row validation before importing. Exported workbooks contain Transmittal Log, TL drawing list and Lists sheets.</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} />
          {importError && <p role="status" style={{ margin: '12px 0', color: importError.includes('Imported') || importError.includes('undone') ? 'var(--forest-dark)' : 'var(--rust-dark)' }}>{importError}</p>}
          {preview && <>
            <div style={{ marginTop: 14, marginBottom: 10 }}>
              <b>{fileName}</b> · {preview.rows.filter((r) => r.action === 'New').length} New · {preview.rows.filter((r) => r.action === 'Update').length} Update · {preview.rows.filter((r) => r.action === 'Unchanged').length} Unchanged · {preview.rows.filter((r) => r.action === 'Error').length} Error
            </div>
            <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} /> Apply updates to existing entries</label>
            <DataTable columns={[
              { key: 'row', label: 'Row' },
              { key: 'action', label: 'Result', render: (r) => <StatusPill status={r.action}>{r.action}</StatusPill> },
              { key: 'trNo', label: 'TR no.', render: (r) => r.data?.trNo || '(auto)' },
              { key: 'drawing', label: 'Drawing', render: (r) => r.data?.drawingNo ?? '—' },
              { key: 'reason', label: 'Validation / change note', render: (r) => r.reason ?? r.data?.correctedNote ?? '—' },
            ]} rows={preview.rows} emptyText="No rows found in this sheet." />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn-primary" disabled={preview.rows.every((r) => r.action !== 'New' && !(updateExisting && r.action === 'Update'))} onClick={confirmImport}>Confirm import</button>
              {batchId && <button type="button" className="approve-btn" onClick={undoImport}>Undo this import</button>}
            </div>
          </>}
        </Panel>
      )}

      {modalOpen && <Modal title="Add transmittal" onClose={() => setModalOpen(false)}>
        <form onSubmit={submitCreate}>
          <div className="form-row"><label className="form-label">GFC drawing *</label><select className="filter-select" style={{ width: '100%' }} required value={drawingId} onChange={(e) => setDrawingId(e.target.value)}><option value="">Select TL-shared GFC drawing</option>{drawingRows.filter((d) => d.gfc).map((d) => <option key={d.id} value={d.id}>{d.project?.name} · {d.drawingNo} · {d.rev ?? '—'} · {d.title}</option>)}</select></div>
          <div className="field-grid">
            <div className="form-row"><label className="form-label">Issued to *</label><select className="filter-select" style={{ width: '100%' }} value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)}>{RECIPIENTS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="form-row"><label className="form-label">Method *</label><select className="filter-select" style={{ width: '100%' }} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="form-row"><label className="form-label">Remarks</label><textarea className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          {create.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{create.error.message}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Create transmittal'}</button>
        </form>
      </Modal>}
    </div>
  );
}
