import { API_BASE } from './api.js';

async function upload(path, files, field = 'file', extra = {}) {
  const form = new FormData();
  const list = Array.isArray(files) ? files : [files];
  for (const f of list) form.append(field, f);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, v);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message ?? 'Upload failed.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const docsApi = {
  visitPhotos: (id, files) =>
    upload(`/api/documents/visits/${id}/photos`, files, 'photos'),
  allowanceBill: (id, file) =>
    upload(`/api/documents/allowances/${id}/bill`, file, 'bill'),
  briefPhotos: (projectId, files) =>
    upload(`/api/documents/brief/${projectId}/photos`, files, 'photos'),
  employeeDoc: (id, file, name) =>
    upload(`/api/documents/employees/${id}/documents`, file, 'file', { name }),
  drawingProof: (id, file) =>
    upload(`/api/documents/drawings/${id}/proof`, file, 'proof'),
};

// Download links use plain anchors: same-origin requests carry the
// HttpOnly auth cookie, so no fetch wrapper is needed.
export function fileUrl(stored) {
  return `${API_BASE}/api/documents/files/${stored}`;
}
