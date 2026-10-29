import { Team } from '../models/Team.js';
import { directorTeams } from './directorTeams.js';
import { User } from '../models/User.js';
import { expandServices } from '../config/services.js';

// Called after project visibility is checked. Use this for both options and writes.
export async function taskRoster(user, project) {
  const scoped = await directorTeams(user);
  const fields = 'firstName middleName lastName empId designation department status';
  let teams = scoped
    ? scoped.filter(team => team.projects.some(p => String(p._id) === String(project)))
    : await Team.find({ projects: project, active: { $ne: false } })
      .populate('members.employee', fields).populate('lead', fields).lean();
  if (user.role === 'team_lead') {
    const me = await User.findById(user.id).select('employee').lean();
    // A project can contain several disciplines. Derive the TL's service
    // authority from saved active lead allocations, never from a client filter.
    const ledTeams = me?.employee
      ? await Team.find({ projects: project, active: { $ne: false }, lead: me.employee }).select('service').lean()
      : [];
    const services = new Set(expandServices(ledTeams.map(team => team.service)));
    teams = teams.flatMap(team => expandServices([team.service])
      .filter(service => services.has(service)).map(service => ({ ...team, service })));
  }
  const rows = teams.flatMap(team => [
    ...(team.members ?? []).map(m => ({ employee: m.employee, service: team.service, isLead: false })),
    ...(team.lead ? [{ employee: team.lead, service: team.service, isLead: true }] : []),
  ]).filter(m => m.employee?._id && m.employee.status !== 'Exited');
  const items = [...new Map(rows.map(m => [String(m.employee._id) + ':' + m.service + ':' + m.isLead, m])).values()];
  return { items, total: items.length };
}
