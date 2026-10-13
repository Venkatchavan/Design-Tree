import { Variation } from '../models/Variation.js';
import { makeCrud } from '../utils/crud.js';
import { variationSchema, variationUpdateSchema } from '../validation/variation.schema.js';

export const variations = makeCrud(Variation, {
  create: variationSchema,
  update: variationUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    return f;
  },
});
