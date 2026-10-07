export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message ?? 'Request failed.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function loginApi({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logoutApi() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function meApi() {
  return request('/api/auth/me');
}

export function bootstrapApi() {
  return request('/api/meta/bootstrap');
}

export function toQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.append(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function requestMultipart(path, file, field = 'file') {
  const form = new FormData();
  form.append(field, file);
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message ?? 'Request failed.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const projectsApi = {
  list: (params = {}) => request(`/api/projects${toQuery(params)}`),
  stats: () => request('/api/projects/stats'),
  filters: () => request('/api/projects/filters'),
  get: (id) => request(`/api/projects/${id}`),
  team: (id) => request(`/api/projects/${id}/team`),
  create: (body) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  importFile: (file) => requestMultipart('/api/projects/import', file, 'file'),
};

export const employeesApi = {
  list: (params = {}) => request(`/api/employees${toQuery(params)}`),
  filters: () => request('/api/employees/filters'),
  get: (id) => request(`/api/employees/${id}`),
  create: (body) =>
    request('/api/employees', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const usersApi = {
  list: (params = {}) => request(`/api/users${toQuery(params)}`),
  create: (body) =>
    request('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const teamsApi = {
  list: () => request('/api/teams'),
  get: (id) => request(`/api/teams/${id}`),
  create: (body) =>
    request('/api/teams', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  updateMembers: (id, members) =>
    request(`/api/teams/${id}/members`, {
      method: 'PUT',
      body: JSON.stringify({ members }),
    }),
};

export const workEntriesApi = {
  list: (params = {}) => request(`/api/work-entries${toQuery(params)}`),
  create: (body) =>
    request('/api/work-entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  decide: (id, body) =>
    request(`/api/work-entries/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
