import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const teamSchema = z
  .object({
    name: z.string().trim().min(1),
    service: z.string().trim().min(1),
    branch: z.string().trim().optional(),
    lead: objectId.optional(),
    projects: z.array(objectId).optional(),
    members: z
      .array(
        z
          .object({
            employee: objectId,
            allocation: z.string().trim().optional(),
          })
          .strict(),
      )
      .optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const teamUpdateSchema = teamSchema.partial();

export const teamMembersSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            employee: objectId,
            allocation: z.string().trim().optional(),
          })
          .strict(),
      )
      .min(0),
  })
  .strict();
