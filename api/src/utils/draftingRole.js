// 13 Nov 2026: every designation under Drafting (TL Drafting, Sr. TL Drafting,
// any designation containing "Drafting") works from the Engineer / Drafter
// dashboard, never the Team Lead dashboard.
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';

const DRAFTING = /\bdrafting\b/i;
// Roles a drafting designation is moved off (only the team-lead dashboard).
const MOVED_ROLES = new Set(['team_lead']);

export function isDraftingDesignation(designation) {
  return DRAFTING.test(String(designation ?? ''));
}

export function draftingRoleFor(role, designation) {
  return MOVED_ROLES.has(role) && isDraftingDesignation(designation) ? 'engineer_drafter' : role;
}

// Role to use for a user document (with `employee` id), looked up from the
// linked employee's designation.
export async function resolveDraftingRole(user) {
  if (!user?.employee || !MOVED_ROLES.has(user.role)) return user?.role;
  const employee = await Employee.findById(user.employee?._id ?? user.employee).select('designation').lean();
  return draftingRoleFor(user.role, employee?.designation);
}

// Startup sync: move existing drafting logins to the Engineer / Drafter role.
export async function syncDraftingRoles() {
  const users = await User.find({ role: { $in: [...MOVED_ROLES] }, employee: { $ne: null } }).select('role employee').lean();
  if (!users.length) return 0;
  const employees = await Employee.find({ _id: { $in: users.map((u) => u.employee) } }).select('designation').lean();
  const drafting = new Set(employees.filter((e) => isDraftingDesignation(e.designation)).map((e) => String(e._id)));
  const ids = users.filter((u) => drafting.has(String(u.employee))).map((u) => u._id);
  if (!ids.length) return 0;
  const res = await User.updateMany({ _id: { $in: ids } }, { $set: { role: 'engineer_drafter' } });
  return res.modifiedCount ?? ids.length;
}
