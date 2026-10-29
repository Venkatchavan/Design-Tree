import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['coordination', 'rfi', 'revision', 'action'],
    required: true,
    immutable: true
  },
  record: {
    type: String,
    required: true,
    immutable: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    immutable: true
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },
  at: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  versionKey: false
});
schema.index({
  source: 1,
  record: 1
}, {
  unique: true
});
const deny = () => {
  throw Object.assign(new Error('Follow-up closure history is append-only.'), {
    status: 403
  });
};
schema.pre('save', function () {
  if (!this.isNew) deny();
});
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'bulkWrite']) schema.pre(op, deny);
schema.pre('deleteOne', {
  document: true,
  query: false
}, deny);
export const DesignTeamClosure = mongoose.models.DesignTeamClosure ?? mongoose.model('DesignTeamClosure', schema);
