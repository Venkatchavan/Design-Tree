import { Team } from '../models/Team.js';
import { directorTeams } from './directorTeams.js';

// Called after project visibility is checked. Use this for both options and writes.
export async function taskRoster(user, project) {
  const scoped = await directorTeams(user);
  const fields = 'firstName middleName lastName empId designation department status';
  const teams = scoped
    ? scoped.filter(team => team.projects.some(p => String(p._id) === String(project)))
    : await Team.find({ projects: project, active: { $ne: false } })
      .populate('members.employee', fields).populate('lead', fields).lean();
  const rows = teams.flatMap(team => [
    ...(team.members ?? []).map(m => ({ employee: m.employee, service: team.service, isLead: false })),
    ...(team.lead ? [{ employee: team.lead, service: team.service, isLead: true }] : []),
  ]).filter(m => m.employee?._id && m.employee.status !== 'Exited');
  const items = [...new Map(rows.map(m => [String(m.employee._id) + ':' + m.service + ':' + m.isLead, m])).values()];
  return { items, total: items.length };
}
