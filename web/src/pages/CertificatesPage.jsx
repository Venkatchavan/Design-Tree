import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, projectsApi } from '../lib/api.js';
import { certificatesApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';

const TABS = [
  { key: 'issued', label: 'Issued certificates' },
  { key: 'templates', label: 'Templates' },
  { key: 'request', label: 'Request from client' },
  { key: 'uploads', label: 'Client-uploaded certificates' },
];

export default function CertificatesPage({ bootstrap }) {
  const isDirector = new Set(['founding_director', 'working_director', 'executive_director']).has(bootstrap?.role?.key ?? '');
  const isAdmin = (bootstrap?.role?.key ?? '') === 'admin_billing';
  const [tab, setTab] = useState('issued');
  const [cert, setCert] = useState({ project: '', certType: '', certNo: '', stage: '', issuedBy: '', status: 'Issued' });
  const [req, setReq] = useState({ project: '', category: '' });
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects-certs'], queryFn: () => projectsApi.list({}) });
  const list = useQuery({ queryKey: ['certificates'], queryFn: () => certificatesApi.list({}) });
  const templates = useQuery({ queryKey: ['certificate-templates'], queryFn: certificatesApi.templates });
  const requests = useQuery({ queryKey: ['certificate-requests'], queryFn: () => certificatesApi.requests({}) });
  const create = useMutation({ mutationFn: certificatesApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }); setCert({ project: '', certType: '', certNo: '', stage: '', issuedBy: '', status: 'Issued' }); } });
  const requestCert = useMutation({ mutationFn: certificatesApi.request, onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-requests'] }); setReq({ project: '', category: '' }); } });
  const allRequests = requests.data?.items ?? [];
  const uploadedCount = allRequests.filter((r) => r.status === 'Uploaded').length;
  const awaitingCount = allRequests.length - uploadedCount;
  const uploadedRows = allRequests.filter((r) => r.status === 'Uploaded');
  const uploadedFileFor = (r) => {
    const cert = (list.data?.items ?? []).find((c) => c.status === 'Uploaded' && String(c.project?._id ?? c.project ?? '') === String(r.project?._id ?? r.project ?? '') && (c.certType ?? '') === (r.category ?? ''));
    const id = cert?._id ?? cert?.id;
    return cert?.file && id ? { id, name: cert.file.split('/').pop() } : null;
  };
  const fmtCertDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-GB', { month: 'short' });
    return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
  };
  const templateCategories = (templates.data?.items ?? []).map((t) => t.category).filter(Boolean);

  async function uploadTemplate(e) {
    e.preventDefault();
    if (!file || !category.trim()) return;
    try {
      await certificatesApi.addTemplate(category.trim(), file);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      setFile(null); setCategory(''); setMessage('Template uploaded.');
    } catch (err) { setMessage(err.message); }
  }

  if (isDirector) {
    return (
      <div id="view-completioncerts">
        <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued on completion of a project stage or discipline scope</div></div>
        <Panel title="Completion Certificates"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'certType', label: 'Certificate type' }, { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'issuedDate', label: 'Issued date', render: (r) => r.issuedDate ? new Date(r.issuedDate).toLocaleDateString() : '—' },
          { key: 'issuedBy', label: 'Issued by' },
        ]} rows={list.data?.items ?? []} emptyText="No certificates issued yet." /></Panel>
        <Panel title="Client-uploaded certificates" sub={`${allRequests.length} requested · ${uploadedCount} uploaded · ${awaitingCount} awaiting client`}><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'category', label: 'Category' },
          { key: 'createdAt', label: 'Requested', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'file', label: 'Uploaded file', render: (r) => {
            const f = uploadedFileFor(r);
            return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>{f.name}</a> : '—';
          } },
          { key: 'download', label: '', render: (r) => {
            const f = uploadedFileFor(r);
            return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>Download</a> : '—';
          } },
        ]} rows={uploadedRows} emptyText="No client-uploaded certificates yet." /></Panel>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div id="view-completioncerts">
        <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued certificates, templates, and client-uploaded certificate requests</div></div>
        <Panel title="Completion Certificates" sub="Issued on completion of a project stage or discipline scope"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'certType', label: 'Certificate type' }, { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'issuedDate', label: 'Issued date', render: (r) => fmtCertDate(r.issuedDate) },
          { key: 'issuedBy', label: 'Issued by', render: (r) => r.issuedBy ?? '—' },
        ]} rows={list.data?.items ?? []} emptyText="No certificates issued yet." /></Panel>
        <Panel title="Add issued certificate"><form className="field-grid" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...cert }); }}>
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={cert.project} onChange={(e) => setCert({ ...cert, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Certificate type *</label><input required className="form-input" value={cert.certType} onChange={(e) => setCert({ ...cert, certType: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Certificate no.</label><input className="form-input" placeholder="e.g. CC-STR-2026-045" value={cert.certNo} onChange={(e) => setCert({ ...cert, certNo: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Stage</label><input className="form-input" value={cert.stage} onChange={(e) => setCert({ ...cert, stage: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Issued by</label><input className="form-input" value={cert.issuedBy} onChange={(e) => setCert({ ...cert, issuedBy: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Status</label><select className="filter-select" value={cert.status} onChange={(e) => setCert({ ...cert, status: e.target.value })}><option>Issued</option><option>Pending</option></select></div>
          {create.isError && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{create.error.message}</div>}
          <button className="btn-primary" type="submit" disabled={create.isPending}>Add certificate</button>
        </form></Panel>
        <Panel title="Completion certificate templates" sub="Upload a blank template per category — shown to the client as the format to follow, and available as a category when requesting a certificate">
          <form onSubmit={uploadTemplate} className="field-grid">
            <div className="form-row"><label className="form-label">Certificate category *</label><input className="form-input" required placeholder="e.g. HVAC Completion Certificate" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Upload template file *</label><input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <button type="submit" className="btn-primary" disabled={!file}>Add template</button>
            {message && <p role="status" style={{ color: 'var(--ink-muted)' }}>{message}</p>}
          </form>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'category', label: 'Category' }, { key: 'file', label: 'Template file' },
              { key: 'createdAt', label: 'Uploaded on', render: (r) => fmtCertDate(r.createdAt) },
              { key: 'download', label: '', render: (r) => <button type="button" className="approve-btn" onClick={() => certificatesApi.downloadTemplate(r._id).catch((e) => setMessage(e.message))}>Download</button> },
            ]} rows={templates.data?.items ?? []} emptyText="No certificate templates uploaded." />
          </div>
        </Panel>
        <Panel title="Request completion certificate from client" sub="Sent to the client to upload; the uploaded file can then be downloaded here">
          <form onSubmit={(e) => { e.preventDefault(); requestCert.mutate(req); }} className="field-grid">
            <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={req.project} onChange={(e) => setReq({ ...req, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <div className="form-row"><label className="form-label">Certificate category *</label>{templateCategories.length > 0 ? (
              <select required className="filter-select" style={{ width: '100%' }} value={req.category} onChange={(e) => setReq({ ...req, category: e.target.value })}><option value="">Select category</option>{templateCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            ) : (
              <input required className="form-input" value={req.category} onChange={(e) => setReq({ ...req, category: e.target.value })} />
            )}</div>
            <button type="submit" className="btn-primary" disabled={requestCert.isPending}>{requestCert.isPending ? 'Sending…' : 'Send request to client'}</button>
          </form>
        </Panel>
        <Panel title="Client-uploaded certificates" sub={`${allRequests.length} requested · ${uploadedCount} uploaded · ${awaitingCount} awaiting client`}><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'category', label: 'Category' },
          { key: 'createdAt', label: 'Requested', render: (r) => fmtCertDate(r.createdAt) },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'file', label: 'Uploaded file', render: (r) => {
            const f = uploadedFileFor(r);
            return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>{f.name}</a> : '—';
          } },
          { key: 'download', label: '', render: (r) => {
            const f = uploadedFileFor(r);
            return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>Download</a> : '—';
          } },
        ]} rows={uploadedRows} emptyText="No client-uploaded certificates yet." /></Panel>
      </div>
    );
  }

  return (
    <div id="view-completioncerts">
      <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued certificates, templates, and certificate requests made to clients.</div></div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'issued' && <>
        <Panel title="Add issued certificate"><form className="field-grid" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...cert }); }}>
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={cert.project} onChange={(e) => setCert({ ...cert, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Certificate type *</label><input required className="form-input" value={cert.certType} onChange={(e) => setCert({ ...cert, certType: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Certificate no.</label><input className="form-input" placeholder="e.g. CC-STR-2026-045" value={cert.certNo} onChange={(e) => setCert({ ...cert, certNo: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Stage</label><input className="form-input" value={cert.stage} onChange={(e) => setCert({ ...cert, stage: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Issued by</label><input className="form-input" value={cert.issuedBy} onChange={(e) => setCert({ ...cert, issuedBy: e.target.value })} /></div>
          {create.isError && <div className="login-error" role="alert" style={{ display: 'block', gridColumn: '1 / -1' }}>{create.error.message}</div>}
          <button className="btn-primary" type="submit" disabled={create.isPending}>Add certificate</button>
        </form></Panel>
        <Panel title="Completion certificates"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'certType', label: 'Certificate type' }, { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'issuedDate', label: 'Issued date', render: (r) => r.issuedDate ? new Date(r.issuedDate).toLocaleDateString() : '—' },
          { key: 'issuedBy', label: 'Issued by' },
        ]} rows={list.data?.items ?? []} emptyText="No certificates issued yet." /></Panel>
      </>}

      {tab === 'templates' && <>
        <Panel title="Add a certificate template"><form onSubmit={uploadTemplate} className="field-grid">
          <div className="form-row"><label className="form-label">Certificate category *</label><input className="form-input" required value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">Template file *</label><input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <button type="submit" className="btn-primary" disabled={!file}>Add template</button>
          {message && <p role="status" style={{ color: 'var(--ink-muted)' }}>{message}</p>}
        </form></Panel>
        <Panel title="Templates"><DataTable columns={[
          { key: 'category', label: 'Category' }, { key: 'file', label: 'Template file' },
          { key: 'createdAt', label: 'Uploaded on', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
          { key: 'download', label: 'Download', render: (r) => <button type="button" className="approve-btn" onClick={() => certificatesApi.downloadTemplate(r._id).catch((e) => setMessage(e.message))}>Download</button> },
        ]} rows={templates.data?.items ?? []} emptyText="No certificate templates uploaded." /></Panel>
      </>}

      {tab === 'request' && <>
        <Panel title="Request completion certificate from client"><form onSubmit={(e) => { e.preventDefault(); requestCert.mutate(req); }} className="field-grid">
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={req.project} onChange={(e) => setReq({ ...req, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Category *</label><input required className="form-input" value={req.category} onChange={(e) => setReq({ ...req, category: e.target.value })} /></div>
          <button type="submit" className="btn-primary">Send request to client</button>
        </form></Panel>
        <Panel title="Requests"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' }, { key: 'category', label: 'Category' },
          { key: 'createdAt', label: 'Requested', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
        ]} rows={requests.data?.items ?? []} emptyText="No completion certificate requests." /></Panel>
      </>}

      {tab === 'uploads' && <Panel title="Client-uploaded certificates"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'category', label: 'Category' },
          { key: 'createdAt', label: 'Requested', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'file', label: 'Uploaded file', render: (r) => {
            const cert = (list.data?.items ?? []).find((c) => c.status === 'Uploaded' && String(c.project?._id ?? c.project ?? '') === String(r.project?._id ?? r.project ?? '') && (c.certType ?? '') === (r.category ?? ''));
            const id = cert?._id ?? cert?.id;
            return cert?.file && id ? <a href={`${API_BASE}/api/certificates/${id}/file`} download>Download</a> : '—';
          } },
        ]} rows={(requests.data?.items ?? []).filter((r) => r.status === 'Uploaded')} emptyText="No client-uploaded certificates yet. Clients upload against requests from the Project Portal." /></Panel>}
    </div>
  );
}
