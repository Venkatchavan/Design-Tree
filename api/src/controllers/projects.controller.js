import {
  PROJECT_STATUSES,
  Project,
  SERVICES,
  STAGES,
} from '../models/Project.js';
import {
  activateProjectSchema,
  finalApprovalSchema,
  projectSchema,
  projectUpdateSchema,
  spocContactsSchema,
  teamConfirmationSchema,
  teamLeadsSchema,
} from '../validation/project.schema.js';
import { requireActiveBranch } from '../utils/branches.js';

// Only Admin/Billing may create/import projects (FD/WD superusers bypass via requireRole §3.4).
const CREATOR_ROLES = ['admin_billing'];

export { CREATOR_ROLES };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Admin-only sequential identifiers for the New Project form, initialized
// above the highest existing value for the year so collisions are avoided.
async function nextSequence(name, usedCodes) {
  let max = 0;
  for (const code of usedCodes) {
    const m = /-(\d+)$/.exec(String(code ?? ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const { Counter } = await import('../models/Counter.js');
  await Counter.findOneAndUpdate(
    { name },
    { $max: { seq: max } },
    { upsert: true },
  );
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, returnDocument: 'after' },
  );
  return doc.seq;
}

export async function nextProjectCode(_req, res, next) {
  try {
    const year = new Date().getFullYear();
    const existing = await Project.find({ code: new RegExp(`^PRJ-${year}-\\d+$`) }).select('code').lean();
    const seq = await nextSequence(`project-code-${year}`, existing.map((p) => p.code));
    return res.status(200).json({ code: `PRJ-${year}-${String(seq).padStart(3, '0')}` });
  } catch (err) {
    return next(err);
  }
}

export async function nextJobNumber(_req, res, next) {
  try {
    const year = new Date().getFullYear();
    const existing = await Project.find({ jobNumber: new RegExp(`^WO/${year}/\\d+$`) }).select('jobNumber').lean();
    const seq = await nextSequence(`job-number-${year}`, existing.map((p) => p.jobNumber));
    return res.status(200).json({ jobNumber: `WO/${year}/${String(seq).padStart(4, '0')}` });
  } catch (err) {
    return next(err);
  }
}

export async function listProjects(req, res, next) {
  try {
    const { branch, service, stage, status, search } = req.query;
    const filter = {};
    if (branch) filter.branch = branch;
    if (stage) filter.currentStage = stage;
    if (status) filter.status = status;
    if (service) filter['scope.service'] = service;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { clientName: rx }];
    }
    const [items, total] = await Promise.all([
      Project.find(filter).sort({ updatedAt: -1 }).limit(200),
      Project.countDocuments(filter),
    ]);
    return res.status(200).json({ items, total });
  } catch (err) {
    return next(err);
  }
}

export async function projectStats(_req, res, next) {
  try {
    const projects = await Project.find(
      {},
      { status: 1, completion: 1, branch: 1, currentStage: 1, scope: 1 },
    );
    const counts = { active: 0, completed: 0, onHold: 0 };
    const byBranch = new Map();
    const byStage = new Map();
    const byService = new Map();
    for (const p of projects) {
      if (p.status === 'Active') counts.active += 1;
      else if (p.status === 'Completed') counts.completed += 1;
      else if (p.status === 'On Hold') counts.onHold += 1;
      const b = byBranch.get(p.branch) ?? { projects: 0, completionSum: 0 };
      b.projects += 1;
      b.completionSum += p.completion ?? 0;
      byBranch.set(p.branch, b);
      byStage.set(p.currentStage, (byStage.get(p.currentStage) ?? 0) + 1);
      for (const s of p.scope ?? []) {
        if (s.service) byService.set(s.service, (byService.get(s.service) ?? 0) + 1);
      }
    }
    return res.status(200).json({
      counts,
      branches: [...byBranch.entries()].map(([branch, v]) => ({
        branch,
        projects: v.projects,
        avgCompletion:
          v.projects === 0 ? 0 : Math.round(v.completionSum / v.projects),
      })),
      byStage: [...byStage.entries()].map(([stage, count]) => ({
        stage,
        count,
      })),
      services: [...byService.entries()].map(([service, projects]) => ({
        service,
        projects,
      })),
      totals: { projects: projects.length, branches: byBranch.size },
    });
  } catch (err) {
    return next(err);
  }
}

