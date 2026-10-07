import mongoose from 'mongoose';
import { ROLE_KEYS } from '../config/roles.js';

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
    role: {
      type: String,
      required: true,
      index: true,
      enum: ROLE_KEYS,
      default: 'founding_director',
    },
    isActive: { type: Boolean, default: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User ?? mongoose.model('User', userSchema);
