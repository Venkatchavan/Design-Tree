import { StageStatus } from '../models/StageStatus.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Team } from '../models/Team.js';
import { SpocAllocation } from '../models/SpocAllocation.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { sendMail, mailLogLine } from '../services/mailer.js';
import { STAGE_FINAL_APPROVER_EMAILS } from '../config/stageApproval.js';
import { canReadProject } from '../utils/projectScope.js';
import { expandServices } from '../config/services.js';
import { directorTeams } from '../utils/directorTeams.js';
import { stageStatusSchema } from '../validation/phase3.schema.js';
import { STAGES, serviceKey, sameService, coversService, overlapsService, day, daysBetween, nextDay, stageMetrics, approved, currentStage } from '../utils/stageTimeline.js';
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
  const projectServices = [...(project.services ?? []), ...(project.scope ?? []).map(row => row.service)];
  const ptlServices = [
    ...(project.principalTeamLeads ?? []).filter(t => id(t.employee) === employee && t.approvalStatus !== 'Proposed').map(t => t.service),
    ...teams.filter(t => id(t.lead) === employee).map(t => t.service),
  ];
  // 05 Nov 2026: every Team Lead / Sr. TL / PTL who can open the project may enter
  // the start, expected and actual completion dates for the services of their own
  // department (a bundle tracker such as SMEPF counts when it includes their service),
  // not only the one named as the project's Team lead. A TL with no saved department
  // keeps only the named-lead authority above.
  let ownDepartment = '';
  if (user.role === 'team_lead' && employee) ownDepartment = (await Employee.findById(employee).select('department').lean())?.department ?? '';
  const ptl = user.role === 'team_lead' && !!employee && (coversService(ptlServices, service) || !!ownDepartment && overlapsService(ownDepartment, service));
  const spocServices = allocations.filter(a => id(a.coordinator) === employee)
    .flatMap(a => (a.services ?? []).length ? a.services : projectServices);
  const activatedSpoc = id(project.activation?.spoc) === employee;
  const spoc = user.role === 'coordinator' && !!employee &&
    (!project.activation?.spoc || activatedSpoc) &&
    (coversService(spocServices, service) || activatedSpoc && coversService(projectServices, service));
  let director = false;
  if (APPROVERS.includes(user.role)) {
    const owned = await directorTeams(user);
    director = coversService(owned.filter(t => t.projects.some(p => id(p) === id(project))).map(t => t.service), service);
  }
  return {
    plan: ptl || director,
    request: ptl,
    confirm: spoc,
    // 25 Nov 2026: PTL completes → assigned SPOC approves → the Design Management
    // Head (Santosh Kumar V R) gives the final approval, which makes the stage
    // Ready for billing and emails the billing department.
    approve: user.role === 'design_mgmt_head' || STAGE_FINAL_APPROVER_EMAILS.includes(String(user.email ?? (await User.findById(user.id).select('email').lean())?.email ?? '').trim().toLowerCase()),
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
    // 17 Nov 2026: each service of a bundle (MEP / MEPF / SMEPF) has its own
    // stage tracker. A tracker already saved under a bundle keeps its identity;
    // only the services it does not cover are added.
    // A single service keeps its saved label.
    if (components.length === 1) {
      if (!covered.includes(components[0])) map.set(serviceKey(service), service);
      continue;
    }
    for (const component of components.filter(s => !covered.includes(s))) map.set(serviceKey(component), component);
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
            progress: stage === current && permissions.request && row.confirmationStatus === 'None',
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
    if (coversService(owned.filter(t => t.projects.some(p => id(p) === id(project))).map(t => t.service), service)) users.push(id(director));
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
// 25 Nov 2026: the final approval is intimated to the billing department
// (every active Billing login) by email. With SMTP not configured the mail is
// recorded as queued in the stage history and the in-app notice still goes out.
async function billingEmail(project, service, doc, user) {
  const [billing, approver] = await Promise.all([
    User.find({ role: 'admin_billing', isActive: { $ne: false } }).select('email').lean(),
    User.findById(user.id).select('name email').lean(),
  ]);
  const what = `${project.name} · ${service} ${doc.stage} ready for billing`;
  const result = await sendMail({
    to: billing.map(u => u.email),
    cc: approver?.email ? [approver.email] : [],
    subject: `Ready for billing: ${project.jobNumber ? project.jobNumber + ' · ' : ''}${project.name} — ${service} ${doc.stage}`,
    text: [
      'Dear Billing team,',
      '',
      `The ${doc.stage} stage of ${service} for ${project.name}${project.jobNumber ? ` (${project.jobNumber})` : ''} has received the Design Management Head's final approval. Please proceed with billing.`,
      '',
      `Actual completion: ${day(doc.actualCompletion) || '—'}`,
      `Approved by: ${approver?.name || 'Design Management Head'}`,
      '',
      'This is an automated message from DesignTree MIS.',
    ].join('\n'),
  });
  const line = mailLogLine(result, what);
  await StageStatus.updateOne({ _id: doc._id }, { $push: { history: { by: user.id, at: new Date(), action: line } } });
  return { sent: result.sent, to: result.to, error: result.error };
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
    if (!access.plan && !access.confirm && !access.approve) return res.status(403).json({
      message: 'Only the assigned PTL, SPOC, Design Management Head or authorized TD/ATD can act.'
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
    const count = [data.planDates, data.requestCompletion, data.confirmCompletion, data.approveCompletion, data.billingReadiness, data.progressStatus].filter(Boolean).length;
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
    if (data.progressStatus) {
      if (!access.request) return res.status(403).json({
        message: 'Only the assigned PTL can set the stage progress.'
      });
      if (from !== 'None') return res.status(409).json({
        message: 'Stage has already been submitted.'
      });
      if (data.startDate || data.plannedCompletion || data.actualCompletion || data.reason) return res.status(400).json({
        message: 'Progress status cannot be combined with dates.'
      });
      patch = {
        ...patch,
        progressStatus: data.progressStatus,
        currentStatus: data.progressStatus
      };
      action = `PTL marked stage ${data.progressStatus.toLowerCase()}`;
    } else if (data.planDates) {
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
            message: 'Only the assigned SPOC can approve.'
          });
          if (from !== 'PTL Requested') return res.status(409).json({
            message: 'A PTL submission is required first.'
          });
          // 25 Nov 2026: the SPOC approves the PTL's submission as it stands — the
          // dates belong to the Sr TL / TL / PTL / ATD, so none are asked for here.
          // The stage then waits for the Design Management Head's final approval.
          patch = {
            ...patch,
            confirmationStatus: 'SPOC Confirmed',
            spocConfirmedBy: req.user.id,
            spocConfirmedAt: new Date(),
            spocRemark: data.spocRemark,
            currentStatus: 'Pending Design Management Head approval',
            billingReadiness: 'Pending'
          };
          action = 'SPOC approved completion';
        } else {
          if (!access.approve) return res.status(403).json({
            message: 'Only the Design Management Head gives the final approval.'
          });
          if (from !== 'SPOC Confirmed') return res.status(409).json({
            message: 'The SPOC must approve the stage before the final approval.'
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
          action = 'Design Management Head final approval — ready for billing';
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
    let billingMail = null;
    if (data.approveCompletion && doc.confirmationStatus === 'TD Approved') {
      try {
        billingMail = await billingEmail(project, service, doc, req.user);
      } catch {/* The approval stands even if mail fails. */}
    }
    const target = doc.confirmationStatus === 'TD Approved' && data.stage !== 'GFC' ? targetFor(service, [...serviceRows.filter(r => r.stage !== data.stage), doc], STAGES[STAGES.indexOf(data.stage) + 1]) : null;
    // Only someone who may plan dates (PTL / TD / ATD) is prompted to plan the next
    // stage (canPlan); the SPOC and the Design Management Head are never asked for dates.
    const nextStage = target ? { ...target, canPlan: !!access.plan } : null;
    return res.json({
      item: doc,
      nextStage,
      ...(billingMail ? { billingMail } : {})
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
