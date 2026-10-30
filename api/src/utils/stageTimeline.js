import { expandServices } from '../config/services.js';
export const STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];
export const serviceKey = value => expandServices([value]).sort().join('|').toLowerCase();
export const sameService = (a, b) => serviceKey(a) === serviceKey(b);
export const overlapsService = (a, b) => expandServices([a]).some(s => expandServices([b]).includes(s));
export * from './stageDates.js';
export const approved = row => row?.confirmationStatus === 'TD Approved' || row?.billingReadiness === 'Billed';
export function currentStage(rows) {
  return STAGES.find(stage => !approved(rows.find(r => r.stage === stage))) ?? null;
}
