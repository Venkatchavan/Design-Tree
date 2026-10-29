import { User } from '../models/User.js';

// SPOC, team leads and engineers/drafters only see data for projects they are
// allocated to. Every other role keeps company-wide access.
export const PROJECT_SCOPED_ROLES = ['coordinator', 'team_lead', 'engineer_drafter', 'qs', 'qaqc', 'bim', 'gbs', 'peer_reviewer'];

// null → unrestricted. Array → the only project ids this user may see.
export async function projectScopeIds(user) {
  if (!user || !PROJECT_SCOPED_ROLES.includes(user.role)) return null;
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return [];
  const empId = me.employee;
  if (user.role === 'coordinator') {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const rows = await SpocAllocation.find({ coordinator: empId, active: { $ne: false }, status: { $in: ['Approved', 'Proposed'] } }).select('project').lean();
    const { Project } = await import('../models/Project.js');
    const projects = await Project.find({ $or: [{ _id: { $in: rows.map(r=>r.project) } }, { 'activation.spoc': empId }] }).select('activation.spoc').lean();
    return projects.filter(p=>!p.activation?.spoc || String(p.activation.spoc)===String(empId)).map(p=>String(p._id));
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

export async function canReadProject(user, project) {
  const ids = await projectScopeIds(user);
  return ids === null || ids.includes(String(project?._id ?? project));
}
