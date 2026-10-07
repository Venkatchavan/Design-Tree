import mongoose from 'mongoose';

const rfiSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    type: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    team: { type: String, trim: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: String, trim: true },
    due: { type: Date },
    status: {
      type: String,
      enum: ['Open', 'Responded', 'Closed'],
      default: 'Open',
      index: true,
    },
  },
  { timestamps: true },
);

export const Rfi = mongoose.models.Rfi ?? mongoose.model('Rfi', rfiSchema);
