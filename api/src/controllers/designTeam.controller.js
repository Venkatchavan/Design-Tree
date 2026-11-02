import { z } from 'zod';
import { Project } from '../models/Project.js';
import { SpocAllocation } from '../models/SpocAllocation.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { TravelRequest } from '../models/TravelRequest.js';
import { CoordinationItem } from '../models/CoordinationItem.js';
import { Rfi } from '../models/Rfi.js';
import { Revision } from '../models/Revision.js';
import { Meeting } from '../models/Meeting.js';
import { DesignWorkflow, WORKFLOW_STEPS } from '../models/DesignWorkflow.js';
import { DesignTeamEvent } from '../models/DesignTeamEvent.js';
import { DesignTeamClosure } from '../models/DesignTeamClosure.js';
import { Team } from '../models/Team.js';
import { designTeamScope, DESIGN_POLICY, DESIGN_STATUS, id, workingDays, loadPoints, projectCounts, band, dayOf, designStatus } from '../utils/designTeam.js';
import { istDayKey, istDayRangeUtc } from '../config/attendance.js';
const oid = z.string().regex(/^[a-f\d]{24}$/i),
  fail = (status, message) => Object.assign(new Error(message), {
    status
  });
const owners = ['Founding / Working Director', 'Coordinator (SPOC)', 'Coordinator (SPOC)', 'Technical Director', 'Coordinator (SPOC)', 'Coordinator (SPOC)', 'Principal Team Lead', 'Coordinator (SPOC)', 'Coordinator (SPOC)', 'Coordinator (SPOC)', 'Coordinator (SPOC)', 'Technical Director', 'Technical Director', 'Coordinator (SPOC)', 'Technical Director', 'Coordinator (SPOC)'];
function parse(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) throw fail(400, 'Invalid management update. Check the required fields.');
  return r.data;
}
export async function scopeGuard(req, res, next) {
  try {
    req.designScope = await designTeamScope(req.user);
    if (req.method !== 'GET' && !req.designScope.head) throw fail(403, 'Only the authorised Design Management head may change these records.');
    next();
  } catch (e) {
    next(e);
  }
}
function spocGuard(req, spoc) {
  if (!req.designScope.spocIds.includes(id(spoc))) throw fail(404, 'SPOC not found in your reporting line.');
}
async function allocationMap() {
  const rows = await SpocAllocation.find({
    status: 'Approved',
    active: {
      $ne: false
    }
  }).select('project coordinator').lean();
  const map = new Map();
  for (const r of rows) {
    const key = id(r.project);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(id(r.coordinator));
  }
  return map;
}
function currentSpoc(p, map) {
  if (p.activation?.spoc) return id(p.activation.spoc);
  const set = map.get(id(p));
  return set?.size === 1 ? [...set][0] : null;
}
function directorOwns(scope, p) {
  const owner = scope.resolve(p.related?.projectDirector);
  return scope.head && !!owner && scope.reporting.has(owner);
}
async function scopedProjects(req) {
  const scope = req.designScope,
    map = await allocationMap();
  const rows = await Project.find({
    origin: {
      $ne: 'marketing'
    }
  }).select('name jobNumber code clientName contacts related services scope currentStage status coordinationStatus hold complexity expectedCompletion activation __v updatedAt').lean();
  return rows.map(p => ({
    ...p,
    currentSpoc: currentSpoc(p, map),
    allocationAmbiguous: !p.activation?.spoc && (map.get(id(p))?.size ?? 0) > 1
  })).filter(p => scope.spocIds.includes(p.currentSpoc) || directorOwns(scope, p));
}
async function projectGuard(req, project, edit = false) {
  if (!oid.safeParse(project).success) throw fail(400, 'Invalid project.');
  const p = (await scopedProjects(req)).find(p => id(p) === project);
  if (!p || edit && !req.designScope.head) throw fail(404, 'Project not found in your management scope.');
  return p;
}
async function event(req, action, project, spocs, detail, extra = {}) {
  return DesignTeamEvent.create({
    action,
    project,
    spocs: [...new Set(spocs.filter(Boolean))],
    detail,
    actor: req.user.id,
    actorName: req.designScope.me.name,
    at: new Date(),
    ...extra
  });
}
async function feeds(projects) {
  const ids = projects.map(p => p._id);
  const [coord, rfis, revisions, meetings, closures] = await Promise.all([CoordinationItem.find({
    project: {
      $in: ids
    }
  }).lean(), Rfi.find({
    project: {
      $in: ids
    }
  }).lean(), Revision.find({
    project: {
      $in: ids
    }
  }).lean(), Meeting.find({
    project: {
      $in: ids
    },
    status: {
      $ne: 'Cancelled'
    }
  }).lean(), DesignTeamClosure.find({
    project: {
      $in: ids
    }
  }).lean()]);
  const closed = new Set(closures.map(c => c.source + ':' + c.record));
  const rows = [...coord.map(r => ({
    id: id(r),
    source: 'coordination',
    project: id(r.project),
    group: ['Client', 'Architect', 'PMC'].includes(r.channel) ? 'Client architect and PMC follow-ups' : 'Approvals and action items',
    item: r.topic,
    due: r.deadline,
    responsible: r.channel,
    closed: r.status === 'Resolved'
  })), ...rfis.map(r => ({
    id: id(r),
    source: 'rfi',
    project: id(r.project),
    group: 'RFIs and clarifications',
    item: r.description,
    due: r.due,
    responsible: r.assignedTo,
    closed: r.status === 'Closed'
  })), ...revisions.map(r => ({
    id: id(r),
    source: 'revision',
    project: id(r.project),
    group: 'Drawing submissions and revisions',
    item: r.details || r.drawing || 'Saved revision',
    due: r.dueDate,
    responsible: typeof r.assignedTo === 'string' ? r.assignedTo : 'Assigned project team',
    closed: r.status === 'Cleared'
  })), ...meetings.flatMap(m => (m.actions ?? []).map(a => ({
    id: id(m) + ':' + id(a),
    source: 'action',
    project: id(m.project),
    group: 'Approvals and action items',
    item: a.text,
    due: a.due,
    responsible: a.service,
    closed: a.status === 'Completed'
  })))];
  return {
    followups: rows.map(r => ({
      ...r,
      closed: r.closed || ['revision', 'action'].includes(r.source) && closed.has(r.source + ':' + r.id)
    })),
    meetings
  };
}
async function snapshot(req) {
  const scope = req.designScope,
    today = istDayKey(),
    holidays = await Holiday.find({}).select('date').lean(),
    days = workingDays(today, holidays.map(h => dayOf(h.date))),
    range = istDayRangeUtc(days[0]);
  const projects = await scopedProjects(req),
    employeeIds = scope.spocs.map(e => e._id);
  const [entries, last, leave, travel, activity] = await Promise.all([SpocEntry.find({
    employee: {
      $in: employeeIds
    },
    date: {
      $gte: range.start,
      $lt: istDayRangeUtc(days.at(-1)).end
    }
  }).populate('project', 'name jobNumber services currentStage').sort({
    date: -1,
    updatedAt: -1
  }).lean(), SpocEntry.aggregate([{
    $match: {
      employee: {
        $in: employeeIds
      }
    }
  }, {
    $group: {
      _id: '$employee',
      at: {
        $max: '$updatedAt'
      }
    }
  }]), LeaveRequest.find({
    employee: {
      $in: employeeIds
    },
    status: 'Approved',
    from: {
      $lt: istDayRangeUtc(days.at(-1)).end
    },
    to: {
      $gte: range.start
    }
  }).select('employee from to').lean(), TravelRequest.find({
    employee: {
      $in: employeeIds
    },
    status: 'Approved',
    departureDate: {
      $lt: istDayRangeUtc(days.at(-1)).end
    },
    returnDate: {
      $gte: range.start
    }
  }).select('employee departureDate returnDate').lean(), feeds(projects)]);
  const currentEntries = entries.filter(e => days.includes(dayOf(e.date))),
    latest = new Map(last.map(r => [id(r), r.at]));
  const people = scope.spocs.map(employee => {
    const own = projects.filter(p => p.currentSpoc === id(employee)),
      logs = currentEntries.filter(e => id(e.employee) === id(employee)),
      load = own.reduce((s, p) => s + loadPoints(p), 0);
    const daily = days.map(date => {
      const rows = logs.filter(e => dayOf(e.date) === date),
        hours = rows.reduce((s, e) => s + e.totalHours, 0),
        onLeave = leave.some(l => id(l.employee) === id(employee) && dayOf(l.from) <= date && dayOf(l.to) >= date),
        onTravel = travel.some(l => id(l.employee) === id(employee) && dayOf(l.departureDate) <= date && dayOf(l.returnDate) >= date),
        notEmployed = employee.dateOfJoining && dayOf(employee.dateOfJoining) > date;
      return {
        date,
        hours,
        saved: rows.length > 0,
        status: rows.length ? hours >= 8 ? 'Full day' : hours > 0 ? 'Short day' : '0 h logged' : notEmployed ? 'Not employed' : onLeave ? 'Approved leave' : onTravel ? 'Approved travel' : date === today ? 'Entry pending' : 'No entry',
        savedAt: rows.reduce((v, e) => !v || e.updatedAt > v ? e.updatedAt : v, null)
      };
    });
    return {
      employee,
      projects: own,
      counts: projectCounts(own),
      load,
      band: band(load),
      daily,
      totalHours: logs.reduce((s, e) => s + e.totalHours, 0),
      lastUpdate: latest.get(id(employee)) ?? null,
      pendingFollowups: activity.followups.filter(r => own.some(p => id(p) === r.project) && !r.closed).length
    };
  });
  const assigned = projects.filter(p => scope.spocIds.includes(p.currentSpoc)),
    counts = projectCounts(assigned),
    unassigned = projects.filter(p => !p.currentSpoc && !p.allocationAmbiguous && p.status !== 'Completed');
  return {
    canEdit: scope.head,
    asOf: new Date().toISOString(),
    policy: DESIGN_POLICY,
    today,
    days,
    spocs: people,
    projects,
    unassigned,
    entries: currentEntries,
    ...activity,
    summary: {
      spocs: people.length,
      assigned: assigned.length,
      active: counts.Active,
      delayed: counts.Delayed,
      awaiting: counts['Awaiting info'],
      ready: counts['Ready for billing'],
      withoutSpoc: unassigned.length,
      todayUpdated: people.filter(p => p.daily.some(d => d.date === today && d.saved)).length,
      hours: people.reduce((s, p) => s + p.totalHours, 0),
      todayWorking: days.includes(today)
    }
  };
}
export async function dashboard(req, res, next) {
  try {
    return res.json(await snapshot(req));
  } catch (e) {
    next(e);
  }
}
export async function spocDetail(req, res, next) {
  try {
    spocGuard(req, req.params.id);
    const data = await snapshot(req),
      person = data.spocs.find(s => id(s.employee) === req.params.id),
      projectIds = person.projects.map(id);
    const [events, dailyHistory] = await Promise.all([DesignTeamEvent.find({
      spocs: req.params.id
    }).sort({
      at: -1,
      _id: -1
    }).lean(), SpocEntry.find({
      employee: req.params.id
    }).select('project totalHours date createdBy updatedAt areas service').populate('project', 'name jobNumber').populate('createdBy', 'name').sort({
      updatedAt: -1,
      _id: -1
    }).lean()]);
    const activity = [...events.map(e => ({
      ...e,
      source: 'management'
    })), ...dailyHistory.map(e => ({
      _id: e._id,
      source: 'daily',
      action: 'SPOC daily work update saved',
      project: e.project?._id,
      actor: e.createdBy?._id,
      actorName: e.createdBy?.name || 'Actor not in records',
      at: e.updatedAt,
      detail: {
        date: e.date,
        project: e.project?.name || 'Project not in records',
        service: e.service,
        totalHours: e.totalHours,
        areas: e.areas
      }
    }))].sort((a, b) => new Date(b.at) - new Date(a.at) || id(b).localeCompare(id(a)));
    return res.json({
      ...person,
      canEdit: data.canEdit,
      asOf: data.asOf,
      policy: data.policy,
      days: data.days,
      today: data.today,
      entries: data.entries.filter(e => id(e.employee) === req.params.id),
      followups: data.followups.filter(e => projectIds.includes(e.project)),
      meetings: data.meetings.filter(e => projectIds.includes(id(e.project))),
      events,
      activity,
      remarks: events.filter(e => e.action === 'Remark added').map(e => ({
        ...e,
        text: e.detail.text
      })),
      allocations: events.filter(e => ['Project assigned', 'Project reassigned'].includes(e.action))
    });
  } catch (e) {
    next(e);
  }
}
export async function projectDetail(req, res, next) {
  try {
    let project,
      canManage = true;
    try {
      project = await projectGuard(req, req.params.id);
    } catch (e) {
      if (e.status !== 404 || !(await SpocEntry.exists({
        project: req.params.id,
        employee: {
          $in: req.designScope.spocs.map(s => s._id)
        }
      }))) throw e;
      project = await Project.findById(req.params.id).select('name jobNumber services currentStage status coordinationStatus complexity expectedCompletion').lean();
      if (!project) throw e;
      canManage = false;
    }
    const data = await snapshot(req),
      doc = canManage ? await DesignWorkflow.findOne({
        project: project._id
      }).lean() : null,
      events = await DesignTeamEvent.find({
        project: project._id,
        ...(!canManage ? {
          spocs: {
            $in: req.designScope.spocIds
          }
        } : {})
      }).sort({
        at: -1,
        _id: -1
      }).lean(),
      entries = data.entries.filter(e => id(e.project) === id(project));
    const teams = canManage ? await Team.find({
      projects: project._id,
      active: {
        $ne: false
      }
    }).select('name service lead').populate('lead', 'firstName lastName empId').lean() : [];
    const steps = WORKFLOW_STEPS.map((label, i) => ({
      ...((doc?.steps ?? []).find(s => s.n === i + 1) ?? {}),
      n: i + 1,
      label,
      owner: owners[i],
      status: (doc?.steps ?? []).find(s => s.n === i + 1)?.status ?? 'Not Started'
    }));
    return res.json({
      project,
      teams,
      asOf: data.asOf,
      canEdit: data.canEdit && canManage,
      loggedOutsideAllocation: !canManage,
      entries,
      hours: entries.reduce((s, e) => s + e.totalHours, 0),
      followups: canManage ? data.followups.filter(r => r.project === id(project)) : [],
      events,
      allocations: events.filter(e => ['Project assigned', 'Project reassigned'].includes(e.action)),
      workflow: {
        steps: canManage ? steps : [],
        updatedAt: doc?.updatedAt ?? null
      }
    });
  } catch (e) {
    next(e);
  }
}
export async function addRemark(req, res, next) {
  try {
    const b = parse(z.object({
      spoc: oid,
      text: z.string().trim().min(1).max(4000)
    }).strict(), req.body);
    spocGuard(req, b.spoc);
    return res.status(201).json({
      item: await event(req, 'Remark added', null, [b.spoc], {
        text: b.text
      })
    });
  } catch (e) {
    next(e);
  }
}
export async function assignProject(req, res, next) {
  try {
    const b = parse(z.object({
      spoc: oid,
      expectedSpoc: oid.nullable(),
      reason: z.string().trim().max(4000).optional()
    }).strict(), req.body);
    spocGuard(req, b.spoc);
    const p = await projectGuard(req, req.params.id, true);
    if (p.allocationAmbiguous) throw fail(409, 'Existing approved allocations are ambiguous. Reconcile them before assigning.');
    if (p.currentSpoc !== b.expectedSpoc || p.currentSpoc === b.spoc) throw fail(409, 'The current SPOC changed or is already selected. Refresh the project.');
    if (p.currentSpoc && !b.reason) throw fail(400, 'A reason is required for reassignment.');
    const match = {
      _id: p._id,
      __v: p.__v ?? {
        $exists: false
      },
      'activation.spoc': p.activation?.spoc ?? null
    };
    const updated = await Project.findOneAndUpdate(match, {
      $set: {
        'activation.spoc': b.spoc
      },
      $inc: {
        __v: 1
      }
    }, {
      returnDocument: 'after',
      runValidators: true
    });
    if (!updated) throw fail(409, 'The current SPOC changed while you were reviewing. Nothing was saved.');
    await event(req, p.currentSpoc ? 'Project reassigned' : 'Project assigned', p._id, [p.currentSpoc, b.spoc], {
      reason: b.reason ?? '',
      previous: p.currentSpoc,
      updated: b.spoc
    }, {
      fromSpoc: p.currentSpoc,
      toSpoc: b.spoc
    });
    await SpocAllocation.updateMany({
      project: p._id,
      coordinator: {
        $ne: b.spoc
      }
    }, {
      $set: {
        active: false
      }
    });
    await SpocAllocation.findOneAndUpdate({
      project: p._id,
      coordinator: b.spoc
    }, {
      $set: {
        status: 'Approved',
        active: true,
        services: p.services
      },
      $setOnInsert: {
        createdBy: req.user.id
      }
    }, {
      upsert: true,
      returnDocument: 'after',
      runValidators: true
    });
    return res.json({
      project: updated,
      message: p.currentSpoc ? 'Project reassigned.' : 'Project assigned.'
    });
  } catch (e) {
    next(e);
  }
}
export async function changeStatus(req, res, next) {
  try {
    const b = parse(z.object({
        status: z.enum(DESIGN_STATUS),
        reason: z.string().trim().max(4000).optional()
      }).strict(), req.body),
      p = await projectGuard(req, req.params.id, true);
    if (b.status === 'On Hold' && !b.reason) throw fail(400, 'Provide a reason for placing the project on hold.');
    const patch = {
      status: ['Delayed', 'Awaiting info', 'Ready for billing'].includes(b.status) ? 'Active' : b.status,
      coordinationStatus: b.status,
      'hold.reason': b.reason ?? '',
      'hold.updatedBy': req.user.id,
      'hold.updatedAt': new Date()
    };
    const saved = await Project.findOneAndUpdate({
      _id: p._id,
      __v: p.__v ?? {
        $exists: false
      }
    }, {
      $set: patch,
      $inc: {
        __v: 1
      },
      $push: {
        'hold.history': {
          from: p.status,
          to: b.status,
          reason: b.reason ?? '',
          by: req.user.id,
          at: new Date()
        }
      }
    }, {
      runValidators: true,
      returnDocument: 'after'
    });
    if (!saved) throw fail(409, 'The project changed. Refresh before changing its status.');
    await event(req, 'Project status changed', p._id, [p.currentSpoc], {
      previous: designStatus(p),
      updated: b.status,
      reason: b.reason ?? ''
    });
    return res.json({
      message: 'Project status updated.'
    });
  } catch (e) {
    next(e);
  }
}
export async function closeFollowup(req, res, next) {
  try {
    parse(z.object({
      closed: z.literal(true)
    }).strict(), req.body);
    const data = await snapshot(req),
      item = data.followups.find(r => r.source === req.params.source && r.id === req.params.id);
    if (!item) throw fail(404, 'Follow-up not found.');
    if (item.closed) return res.json({
      message: 'Follow-up is already closed.'
    });
    const p = await projectGuard(req, item.project, true);
    if (['revision', 'action'].includes(item.source)) {
      try {
        await DesignTeamClosure.create({
          source: item.source,
          record: item.id,
          project: p._id,
          by: req.user.id
        });
      } catch (e) {
        if (e.code === 11000) return res.json({
          message: 'Follow-up is already closed.'
        });
        throw e;
      }
    } else {
      const Model = item.source === 'coordination' ? CoordinationItem : Rfi,
        status = item.source === 'coordination' ? 'Resolved' : 'Closed';
      const changed = await Model.findOneAndUpdate({
        _id: item.id,
        status: {
          $ne: status
        }
      }, {
        $set: {
          status
        }
      }, {
        runValidators: true,
        returnDocument: 'after'
      });
      if (!changed) return res.json({
        message: 'Follow-up is already closed.'
      });
    }
    await event(req, 'Follow-up closed', p._id, [p.currentSpoc], {
      source: item.source,
      record: item.id,
      item: item.item
    });
    return res.json({
      message: 'Coordination follow-up closed. Source approval/completion policies are retained.'
    });
  } catch (e) {
    next(e);
  }
}
export async function circulateMom(req, res, next) {
  try {
    if (!oid.safeParse(req.params.id).success) throw fail(400, 'Invalid meeting.');
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) throw fail(404, 'Meeting not found.');
    const p = await projectGuard(req, id(meeting.project), true);
    if (meeting.status !== 'Held' || meeting.date > new Date()) throw fail(400, 'Only a past held meeting can have its MOM marked circulated.');
    if (meeting.momCirculatedAt) return res.json({
      message: 'MOM already circulated.'
    });
    const saved = await Meeting.findOneAndUpdate({
      _id: meeting._id,
      momCirculatedAt: null
    }, {
      $set: {
        momCirculatedAt: new Date(),
        momCirculatedBy: req.user.id
      }
    }, {
      returnDocument: 'after'
    });
    if (saved) await event(req, 'MOM marked circulated', p._id, [p.currentSpoc], {
      meeting: id(meeting),
      title: meeting.title
    });
    return res.json({
      message: 'MOM marked circulated.'
    });
  } catch (e) {
    next(e);
  }
}
export async function changeWorkflow(req, res, next) {
  try {
    const b = parse(z.object({
        n: z.number().int().min(1).max(16),
        status: z.enum(['Not Started', 'In Progress', 'Completed']),
        remarks: z.string().trim().max(4000)
      }).strict(), req.body),
      p = await projectGuard(req, req.params.id, true),
      old = await DesignWorkflow.findOne({
        project: p._id
      }).lean();
    const step = {
        ...b,
        date: new Date(),
        updatedBy: req.user.id
      },
      steps = Array.from({
        length: 16
      }, (_, i) => i + 1 === b.n ? step : (old?.steps ?? []).find(s => s.n === i + 1) ?? {
        n: i + 1,
        status: 'Not Started'
      });
    const doc = old ? await DesignWorkflow.findOneAndUpdate({
      _id: old._id,
      __v: old.__v
    }, {
      $set: {
        steps
      },
      $inc: {
        __v: 1
      }
    }, {
      returnDocument: 'after',
      runValidators: true
    }) : await DesignWorkflow.create({
      project: p._id,
      steps
    });
    if (!doc) throw fail(409, 'The workflow changed. Refresh before saving.');
    await event(req, 'Workflow step changed', p._id, [p.currentSpoc], {
      n: b.n,
      previous: (old?.steps ?? []).find(s => s.n === b.n) ?? null,
      updated: step
    });
    return res.json({
      message: 'Workflow step saved.'
    });
  } catch (e) {
    if (e.code === 11000) e = fail(409, 'The workflow changed. Refresh before saving.');
    next(e);
  }
}
