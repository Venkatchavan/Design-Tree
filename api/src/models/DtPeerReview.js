import mongoose from 'mongoose';
import { auditProjectSchema } from '../utils/projectAudit.js';

// DT Peer Review (3 Nov 2026): the DesignTree Structural Peer Review package
// for one project — review team, seven review stages, master checklist,
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
export const DT_PR_TEAM_ROLES = [
  { key: 'designEngineer', label: 'Design Engineer', duty: 'Prepares the design and self-checks' },
  { key: 'checker', label: 'Checker / Senior Engineer', duty: 'Independent review' },
  { key: 'lead', label: 'Lead Engineer', duty: 'Technical review and comment closure' },
  { key: 'principal', label: 'Principal Engineer', duty: 'Final verification and approval for issue' },
];
// A comment is overdue when the awaited reply is older than this many days.
export const DT_PR_RESPONSE_TARGET_DAYS = 7;

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
  rounds: { type: [roundSchema], default: [] },
}, { timestamps: true });

const dtPeerReviewSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
  location: { type: String, trim: true, default: '' },
  client: { type: String, trim: true, default: '' },
  principalConsultant: { type: String, trim: true, default: '' },
  deliverableStage: { type: String, trim: true, default: 'GFC' },
  team: {
    designEngineer: ref, checker: ref, lead: ref, principal: ref,
  },
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
