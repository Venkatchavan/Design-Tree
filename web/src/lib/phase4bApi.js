import { API_BASE, request, toQuery } from './api.js';

export const UNAVAILABLE_REASONS = [
  'Another scheduled meeting',
  'Project work / deadline',
  'Leave',
  'Client engagement',
  'Personal reason',
  'Other — specify',
];

export const leaveApi = {
  mine: () => request('/api/leave-travel/leave/mine'),
  list: (params = {}) => request(`/api/leave-travel/leave${toQuery(params)}`),
  create: (body) =>
    request('/api/leave-travel/leave', { method: 'POST', body: JSON.stringify(body) }),
  decide: (id, body) =>
    request(`/api/leave-travel/leave/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  scopeIds: () => request('/api/leave-travel/scope'),
  queue: () => request('/api/leave-travel/approvals/queue'),
};

export const travelApi = {
  mine: () => request('/api/leave-travel/travel/mine'),
  list: (params = {}) => request(`/api/leave-travel/travel${toQuery(params)}`),
  create: (body) =>
    request('/api/leave-travel/travel', { method: 'POST', body: JSON.stringify(body) }),
  decide: (id, body) =>
    request(`/api/leave-travel/travel/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  settle: (id, body) =>
    request(`/api/leave-travel/travel/${id}/settle`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const allowanceApi = {
  mine: () => request('/api/leave-travel/allowances/mine'),
  list: (params = {}) => request(`/api/leave-travel/allowances${toQuery(params)}`),
  create: (body) =>
    request('/api/leave-travel/allowances', { method: 'POST', body: JSON.stringify(body) }),
  decide: (id, body) =>
    request(`/api/leave-travel/allowances/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const holidaysApi = {
  list: (params = {}) => request(`/api/leave-travel/holidays${toQuery(params)}`),
  create: (body) =>
    request('/api/leave-travel/holidays', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => request(`/api/leave-travel/holidays/${id}`, { method: 'DELETE' }),
};

export const supportApi = {
  mine: () => request('/api/support/mine'),
  list: (params = {}) => request(`/api/support${toQuery(params)}`),
  create: (body) =>
    request('/api/support', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/support/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const meetingsApi = {
  list: (params = {}) => request(`/api/meetings${toQuery(params)}`),
  get: (id) => request(`/api/meetings/${id}`),
  projectTeam: (projectId) => request(`/api/projects/${projectId}/team`),
  create: (body) =>
    request('/api/meetings', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  reschedule: (id, body) =>
    request(`/api/meetings/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  held: (id) => request(`/api/meetings/${id}/held`, { method: 'PATCH' }),
  cancel: (id, body) =>
    request(`/api/meetings/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),
  attendance: (id, body) =>
    request(`/api/meetings/${id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  mom: (id, body) =>
    request(`/api/meetings/${id}/mom`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  momDownloadUrl: (id) => `${API_BASE}/api/meetings/${id}/mom/download`,
  momDoc: async (id, files) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`${API_BASE}/api/meetings/${id}/mom-doc`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message ?? 'Upload failed.');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  refDocs: async (id, files) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`${API_BASE}/api/meetings/${id}/refdocs`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message ?? 'Upload failed.');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  addAction: (id, body) =>
    request(`/api/meetings/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  actionStatus: (id, actionId, body) =>
    request(`/api/meetings/${id}/actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  actionNote: (id, actionId, body) =>
    request(`/api/meetings/${id}/actions/${actionId}/note`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  respond: (id, body) =>
    request(`/api/meetings/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  absenceLog: (params = {}) => request(`/api/meetings/absence-log${toQuery(params)}`),
};

export const portalApi = {
  mine: () => request('/api/portal/mine'),
  acknowledge: (body) =>
    request('/api/portal/acknowledge', { method: 'POST', body: JSON.stringify(body) }),
  respond: (id, body) =>
    request(`/api/portal/rfis/${id}/respond`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  acknowledgeStage: (id, body) =>
    request(`/api/portal/stages/${id}/acknowledge`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  uploadRequest: async (requestId, file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/portal/requests/${requestId}/upload`, {
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
  },
};

export const notificationsApi = {
  list: () => request('/api/notifications'),
  read: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => request('/api/notifications/read-all', { method: 'POST' }),
};
