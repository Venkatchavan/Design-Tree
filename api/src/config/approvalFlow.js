// Leave / Travel / LA-Cab approval chain (Leave & Travel → Approvals).
//
//   Team Lead → HR → Finance (final)
//
// Every request records which stages apply to it (`flowStages`) so the
// chain can skip steps that have no owner — a director or an admin has no
// Team Lead above them, and only Finance-department travel reaches the
// Finance stage. `status` stays the single field the rest of the app reads,
// derived from the stage decisions so nothing downstream needs to change.

import mongoose from 'mongoose';

// Directive roles report straight to HR — no Team Lead step.
const TL_STAGE_EXEMPT_ROLES = [
  'founding_director',
  'working_director',
  'admin_billing',
  'hr',
  'executive_director',
  'associate_director',
  'technical_director',
  'assoc_technical_director',
];

// Canonical order of the chain.
export const APPROVAL_STAGES = ['tl', 'hr', 'finance'];

export const STAGE_LABELS = {
  tl: 'Team Lead',
  hr: 'HR',
  finance: 'Finance',
};

// Derived `status` values. The two intermediate ones tell the requester
// exactly who is holding the request right now.
export const FLOW_PENDING = 'Pending'; // awaiting Team Lead
export const FLOW_PENDING_HR = 'Pending HR'; // TL cleared, awaiting HR
export const FLOW_PENDING_FINANCE = 'Pending Finance'; // TL + HR cleared
export const FLOW_APPROVED = 'Approved'; // chain complete
export const FLOW_REJECTED = 'Rejected'; // terminal, whoever rejected

export const FLOW_STATUSES = [
  FLOW_PENDING,
  FLOW_PENDING_HR,
  FLOW_PENDING_FINANCE,
  FLOW_APPROVED,
  FLOW_REJECTED,
];

export function isPendingFlow(status) {
  const s = String(status ?? '');
  return s === FLOW_PENDING || s === FLOW_PENDING_HR || s === FLOW_PENDING_FINANCE;
}

const stageSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['Approved', 'Rejected'] },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

// Reused by LeaveRequest / TravelRequest / AllowanceRequest.
export function approvalStagesField() {
  return {
    tl: { type: stageSchema, default: () => ({}) },
    hr: { type: stageSchema, default: () => ({}) },
    finance: { type: stageSchema, default: () => ({}) },
  };
}

// Stages this particular request must clear, in order.
export function buildFlowStages({ hasTeamLead = false, department = '' } = {}) {
  const stages = [];
  if (hasTeamLead) stages.push('tl');
  stages.push('hr');
  if (String(department).toLowerCase() === 'finance') stages.push('finance');
  return stages;
}

// True when the requester is someone a Team Lead actually manages —
// directive roles report straight to HR, so they skip that step.
export function isTlStageExempt(role) {
  return TL_STAGE_EXEMPT_ROLES.includes(role);
}

// The first rejection is terminal; otherwise the chain advances while the
// leading stages are approved. Only `flowStages` count, so a skipped step
// never blocks the final one.
export function deriveFlowStatus(stages = {}, flowStages = APPROVAL_STAGES) {
  const list = flowStages?.length ? flowStages : APPROVAL_STAGES;
  for (const k of list) {
    if (stages?.[k]?.status === FLOW_REJECTED) return FLOW_REJECTED;
  }
  let done = 0;
  for (const k of list) {
    if (stages?.[k]?.status === FLOW_APPROVED) done += 1;
    else break;
  }
  if (done >= list.length) return FLOW_APPROVED;
  if (done === list.length - 1) {
    const next = list[done];
    if (next === 'hr') return FLOW_PENDING_HR;
    if (next === 'finance') return FLOW_PENDING_FINANCE;
  }
  return FLOW_PENDING;
}

// Whose turn it is, or null when the chain is finished / already rejected.
export function nextStage(stages = {}, flowStages = APPROVAL_STAGES) {
  const list = flowStages?.length ? flowStages : APPROVAL_STAGES;
  for (const k of list) {
    const s = stages?.[k]?.status;
    if (s === FLOW_REJECTED) return null;
    if (s !== FLOW_APPROVED) return k;
  }
  return null;
}

// Which stage a role owns. Everyone else — including FD/WD and the
// directors — never approves here; they view read-only.
export function stageForRole(role) {
  if (role === 'team_lead') return 'tl';
  if (role === 'hr') return 'hr';
  if (role === 'finance') return 'finance';
  return null;
}

export const FLOW_APPROVER_ROLES = ['team_lead', 'hr', 'finance'];

// Roles allowed to open the Approvals tab at all (the last ones read-only).
export const FLOW_OVERSIGHT_ROLES = [
  'founding_director',
  'working_director',
  'executive_director',
  'associate_director',
];