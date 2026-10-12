import { User } from '../models/User.js';

// SPOC, team leads and engineers/drafters only see data for projects they are
// allocated to. Every other role keeps company-wide access.
export const PROJECT_SCOPED_ROLES = ['coordinator', 'team_lead', 'engineer_drafter'];

// null → unrestricted. Array → the only project ids this user may see.
export async function projectScopeIds(user) {
  if (!user || !PROJECT_SCOPED_ROLES.includes(user.role)) return null;
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return [];
  const empId = me.employee;
  if (user.role === 'coordinator') {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const rows = await SpocAllocation.find({ coordinator: empId }).select('project').lean();
    return [...new Set(rows.map((r) => String(r.project)))];
  }
  const { Team } = await import('../models/Team.js');
  const teams = await Team.find({ $or: [{ lead: empId }, { 'members.employee': empId }] })
    .select('projects')
    .lean();
  return [...new Set(teams.flatMap((t) => (t.projects ?? []).map(String)))];
}

// Narrow a Mongo filter on a project-reference field to the allowed ids.
export function narrowByProject(filter, field, ids) {
  if (!ids) return filter;
  const current = filter[field];
  if (typeof current === 'string' && current) {
    if (!ids.includes(current)) filter[field] = { $in: [] };
    return filter;
  }
  filter[field] = { $in: ids };
  return filter;
}

export function projectIdOf(doc) {
  return String(doc?.project?._id ?? doc?.project ?? '');
}
