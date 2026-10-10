import { z } from 'zod';
import {
  WORK_ENTRY_STATUSES,
  WORK_ENTRY_TYPES,
} from '../models/WorkEntry.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const workEntrySchema = z
  .object({
    employee: objectId.optional(),
    project: objectId.optional(),
    stage: z.string().trim().optional(),
    date: z.coerce.date().optional(),
    hours: z.number().min(0).max(24),
    type: z.enum(WORK_ENTRY_TYPES).optional(),
    notes: z.string().trim().optional(),
    category: z
      .enum(['Assigned Daily Work', 'Hourly', 'Drawing', 'Task'])
      .optional(),
    deliverable: z.string().trim().optional(),
    taskActivity: z.string().trim().optional(),
    drawing: z.string().trim().optional(),
    progressPct: z.number().min(0).max(100).optional(),
    otherHours: z
      .array(
        z
          .object({
            project: objectId,
            hours: z.number().min(0).max(24),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const workEntryDecisionSchema = z
  .object({
    status: z.enum(WORK_ENTRY_STATUSES),
    remark: z.string().trim().optional(),
  })
  .strict();
