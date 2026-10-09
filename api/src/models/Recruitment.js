import mongoose from 'mongoose';

export const RECRUITMENT_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Closed',
];

const recruitmentSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    headcount: { type: Number, required: true, min: 1 },
    branch: { type: String, trim: true },
    fresherExperienced: { type: String, trim: true },
    experience: { type: String, trim: true },
    timeline: { type: String, trim: true },
    qualifications: { type: String, trim: true },
    skills: { type: String, trim: true },
    tools: { type: String, trim: true },
    jd: { type: String, trim: true },
    workload: { type: String, trim: true },
    reason: { type: String, trim: true },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: RECRUITMENT_STATUSES,
      default: 'Draft',
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Recruitment =
  mongoose.models.Recruitment ??
  mongoose.model('Recruitment', recruitmentSchema);
