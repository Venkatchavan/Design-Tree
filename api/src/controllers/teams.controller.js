import { directorTeams } from '../utils/directorTeams.js';
import { directorDirectory } from '../utils/directorDirectory.js';

export async function reportingDirectory(req,res,next) {
  try{return res.json(await directorDirectory(req.user,false,req.query.branch??''));}catch(error){return next(error);}
}
export async function companyDirectory(req,res,next) {
  try{return res.json(await directorDirectory(req.user,true,req.query.branch??''));}catch(error){return next(error);}
}
import { applyMeetingAudience } from '../middlewares/meetingAccess.js';
import { projectScopeIds } from '../utils/projectScope.js';
import { Meeting } from '../models/Meeting.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { requireActiveBranch } from '../utils/branches.js';
import {
  teamMembersSchema,
  teamSchema,
  teamUpdateSchema,
} from '../validation/team.schema.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function weekHoursByEmployee(employeeIds) {
  if (employeeIds.length === 0) return new Map();
  const since = new Date(Date.now() - WEEK_MS);
  const rows = await WorkEntry.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: since },
      },
    },
    { $group: { _id: '$employee', hours: { $sum: '$hours' } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.hours]));
}

export async function myTeams(req, res, next) {
  try {
    const { User } = await import('../models/User.js');
    const me = await User.findById(req.user.id);
    // Prefer the live DB role: JWTs are minted at login, so a recently
    // re-roled user still carries the old role in their cookie until they
    // sign in again.
    const role = me?.role ?? req.user.role;
    const memberSelect =
      'firstName lastName empId designation department branch status experience';
    const scoped = await directorTeams({ ...req.user, role });
    if (scoped) return res.json({ items: scoped, total: scoped.length });
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const teams = await Team.find({
      active:{$ne:false},
      $or: [{ lead: me.employee }, { 'members.employee': me.employee }],
    }).sort({allocationProject:-1,updatedAt:-1})
      .populate('projects', 'name jobNumber code branch currentStage status clientName description projectType completion expectedCompletion actualCompletion services hold')
      .populate('lead', memberSelect)
      .populate('members.employee', memberSelect);
    return res.status(200).json({ items: teams, total: teams.length });
  } catch (err) {
    return next(err);
  }
}

export async function listTeams(req, res, next) {
  try {
    const scoped = await directorTeams(req.user);
    if (scoped) {
      const items = scoped.filter(t => !req.query.service || t.service === req.query.service).map(t => ({ ...t, id: String(t._id), memberCount: new Set([t.lead?._id, ...t.members.map(m=>m.employee._id)].filter(Boolean).map(String)).size }));
      return res.json({ items, total: items.length });
    }
    const { service } = req.query;
    const filter = {};
    if (service) filter.service = service;
    const allowed = await projectScopeIds(req.user);
    if (allowed) filter.projects = {$in:allowed};
    const teams = await Team.find(filter).sort({ name: 1 });
    const memberIds = teams.flatMap((t) => t.members.map((m) => m.employee));
    const hours = await weekHoursByEmployee(memberIds);
    return res.status(200).json({
      items: teams.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        service: t.service,
        branch: t.branch,
        active: t.active,
        memberCount: t.members.length,
        weekHours: t.members.reduce(
          (sum, m) => sum + (hours.get(m.employee.toString()) ?? 0),
          0,
        ),
      })),
      total: teams.length,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getTeam(req, res, next) {
  try {
    const scoped = await directorTeams(req.user);
    const rows = scoped?.filter(t=>String(t._id)===req.params.id && (!req.query.project||t.projects.some(p=>String(p._id)===req.query.project)) && (!req.query.service||t.service===req.query.service));
    const team = scoped ? (rows.length ? rows[0] : null) : await Team.findById(req.params.id)
      .populate('lead', 'firstName lastName empId designation')
      .populate('members.employee', 'firstName lastName empId designation branch department status experience')
      .populate('projects', 'name jobNumber code status currentStage');
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    const allowed = await projectScopeIds(req.user);
    const projectIds = team.projects.map(p => p._id);
    if (allowed && !projectIds.some(id => allowed.includes(String(id)))) return res.status(404).json({message:'Team not found.'});
    const visibleProjects = allowed ? projectIds.filter(id => allowed.includes(String(id))) : projectIds;
    const memberIds = team.members.filter(m => m.employee).map((m) => m.employee._id);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const meetingFilter = {project:{$in:visibleProjects}};
    await applyMeetingAudience(meetingFilter,req.user);
    const weekFilter = {
      employee: { $in: memberIds },
      project: { $in: visibleProjects },
      date: { $gte: weekStart, $lte: now },
    };
    const [entries, pending, meetings, projectHourRows] = await Promise.all([
      WorkEntry.find(weekFilter)
        .populate('project', 'name code')
        .populate('employee', 'firstName lastName empId designation')
        .sort({ date: -1 })
        .limit(500),
      WorkEntry.find({
        employee: { $in: memberIds },
        project: { $in: visibleProjects },
        status: 'Pending',
        date: { $gte: weekStart, $lte: now },
      }).populate('project','name code').populate('employee','firstName lastName empId designation').sort({ date: -1 }).limit(500),
      Meeting.find(meetingFilter).populate('project','name code').sort({date:-1}),
      WorkEntry.aggregate([
        { $match: weekFilter },
        { $group: { _id: '$project', hours: { $sum: '$hours' } } },
        { $sort: { hours: -1 } },
      ]),
    ]);
    const projectsById = new Map(
      (await Project.find({ _id: { $in: projectHourRows.map((row) => row._id) } }).select('name code'))
        .map((project) => [String(project._id), project]),
    );
    const projectHours = projectHourRows.map((row) => ({
      project: projectsById.get(String(row._id)) ?? { _id: row._id },
      hours: row.hours,
    }));
    return res.status(200).json({
      team,
      weekEntries: entries,
      pending,
      meetings,
      projectHours,
      weekStart,
      weekEnd: now,
    });
  } catch (err) {
    return next(err);
  }
}

export async function createTeam(req, res, next) {
  try {
    const parsed = teamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid team data.' });
    }
    if (parsed.data.branch) {
      try {
        parsed.data.branch = await requireActiveBranch(parsed.data.branch);
      } catch (err) {
        return res.status(err.status ?? 400).json({ message: err.message });
      }
    }
    const team = await Team.create(parsed.data);
    return res.status(201).json({ team });
  } catch (err) {
    return next(err);
  }
}

export async function updateTeam(req, res, next) {
  try {
    const parsed = teamUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid team data.' });
    }
    if (parsed.data.branch) {
      try {
        parsed.data.branch = await requireActiveBranch(parsed.data.branch);
      } catch (err) {
        return res.status(err.status ?? 400).json({ message: err.message });
      }
    }
    const team = await Team.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    return res.status(200).json({ team });
  } catch (err) {
    return next(err);
  }
}

export async function setTeamMembers(req, res, next) {
  try {
    const parsed = teamMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid members data.' });
    }
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { members: parsed.data.members },
      { new: true, returnDocument: 'after', runValidators: true },
    ).populate('members.employee', 'firstName lastName empId designation');
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    return res.status(200).json({ team });
  } catch (err) {
    return next(err);
  }
}
