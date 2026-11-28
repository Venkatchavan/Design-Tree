import mongoose from 'mongoose';

// IS Design Workbench (28 Nov 2026) inside DT Peer Review. The workbench page keeps
// its data as path-addressed documents (projects/{pid}, projects/{pid}/elements/{id},
// projects/{pid}/history/{id}, projects/{pid}/analysis/main). Each one is stored here
// as JSON text so calculation keys never clash with Mongo field-name rules.
const workbenchDocSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, unique: true },
    parent: { type: String, required: true, index: true },
    json: { type: String, default: '{}' },
    at: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
workbenchDocSchema.index({ parent: 1, at: -1 });

export const WorkbenchDoc = mongoose.model('WorkbenchDoc', workbenchDocSchema);
