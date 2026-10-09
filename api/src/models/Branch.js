import mongoose from 'mongoose';

// Branch master (§branches): curated list of office/branch locations.
// Forms use strict dropdowns sourced from active branches; records keep
// storing the branch name as a plain string.
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Lower-cased name for case-insensitive uniqueness.
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

branchSchema.pre('validate', function setKey(next) {
  if (this.name != null) {
    this.key = String(this.name).trim().toLowerCase();
  }
  next();
});

export const Branch =
  mongoose.models.Branch ?? mongoose.model('Branch', branchSchema);
