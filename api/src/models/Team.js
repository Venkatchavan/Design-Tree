import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    service: { type: String, required: true, trim: true, index: true },
    branch: { type: String, trim: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    members: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
          required: true,
        },
        allocation: { type: String, trim: true },
        _id: false,
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Team =
  mongoose.models.Team ?? mongoose.model('Team', teamSchema);
