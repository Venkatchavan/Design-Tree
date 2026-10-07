import mongoose from 'mongoose';

export const DELIVERABLE_STATUSES = [
  'Planned',
  'In Progress',
  'Submitted',
  'Approved',
  'Overdue',
];

const deliverableSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    deliverable: { type: String, required: true, trim: true },
    specify: { type: String, trim: true },
    stage: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    plannedDate: { type: Date },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: DELIVERABLE_STATUSES,
      default: 'Planned',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const deliverableLogSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    action: { type: String, trim: true },
    stage: { type: String, trim: true },
    deliverable: { type: String, trim: true },
    details: { type: String, trim: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Deliverable =
  mongoose.models.Deliverable ??
  mongoose.model('Deliverable', deliverableSchema);
export const DeliverableLog =
  mongoose.models.DeliverableLog ??
  mongoose.model('DeliverableLog', deliverableLogSchema);
