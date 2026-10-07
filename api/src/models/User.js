import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, index: true, default: 'founding_director' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User ?? mongoose.model('User', userSchema);
