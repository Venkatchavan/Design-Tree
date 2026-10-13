import { StageReview } from '../models/StageReview.js';
import { makeCrud } from '../utils/crud.js';
import { stageReviewSchema, stageReviewUpdateSchema } from '../validation/stageReview.schema.js';

export const stageReviews = makeCrud(StageReview, {
  create: stageReviewSchema,
  update: stageReviewUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    return f;
  },
});
