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
  teamConfirmationSchema,
} from '../validation/project.schema.js';

const CREATOR_ROLES = [
  'admin_billing',
  'executive_director',
  'associate_director',
  'technical_director',
];

export { CREATOR_ROLES };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function paceOnTrack(p) {
  if (!p.startDate || !p.expectedCompletion) return true;
  const total = p.expectedCompletion - p.startDate;
  if (total <= 0) return true;
  const elapsed = Date.now() - p.startDate;
  const expected = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return (p.completion ?? 0) >= expected - 5;
}

export async function projectStats(_req, res, next) {
  try {
    const projects = await Project.find(
      {},
      { status: 1, completion: 1, branch: 1, currentStage: 1, scope: 1, startDate: 1, expectedCompletion: 1 },
    );
    const counts = { active: 0, onTrack: 0, completed: 0, onHold: 0, other: 0 };
    const byBranch = new Map();
    const byStage = new Map();
    const byService = new Map();
    for (const p of projects) {
      if (p.status === 'Active') {
        counts.active += 1;
        if (paceOnTrack(p)) counts.onTrack += 1;
      } else if (p.status === 'Completed') counts.completed += 1;
      else if (p.status === 'On Hold') counts.onHold += 1;
      else counts.other += 1;
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
    return res.status(200).json({
      branches: branches.filter(Boolean).sort(),
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

export async function createProject(req, res, next) {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid project data.' });
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
      return res.status(400).json({ message: 'Invalid project data.' });
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
