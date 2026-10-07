import mongoose from 'mongoose';

// 16-step coordination workflow per project (§4.11). Each step belongs to
// a concerned head; only that head — or the Design Management Head —
// may update it (board roles view only).
const stepSchema = new mongoose.Schema(
  {
    n: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed', 'Blocked'],
      default: 'Not Started',
    },
    remarks: { type: String, trim: true },
    date: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    _id: false,
  },
);

const matrixRowSchema = new mongoose.Schema(
  {
    discipline: { type: String, trim: true },
    spoc: { type: String, trim: true },
    td: { type: String, trim: true },
    channel: { type: String, trim: true },
    frequency: { type: String, trim: true },
    _id: false,
  },
);

const designWorkflowSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
      index: true,
    },
    steps: [stepSchema],
    matrix: [matrixRowSchema],
  },
  { timestamps: true },
);

export const WORKFLOW_STEPS = [
  'Project received / initiated',
  'Review scope & requirements',
  'Identify required disciplines & teams',
  'Allocate SPOC / coordination team',
  'Prepare responsibility & communication matrix',
  'Coordinate with PTL / Technical Director / design teams',
  'Track design inputs & deliverables (CD → SD → DD → TD → GFC)',
  'Monitor interdisciplinary coordination',
  'Track RFIs / queries / design issues / client comments',
  'Assign action to responsible team',
  'Monitor action & due dates',
  'Escalate delays / critical issues',
  'Review status & coordination reports',
  'Ensure closure of comments / queries / revisions',
  'Final coordination & submission',
  'Update dashboard & close activity',
];

// Concerned head per step (Director / Coordinator / Technical Director / TL).
export const STEP_OWNERS = [
  'Director',
  'Director',
  'Technical Director',
  'Technical Director',
  'Coordinator',
  'Coordinator',
  'TL',
  'Coordinator',
  'Coordinator',
  'TL',
  'Coordinator',
  'Director',
  'Technical Director',
  'Coordinator',
  'Technical Director',
  'Coordinator',
];

export const DesignWorkflow =
  mongoose.models.DesignWorkflow ??
  mongoose.model('DesignWorkflow', designWorkflowSchema);
