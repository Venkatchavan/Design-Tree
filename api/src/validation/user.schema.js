import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const adminCreateUserSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.string().trim().min(1),
    employeeId: objectId.optional(),
  })
  .strict();

export const adminUpdateUserSchema = z
  .object({
    role: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
