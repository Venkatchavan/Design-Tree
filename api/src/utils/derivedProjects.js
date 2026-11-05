import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { expandServices } from '../config/services.js';
import { employeeOwnership } from './directorTeams.js';

const id = value => String(value?._id ?? value ?? '');
const OPEN_STATUSES = ['Active', 'On Hold'];

// Projects an employee works on without being a member of a Team document:
//  1. projects of tasks assigned to them (TLs assign from their saved
//     reporting team, which is not always a project Team), and
//  2. Executive Director hierarchy: every project carrying the ED's service
//     (Electrical for Mitra) is reflected under all of that ED's Team Leads
//     and, below them, their team members (05 Nov 2026 client request).
// Returns [{ project, service, via }] with project ids as strings.
export async function derivedProjectLinks(user) {
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return [];
  const own = id(me.employee);
  const links = new Map();
  const tasks = await Task.find({ members: own }).select('project').lean();
  for (const t of tasks) links.set(id(t.project), { project: id(t.project), service: '', via: 'task' });

  const eds = await User.find({ role: 'executive_director' }).select('employee').lean();
  if (eds.length) {
    const [employees, users] = await Promise.all([
      Employee.find({ status: { $ne: 'Exited' } })
        .select('firstName middleName lastName empId email director reportingManager teamViewOf headOfDepartments department status').lean(),
      User.find({}).select('name email employee').lean(),
    ]);
    const byId = new Map(employees.map(e => [id(e), e]));
    const services = new Set();
    for (const ed of eds) {
      const edEmployee = byId.get(id(ed.employee));
      if (!edEmployee) continue;
      const { reporting } = employeeOwnership({ id: id(ed._id) }, employees, users);
      if (!reporting.has(own) || own === id(ed.employee)) continue;
      for (const s of expandServices([edEmployee.department])) services.add(s);
    }
    if (services.size) {
      const projects = await Project.find({ status: { $in: OPEN_STATUSES } }).select('services').lean();
      for (const p of projects) {
        const match = expandServices(p.services ?? []).find(s => services.has(s));
        if (match && !links.has(id(p))) links.set(id(p), { project: id(p), service: match, via: 'hierarchy' });
      }
    }
  }
  return [...links.values()];
}
