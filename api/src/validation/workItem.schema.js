import { z } from 'zod';
import { WORK_ITEM_STATUSES, WORK_ITEM_TYPES } from '../models/WorkItem.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();

export const workItemSchema = z
  .object({
    project: objectId,
    wuNo: z.string().trim().min(1),
    type: z.enum(WORK_ITEM_TYPES),
    activity: strOpt,
    subActivity: strOpt,
    progressPct: z.number().min(0).max(100).optional(),
    status: z.enum(WORK_ITEM_STATUSES).optional(),
    waitingOn: strOpt,
    date: z.coerce.date().optional(),
    notes: strOpt,
  })
  .strict();

export const workItemUpdateSchema = workItemSchema.partial();
