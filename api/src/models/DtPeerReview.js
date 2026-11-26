import mongoose from 'mongoose';
import { auditProjectSchema } from '../utils/projectAudit.js';

// DT Peer Review (3 Nov 2026): the DesignTree Structural Peer Review package
// for one project — allotted review team, seven review stages, master checklist,
// approval gate and round-by-round comment log. The per-project PeerReview
// records (project Peer Review column) are separate and unchanged.

export const DT_PR_STAGES = [
  { code: 'S1', name: 'Design Input Review' },
  { code: 'S2', name: 'Analysis / Design Model Review' },
  { code: 'S3', name: 'Loading / Design Parameters Review' },
  { code: 'S4', name: 'Analysis Results Review' },
  { code: 'S5', name: 'Design Review & Code Compliance' },
  { code: 'S6', name: 'Drawing Review' },
  { code: 'S7', name: 'Final Verification' },
];
export const DT_PR_CHECKLIST = [
  ['S1', 'DBR approved'], ['S1', 'Soil Investigation Report reviewed'], ['S1', 'Material grades verified'],
  ['S2', 'Structural geometry verified'], ['S2', 'Storey levels verified'], ['S2', 'ETABS model checked'], ['S2', 'SAFE model checked'],
  ['S3', 'Load cases verified'], ['S3', 'Load combinations verified'],
  ['S4', 'Gravity analysis verified'], ['S4', 'Wind analysis verified'], ['S4', 'Seismic analysis verified'], ['S4', 'P-Delta analysis verified'], ['S4', 'Drift limits satisfied'], ['S4', 'Stability verified'],
  ['S5', 'Slab design verified'], ['S5', 'Beam design verified'], ['S5', 'Column design verified'], ['S5', 'Shear wall design verified'], ['S5', 'Foundation design verified'], ['S5', 'Ductile detailing verified'],
  ['S6', 'Structural drawings checked'], ['S6', 'Drawing revisions updated'], ['S6', 'Calculations cross-checked with drawings'],
  ['S7', 'Final technical review completed'],
];
export const DT_PR_DELIVERABLES = ['Design Basis Report', 'Analysis / design models', 'Design calculations', 'Drawings', 'Design Review Checklist', 'Design Verification Checklist', 'Comment Closure Register'];
export const DT_PR_ITEM_STATUS = ['Not Started', 'In Progress', 'Verified', 'N.A.'];
export const DT_PR_APPROVAL_STATUS = ['Pending', 'Submitted', 'Approved', 'N.A.'];
// A comment is overdue when the awaited reply is older than this many days.
export const DT_PR_RESPONSE_TARGET_DAYS = 7;
// Management overview (26 Nov 2026, client's Peer Review dashboard): each
// comment is classified so severity, technical breakdown and repeat issues
// can be reported; each package carries a likelihood x impact risk rating.
export const DT_PR_SEVERITY = ['Critical', 'Major', 'Moderate', 'Minor'];
export const DT_PR_CATEGORIES = {
  Analysis: ['Load assumptions', 'Load combinations', 'Mass source', 'Modal participation', 'Stability', 'P-Delta', 'Drift', 'Torsion', 'Irregularity', 'Seismic system'],
  Design: ['Flexure', 'Shear', 'Axial capacity', 'Interaction', 'Punching shear', 'Serviceability', 'Crack width', 'Deflection', 'Foundation pressure', 'Settlement'],
  Detailing: ['Ductile detailing', 'Anchorage', 'Lap locations', 'Confinement', 'Boundary elements', 'Coupling beams', 'Development length', 'Reinforcement congestion'],
};
export const DT_PR_ELEMENTS = ['Slab', 'Beam', 'Column', 'Shear wall', 'Core wall', 'Transfer structure', 'Foundation', 'Retaining wall', 'Staircase', 'General'];
export const DT_PR_RISK = ['Low', 'Medium', 'High'];

const ref = { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null };
const stamp = { by: ref, byName: { type: String, trim: true }, at: Date };

const roundSchema = new mongoose.Schema({
  commentDate: Date,
  comment: { type: String, trim: true, default: '' },
  // R2 onwards: DesignTree's verdict on the previous response.
  verdict: { type: String, enum: ['Open', 'Closed', null], default: null },
  responseDate: Date,
  response: { type: String, trim: true, default: '' },
}, { _id: true });

const commentSchema = new mongoose.Schema({
  stage: { type: String, enum: DT_PR_STAGES.map((s) => s.code), required: true },
  document: { type: String, trim: true, default: '' },
  topic: { type: String, trim: true, default: '' },
  detail: { type: String, trim: true, default: '' },
  severity: { type: String, enum: [...DT_PR_SEVERITY, ''], default: '' },
  category: { type: String, enum: [...Object.keys(DT_PR_CATEGORIES), ''], default: '' },
  reviewItem: { type: String, trim: true, default: '' },
  element: { type: String, enum: [...DT_PR_ELEMENTS, ''], default: '' },
  rounds: { type: [roundSchema], default: [] },
}, { timestamps: true });

const dtPeerReviewSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
  location: { type: String, trim: true, default: '' },
  client: { type: String, trim: true, default: '' },
  principalConsultant: { type: String, trim: true, default: '' },
  deliverableStage: { type: String, trim: true, default: 'GFC' },
  projectType: { type: String, trim: true, default: '' },
  likelihood: { type: String, enum: [...DT_PR_RISK, ''], default: '' },
  impact: { type: String, enum: [...DT_PR_RISK, ''], default: '' },
  // Daily review log kept by the review team (hours and documents checked).
  activity: [new mongoose.Schema({
    date: { type: Date, required: true },
    hours: { type: Number, min: 0, max: 24, default: 0 },
    docsChecked: { type: Number, min: 0, default: 0 },
    note: { type: String, trim: true, default: '' },
    by: ref,
    byName: { type: String, trim: true },
  }, { timestamps: true })],
  // Allotted by Admin (not typed by the review team): the only people who can work this package.
  reviewTeam: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], default: [] },
  allottedBy: stamp,
  stages: [{ _id: false, code: String, name: String, signedOff: stamp }],
  checklist: [new mongoose.Schema({
    stage: { type: String, enum: DT_PR_STAGES.map((s) => s.code), required: true },
    item: { type: String, trim: true, required: true },
    status: { type: String, enum: DT_PR_ITEM_STATUS, default: 'Not Started' },
    stamped: stamp,
    remarks: { type: String, trim: true, default: '' },
  })],
  approvals: [new mongoose.Schema({
    deliverable: { type: String, trim: true, required: true },
    status: { type: String, enum: DT_PR_APPROVAL_STATUS, default: 'Pending' },
    stamped: stamp,
  })],
  comments: { type: [commentSchema], default: [] },
  released: stamp,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const DtPeerReview = mongoose.models.DtPeerReview
  ?? mongoose.model('DtPeerReview', auditProjectSchema(dtPeerReviewSchema));
