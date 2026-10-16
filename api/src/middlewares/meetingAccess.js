import { Meeting } from '../models/Meeting.js';
import { User } from '../models/User.js';
import { canReadProject } from '../utils/projectScope.js';

export const MEETING_OBSERVERS = ['founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director', 'assoc_technical_director', 'design_mgmt_head', 'team_lead', 'coordinator'];
export async function applyMeetingAudience(filter, user, mine = false) {
  if (mine || !MEETING_OBSERVERS.includes(user.role)) {
    const me = await User.findById(user.id).select('employee').lean();
    filter.$and = [...(filter.$and ?? []), { $or: [
      { 'invites.employee': me?.employee ?? null },
      { 'participants.employee': me?.employee ?? null },
      { 'actions.owner': me?.employee ?? null },
    ] }];
    if (!me?.employee) filter._id = { $in: [] };
  }
}
export async function meetingAccess(req, res, next) {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid meeting.' });
    const doc = await Meeting.findById(req.params.id);
    if (!doc || !await canReadProject(req.user, doc.project)) return res.status(404).json({ message: 'Meeting not found.' });
    if (!MEETING_OBSERVERS.includes(req.user.role)) {
      const filter = { _id: doc._id };
      await applyMeetingAudience(filter, req.user);
      if (!await Meeting.exists(filter)) return res.status(404).json({ message: 'Meeting not found.' });
    }
    const personal = /\/respond$|\/actions\/[^/]+(?:\/note)?$/.test(req.path);
    if (req.method !== 'GET' && !personal && req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Only the assigned SPOC manages meetings.' });
    }
    return next();
  } catch (err) { return next(err); }
}
