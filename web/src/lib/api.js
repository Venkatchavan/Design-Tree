const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
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
