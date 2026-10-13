import mongoose from 'mongoose';
import {
  FLOW_STATUSES,
  approvalStagesField,
  deriveFlowStatus,
} from '../config/approvalFlow.js';

export const LEAVE_STATUSES = FLOW_STATUSES;

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    reportingManager: { type: String, trim: true },
    leaveType: { type: String, required: true, trim: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    days: { type: Number, min: 0.5 },
    reason: { type: String, trim: true },
    // Which stages this request clears — Team Lead → HR → Finance.
    flowStages: { type: [String], default: () => ['tl', 'hr'] },
    stages: { type: approvalStagesField(), default: () => ({}) },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: FLOW_STATUSES[0],
      index: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

leaveRequestSchema.pre('validate', function autoDays() {
  if (this.from && this.to) {
    const days =
      Math.round((new Date(this.to) - new Date(this.from)) / 86400000) + 1;
    this.days = Math.max(0.5, days);
  }
  this.status = deriveFlowStatus(this.stages, this.flowStages);
});

export const LeaveRequest =
  mongoose.models.LeaveRequest ??
  mongoose.model('LeaveRequest', leaveRequestSchema);
