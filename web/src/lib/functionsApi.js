import { request, toQuery } from './api.js';

export const areaApi = {
  list: (params = {}) => request(`/api/functions/area-settlements${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/area-settlements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  review: (id, body) =>
    request(`/api/functions/area-settlements/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const boqApi = {
  list: (params = {}) => request(`/api/functions/boq${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/boq', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    request(`/api/functions/boq/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  review: (id, body) =>
    request(`/api/functions/boq/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const visitsApi = {
  list: (params = {}) => request(`/api/functions/site-visits${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/site-visits', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const discApi = {
  list: (params = {}) => request(`/api/functions/discrepancies${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/discrepancies', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    request(`/api/functions/discrepancies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const convApi = {
  list: (params = {}) => request(`/api/functions/conveyance${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/conveyance', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const rfiApi = {
  list: (params = {}) => request(`/api/functions/rfis${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/rfis', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    request(`/api/functions/rfis/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const bimApi = {
  list: (params = {}) => request(`/api/functions/bim-orders${toQuery(params)}`),
  create: (body) =>
    request('/api/functions/bim-orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    request(`/api/functions/bim-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const gbsApi = {
  get: (projectId) => request(`/api/functions/gbs-cert${toQuery({ project: projectId })}`),
  save: (body) =>
    request('/api/functions/gbs-cert', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const peerApi = {
  list: (params = {}) => request(`/api/functions/peer-reviews${toQuery(params)}`),
  get: (id) => request(`/api/functions/peer-reviews/${id}`),
  create: (body) =>
    request('/api/functions/peer-reviews', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    request(`/api/functions/peer-reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addChecklist: (id, item) =>
    request(`/api/functions/peer-reviews/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updateChecklist: (id, itemId, patch) =>
    request(`/api/functions/peer-reviews/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  addComment: (id, comment) =>
    request(`/api/functions/peer-reviews/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment),
    }),
  updateComment: (id, itemId, patch) =>
    request(`/api/functions/peer-reviews/${id}/comments/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  setFinal: (id, body) =>
    request(`/api/functions/peer-reviews/${id}/final`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
