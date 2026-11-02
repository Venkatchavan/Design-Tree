import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { employeeOwnership } from './directorTeams.js';
import { istDayKey } from '../config/attendance.js';
import { eligibleSpocs } from './spocOptions.js';
export const id = value => String(value?._id ?? value ?? '');
export const DESIGN_STATUS = ['Active', 'On Hold', 'Delayed', 'Awaiting info', 'Ready for billing', 'Completed'];
const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
export const DESIGN_POLICY = Object.freeze({
  capacity: positive(process.env.DESIGN_TEAM_CAPACITY, 10),
  standardHours: 8,
  staleSpocDays: 21,
  staleWorkflowDays: 30,
  timezone: 'Asia/Kolkata',
  calendar: 'Monday to Friday excluding published HR holidays; approved leave and travel are marked separately'
});
export async function designTeamAccess(user) {
  const me = await User.findById(user.id).select('role employee name isActive').populate('employee', 'department designation status').lean();
  const role = me?.role;
  const label = `${me?.employee?.department ?? ''} ${me?.employee?.designation ?? ''}`;
  const head = ['design_mgmt_head', 'founding_director', 'working_director'].includes(role) || role === 'technical_director' && /design\s*(management|mgmt)/i.test(label);
  return {
    me,
    head: !!(me?.isActive && head),
    canRead: !!(me?.isActive && (head || role === 'coordinator'))
  };
}
export async function designTeamScope(user) {
  const access = await designTeamAccess(user);
  if (!access.canRead) throw Object.assign(new Error('Design Management My Team is not available for this login.'), {
    status: 403
  });
  const [employees, users] = await Promise.all([Employee.find({
    status: {
      $ne: 'Exited'
    }
  }).select('firstName middleName lastName empId designation department branch mobile phone email director reportingManager dateOfJoining status').lean(), User.find({
    isActive: true
  }).select('name email employee role').lean()]);
  const ownership = employeeOwnership(user, employees, users);
  const coordinatorIds = new Set((await eligibleSpocs()).items.map(e => id(e)));
  const spocs = employees.filter(e => coordinatorIds.has(id(e)) && (access.head ? ownership.reporting.has(id(e)) && id(e) !== ownership.own : id(e) === ownership.own));
  return {
    ...access,
    ...ownership,
    spocs,
    spocIds: spocs.map(e => id(e)),
    users
  };
}
export function workingDays(today, holidays = [], count = 7) {
  const result = [],
    blocked = new Set(holidays),
    d = new Date(today + 'T12:00:00Z');
  while (result.length < count) {
    const key = d.toISOString().slice(0, 10),
      weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !blocked.has(key)) result.push(key);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return result.reverse();
}
export function designStatus(p) {
  return ['On Hold', 'Completed'].includes(p.status) ? p.status : p.coordinationStatus && !['On Hold', 'Completed'].includes(p.coordinationStatus) ? p.coordinationStatus : p.status;
}
export function loadPoints(p) {
  const status = designStatus(p);
  return status === 'Completed' ? 0 : ({
    High: 3,
    Medium: 2,
    Low: 1
  }[p.complexity] ?? 2) * (status === 'On Hold' ? 0.5 : 1);
}
export function projectCounts(projects) {
  return Object.fromEntries([['Total', projects.length], ...DESIGN_STATUS.map(s => [s, projects.filter(p => designStatus(p) === s).length])]);
}
export const band = load => load < 5 ? 'Light' : load <= 8 ? 'Balanced' : 'Heavy';
export const dayOf = value => istDayKey(new Date(value));
