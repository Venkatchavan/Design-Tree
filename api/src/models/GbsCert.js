import mongoose from 'mongoose';

// Green Building Certification workflow, one doc per project.
const stepSchema = new mongoose.Schema(
  {
    n: { type: Number, required: true },
    phase: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed'],
      default: 'Not Started',
    },
    remarks: { type: String, trim: true },
    date: { type: Date },
    _id: false,
  },
);

const gbsCertSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
      index: true,
    },
    steps: [stepSchema],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const GbsCert =
  mongoose.models.GbsCert ?? mongoose.model('GbsCert', gbsCertSchema);
