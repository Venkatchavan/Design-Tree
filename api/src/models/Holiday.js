import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Holiday =
  mongoose.models.Holiday ?? mongoose.model('Holiday', holidaySchema);
