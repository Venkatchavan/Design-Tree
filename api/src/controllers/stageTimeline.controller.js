import { StageStatus } from '../models/StageStatus.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { SpocAllocation } from '../models/SpocAllocation.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { canReadProject } from '../utils/projectScope.js';
import { expandServices } from '../config/services.js';
import { directorTeams } from '../utils/directorTeams.js';
import { stageStatusSchema } from '../validation/phase3.schema.js';
import { STAGES, serviceKey, sameService, overlapsService, day, daysBetween, nextDay, stageMetrics, approved, currentStage } from '../utils/stageTimeline.js';
const APPROVERS = ['technical_director', 'assoc_technical_director'];
const id = value => String(value?._id ?? value ?? '');
async function assignments(user, project, service) {
  const me = await User.findById(user.id).select('employee').lean();
  const employee = id(me?.employee);
  const [teams, allocations] = await Promise.all([Team.find({
    projects: project._id,
    active: {
      $ne: false
    }
  }).lean(), SpocAllocation.find({
    project: project._id,
    status: 'Approved',
    active: {
      $ne: false
    }
  }).lean()]);
  const ptl = user.role === 'team_lead' && !!employee && ((project.principalTeamLeads ?? []).some(t => id(t.employee) === employee && t.approvalStatus !== 'Proposed' && overlapsService(t.service, service)) || teams.some(t => id(t.lead) === employee && overlapsService(t.service, service)));
  const spoc = user.role === 'coordinator' && !!employee && (!project.activation?.spoc || id(project.activation.spoc) === employee) && (allocations.some(a => id(a.coordinator) === employee && (!(a.services ?? []).length || a.services.some(s => overlapsService(s, service)))) || id(project.activation?.spoc) === employee && (project.services ?? []).some(s => overlapsService(s, service)));
  let approver = false;
  if (APPROVERS.includes(user.role)) {
    const owned = await directorTeams(user);
    approver = owned.some(t => t.projects.some(p => id(p) === id(project)) && overlapsService(t.service, service));
  }
  return {
    plan: ptl || approver,
    request: ptl,
    confirm: spoc,
    approve: approver,
    teams,
    allocations
  };
}
function servicesFor(project, rows) {
  const map = new Map();
  for (const service of rows.map(r => r.service).filter(Boolean)) if (!map.has(serviceKey(service))) map.set(serviceKey(service), service);
  for (const service of [...(project.services ?? []), ...(project.scope ?? []).map(s => s.service)].filter(Boolean)) {
    if (map.has(serviceKey(service))) continue;
    const components = expandServices([service]);
    const covered = [...map.values()].flatMap(s => expandServices([s]));
    // A legacy component tracker keeps its identity; expose only the rest of
    // its bundle, never a second bundle tracker covering the same component.
    if (components.some(s => covered.includes(s))) {
      for (const component of components.filter(s => !covered.includes(s))) map.set(serviceKey(component), component);
    } else map.set(serviceKey(service), service);
  }
  return [...map.values()];
}
function resolveService(project, rows, requested) {
  const available = servicesFor(project, rows),
    exact = available.find(s => sameService(s, requested));
  if (exact) return exact;
  const wanted = expandServices([requested]);
  // Resolve component labels to the single available project/persisted bundle.
  // If legacy component rows partition a bundle, that bundle is no longer an
  // alternate write identity; callers must choose a displayed component.
  const covering = available.find(service => wanted.every(s => expandServices([service]).includes(s)));
  if (covering) return covering;
  return null;
}
function targetFor(service, rows, stage) {
  const index = STAGES.indexOf(stage),
    previous = rows.find(r => r.stage === STAGES[index - 1]),
    saved = rows.find(r => r.stage === stage);
  return {
    service,
    stage,
    expectedVersion: saved?.__v ?? 0,
    startDate: saved?.startDate,
    plannedCompletion: saved?.plannedCompletion,
    baselineCompletion: saved?.baselineCompletion,
    previousStage: STAGES[index - 1] ?? null,
    previousActualCompletion: previous?.actualCompletion ?? null,
    defaultStartDate: previous?.actualCompletion ? nextDay(previous.actualCompletion) : null
  };
}
export async function stageTimeline(req, res, next) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.query.project ?? '')) return res.status(400).json({
      message: 'Choose a project.'
    });
    const project = await Project.findById(req.query.project).lean();
    if (!project) return res.status(404).json({
      message: 'Project not found.'
    });
    if (!(await canReadProject(req.user, project._id))) return res.status(403).json({
      message: 'Project is not assigned to you.'
    });
    const rows = await StageStatus.find({
      project: project._id
    }).lean();
    const items = [];
    const summaries = [];
    for (const service of servicesFor(project, rows)) {
      const serviceRows = rows.filter(r => sameService(r.service, service));
      const current = currentStage(serviceRows),
        permissions = await assignments(req.user, project, service);
      let onTime = 0,
        delayed = 0,
        netVariance = 0,
        baselineNetVariance = 0;
      for (const stage of STAGES) {
        const row = {
          service,
          stage,
          confirmationStatus: 'None',
          billingReadiness: 'Pending',
          __v: 0,
          ...serviceRows.find(r => r.stage === stage)
        };
        const metrics = stageMetrics(row);
        if (metrics.variance !== null) {
          if (metrics.variance > 0) delayed++;else onTime++;
          netVariance += metrics.variance;
        }
        if (metrics.baselineVariance !== null) baselineNetVariance += metrics.baselineVariance;
        items.push({
          ...row,
          metrics,
          isCurrent: stage === current,
          currentStage: current,
          permissions: {
            plan: stage === current && permissions.plan && !row.actualCompletion,
            request: stage === current && permissions.request && row.confirmationStatus === 'None',
            confirm: stage === current && permissions.confirm && row.confirmationStatus === 'PTL Requested',
            approve: stage === current && permissions.approve && row.confirmationStatus === 'SPOC Confirmed'
          },
          planningTarget: targetFor(service, serviceRows, stage)
        });
      }
      summaries.push({
        service,
        completed: serviceRows.filter(approved).length,
        total: 5,
        onTime,
        delayed,
        netVariance,
        baselineNetVariance,
        currentStage: current,
        currentStatus: items.find(r => sameService(r.service, service) && r.stage === current)?.metrics.label ?? 'Completed'
      });
    }
    return res.json({
      project: {
        _id: project._id,
        name: project.name
      },
      items,
      summaries
    });
  } catch (err) {
    return next(err);
  }
}
async function stageNotification(user, project, service, doc, access, action) {
  // Project-specific users prevent notifications leaking into unrelated role inboxes.
  const employeeIds = [project.activation?.spoc, ...access.allocations.filter(a => (!project.activation?.spoc || id(a.coordinator) === id(project.activation.spoc)) && (!(a.services ?? []).length || a.services.some(s => overlapsService(s, service)))).map(a => a.coordinator), ...(project.principalTeamLeads ?? []).filter(t => t.approvalStatus !== 'Proposed' && overlapsService(t.service, service)).map(t => t.employee), ...access.teams.filter(t => overlapsService(t.service, service)).flatMap(t => [t.lead, ...(t.members ?? []).map(m => m.employee)])];
  const users = await userIdsForEmployees(employeeIds);
  const directors = await User.find({
    role: {
      $in: APPROVERS
    }
  }).select('_id role').lean();
  for (const director of directors) {
    const owned = await directorTeams({
      id: id(director),
      role: director.role
    });
    if (owned.some(t => t.projects.some(p => id(p) === id(project)) && overlapsService(t.service, service))) users.push(id(director));
  }
  users.push(id(user.id));
  await notify({
    users: [...new Set(users)],
    roles: doc.confirmationStatus === 'TD Approved' ? ['admin_billing'] : [],
    project: project._id,
    link: {
      view: 'stage-timeline',
      id: id(project)
    },
    title: action,
    detail: `${service} ${doc.stage} — ${stageMetrics(doc).label}; ${doc.currentStatus ?? 'Dates saved'}`,
    type: 'stage-approval'
  });
}
export async function upsertStage(req, res, next) {
  const parsed = stageStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    message: 'Invalid stage data. Use real calendar dates and an expected version.'
  });
  try {
    const data = parsed.data;
    const project = await Project.findById(data.project).lean();
    if (!project) return res.status(404).json({
      message: 'Project not found.'
    });
    if (!(await canReadProject(req.user, project._id))) return res.status(403).json({
      message: 'Project is not assigned to you.'
    });
    const rows = await StageStatus.find({
      project: project._id
    }).lean();
    const service = resolveService(project, rows, data.service);
    if (!service) return res.status(403).json({
      message: 'Service is not assigned to this project.'
    });
    const access = await assignments(req.user, project, service);
    if (!access.plan && !access.confirm) return res.status(403).json({
      message: 'Only the assigned PTL, SPOC or authorized TD/ATD can act.'
    });
    const serviceRows = rows.filter(r => sameService(r.service, service));
    const old = serviceRows.find(r => r.stage === data.stage),
      from = old?.confirmationStatus ?? 'None';
    if (approved(old)) return res.status(409).json({
      message: 'An approved or billed stage cannot be changed.'
    });
    if ((old?.__v ?? 0) !== data.expectedVersion) return res.status(409).json({
      message: 'Stage changed; refresh before continuing.'
    });
    const count = [data.planDates, data.requestCompletion, data.confirmCompletion, data.approveCompletion, data.billingReadiness].filter(Boolean).length;
    if (count !== 1 || data.billingReadiness) return res.status(400).json({
      message: 'Choose one planning or approval action. Billing is recorded through an approved claim.'
    });
    const current = currentStage(serviceRows);
    if (data.stage !== current) return res.status(409).json({
      message: `Awaiting ${current ?? 'stage approval'}. Complete prior stages in this service first.`
    });
    const previous = serviceRows.find(r => r.stage === STAGES[STAGES.indexOf(data.stage) - 1]);
    let patch = {
        updatedBy: req.user.id
      },
      action;
    let revision;
    if (data.planDates) {
      if (!access.plan) return res.status(403).json({
        message: 'Only the assigned PTL or authorized TD/ATD can plan dates.'
      });
      if (old?.actualCompletion) return res.status(409).json({
        message: 'Submitted stage dates are locked.'
      });
      if (!data.startDate || !data.plannedCompletion) return res.status(400).json({
        message: 'Enter both the start date and the expected completion date.'
      });
      if (data.plannedCompletion < data.startDate) return res.status(400).json({
        message: 'Expected completion must be on or after the start date.'
      });
      if (previous?.actualCompletion && data.startDate < day(previous.actualCompletion)) return res.status(400).json({
        message: `Start date can’t be before ${previous.stage} was submitted (${day(previous.actualCompletion)}).`
      });
      const hasPlan = !!old?.baselineCompletion;
      if (hasPlan && !data.reason?.trim()) return res.status(400).json({
        message: 'Enter a reason for revising the plan.'
      });
      if (hasPlan && day(old.startDate) === data.startDate && day(old.plannedCompletion) === data.plannedCompletion) return res.status(400).json({
        message: 'Change the dates before saving a revision.'
      });
      patch = {
        ...patch,
        startDate: data.startDate,
        plannedCompletion: data.plannedCompletion,
        timelineManaged: true
      };
      if (!hasPlan) Object.assign(patch, {
        baselineStartDate: data.startDate,
        baselineCompletion: data.plannedCompletion
      });else revision = {
        previousStartDate: old.startDate,
        previousPlannedCompletion: old.plannedCompletion,
        startDate: data.startDate,
        plannedCompletion: data.plannedCompletion,
        reason: data.reason,
        by: req.user.id,
        at: new Date()
      };
      action = hasPlan ? 'Stage dates revised' : 'Stage dates saved';
    } else {
      if (data.startDate || data.plannedCompletion || data.reason) return res.status(400).json({
        message: 'Use the planning action to save dates.'
      });
      if (data.requestCompletion) {
        if (!access.request) return res.status(403).json({
          message: 'Only the assigned PTL can submit.'
        });
        if (from !== 'None') return res.status(409).json({
          message: 'Stage has already been submitted.'
        });
        if (!old?.startDate || !old.plannedCompletion) return res.status(400).json({
          message: 'Set start and expected completion dates before submitting.'
        });
        const actual = data.actualCompletion ?? day();
        if (actual > day()) return res.status(400).json({
          message: 'Submission date can’t be in the future.'
        });
        if (actual < day(old.startDate)) return res.status(400).json({
          message: `Submission date can’t be before the stage start (${day(old.startDate)}).`
        });
        patch = {
          ...patch,
          actualCompletion: actual,
          confirmationStatus: 'PTL Requested',
          ptlRequestedBy: req.user.id,
          ptlRequestedAt: new Date(),
          ptlRemark: data.ptlRemark,
          currentStatus: 'Pending SPOC approval',
          billingReadiness: 'Pending',
          timelineManaged: true,
          delayDays: Math.max(0, daysBetween(actual, old.plannedCompletion))
        };
        action = 'PTL requested completion';
      } else {
        if (data.actualCompletion) return res.status(400).json({
          message: 'Only PTL submission records the actual date.'
        });
        if (data.confirmCompletion) {
          if (!access.confirm) return res.status(403).json({
            message: 'Only the assigned SPOC can confirm.'
          });
          if (from !== 'PTL Requested') return res.status(409).json({
            message: 'A PTL submission is required first.'
          });
          if (!old.startDate || !old.plannedCompletion) return res.status(400).json({
            message: 'Set the stage dates before confirming this legacy submission.'
          });
          patch = {
            ...patch,
            confirmationStatus: 'SPOC Confirmed',
            spocConfirmedBy: req.user.id,
            spocConfirmedAt: new Date(),
            spocRemark: data.spocRemark,
            currentStatus: 'Pending TD approval'
          };
          action = 'SPOC confirmed completion';
        } else {
          if (!access.approve) return res.status(403).json({
            message: 'Only the authorized TD/ATD approves.'
          });
          if (from !== 'SPOC Confirmed') return res.status(409).json({
            message: 'Assigned SPOC confirmation is required first.'
          });
          if (!old.startDate || !old.plannedCompletion) return res.status(400).json({
            message: 'Set the stage dates before approving this legacy submission.'
          });
          patch = {
            ...patch,
            confirmationStatus: 'TD Approved',
            approvalSequenceVerified: true,
            tdApprovedBy: req.user.id,
            tdApprovedAt: new Date(),
            tdRemark: data.tdRemark,
            currentStatus: 'Completed',
            billingReadiness: 'Ready for billing'
          };
          action = req.user.role === 'technical_director' ? 'TD approved completion' : 'ATD approved completion';
        }
      }
    }
    const history = {
      by: req.user.id,
      at: new Date(),
      action
    };
    const doc = old ? await StageStatus.findOneAndUpdate({
      _id: old._id,
      ...(data.expectedVersion === 0 ? {
        $or: [{
          __v: 0
        }, {
          __v: {
            $exists: false
          }
        }]
      } : {
        __v: data.expectedVersion
      }),
      confirmationStatus: from === 'None' ? {
        $in: ['None', null]
      } : from,
      billingReadiness: {
        $ne: 'Billed'
      }
    }, {
      $set: patch,
      $inc: {
        __v: 1
      },
      $push: {
        history,
        ...(revision ? {
          planRevisions: revision
        } : {})
      }
    }, {
      returnDocument: 'after',
      runValidators: true
    }) : await StageStatus.create({
      project: project._id,
      service,
      stage: data.stage,
      __v: 1,
      ...patch,
      history: [history]
    });
    if (!doc) return res.status(409).json({
      message: 'Stage changed; refresh before continuing.'
    });
    try {
      await stageNotification(req.user, project, service, doc, access, action);
    } catch {/* A saved action survives notification transport failure. */}
    const nextStage = data.approveCompletion && data.stage !== 'GFC' ? targetFor(service, [...serviceRows.filter(r => r.stage !== data.stage), doc], STAGES[STAGES.indexOf(data.stage) + 1]) : null;
    return res.json({
      item: doc,
      nextStage
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({
      message: 'Stage changed; refresh before continuing.'
    });
    return next(err);
  }
}
export async function updateStage(req, res, next) {
  try {
    const doc = await StageStatus.findById(req.params.id);
    if (!doc) return res.status(404).json({
      message: 'Stage not found.'
    });
    if (['project', 'service', 'stage'].some(key => req.body[key] !== undefined && String(req.body[key]) !== String(doc[key]))) return res.status(400).json({
      message: 'Stage identity cannot change.'
    });
    req.body = {
      ...req.body,
      project: id(doc.project),
      service: doc.service,
      stage: doc.stage
    };
    return upsertStage(req, res, next);
  } catch (err) {
    return next(err);
  }
}
