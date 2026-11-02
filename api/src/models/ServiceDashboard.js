import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

// Per-project team and status figures for the BIM and GBS workspaces.
export const DASHBOARD_SERVICES = ['BIM', 'GBS', 'STR', 'ELE', 'HVAC', 'PHE', 'FIRE', 'QS', 'QAQC'];

const areaRevisionSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    date: { type: Date },
    reason: { type: String, trim: true },
    preparedBy: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    document: { type: String, trim: true },
    _id: false,
  },
);

const serviceDashboardSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    service: { type: String, enum: DASHBOARD_SERVICES, required: true },
    technicalDirector: { type: String, trim: true },
    modelers: { type: Number, min: 0 },
    teamMembers: { type: Number, min: 0 },
    coordinators: { type: Number, min: 0 },
    modelVersion: { type: String, trim: true },
    lod: { type: String, trim: true },
    lastClashRun: { type: Date },
    clashesFound: { type: Number, min: 0 },
    clashesResolved: { type: Number, min: 0 },
    designers: { type: Number, min: 0 },
    drafters: { type: Number, min: 0 },
    auditors: { type: Number, min: 0 },
    reviewers: { type: Number, min: 0 },
    scopeStatus: { type: String, trim: true },
    scopeStartDate: { type: Date },
    scopeCompletedDate: { type: Date },
    milestoneLabel: { type: String, trim: true },
    milestoneValue: { type: String, trim: true },
    boqBuiltUpArea: { type: Number, min: 0 },
    boqEnteredBy: { type: String, trim: true },
    boqEnteredOn: { type: Date },
    workOrderQuotedArea: { type: Number, min: 0 },
    initialArea: { type: Number, min: 0 },
    revisedArea: { type: Number, min: 0 },
    revisedAreaLabel: { type: String, trim: true },
    areaFinal: { type: String, trim: true },
    areaAlertSentOn: { type: Date },
    areaRevisions: [areaRevisionSchema],
  },
  { timestamps: true },
);

serviceDashboardSchema.index({ project: 1, service: 1 }, { unique: true });

export const ServiceDashboard =
  mongoose.models.ServiceDashboard ??
  mongoose.model('ServiceDashboard', auditProjectSchema(serviceDashboardSchema));
