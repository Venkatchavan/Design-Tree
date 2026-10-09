import { z } from 'zod';

export const branchSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    isActive: z.boolean().optional(),
  })
  .strict();

export const branchUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
