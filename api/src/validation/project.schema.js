import { z } from 'zod';
import { PROJECT_STATUSES, SERVICES, STAGES } from '../models/Project.js';

const contact = z
  .object({
    salutation: z.string().trim().optional(),
    name: z.string().trim().optional(),
    designation: z.string().trim().optional(),
    company: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  })
  .strict()
  .optional();

export const projectSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
  projectType: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  usedFor: z.string().trim().min(1),
  entityName: z.string().trim().min(1),
  location: z
    .object({
      label: z.string().trim().min(1),
      address1: z.string().trim().optional(),
      address2: z.string().trim().optional(),
      city: z.string().trim().optional(),
      zip: z.string().trim().optional(),
    })
    .strict(),
  jobNumber: z.string().trim().optional(),
  scope: z
    .array(
      z
        .object({
          service: z.enum(SERVICES),
          scope: z.string().trim().optional(),
          fee: z.number().min(0).optional(),
        })
        .strict(),
    )
    .optional(),
  hospitalityByClient: z.boolean().optional(),
  bimWorkOrder: z
    .object({
      scope: z.string().trim().optional(),
      fee: z.number().min(0).optional(),
      description: z.string().trim().optional(),
    })
    .strict()
    .optional(),
  principalTeamLeads: z
    .array(
      z
        .object({
          service: z.string().trim().optional(),
          name: z.string().trim().optional(),
        })
        .strict(),
    )
    .optional(),
  contacts: z
    .object({
      client: contact,
      architect: contact,
      pmc: contact,
      peerReview: contact,
      billing: contact,
    })
    .partial()
    .optional(),
  clientName: z.string().trim().optional(),
  related: z
    .object({
      projectDirector: z.string().trim().min(1),
      projectDirectorDesignation: z.string().trim().optional(),
      projectHead: z.string().trim().optional(),
      projectHeadDesignation: z.string().trim().optional(),
    })
    .strict(),
  owner: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  expectedCompletion: z.coerce.date().optional(),
  actualCompletion: z.coerce.date().optional(),
  description: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  completion: z.number().min(0).max(100).optional(),
  currentStage: z.enum(STAGES).optional(),
});

export const projectUpdateSchema = projectSchema.partial();
