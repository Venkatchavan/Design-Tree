import { z } from 'zod';
import { STAGE_REVIEW_OUTCOMES } from '../models/StageReview.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();

export const stageReviewSchema = z
  .object({
    project: objectId,
    date: z.coerce.date().optional(),
    stage: strOpt,
    reviewer: strOpt,
    waitingOn: strOpt,
    outcome: z.enum(STAGE_REVIEW_OUTCOMES).optional(),
  })
  .strict();

export const stageReviewUpdateSchema = stageReviewSchema.partial();
