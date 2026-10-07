import { request, toQuery } from './api.js';

export const spocApi = {
  allocationsMine: () => request('/api/spoc/allocations/mine'),
  recordAllocation: (body) =>
    request('/api/spoc/allocations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  entriesList: (params = {}) => request(`/api/spoc/entries${toQuery(params)}`),
  entriesCreate: (body) =>
    request('/api/spoc/entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  manHourStatus: () => request('/api/spoc/man-hours/status'),
};
