import { DIRECTOR_ROLES } from '../config/roles.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { employeeOwnership } from './directorTeams.js';

const id = (value) => String(value?._id ?? value ?? '');
const FIELDS = ['_id', 'firstName', 'middleName', 'lastName', 'empId', 'designation', 'department', 'branch', 'status'];
const publicEmployee = (e, role) => ({ ...Object.fromEntries(FIELDS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]])), ...(role ? { role } : {}) });

// Team allocation pickers: directors and team leads come from login roles
// (never a designation guess), and each TL carries the saved reporting team
// they lead or were granted, so the SPOC can allocate the whole team at once.
export async function allocationOptions() {
  const [employees, users] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } })
      .select('firstName middleName lastName empId email designation department branch status director reportingManager teamViewOf headOfDepartments')
      .sort({ firstName: 1, _id: 1 }).lean(),
    User.find({ employee: { $ne: null }, isActive: { $ne: false } }).select('name email employee role').lean(),
  ]);
  const active = new Map(employees.map((e) => [id(e), e]));
  const roleOf = new Map(users.filter((u) => active.has(id(u.employee))).map((u) => [id(u.employee), u.role]));
  const directors = employees.filter((e) => DIRECTOR_ROLES.includes(roleOf.get(id(e))));
  const teamLeads = users.filter((u) => u.role === 'team_lead' && active.has(id(u.employee))).map((u) => {
    const { own, reporting, resolve } = employeeOwnership({ id: u._id }, employees, users);
    const team = [own, ...[...reporting].filter((member) => member !== own)].filter((member) => active.has(member));
    // Nearest director up the saved reporting chain (TL -> TD/ATD/AD ...).
    let director = null;
    const seen = new Set([own]);
    for (let next = resolve(active.get(own)?.reportingManager); next && !seen.has(next); next = resolve(active.get(next)?.reportingManager)) {
      seen.add(next);
      if (DIRECTOR_ROLES.includes(roleOf.get(next))) { director = active.get(next); break; }
    }
    return { ...publicEmployee(active.get(own), 'team_lead'), team: [...new Set(team)], ...(director ? { director: publicEmployee(director, roleOf.get(id(director))) } : {}) };
  }).sort((a, b) => `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`));
  return {
    directors: directors.map((e) => publicEmployee(e, roleOf.get(id(e)))),
    teamLeads,
    employees: employees.map((e) => publicEmployee(e, roleOf.get(id(e)))),
  };
}
