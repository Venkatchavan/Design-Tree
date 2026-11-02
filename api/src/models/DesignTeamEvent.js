import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    immutable: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    immutable: true,
    index: true
  },
  spocs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    immutable: true
  }],
  fromSpoc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    immutable: true
  },
  toSpoc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    immutable: true
  },
  detail: {
    type: mongoose.Schema.Types.Mixed,
    immutable: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },
  actorName: {
    type: String,
    required: true,
    immutable: true
  },
  at: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  }
}, {
  versionKey: false
});
schema.index({
  spocs: 1,
  at: -1,
  _id: -1
});
const deny = () => {
  throw Object.assign(new Error('Design Team history is append-only.'), {
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
export const DesignTeamEvent = mongoose.models.DesignTeamEvent ?? mongoose.model('DesignTeamEvent', schema);
