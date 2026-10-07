import { Team } from '../models/Team.js';
import { WorkEntry } from '../models/WorkEntry.js';
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
    const me = await (await import('../models/User.js')).User.findById(
      req.user.id,
    );
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const teams = await Team.find({
      $or: [{ lead: me.employee }, { 'members.employee': me.employee }],
    })
      .populate('projects', 'name code branch currentStage status')
      .populate('members.employee', 'firstName lastName empId designation');
    return res.status(200).json({ items: teams, total: teams.length });
  } catch (err) {
    return next(err);
  }
}

export async function listTeams(req, res, next) {
  try {
    const { service } = req.query;
    const filter = {};
    if (service) filter.service = service;
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
    const team = await Team.findById(req.params.id)
      .populate('lead', 'firstName lastName empId designation')
      .populate('members.employee', 'firstName lastName empId designation branch department status');
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    const memberIds = team.members.map((m) => m.employee._id);
    const since = new Date(Date.now() - WEEK_MS);
    const [entries, pending] = await Promise.all([
      WorkEntry.find({ employee: { $in: memberIds }, date: { $gte: since } })
        .populate('project', 'name code')
        .populate('employee', 'firstName lastName empId')
        .sort({ date: -1 })
        .limit(100),
      WorkEntry.countDocuments({
        employee: { $in: memberIds },
        status: 'Pending',
      }),
    ]);
    return res.status(200).json({ team, weekEntries: entries, pending });
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
