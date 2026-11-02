import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
      immutable: true,
    },
    recordType: { type: String, required: true, immutable: true },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: ['Created', 'Updated', 'Deleted'],
      required: true,
      immutable: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
    },
    actorName: { type: String, required: true, immutable: true },
    at: { type: Date, default: Date.now, required: true, immutable: true },
    changes: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      immutable: true,
    },
  },
  { versionKey: false },
);
schema.index({ project: 1, at: -1, _id: -1 });
function readOnly() {
  throw Object.assign(new Error('Project audit history is append-only.'), {
    status: 403,
  });
}
schema.pre('save', function () {
  if (!this.isNew) readOnly();
});
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
])
  schema.pre(op, readOnly);
schema.pre('deleteOne', { document: true, query: false }, readOnly);
schema.pre('bulkWrite', readOnly);
export const ProjectAudit =
  mongoose.models.ProjectAudit ?? mongoose.model('ProjectAudit', schema);
