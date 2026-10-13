import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { API_BASE, request } from '../lib/api.js';

export default function PublicCertificatePage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const base = `/api/certificates/public/${token}`;
  const q = useQuery({ queryKey: ['public-certificate', token], queryFn: () => request(base), retry: false });
  const upload = useMutation({ mutationFn: async () => {
    const body = new FormData(); body.append('file', file);
    const res = await fetch(`${API_BASE}${base}/upload`, { method: 'POST', body });
    const data = await res.json(); if (!res.ok) throw new Error(data.message); return data;
  }, onSuccess: () => { setFile(null); qc.invalidateQueries({ queryKey: ['public-certificate', token] }); } });
  return <main style={{ maxWidth: 680, margin: '48px auto', padding: 24 }}>
    <meta name="referrer" content="no-referrer" />
    <h1>Completion certificate</h1>
    {q.isLoading ? <p>Loading request…</p> : q.isError ? <p role="alert">{q.error.message}</p> : <>
      <h2>{q.data.project}</h2><p>{q.data.code} · {q.data.category}</p>
      {q.data.template && <p><a href={`${API_BASE}${base}/template`} download>Download template</a></p>}
      {q.data.status === 'Sent' ? <form onSubmit={e => { e.preventDefault(); upload.mutate(); }}>
        <label>Completed certificate <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <p><button className="btn-primary" disabled={!file || upload.isPending} type="submit">{upload.isPending ? 'Uploading…' : 'Upload certificate'}</button></p>
      </form> : <p>Certificate submitted.</p>}
      {q.data.issued && <p><a href={`${API_BASE}${base}/issued`} download>Download issued certificate</a></p>}
      {upload.isError && <p role="alert">{upload.error.message}</p>}
    </>}
  </main>;
}
