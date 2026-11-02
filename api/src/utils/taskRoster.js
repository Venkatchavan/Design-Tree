import { Team } from '../models/Team.js';
import { Employee } from '../models/Employee.js';
import { directorTeams, employeeOwnership } from './directorTeams.js';
import { User } from '../models/User.js';
import { expandServices } from '../config/services.js';

const FIELDS = 'firstName middleName lastName empId designation department branch status';

// The TL's saved reporting team (everyone under them in the imported roster),
// without the TL. Same resolution as My Team, so both screens list the same people.
async function reportingTeam(user) {
  const [employees, users] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } })
      .select(`${FIELDS} email director reportingManager teamViewOf headOfDepartments`).lean(),
    User.find({}).select('name email employee').lean(),
  ]);
  const { own, reporting } = employeeOwnership(user, employees, users);
  const byId = new Map(employees.map(e => [String(e._id), e]));
  return [...reporting].filter(member => member !== own).map(member => byId.get(member)).filter(Boolean);
}

// Called after project visibility is checked. Use this for both options and writes.
export async function taskRoster(user, project) {
  const scoped = await directorTeams(user);
  let teams = scoped
    ? scoped.filter(team => team.projects.some(p => String(p._id) === String(project)))
    : await Team.find({ projects: project, active: { $ne: false } })
      .populate('members.employee', FIELDS).populate('lead', FIELDS).lean();
  let own = [];
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
    // Everyone under the TL is listed too, so the TL never has to search for their own people.
    const label = [...new Set(ledTeams.map(team => team.service).filter(Boolean))].join(' + ') || 'My team';
    own = (await reportingTeam(user)).map(employee => ({ employee, service: label, isLead: false }));
  }
  const allocated = teams.flatMap(team => [
    ...(team.members ?? []).map(m => ({ employee: m.employee, service: team.service, isLead: false })),
    ...(team.lead ? [{ employee: team.lead, service: team.service, isLead: true }] : []),
  ]);
  // People already allocated on the project keep their service group; no duplicates.
  const listed = new Set(allocated.map(m => String(m.employee?._id ?? '')));
  const rows = [...allocated, ...own.filter(m => !listed.has(String(m.employee._id)))]
    .filter(m => m.employee?._id && m.employee.status !== 'Exited');
  const items = [...new Map(rows.map(m => [String(m.employee._id) + ':' + m.service + ':' + m.isLead, m])).values()];
  return { items, total: items.length };
}
