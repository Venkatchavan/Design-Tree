import { expandServices } from '../config/services.js';
export const STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];
export const serviceKey = value => expandServices([value]).sort().join('|').toLowerCase();
export const sameService = (a, b) => serviceKey(a) === serviceKey(b);
// Mutation authority covers the complete saved tracker, even when the request
// used a component alias that resolves to that bundle. Read overlap is separate.
export function coversService(assignedServices, requested) {
  const required = expandServices([requested]);
  const assigned = new Set(expandServices(assignedServices));
  return required.length > 0 && required.every(service => assigned.has(service));
}
export const overlapsService = (a, b) => expandServices([a]).some(s => expandServices([b]).includes(s));
export * from './stageDates.js';
export const approved = row => row?.confirmationStatus === 'TD Approved' || row?.billingReadiness === 'Billed';
export function currentStage(rows) {
  return STAGES.find(stage => !approved(rows.find(r => r.stage === stage))) ?? null;
}
