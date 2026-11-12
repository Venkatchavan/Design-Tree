import { Team } from '../models/Team.js';
import { User } from '../models/User.js';

// The service a user works in on a project, taken from the active team(s) on
// that project that they lead or belong to. Several teams → "A + B" (the same
// composite form team services already use). Returns '' when none match.
export async function deriveUserService(user, projectId) {
  if (!user?.id || !projectId) return '';
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee) return '';
  const teams = await Team.find({
    projects: projectId,
    active: { $ne: false },
    $or: [{ 'members.employee': me.employee }, { lead: me.employee }],
  }).select('service').lean();
  const services = [...new Set(teams.map((t) => String(t.service ?? '').trim()).filter(Boolean))];
  return services.join(' + ');
}
