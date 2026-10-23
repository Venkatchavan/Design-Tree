import mongoose from 'mongoose';
import { ProjectAudit } from '../models/ProjectAudit.js';
import { requestContext } from './requestContext.js';

const normalize = (value) =>
  value == null ? null : JSON.parse(JSON.stringify(value));
function changes(before, after, prefix = '') {
  const result = [];
  for (const key of new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])) {
    if (['_id', '__v', 'createdAt', 'updatedAt', 'linkHash'].includes(key))
      continue;
    const oldValue = before?.[key] ?? null,
      newValue = after?.[key] ?? null,
      field = prefix + key;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    if (
      oldValue &&
      newValue &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue) &&
      typeof oldValue === 'object' &&
      typeof newValue === 'object'
    )
      result.push(...changes(oldValue, newValue, field + '.'));
    else result.push({ field, previous: oldValue, updated: newValue });
  }
  return result;
}
async function record(Model, before, after) {
  const req = requestContext.getStore()?.req;
  if (!req) return; // Background seeds/maintenance are outside a user request.

  const diff = changes(normalize(before), normalize(after));
  if (!diff.length) return;
  const docs = [before, after].filter(Boolean);
  const ids = new Set(
    docs.flatMap((d) =>
      Model.modelName === 'Project'
        ? [String(d._id)]
        : d.projects
          ? d.projects.map(String)
          : d.project
            ? [String(d.project)]
            : [],
    ),
  );
  if (!ids.size) {
    for (const doc of docs) {
      if (doc.drawing) {
        const drawing = await mongoose
          .model('Drawing')
          .findById(doc.drawing)
          .select('project')
          .lean();
        if (drawing?.project) ids.add(String(drawing.project));
      }
      if (doc.stageStatus) {
        const stage = await mongoose
          .model('StageStatus')
          .findById(doc.stageStatus)
          .select('project')
          .lean();
        if (stage?.project) ids.add(String(stage.project));
      }
    }
  }
  if (!ids.size) return;
  const user = req.user
    ? await mongoose.model('User').findById(req.user.id).select('name').lean()
    : null;
  await ProjectAudit.insertMany(
    [...ids].map((project) => ({
      project,
      recordType: Model.modelName,
      recordId: (after ?? before)._id,
      action: !before ? 'Created' : !after ? 'Deleted' : 'Updated',
      actor: req.user?.id,
      actorName: user?.name || req.user?.email || 'External workflow',
      at: new Date(),
      changes: diff,
    })),
  );
}

// Attach before compilation to project and project-linked business records.
// Snapshot the persisted preimage, rather than accepting audit data from clients.
export function auditProjectSchema(schema) {
  if (schema.$projectAudited) return schema;
  schema.$projectAudited = true;
  schema.pre('save', async function () {
    this.$locals.auditBefore = this.isNew
      ? null
      : await this.constructor.findById(this._id).lean();
  });
  schema.post('save', async function (doc) {
    await record(
      this.constructor,
      this.$locals.auditBefore,
      doc.toObject({ depopulate: true }),
    );
  });
  for (const op of [
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ]) {
    schema.pre(op, async function () {
      const q = this.model.find(this.getFilter()).lean();
      if (!['updateMany', 'deleteMany'].includes(op)) q.limit(1);
      this._auditBefore = await q;
    });
    schema.post(op, async function () {
      const before = this._auditBefore ?? [];
      if (!before.length && this.getOptions().upsert) {
        const after = await this.model.findOne(this.getFilter()).lean();
        if (after) await record(this.model, null, after);
      }
      for (const doc of before)
        await record(
          this.model,
          doc,
          await this.model.findById(doc._id).lean(),
        );
    });
  }
  schema.post('insertMany', async function (docs) {
    for (const doc of docs)
      await record(
        this,
        null,
        doc.toObject ? doc.toObject({ depopulate: true }) : doc,
      );
  });
  return schema;
}
