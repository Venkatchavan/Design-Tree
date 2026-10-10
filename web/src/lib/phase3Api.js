import { API_BASE, request, requestMultipart, toQuery } from './api.js';

async function download(path, fallbackName) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* not json */ }
    throw new Error(data.message ?? 'Download failed.');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export const transmittalsApi = {
  list: (params = {}) => request(`/api/transmittals${toQuery(params)}`),
  teamScope: () => request('/api/transmittals/team-scope'),
  get: (id) => request(`/api/transmittals/${id}`),
  create: (body) => request('/api/transmittals', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/transmittals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setStatus: (id, status) => request(`/api/transmittals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  drawings: (params = {}) => request(`/api/transmittals/tl-drawings${toQuery(params)}`),
  createFromDrawings: (body) => request('/api/transmittals/from-drawings', { method: 'POST', body: JSON.stringify(body) }),
  resync: (params = {}) => request(`/api/transmittals/resync${toQuery(params)}`),
  previewImport: (file) => requestMultipart('/api/transmittals/import/preview', file),
  confirmImport: (body) => request('/api/transmittals/import/confirm', { method: 'POST', body: JSON.stringify(body) }),
  undoImport: (batchId) => request(`/api/transmittals/import/${batchId}/undo`, { method: 'POST' }),
  export: () => download('/api/transmittals/export', 'transmittal-log.xlsx'),
};

export const transmittalRegisterApi = {
  list: (params = {}) => request(`/api/transmittal-register${toQuery(params)}`),
  create: (body) => request('/api/transmittal-register', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/transmittal-register/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

export const billingApi = {
  claims: (params = {}) => request(`/api/billing/claims${toQuery(params)}`),
  createClaim: (body) => request('/api/billing/claims', { method: 'POST', body: JSON.stringify(body) }),
  updateClaim: (id, body) => request(`/api/billing/claims/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  claimStatus: (id, status) => request(`/api/billing/claims/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  stages: (params = {}) => request(`/api/billing/stages${toQuery(params)}`),
  saveStage: (body) => request('/api/billing/stages', { method: 'POST', body: JSON.stringify(body) }),
  updateStage: (id, body) => request(`/api/billing/stages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  quotedFees: () => request('/api/billing/quoted-fees'),
  setQuote: (id, body) => request(`/api/billing/projects/${id}/quote`, { method: 'PATCH', body: JSON.stringify(body) }),
  overview: () => request('/api/billing/overview'),
  financeOverview: () => request('/api/billing/finance-overview'),
  revenueByProject: () => request('/api/billing/revenue-by-project'),
  projectCosts: () => request('/api/billing/project-costs'),
  payments: (params = {}) => request(`/api/billing/payments${toQuery(params)}`),
  createPayment: (body) => request('/api/billing/payments', { method: 'POST', body: JSON.stringify(body) }),
};

export const certificatesApi = {
  list: (params = {}) => request(`/api/certificates${toQuery(params)}`),
  create: (body) => request('/api/certificates', { method: 'POST', body: JSON.stringify(body) }),
  templates: () => request('/api/certificates/templates/all'),
  addTemplate: async (category, file) => {
    const form = new FormData();
    form.append('category', category);
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/certificates/templates`, { method: 'POST', credentials: 'include', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? 'Template upload failed.');
    return data;
  },
  downloadTemplate: (id) => download(`/api/certificates/templates/${id}/download`, 'certificate-template'),
  requests: (params = {}) => request(`/api/certificates/requests/all${toQuery(params)}`),
  request: (body) => request('/api/certificates/requests', { method: 'POST', body: JSON.stringify(body) }),
};

export const bookingsApi = {
  summary: () => request('/api/travel-bookings/summary'),
  list: (params = {}) => request(`/api/travel-bookings${toQuery(params)}`),
  create: (body) => request('/api/travel-bookings', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/travel-bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setStatus: (id, status) => request(`/api/travel-bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => request(`/api/travel-bookings/${id}`, { method: 'DELETE' }),
};

export const financeOccApi = {
  summary: () => request('/api/finance-occ/summary'),
  list: (params = {}) => request(`/api/finance-occ${toQuery(params)}`),
  create: (body) => request('/api/finance-occ', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/finance-occ/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  decide: (id, body) => request(`/api/finance-occ/${id}/decision`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => request(`/api/finance-occ/${id}`, { method: 'DELETE' }),
  uploadDocs: async (id, files) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`${API_BASE}/api/documents/finance-occ/${id}/files`, { method: 'POST', credentials: 'include', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? 'Upload failed.');
    return data;
  },
  downloadUrl: (stored) => `${API_BASE}/api/documents/files/${stored}`,
};

export const workApi = {
  entries: (params = {}) => request(`/api/work-entries${toQuery(params)}`),
};

export function downloadCsv(rows, columns, fileName) {
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [columns.map((c) => escape(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(c.value ? c.value(row) : row[c.key])).join(','));
  }
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
