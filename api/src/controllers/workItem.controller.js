import { WorkItem } from '../models/WorkItem.js';
import { makeCrud } from '../utils/crud.js';
import { workItemSchema, workItemUpdateSchema } from '../validation/workItem.schema.js';

export const workItems = makeCrud(WorkItem, {
  create: workItemSchema,
  update: workItemUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    return f;
  },
});
