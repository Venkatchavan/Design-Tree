import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';
import {
  FLOW_STATUSES,
  approvalStagesField,
  deriveFlowStatus,
} from '../config/approvalFlow.js';

export const ALLOWANCE_TYPES = ['LA', 'Cab', 'Other'];
// Flow statuses plus the two post-approval housekeeping states.
export const ALLOWANCE_STATUSES = [
  ...FLOW_STATUSES,
  'Completed',
  'Returned for clarification',
];

const allowanceRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    reqType: { type: String, enum: ALLOWANCE_TYPES, required: true },
    date: { type: Date, default: Date.now },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    amount: { type: Number, min: 0, default: 0 },
    days: { type: Number, min: 0, default: 0 },
    route: { type: String, trim: true },
    pickup: { type: String, trim: true },
    drop: { type: String, trim: true },
    meetingTime: { type: String, trim: true },
    vehicle: { type: String, trim: true },
    passengers: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true },
    purpose: { type: String, trim: true },
    bill: { type: String, trim: true },
    // Which stages this request clears — Team Lead → HR → Finance.
    flowStages: { type: [String], default: () => ['tl', 'hr'] },
    stages: { type: approvalStagesField(), default: () => ({}) },
    status: {
      type: String,
      enum: ALLOWANCE_STATUSES,
      default: FLOW_STATUSES[0],
      index: true,
    },
    remarks: { type: String, trim: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// status stays derived from the stage decisions so the extra housekeeping
// states (Completed / Returned for clarification) survive untouched.
allowanceRequestSchema.pre('validate', function deriveStatus() {
  if (['Completed', 'Returned for clarification'].includes(this.status)) return;
  this.status = deriveFlowStatus(this.stages, this.flowStages);
});

export const AllowanceRequest =
  mongoose.models.AllowanceRequest ??
  mongoose.model('AllowanceRequest', auditProjectSchema(allowanceRequestSchema));
