import { Certificate, CertRequest } from '../models/Certificate.js';
import { Drawing } from '../models/Drawing.js';
import { DrawingAck } from '../models/DrawingAck.js';
import { Project } from '../models/Project.js';
import { Rfi } from '../models/Rfi.js';
import { Revision } from '../models/Revision.js';
import { StageStatus } from '../models/StageStatus.js';
import { ackSchema, portalUsersSchema } from '../validation/phase4.schema.js';

async function portalProjects(userId) {
  return Project.find({ portalUsers: userId });
}

// External view: only the client's own project(s), no internal data (§4.16).
export async function myPortal(req, res, next) {
  try {
    const projects = await portalProjects(req.user.id);
    const ids = projects.map((p) => p._id);
    const [stages, revisions, rfis, drawings, acks, certs, requests] =
      await Promise.all([
        StageStatus.find({ project: { $in: ids } }),
        Revision.find({ project: { $in: ids } }).sort({ createdAt: -1 }).limit(100),
        Rfi.find({ project: { $in: ids }, status: 'Open' })
          .sort({ createdAt: -1 })
          .limit(100),
        Drawing.find({ project: { $in: ids } }).sort({ createdAt: -1 }).limit(200),
        DrawingAck.find({ by: req.user.id }),
        Certificate.find({ project: { $in: ids } }).sort({ createdAt: -1 }),
        CertRequest.find({ project: { $in: ids } }).sort({ createdAt: -1 }),
      ]);
    const acked = new Set(acks.map((a) => a.drawing.toString()));
    return res.status(200).json({
      projects: projects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        code: p.code,
        location: p.location?.label,
        projectType: p.projectType,
        startDate: p.startDate,
        expectedCompletion: p.expectedCompletion,
        description: p.description,
        scope: p.scope,
        completion: p.completion,
        currentStage: p.currentStage,
      })),
      stages,
      revisions,
      pendingRequests: rfis,
      drawings: drawings.map((d) => ({
        id: d._id.toString(),
        drawingNo: d.drawingNo,
        title: d.title,
        service: d.service,
        stage: d.stage,
        rev: d.rev,
        date: d.date,
        method: d.method,
        acknowledged: acked.has(d._id.toString()),
      })),
      certificates: certs,
      certRequests: requests,
    });
  } catch (err) {
    return next(err);
  }
}

export async function acknowledge(req, res, next) {
  const parsed = ackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const projects = await portalProjects(req.user.id);
    const ids = new Set(projects.map((p) => p._id.toString()));
    const drawing = await Drawing.findById(parsed.data.drawing);
    if (!drawing || !ids.has(drawing.project.toString())) {
      return res
        .status(403)
        .json({ message: 'This drawing is not in your project.' });
    }
    const ack = await DrawingAck.findOneAndUpdate(
      { drawing: drawing._id, by: req.user.id },
      { drawing: drawing._id, by: req.user.id, remarks: parsed.data.remarks },
      { upsert: true, new: true, returnDocument: 'after' },
    );
    return res.status(200).json({ item: ack });
  } catch (err) {
    return next(err);
  }
}

export async function uploadForRequest(req, res, next) {
  try {
    const projects = await portalProjects(req.user.id);
    const ids = new Set(projects.map((p) => p._id.toString()));
    const request = await CertRequest.findById(req.params.id);
    if (!request || !ids.has(request.project.toString())) {
      return res
        .status(403)
        .json({ message: 'This request is not in your project.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    request.status = 'Uploaded';
    await request.save();
    const cert = await Certificate.create({
      project: request.project,
      certType: request.category,
      status: 'Uploaded',
      file: req.file.filename,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: cert });
  } catch (err) {
    return next(err);
  }
}

export async function setPortalUsers(req, res, next) {
  const parsed = portalUsersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { portalUsers: parsed.data.userIds },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}
