import mongoose from 'mongoose';

const employeeMeetingSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['1:1 check-in', 'Team meeting', 'Disciplinary', 'Performance review'],
      required: true,
    },
    topic: { type: String, required: true, trim: true },
    conductedBy: { type: String, required: true, trim: true },
    notes: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

employeeMeetingSchema.index({ employee: 1, date: -1 });

export const EmployeeMeeting =
  mongoose.models.EmployeeMeeting ??
  mongoose.model('EmployeeMeeting', employeeMeetingSchema);
