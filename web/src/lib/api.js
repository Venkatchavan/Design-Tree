export const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchApi(path, options) {
  try {
    return await fetch(`${API_BASE}${path}`, options);
  } catch (cause) {
    if (!(cause instanceof TypeError)) throw cause;
    const error = new Error('Cannot connect to DesignTree. Check your connection and try again. If this continues, contact your administrator.', { cause });
    error.code = 'NETWORK_ERROR';
    throw error;
  }
}

export async function request(path, options = {}) {
  const res = await fetchApi(path, {
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

export function logoutApi(body) {
  return request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
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

async function directoryList(path, params) {
  if (params.page != null || params.limit != null) return request(`${path}${toQuery(params)}`);
  let data = await request(`${path}${toQuery({ ...params, page: 1, limit: 200 })}`);
  const records = new Map(data.items.map(item => [String(item.id ?? item._id), item]));
  for (let page = 2; data.hasMore; page++) {
    data = await request(`${path}${toQuery({ ...params, page, limit: 200 })}`);
    const before = records.size;
    for (const item of data.items) records.set(String(item.id ?? item._id), item);
    if (data.hasMore && records.size === before) throw new Error('The directory changed while loading. Please refresh and try again.');
  }
  return { ...data, items: [...records.values()], page: 1, hasMore: false };
}

export async function requestMultipart(path, file, field = 'file') {
  const form = new FormData();
  form.append(field, file);
  const res = await fetchApi(path, {
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

export const attendanceApi = {
  status: () => request('/api/attendance/status'),
  reason: (body) =>
    request('/api/attendance/reason', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  list: (params = {}) => request(`/api/attendance${toQuery(params)}`),
};

export const projectsApi = {
  reconcileTeam: (id) => request(`/api/projects/${id}/reconcile-team`, { method: 'POST' }),
  summary: (params = {}) => request(`/api/projects/status-summary${toQuery(params)}`),
  updateHold: (id, body) => request(`/api/projects/${id}/hold`, { method: 'PUT', body: JSON.stringify(body) }),
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
  activate: (id, body = {}) =>
    request(`/api/projects/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  saveTeam: (id, body) =>
    request(`/api/projects/${id}/team-confirmation`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  saveSpocContacts: (id, body) =>
    request(`/api/projects/${id}/spoc-contacts`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  saveTeamLeads: (id, body) =>
    request(`/api/projects/${id}/team-leads`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setPortalUsers: (id, userIds) =>
    request(`/api/projects/${id}/portal-users`, {
      method: 'PATCH',
      body: JSON.stringify({ userIds }),
    }),
  gfcReadiness: (id) => request(`/api/projects/${id}/gfc-readiness`),
  finalApproval: (id, body = {}) =>
    request(`/api/projects/${id}/final-approval`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importFile: (file) => requestMultipart('/api/projects/import', file, 'file'),
  nextCode: () => request('/api/projects/next-code'),
  nextJobNumber: () => request('/api/projects/next-job-number'),
};

export const metaApi = {
  geocode: (q) => request(`/api/meta/geocode${toQuery({ q })}`),
};

export const employeesApi = {
  spocOptions: () => request('/api/employees/spoc-options'),
  list: (params = {}) => directoryList('/api/employees', params),
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
  list: (params = {}) => directoryList('/api/users', params),
  create: (body) =>
    request('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  // External portal identity (client / architect) — never linked to employees.
  createPortal: (body) =>
    request('/api/users/portal', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const branchesApi = {
  options: () => request('/api/branches/options'),
  list: (all = false) => request(`/api/branches${all ? '?all=1' : ''}`),
  create: (body) =>
    request('/api/branches', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/branches/${id}`, {
      method: 'PUT',
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
