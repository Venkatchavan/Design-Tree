import { z } from 'zod';
import { VARIATION_APPROVAL_STATUSES, VARIATION_STEPS } from '../models/Variation.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();

export const variationSchema = z
  .object({
    project: objectId,
    service: strOpt,
    reason: strOpt,
    effectiveDate: z.coerce.date().optional(),
    areaChange: strOpt,
    requestedBy: strOpt,
    additionalScope: strOpt,
    approvalStatus: z.enum(VARIATION_APPROVAL_STATUSES).optional(),
    currentStep: z.number().int().min(1).max(VARIATION_STEPS.length).optional(),
  })
  .strict();

export const variationUpdateSchema = variationSchema.partial();
