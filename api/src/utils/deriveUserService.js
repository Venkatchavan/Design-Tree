import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { expandServiceCodes } from '../config/services.js';

async function teamServices(user, projectId) {
  if (!user?.id || !projectId) return [];
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return [];
  const teams = await Team.find({
    projects: projectId,
    active: { $ne: false },
    $or: [{ 'members.employee': me.employee }, { lead: me.employee }],
  }).select('service').lean();
  return [...new Set(teams.map((t) => String(t.service ?? '').trim()).filter(Boolean))];
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
