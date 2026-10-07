import mongoose from 'mongoose';

// Snapshot of an Excel import for Undo-this-import (§4.10).
const importBatchSchema = new mongoose.Schema(
  {
    kind: { type: String, trim: true, default: 'transmittal' },
    fileName: { type: String, trim: true },
    entries: [
      {
        action: { type: String, enum: ['created', 'updated'] },
        entry: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Transmittal',
          required: true,
        },
        before: { type: Object },
        _id: false,
      },
    ],
    undone: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const ImportBatch =
  mongoose.models.ImportBatch ??
  mongoose.model('ImportBatch', importBatchSchema);
