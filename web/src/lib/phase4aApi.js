import { request, toQuery } from './api.js';

export const designApi = {
  meta: () => request('/api/design/meta'),
  get: (project) => request(`/api/design${toQuery({ project })}`),
  save: (body) =>
    request('/api/design', { method: 'PUT', body: JSON.stringify(body) }),
};

export const marketingApi = {
  portfolio: (params = {}) =>
    request(`/api/marketing/portfolio${toQuery(params)}`),
  brief: (project) => request(`/api/marketing/brief${toQuery({ project })}`),
  saveBrief: (body) =>
    request('/api/marketing/brief', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  collateral: {
    list: (params = {}) =>
      request(`/api/marketing/collateral${toQuery(params)}`),
    create: (body) =>
      request('/api/marketing/collateral', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id, body) =>
      request(`/api/marketing/collateral/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },
  contacts: {
    list: (params = {}) =>
      request(`/api/marketing/contacts${toQuery(params)}`),
    create: (body) =>
      request('/api/marketing/contacts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    summary: () => request('/api/marketing/contacts/summary'),
  },
};

export const reportsApi = {
  management: (params = {}) =>
    request(`/api/reports/management${toQuery(params)}`),
  department: (service) =>
    request(`/api/reports/departments/${encodeURIComponent(service)}`),
};
