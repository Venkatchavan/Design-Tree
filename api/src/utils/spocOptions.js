import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';

// SPOC is the coordinator login role, not a designation or an arbitrary employee.
export async function eligibleSpocs() {
  const users = await User.find({ role: 'coordinator' }).select('_id name isActive employee').lean();
  const employees = await Employee.find({ _id: { $in: users.map(u => u.employee).filter(Boolean) } })
    .select('_id firstName middleName lastName empId status user').lean();
  const byId = new Map(employees.map(e => [String(e._id), e]));
  const links = new Map();
  for (const user of users) if (user.isActive && user.employee) {
    const key = String(user.employee); links.set(key, (links.get(key) ?? 0) + 1);
  }
  const items = [], unavailable = [];
  for (const user of users) {
    const employee = byId.get(String(user.employee ?? ''));
    let reason = '';
    if (!user.isActive) reason = 'SPOC login is inactive.';
    else if (!employee) reason = 'SPOC login is missing a valid employee link.';
    else if (employee.status === 'Exited') reason = 'Linked employee has exited.';
    else if (links.get(String(employee._id)) > 1) reason = 'Employee has multiple active SPOC logins; HR review is required.';
    else if (employee.user && String(employee.user) !== String(user._id)) reason = 'Employee and login links conflict; HR review is required.';
    if (reason) { unavailable.push({ name: user.name, reason }); continue; }
    const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') || user.name;
    items.push({ _id: String(employee._id), name, empId: employee.empId });
  }
  items.sort((a, b) => a.name.localeCompare(b.name) || String(a.empId).localeCompare(String(b.empId)));
  unavailable.sort((a, b) => a.name.localeCompare(b.name));
  return { items, total: items.length, unavailable };
}
