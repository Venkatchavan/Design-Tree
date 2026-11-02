import { request, toQuery } from './api.js';

export const spocApi = {
  allocationsMine: () => request('/api/spoc/allocations/mine'),
  allocationsList: (params = {}) => request(`/api/spoc/allocations${toQuery(params)}`),
  recordAllocation: (body) =>
    request('/api/spoc/allocations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  proposeAllocation: (body) =>
    request('/api/spoc/allocations/propose', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  entriesList: (params = {}) => request(`/api/spoc/entries${toQuery(params)}`),
  entriesCreate: (body) =>
    request('/api/spoc/entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  daySave: body => request('/api/spoc/entries/day', { method: 'POST', body: JSON.stringify(body) }),
  entriesUpdate: (id, body) => request(`/api/spoc/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  manHourStatus: () => request('/api/spoc/man-hours/status'),
};
