import { request, toQuery } from './api.js';

export const teamsMineApi = {
  list: () => request('/api/teams/mine'),
};

export const tasksApi = {
  mine: () => request('/api/work/tasks/mine'),
  list: (params = {}) => request(`/api/work/tasks${toQuery(params)}`),
  create: (body) =>
    request('/api/work/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/work/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setStatus: (id, status) =>
    request(`/api/work/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const deliverablesApi = {
  list: (params = {}) => request(`/api/work/deliverables${toQuery(params)}`),
  create: (body) =>
    request('/api/work/deliverables', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/work/deliverables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  log: (params = {}) => request(`/api/work/deliverables-log${toQuery(params)}`),
};

export const revisionsApi = {
  mine: () => request('/api/work/revisions/mine'),
  list: (params = {}) => request(`/api/work/revisions${toQuery(params)}`),
  create: (body) =>
    request('/api/work/revisions', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/work/revisions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setStatus: (id, status) =>
    request(`/api/work/revisions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const drawingsApi = {
  list: (params = {}) => request(`/api/work/drawings${toQuery(params)}`),
  create: (body) =>
    request('/api/work/drawings', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/work/drawings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const recruitmentApi = {
  list: (params = {}) => request(`/api/work/recruitment${toQuery(params)}`),
  create: (body) =>
    request('/api/work/recruitment', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/work/recruitment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setStatus: (id, status) =>
    request(`/api/work/recruitment/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
