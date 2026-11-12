import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { employeeOwnership } from './directorTeams.js';

// Employees in the caller's saved reporting chain (self included). A TL reads
// their team from it, so team views don't depend on a Team document existing
// for every project the team logs against.
export async function reportingEmployeeIds(user) {
  const [employees, users] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } })
      .select('firstName middleName lastName empId email director reportingManager teamViewOf headOfDepartments department status').lean(),
    User.find({}).select('name email employee').lean(),
  ]);
  const { reporting } = employeeOwnership(user, employees, users);
  return [...reporting];
}
