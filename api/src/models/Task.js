import mongoose from 'mongoose';

export const TASK_STATUSES = [
  'Open',
  'In Progress',
  'Submitted',
  'Approved',
  'Needs Attention',
];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const taskSchema = new mongoose.Schema(
  {
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    stage: { type: String, trim: true },
    deliverable: { type: String, trim: true },
    dueDate: { type: Date },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'Medium' },
    notes: { type: String, trim: true },
    status: { type: String, enum: TASK_STATUSES, default: 'Open', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Task =
  mongoose.models.Task ?? mongoose.model('Task', taskSchema);
