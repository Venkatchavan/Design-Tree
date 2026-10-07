import { Claim } from '../models/Claim.js';
import { Discrepancy } from '../models/Discrepancy.js';
import { Meeting } from '../models/Meeting.js';
import { Payment } from '../models/Payment.js';
import { PeerReview } from '../models/PeerReview.js';
import { Project } from '../models/Project.js';
import { Revision } from '../models/Revision.js';
import { Rfi } from '../models/Rfi.js';
import { SiteVisit } from '../models/SiteVisit.js';
import { StageStatus } from '../models/StageStatus.js';
import { Transmittal } from '../models/Transmittal.js';

// Management & Leadership consolidated overview (§4.13). Review-only:
// every figure is computed live from the underlying collections.
export async function managementOverview(req, res, next) {
  try {
    const { branch, service, stage, project } = req.query;
    const projectFilter = {};
    if (branch) projectFilter.branch = branch;
    if (project) projectFilter._id = project;
    const projects = await Project.find(projectFilter, {
      branch: 1, status: 1, completion: 1, currentStage: 1, scope: 1,
    });
    const projectIds = new Set(projects.map((p) => p._id.toString()));

    const byStage = {};
    const byService = {};
    const byBranch = {};
    let active = 0, onHold = 0, completed = 0;
    for (const p of projects) {
      if (stage && p.currentStage !== stage) continue;
      if (p.status === 'Active') active += 1;
      else if (p.status === 'On Hold') onHold += 1;
      else if (p.status === 'Completed') completed += 1;
      byStage[p.currentStage] = (byStage[p.currentStage] ?? 0) + 1;
      byBranch[p.branch] = (byBranch[p.branch] ?? 0) + 1;
      for (const s of p.scope ?? []) {
        if (service && s.service !== service) continue;
        byService[s.service] = (byService[s.service] ?? 0) + 1;
      }
    }

    const [claims, payments, revisions, transmittals, visits, discrepancies, reviews, rfis, meetings] =
      await Promise.all([
        Claim.find({}).populate('project', 'branch'),
        Payment.find({}),
        Revision.find({}).populate('project', 'branch'),
        Transmittal.find({}).populate({ path: 'drawing', populate: { path: 'project', select: 'branch' } }),
        SiteVisit.find({}),
        Discrepancy.find({ status: 'Open' }),
        PeerReview.find({}),
        Rfi.find({}),
        Meeting.find({ status: 'Scheduled' }),
      ]);

    const scopeOk = (doc, getBranch) => {
      if (branch && getBranch(doc) !== branch) return false;
      return true;
    };
    const scopedClaims = claims.filter((c) => scopeOk(c, (x) => x.project?.branch));
    const invoiced = scopedClaims
      .filter((c) => ['Billed', 'Ready for billing'].includes(c.status))
      .reduce((s, c) => s + c.amount, 0);
    const received = payments.reduce((s, p) => s + p.amount, 0);
    const scopedRevisions = revisions.filter((r) => {
      if (!scopeOk(r, (x) => x.project?.branch)) return false;
      if (project && !projectIds.has(r.project?._id?.toString?.() ?? '')) return false;
      return true;
    });

    return res.status(200).json({
      projects: {
        active, onHold, completed,
        total: active + onHold + completed,
        byStage, byBranch, byService,
      },
      revisions: scopedRevisions.length,
      billing: {
        ready: scopedClaims.filter((c) => c.status === 'Ready for billing').length,
        pending: scopedClaims.filter((c) => c.status === 'Pending').length,
        invoiced, received,
      },
      transmittals: transmittals.filter((t) =>
        !branch || t.drawing?.project?.branch === branch,
      ).length,
      qaqc: {
        visits: visits.length,
        openDiscrepancies: discrepancies.length,
      },
      peerReview: {
        inProgress: reviews.filter((r) => r.status === 'In Progress').length,
        openComments: reviews.reduce(
          (s, r) => s + (r.comments ?? []).filter((c) => c.closureStatus === 'Open').length, 0,
        ),
      },
      rfis: {
        open: rfis.filter((r) => r.status === 'Open').length,
      },
      meetings: { scheduled: meetings.length },
      branch, service, stage, project: project ?? null,
    });
  } catch (err) {
    return next(err);
  }
}

// Department dashboard bundle (§4.26) for one service.
export async function departmentOverview(req, res, next) {
  try {
    const { service } = req.params;
    const [stages, drawings, revisions, transmittals, rfis] = await Promise.all([
      StageStatus.find({ service }).populate('project', 'name code branch').sort({ plannedCompletion: 1 }),
      (await import('../models/Drawing.js')).Drawing.find({ service })
        .populate('project', 'name code branch').sort({ createdAt: -1 }).limit(200),
      Revision.find({}).populate('project', 'name scope').limit(500),
      Transmittal.find({}).populate({
        path: 'drawing',
        populate: { path: 'project', select: 'name code' },
      }).limit(500),
      Rfi.find({}).limit(200),
    ]);
    const svcRevisions = revisions.filter((r) =>
      (r.project?.scope ?? []).some((s) => s.service === service),
    );
    const svcDrawings = new Set(drawings.map((d) => d._id.toString()));
    const svcTransmittals = transmittals.filter((t) =>
      svcDrawings.has(t.drawing?._id?.toString?.() ?? t.drawing?.toString?.()),
    );
    return res.status(200).json({
      service,
      stages,
      drawings,
      gfc: drawings.filter((d) => d.stage === 'GFC'),
      revisions: svcRevisions,
      awaiting: rfis.filter((r) => r.status === 'Open'),
      transmittals: svcTransmittals,
    });
  } catch (err) {
    return next(err);
  }
}