export async function projectFilters(_req, res, next) {
  try {
    const [branches, statuses] = await Promise.all([
      Project.distinct('branch'),
      Project.distinct('status'),
    ]);
    const { branchOptionsWithLegacy } = await import('../utils/branches.js');
    return res.status(200).json({
      branches: await branchOptionsWithLegacy(branches),
      services: SERVICES,
      stages: STAGES,
      statuses: statuses.length > 0 ? statuses.sort() : PROJECT_STATUSES,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// SPOC Meetings §7 / decision 2A: team members come from Teams linked to
// the project. Empty list yields an empty-state on the client.
export async function getProjectTeam(req, res, next) {
  try {
    const { projectTeamBundle } = await import('../utils/meetingTeam.js');
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const bundle = await projectTeamBundle(project);
    return res.status(200).json({
      project: {
        _id: project._id,
        name: project.name,
        code: project.code,
        clientName: project.clientName ?? project.contacts?.client?.company ?? '',
        scope: project.scope ?? [],
      },
      committedServices: bundle.committed,
      responsible: bundle.responsible,
      members: bundle.members.map((m) => ({
        employee: m.employee,
        service: m.service,
        team: m.team,
      })),
      allocations: (bundle.allocations ?? []).map((a) => ({
        coordinator: a.coordinator,
        services: a.services ?? [],
        status: a.status,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

function validationIssues(error) {
  return (error?.issues ?? []).map((i) => ({
    path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
    message: i.message,
    code: i.code,
  }));
}

export async function createProject(req, res, next) {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid project data.', issues: validationIssues(parsed.error) });
    }
    try {
      parsed.data.branch = await requireActiveBranch(parsed.data.branch);
    } catch (err) {
      return res.status(err.status ?? 400).json({ message: err.message });
    }
    const activationStatus = parsed.data.activation?.status ?? 'Pending';
    const project = await Project.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      activation: {
        ...(parsed.data.activation ?? {}),
        status: activationStatus,
        ...(activationStatus === 'Activated'
          ? { activatedBy: req.user.id, activatedAt: new Date() }
          : {}),
      },
    });
    // Best-effort post-creation wiring: seed the 16-step design workflow
    // so the Design Management Head has something to open, and notify the
    // DMH + Technical Directors that a new project needs review.
    try {
      const { DesignWorkflow } = await import('../models/DesignWorkflow.js');
      await DesignWorkflow.findOneAndUpdate(
        { project: project._id },
        { $setOnInsert: { project: project._id, steps: [], matrix: [] } },
        { upsert: true },
      );
      const { notify } = await import('../models/Notification.js');
      await notify({
        roles: ['design_mgmt_head', 'technical_director'],
        project: project._id,
        link: { view: 'design-mgmt', id: project._id.toString() },
        title: `New project: ${project.name} (${project.code})`,
        detail: 'Review scope & requirements and identify required disciplines.',
        type: 'project-created',
      });
    } catch {
      /* creation itself succeeded — wiring is best-effort */
    }
    return res.status(201).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const parsed = projectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid project data.', issues: validationIssues(parsed.error) });
    }
    if (parsed.data.branch !== undefined) {
      try {
        parsed.data.branch = await requireActiveBranch(parsed.data.branch);
      } catch (err) {
        return res.status(err.status ?? 400).json({ message: err.message });
      }
    }
    if (parsed.data.code) parsed.data.code = parsed.data.code.toUpperCase();
    const project = await Project.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}

// PUT /api/projects/:id/spoc-contacts — SPOC-owned PMC / Peer Review
// contacts (admin does not know these; no link with directory sections).
export async function saveSpocContacts(req, res, next) {
  try {
    const parsed = spocContactsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid contacts data.', issues: validationIssues(parsed.error) });
    }
    if (parsed.data.pmc === undefined && parsed.data.peerReview === undefined) {
      return res.status(400).json({ message: 'Provide pmc and/or peerReview.' });
    }
    const set = {};
    if (parsed.data.pmc !== undefined) set['contacts.pmc'] = parsed.data.pmc;
    if (parsed.data.peerReview !== undefined) set['contacts.peerReview'] = parsed.data.peerReview;
    const project = await Project.findByIdAndUpdate(req.params.id, { $set: set }, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    try {
      const { notify } = await import('../models/Notification.js');
      const saved = [
        parsed.data.pmc !== undefined ? 'PMC' : '',
        parsed.data.peerReview !== undefined ? 'Peer Review' : '',
      ].filter(Boolean).join(' + ');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Contacts updated: ${project.name} (${project.code})`,
        detail: `SPOC saved ${saved} contact details.`,
        type: 'spoc-contacts',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// PUT /api/projects/:id/team-leads — SPOC-owned principal team leads
// (+ optional related director/head). Admin side is display-only.
export async function saveTeamLeads(req, res, next) {
  try {
    const parsed = teamLeadsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid team leads data.', issues: validationIssues(parsed.error) });
    }
    const set = {};
    if (parsed.data.principalTeamLeads !== undefined) {
      set.principalTeamLeads = parsed.data.principalTeamLeads
        .filter((t) => (t.service ?? '').trim() || (t.name ?? '').trim())
        .map((t) => ({ service: (t.service ?? '').trim(), name: (t.name ?? '').trim() }));
    }
    for (const k of [
      'projectDirector',
      'projectDirectorDesignation',
      'projectHead',
      'projectHeadDesignation',
    ]) {
      const v = parsed.data.related?.[k];
      if (v !== undefined) set[`related.${k}`] = v;
    }
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: 'Provide principalTeamLeads and/or related.' });
    }
    const project = await Project.findByIdAndUpdate(req.params.id, { $set: set }, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    try {
      const { notify } = await import('../models/Notification.js');
      const names = (project.principalTeamLeads ?? [])
        .map((t) => t?.name)
        .filter(Boolean)
        .join(', ');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Team leads: ${project.name} (${project.code})`,
        detail: names ? `SPOC set team leads: ${names}.` : 'SPOC updated the project team.',
        type: 'team-leads',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// POST /api/projects/:id/activate — Admin activates the project and assigns
// the confirmed SPOC. Idempotent: re-activation re-confirms/assigns.
export async function activateProject(req, res, next) {
  try {
    const parsed = activateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid activation data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    let allocation = null;
    if (parsed.data.coordinator) {
      const { Employee } = await import('../models/Employee.js');
      const coordinator = await Employee.findById(parsed.data.coordinator);
      if (!coordinator) {
        return res.status(400).json({ message: 'Coordinator not found.' });
      }
      const { SpocAllocation } = await import('../models/SpocAllocation.js');
      allocation = await SpocAllocation.findOneAndUpdate(
        { project: project._id, coordinator: coordinator._id },
        {
          project: project._id,
          coordinator: coordinator._id,
          services: parsed.data.services ?? [],
          status: 'Approved',
          createdBy: req.user.id,
        },
        { upsert: true, new: true, returnDocument: 'after', runValidators: true },
      );
    }

    project.status = 'Active';
    project.activation = {
      ...(project.activation?.toObject?.() ?? project.activation ?? {}),
      status: 'Activated',
      activatedBy: req.user.id,
      activatedAt: new Date(),
      spoc: parsed.data.coordinator ?? project.activation?.spoc,
    };
    await project.save();

    try {
      const { notify, userIdsForEmployees } = await import('../models/Notification.js');
      const users = parsed.data.coordinator
        ? await userIdsForEmployees([parsed.data.coordinator])
        : [];
      await notify({
        roles: ['design_mgmt_head', 'coordinator'],
        users,
        project: project._id,
        link: { view: 'my-coordination', id: project._id.toString() },
        title: `Project activated: ${project.name} (${project.code})`,
        detail: 'SPOC workspace is live.',
        type: 'project-activated',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project, allocation });
  } catch (err) {
    return next(err);
  }
}

// PUT /api/projects/:id/team-confirmation — DMH confirms discipline teams
// and optionally shares the details back to Admin.
export async function saveTeamConfirmation(req, res, next) {
  try {
    const parsed = teamConfirmationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid team data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const current = project.teamConfirmation?.toObject?.() ?? {};
    const status = parsed.data.status ?? current.status ?? 'Pending';
    const disciplines = parsed.data.disciplines ?? current.disciplines ?? [];
    if (parsed.data.sharedToAdmin && (status !== 'Confirmed' || disciplines.length === 0)) {
      return res.status(400).json({ message: 'Confirm the team with at least one discipline before sharing to Admin.' });
    }
    project.teamConfirmation = {
      ...current,
      status,
      disciplines,
    };
    if (status === 'Confirmed' && !current.confirmedAt) {
      project.teamConfirmation.confirmedBy = req.user.id;
      project.teamConfirmation.confirmedAt = new Date();
    }
    if (parsed.data.sharedToAdmin) {
      project.teamConfirmation.sharedToAdminAt = new Date();
    }
    await project.save();

    if (parsed.data.sharedToAdmin) {
      try {
        const { notify } = await import('../models/Notification.js');
        await notify({
          roles: ['admin_billing'],
          project: project._id,
          link: { view: 'dashboard', id: project._id.toString() },
          title: `Team confirmed: ${project.name} (${project.code})`,
          detail: 'Design Management Head shared the confirmed project team.',
          type: 'team-confirmed',
        });
      } catch {
        /* best-effort */
      }
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// POST /api/projects/:id/final-approval — director sign-off before GFC.
export async function recordFinalApproval(req, res, next) {
  try {
    const parsed = finalApprovalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid approval data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    project.finalApproval = {
      ...(project.finalApproval?.toObject?.() ?? {}),
      status: 'Approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      remarks: parsed.data.remarks,
    };
    await project.save();
    try {
      const { notify } = await import('../models/Notification.js');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Final approval: ${project.name} (${project.code})`,
        detail: 'Approved for GFC submission.',
        type: 'final-approval',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// GET /api/projects/:id/gfc-readiness — checklist across deliverables,
// revisions, peer reviews, RFIs, QS/BOQ before final approval + GFC issue.
export async function gfcReadiness(req, res, next) {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const pid = project._id;
    const [
      { Deliverable },
      { Revision },
      { PeerReview },
      { Rfi },
      { AreaSettlement },
      { BoqItem },
      { Drawing },
      { Transmittal },
    ] = await Promise.all([
      import('../models/Deliverable.js'),
      import('../models/Revision.js'),
      import('../models/PeerReview.js'),
      import('../models/Rfi.js'),
      import('../models/AreaSettlement.js'),
      import('../models/BoqItem.js'),
      import('../models/Drawing.js'),
      import('../models/Transmittal.js'),
    ]);
    const gfcDrawingIds = await Drawing.find({ project: pid, stage: 'GFC' }).distinct('_id');
    const [
      deliverablesOpen,
      revisionsOpen,
      peerOpen,
      peerCommentsOpen,
      rfisOpen,
      areaPending,
      boqPending,
      gfcTransmittals,
    ] = await Promise.all([
      Deliverable.countDocuments({ project: pid, status: { $ne: 'Approved' } }),
      Revision.countDocuments({ project: pid, status: { $ne: 'Cleared' } }),
      PeerReview.countDocuments({ project: pid, status: { $ne: 'Approved for Issue' } }),
      PeerReview.aggregate([
        { $match: { project: pid } },
        { $unwind: '$comments' },
        { $match: { 'comments.closureStatus': 'Open' } },
        { $count: 'n' },
      ]).then((r) => r[0]?.n ?? 0),
      Rfi.countDocuments({ project: pid, status: 'Open' }),
      AreaSettlement.countDocuments({ project: pid, status: 'Pending' }),
      BoqItem.countDocuments({ project: pid, status: { $ne: 'Approved' } }),
      // Transmittals reference drawings (no project field): count
      // Sent/Acknowledged transmittals over this project's GFC drawings.
      Transmittal.countDocuments({
        drawing: { $in: gfcDrawingIds },
        status: { $in: ['Sent', 'Acknowledged'] },
      }),
    ]);
    const checks = [
      { key: 'deliverables', label: 'Deliverables approved', open: deliverablesOpen, blocking: true },
      { key: 'revisions', label: 'Revisions cleared', open: revisionsOpen, blocking: true },
      { key: 'peer-review', label: 'Peer reviews approved for issue', open: peerOpen, blocking: true },
      { key: 'peer-comments', label: 'Peer review comments closed', open: peerCommentsOpen, blocking: true },
      { key: 'rfis', label: 'RFIs closed', open: rfisOpen, blocking: true },
      { key: 'area-settlement', label: 'Area settlements reviewed', open: areaPending, blocking: true },
      { key: 'boq', label: 'BOQ items approved', open: boqPending, blocking: true },
      { key: 'gfc-transmittal', label: 'GFC transmittals sent', open: 0, count: gfcTransmittals, blocking: false },
    ];
    const ready = checks.filter((c) => c.blocking).every((c) => c.open === 0);
    return res.status(200).json({
      project: { _id: project._id, name: project.name, code: project.code },
      finalApproval: project.finalApproval ?? { status: 'Pending' },
      checks,
      ready,
    });
  } catch (err) {
    return next(err);
  }
}
