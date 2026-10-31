import EmployeeSelect from '../components/EmployeeSelect.jsx';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, request as apiRequest, employeesApi, projectsApi } from '../lib/api.js';
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
  const roleKey = bootstrap?.role?.key ?? '';
  // Read-only log view for directors + AssocTD + DMH + HR (Admin reflection, no inputs).
  // Only admin_billing has write access on this page.
  const isReadonly = new Set(['founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director', 'assoc_technical_director', 'design_mgmt_head', 'hr']).has(roleKey);
  const isAdmin = roleKey === 'admin_billing';
  const [tab, setTab] = useState('issued');
  const [cert, setCert] = useState({ project: '', certType: '', certNo: '', stage: '', issuedBy: '', status: 'Issued' });
  const [req, setReq] = useState({ project: '', category: '' });
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [clientShare, setClientShare] = useState(null);
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects-certs'], queryFn: () => projectsApi.list({}) });
  const employees = useQuery({ queryKey: ['employees-certs'], queryFn: () => employeesApi.list({}) });
  const list = useQuery({ queryKey: ['certificates'], queryFn: () => certificatesApi.list({}) });
  const templates = useQuery({ queryKey: ['certificate-templates'], queryFn: certificatesApi.templates });
  const requests = useQuery({ queryKey: ['certificate-requests'], queryFn: () => certificatesApi.requests({}) });
  const create = useMutation({ mutationFn: certificatesApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }); setCert({ project: '', certType: '', certNo: '', stage: '', issuedBy: '', status: 'Issued' }); } });
  const requestCert = useMutation({
    mutationFn: async (body) => {
      const created = await certificatesApi.request(body);
      const requestId = created?.item?._id ?? created?.item?.id ?? created?._id ?? created?.id;
      if (!requestId) {
        return { requestId: null, linkError: 'The request was created, but its ID was not returned. Generate a client link from the requests table.' };
      }
      try {
        const link = await apiRequest(`/api/certificates/requests/${requestId}/link`, { method: 'POST' });
        return { requestId, url: `${window.location.origin}${link.path}` };
      } catch (error) {
        return { requestId, linkError: error.message };
      }
    },
    onSuccess: async ({ requestId, url, linkError }) => {
      qc.invalidateQueries({ queryKey: ['certificate-requests'] });
      setReq({ project: '', category: '' });
      if (url) {
        setClientShare({ requestId, url, copied: false, error: '' });
        try {
          await navigator.clipboard.writeText(url);
          setClientShare({ requestId, url, copied: true, error: '' });
        } catch {
          setClientShare({ requestId, url, copied: false, error: 'Link is ready; use Copy link below and send it to the client.' });
        }
      } else {
        setClientShare({ requestId, url: '', copied: false, error: linkError || 'The request was created, but a client link could not be generated.' });
      }
    },
  });
  const allRequests = requests.data?.items ?? [];
  const uploadedCount = allRequests.filter((r) => r.status === 'Uploaded').length;
  const awaitingCount = allRequests.length - uploadedCount;
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
  const templateFor = (category) => (templates.data?.items ?? []).find((t) => t.category === category);

  async function clientLink(id) {
    try {
      const data = await apiRequest(`/api/certificates/requests/${id}/link`, { method: 'POST' });
      const url = `${window.location.origin}${data.path}`;
      setClientShare({ requestId: id, url, copied: false, error: '' });
      try {
        await navigator.clipboard.writeText(url);
        setClientShare({ requestId: id, url, copied: true, error: '' });
      } catch {
        setClientShare({ requestId: id, url, copied: false, error: 'Link is ready; use Copy link below and send it to the client.' });
      }
    } catch (e) { setClientShare({ requestId: id, url: '', copied: false, error: e.message }); }
  }

  async function copyClientLink() {
    if (!clientShare?.url) return;
    try {
      await navigator.clipboard.writeText(clientShare.url);
      setClientShare((current) => ({ ...current, copied: true, error: '' }));
    } catch {
      setClientShare((current) => ({ ...current, copied: false, error: 'Could not copy automatically. Select and copy the link above.' }));
    }
  }


  async function uploadTemplate(e) {
    e.preventDefault();
    if (!file || !category.trim()) return;
    try {
      await certificatesApi.addTemplate(category.trim(), file);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      setFile(null); setCategory(''); setMessage('Template uploaded.');
    } catch (err) { setMessage(err.message); }
  }

  if (isReadonly) {
    return (
      <div id="view-completioncerts">
        <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued certificates, templates, and client-uploaded certificate requests</div></div>
        <Panel title="Completion Certificates" sub="Issued on completion of a project stage or discipline scope">
          {list.isLoading ? <p>Loading certificates…</p> : list.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{list.error.message}</div>
          ) : <DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'certType', label: 'Certificate type', render: (r) => r.certType ?? '—' },
          { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
          { key: 'issuedDate', label: 'Issued date', render: (r) => fmtCertDate(r.issuedDate) },
          { key: 'issuedBy', label: 'Issued by', render: (r) => r.issuedBy ?? '—' },
        ]} rows={list.data?.items ?? []} emptyText="No completion certificates yet." />}
        </Panel>
        <Panel
          title="Client-uploaded certificates"
          sub={`${allRequests.length} requested · ${uploadedCount} uploaded · ${awaitingCount} awaiting client`}
        >
          {requests.isLoading || list.isLoading ? <p>Loading client certificate requests…</p> : requests.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{requests.error.message}</div>
          ) : list.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{list.error.message}</div>
          ) : <DataTable columns={[
            { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
            { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
            { key: 'createdAt', label: 'Requested', render: (r) => fmtCertDate(r.createdAt) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            { key: 'file', label: 'Uploaded file', render: (r) => {
              const f = uploadedFileFor(r);
              return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>{f.name}</a> : '—';
            } },
            { key: 'download', label: '', render: (r) => {
              const f = uploadedFileFor(r);
              return f ? <a href={`${API_BASE}/api/certificates/${f.id}/file`} download>Download</a> : '—';
            } },
          ]} rows={allRequests.filter((r) => r.status === 'Uploaded')} emptyText="No client-uploaded certificates yet." />}
        </Panel>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div id="view-completioncerts">
        <div className="page-head"><div className="page-title">Completion Certificates</div><div className="page-sub">Issued certificates, templates, and client-uploaded certificate requests</div></div>
        <Panel title="Certificate templates & client requests" sub="Manage certificate templates and request the matching certificate from a client.">
          <div className="section-label">Add template (entry)</div>
          <form onSubmit={uploadTemplate} className="field-grid">
            <div className="form-row"><label className="form-label">Certificate category *</label><input className="form-input" required placeholder="e.g. HVAC Completion Certificate" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Upload template file *</label><input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <button type="submit" className="btn-primary" disabled={!file}>Add template</button>
            {message && <p role="status" style={{ color: 'var(--ink-muted)' }}>{message}</p>}
          </form>
          <div className="section-label" style={{ marginTop: 16 }}>Request a certificate from the client</div>

          <form onSubmit={(e) => { e.preventDefault(); requestCert.mutate(req); }} className="field-grid">
            <div className="form-row"><label className="form-label">Project *</label><select required className="filter-select" style={{ width: '100%' }} value={req.project} onChange={(e) => setReq({ ...req, project: e.target.value })}><option value="">Select project</option>{(projects.data?.items ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <div className="form-row"><label className="form-label">Certificate category *</label><select required className="filter-select" style={{ width: '100%' }} value={req.category} onChange={(e) => setReq({ ...req, category: e.target.value })}><option value="">Select category from templates</option>{templateCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            {req.category && templateFor(req.category) && (
              <div className="form-row">
                <label className="form-label">Linked template (readily available)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13 }}>{templateFor(req.category).file ? String(templateFor(req.category).file).split('/').pop() : templateFor(req.category).category}</span>
                  <button type="button" className="approve-btn" onClick={() => certificatesApi.downloadTemplate(templateFor(req.category)._id).catch((e) => setMessage(e.message))}>Download template</button>

                </div>
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={requestCert.isPending}>{requestCert.isPending ? 'Creating request and link…' : 'Send request to client'}</button>
          </form>
          {requestCert.isError && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>{requestCert.error.message}</div>}
          {clientShare && (
            <div style={{ marginTop: 12 }} role="status">
              {clientShare.url ? (
                <>
                  <p style={{ marginBottom: 6 }}>
                    Request created. {clientShare.copied ? 'Link copied to clipboard.' : 'Share this link with the client so they can upload the certificate.'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="form-input" aria-label="Client certificate upload link" readOnly value={clientShare.url} style={{ flex: '1 1 320px' }} />
                    <button type="button" className="approve-btn" onClick={copyClientLink}>Copy link</button>
                  </div>
                </>
              ) : (
                <>
                  <p>{clientShare.error}</p>
                  {clientShare.requestId && (
                    <button type="button" className="approve-btn" onClick={() => clientLink(clientShare.requestId)}>Generate client link</button>
                  )}
                </>
              )}
              {clientShare.url && clientShare.error && <p>{clientShare.error}</p>}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'category', label: 'Category' }, { key: 'file', label: 'Template file' },
              { key: 'createdAt', label: 'Uploaded on', render: (r) => fmtCertDate(r.createdAt) },
              { key: 'download', label: '', render: (r) => <button type="button" className="approve-btn" onClick={() => certificatesApi.downloadTemplate(r._id).catch((e) => setMessage(e.message))}>Download</button> },
            ]} rows={templates.data?.items ?? []} emptyText="No certificate templates uploaded." />
          </div>
        </Panel>
        <Panel title="Completion Certificates" sub="Issued on completion of a project stage or discipline scope"><DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
          { key: 'certType', label: 'Certificate type' }, { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          { key: 'issuedDate', label: 'Issued date', render: (r) => fmtCertDate(r.issuedDate) },
          { key: 'issuedBy', label: 'Issued by', render: (r) => r.issuedBy ?? '—' },
        ]} rows={list.data?.items ?? []} emptyText="No certificates issued yet." /></Panel>
        <Panel title="Client certificate requests and uploads" sub={`${allRequests.length} requested · ${uploadedCount} uploaded · ${awaitingCount} awaiting client`}><DataTable columns={[
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
          { key: 'link', label: 'Link', render: (r) => {
            return <button type="button" className="approve-btn" onClick={() => clientLink(r._id ?? r.id)}>Generate client link</button>;
          } },
        ]} rows={allRequests} emptyText="No client certificate requests yet." /></Panel>
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
          <div className="form-row"><label className="form-label">Certificate type *</label>{templateCategories.length > 0 ? (
            <select required className="filter-select" style={{ width: '100%' }} value={cert.certType} onChange={(e) => setCert({ ...cert, certType: e.target.value })}><option value="">Select type</option>{templateCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          ) : (
            <input required className="form-input" value={cert.certType} onChange={(e) => setCert({ ...cert, certType: e.target.value })} />
          )}</div>
          <div className="form-row"><label className="form-label">Certificate no.</label><input className="form-input" placeholder="e.g. CC-STR-2026-045" value={cert.certNo} onChange={(e) => setCert({ ...cert, certNo: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Stage</label><select className="filter-select" style={{ width: '100%' }} value={cert.stage} onChange={(e) => setCert({ ...cert, stage: e.target.value })}><option value="">Select stage</option>{['CD', 'SD', 'DD', 'TD', 'GFC'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="form-row"><label className="form-label">Issued by</label><EmployeeSelect employees={(employees.data?.items ?? [])} getValue={e => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.empId} className="filter-select" style={{ width: '100%' }} value={cert.issuedBy} onChange={(e) => setCert({ ...cert, issuedBy: e.target.value })}><option value="">Select person</option>{(employees.data?.items ?? []).map((x) => { const n = `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim() || x.empId; return <option key={x._id ?? x.id} value={n}>{n}</option>; })}</EmployeeSelect></div>
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
