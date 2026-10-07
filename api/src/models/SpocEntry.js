import mongoose from 'mongoose';

export const SPOC_SERVICES = [
  'Structure',
  'Architecture',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'BIM',
  'Other',
];
export const SPOC_WORK_AREAS = [
  'Project Directory',
  'Meetings',
  'Meeting Scheduling & Coordination',
  'Drawings Sharing / Issuing',
  'RFI',
  'Architectural Updates',
  'Client Updates',
  'Revision Status',
  'Project Status',
  'Other',
];
export const SPOC_REVISION_STATUSES = [
  'Addressed',
  'In Progress',
  'Pending',
  'Awaiting Client',
  'Awaiting Architect',
  'Awaiting Internal Team',
];

// SPOC daily work update / man-hour entry (§4.22). Saving counts as the
// day's man-hour entry for the sign-out rule.
const spocEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now, index: true },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    service: { type: String, enum: SPOC_SERVICES, required: true },
    areas: [
      {
        key: { type: String, enum: SPOC_WORK_AREAS, required: true },
        update: { type: String, trim: true },
        hours: { type: Number, min: 0, max: 24, default: 0 },
        _id: false,
      },
    ],
    revisionNo: { type: String, trim: true },
    revisionStatus: { type: String, enum: SPOC_REVISION_STATUSES },
    revisionRemarks: { type: String, trim: true },
    totalHours: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

spocEntrySchema.pre('validate', function autoTotal() {
  this.totalHours = (this.areas ?? []).reduce(
    (sum, a) => sum + (a.hours ?? 0),
    0,
  );
});

export const SpocEntry =
  mongoose.models.SpocEntry ?? mongoose.model('SpocEntry', spocEntrySchema);
