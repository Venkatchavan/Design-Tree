import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { expandServices, expandServiceCodes } from '../config/services.js';
import { derivedProjectLinks } from './derivedProjects.js';

async function teamServices(user, projectId) {
  if (!user?.id || !projectId) return [];
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return [];
  const teams = await Team.find({
    projects: projectId,
    active: { $ne: false },
    $or: [{ 'members.employee': me.employee }, { lead: me.employee }],
  }).select('service').lean();
  const services = [...new Set(teams.map((t) => String(t.service ?? '').trim()).filter(Boolean))];
  if (services.length) return services;
  // Not on a Team record: the project may still be theirs through an assigned
  // task (or the ED hierarchy). My work lists those with the link's service, else
  // the employee's department — use the same service here.
  const link = (await derivedProjectLinks(user)).find((l) => l.project === String(projectId));
  if (!link) return [];
  const employee = await Employee.findById(me.employee).select('department').lean();
  const service = link.service || expandServices([employee?.department]).join(' + ');
  return service ? [service] : [];
}

// The service a user works in on a project, taken from the active team(s) on
// that project that they lead or belong to. Several teams → "A + B" (the same
// composite form team services already use). Returns '' when none match.
export async function deriveUserService(user, projectId) {
  return (await teamServices(user, projectId)).join(' + ');
}

// The individual services (STR, PHE, ELE, HVAC, FIRE, …) the user's team(s)
// cover on a project — a bundle like SMEPF is split into its parts.
export async function deriveUserServiceOptions(user, projectId) {
  return expandServiceCodes(await teamServices(user, projectId));
}
