import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, projectsApi } from '../lib/api.js';
import { certificatesApi } from '../lib/phase3Api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'issued', label: 'Issued certificates' },
  { key: 'templates', label: 'Templates' },
  { key: 'request', label: 'Request from client' },
  { key: 'uploads', label: 'Client-uploaded certificates' },
];

export default function CertificatesPage() {
  const [tab, setTab] = useState('issued');
  const [cert, setCert] = useState({ project: '', certType: '', stage: '', issuedBy: '' });
  const [req, setReq] = useState({ project: '', category: '' });
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects-certs'], queryFn: () => projectsApi.list({}) });
  const list = useQuery({ queryKey: ['certificates'], queryFn: () => certificatesApi.list({}) });
  const templates = useQuery({ queryKey: ['certificate-templates'], queryFn: certificatesApi.templates });
  const requests = useQuery({ queryKey: ['certificate-requests'], queryFn: () => certificatesApi.requests({}) });
  const create = useMutation({ mutationFn: certificatesApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }); setCert({ project: '', certType: '', stage: '', issuedBy: '' }); } });
  const requestCert = useMutation({ mutationFn: certificatesApi.request, onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-requests'] }); setReq({ project: '', category: '' }); } });

  async function uploadTemplate(e) {
    e.preventDefault();
    if (!file || !category.trim()) return;
    try {
      await certificatesApi.addTemplate(category.trim(), file);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      setFile(null); setCategory(''); setMessage('Template uploaded.');
    } catch (err) { setMessage(err.message); }
  }

  return (
    <div id="view-completioncerts">
      <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued certificates, templates, and certificate requests made to clients.</div></div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'issued' && <>
        <Panel title="Add issued certificate"><form className="field-grid" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...cert, status: 'Issued' }); }}>
          <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={cert.project} onChange={(e) => setCert({ ...cert, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Certificate type *</label><input required className="form-input" value={cert.certType} onChange={(e) => setCert({ ...cert, certType: e.target.value })} /></div>
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
