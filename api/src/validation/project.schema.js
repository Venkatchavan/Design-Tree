import { PROJECT_SERVICES } from '../config/services.js';
import { z } from 'zod';
import {
  ACTIVATION_STATUSES,
  FINAL_APPROVAL_STATUSES,
  PROJECT_CATEGORIES,
  PROJECT_COMPLEXITIES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  SERVICES,
  STAGES,
  TEAM_CONFIRMATION_STATUSES,
} from '../models/Project.js';

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
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().optional(),
  projectType: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  usedFor: z.string().trim().optional(),
  services: z.array(z.enum([...PROJECT_SERVICES, 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination', 'Peer review'])).optional(),
  source: z.string().trim().optional(),
  entityName: z.string().trim().optional(),
  location: z
    .object({
      label: z.string().trim().optional(),
      address1: z.string().trim().optional(),
      address2: z.string().trim().optional(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      zip: z.string().trim().optional(),
    })
    .strict()
    .optional(),
  jobNumber: z.string().trim().optional(),
  scope: z
    .array(
      z
        .object({
          service: z.string().trim().optional(),
          scope: z.string().trim().optional(),
          fee: z.number().min(0).optional(),
        })
        .strict(),
    )
    .optional(),
  hospitalityByClient: z.boolean().optional(),
  bimWorkOrder: z
    .object({
      no: z.string().trim().optional(),
      date: z.coerce.date().optional(),
      scope: z.string().trim().optional(),
      fee: z.number().min(0).optional(),
      description: z.string().trim().optional(),
      status: z.string().trim().optional(),
    })
    .strict()
    .optional(),
  principalTeamLeads: z
    .array(
      z
        .object({
          service: z.string().trim().optional(),
          employee: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
          name: z.string().trim().optional(),
          names: z.array(z.string().trim()).optional(),
          role: z.string().trim().optional(),
          nominatedBy: z.string().trim().optional(),
          approvalStatus: z.enum(['Proposed', 'Approved']).optional(),
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
      projectDirector: z.string().trim().optional(),
      projectDirectorDesignation: z.string().trim().optional(),
      projectHead: z.string().trim().optional(),
      projectHeadDesignation: z.string().trim().optional(),
    })
    .strict()
    .optional(),
  owner: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  expectedCompletion: z.coerce.date().optional(),
  actualCompletion: z.coerce.date().optional(),
  description: z.string().trim().optional(),
  requirements: z.string().trim().optional(),
  complexity: z.enum(PROJECT_COMPLEXITIES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  referral: z.string().trim().optional(),
  sourcePerson: z.string().trim().optional(),
  clientSpoc: z.string().trim().optional(),
  workOrderDate: z.coerce.date().optional(),
  workOrderDocument: z.string().trim().optional(),
  activation: z
    .object({
      status: z.enum(ACTIVATION_STATUSES).optional(),
      activatedBy: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
        .optional(),
      activatedAt: z.coerce.date().optional(),
      spoc: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
        .optional(),
    })
    .strict()
    .optional(),
  teamConfirmation: z
    .object({
      status: z.enum(TEAM_CONFIRMATION_STATUSES).optional(),
      disciplines: z
        .array(
          z
            .object({
              discipline: z.string().trim().optional(),
              spoc: z.string().trim().optional(),
              ptlTl: z.string().trim().optional(),
              detail: z.string().trim().optional(),
            })
            .strict(),
        )
        .optional(),
      sharedToAdmin: z.boolean().optional(),
    })
    .strict()
    .optional(),
  finalApproval: z
    .object({
      remarks: z.string().trim().optional(),
    })
    .strict()
    .optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  completion: z.number().min(0).max(100).optional(),
  currentStage: z.enum(STAGES).optional(),
});

export const projectUpdateSchema = projectSchema.partial();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// POST /api/projects/:id/activate — Admin activates the project and
// assigns the confirmed SPOC (idempotent confirmation for Active ones).
export const activateProjectSchema = z
  .object({
    coordinator: objectId.optional(),
    services: z.array(z.string().trim()).optional(),
  })
  .strict();

// PUT /api/projects/:id/team-confirmation — DMH confirms discipline teams
// and optionally shares the details back to Admin.
export const teamConfirmationSchema = z
  .object({
    status: z.enum(TEAM_CONFIRMATION_STATUSES).optional(),
    disciplines: z
      .array(
        z
          .object({
            discipline: z.string().trim().min(1),
            spoc: z.string().trim().optional(),
            ptlTl: z.string().trim().optional(),
            detail: z.string().trim().optional(),
          })
          .strict(),
      )
      .optional(),
    sharedToAdmin: z.boolean().optional(),
  })
  .strict();

// POST /api/projects/:id/final-approval — director sign-off before GFC.
export const finalApprovalSchema = z
  .object({
    remarks: z.string().trim().optional(),
  })
  .strict();

// PUT /api/projects/:id/team-leads — SPOC-owned principal team leads
// (+ optional related director/head override). Multiple people per service.
export const teamLeadsSchema = z
  .object({
    principalTeamLeads: z
      .array(
        z
          .object({
            service: z.string().trim().optional(),
            employee: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
            name: z.string().trim().optional(),
            names: z.array(z.string().trim()).optional(),
            role: z.string().trim().optional(),
            nominatedBy: z.string().trim().optional(),
            approvalStatus: z.enum(['Proposed', 'Approved']).optional(),
          })
          .strict(),
      )
      .optional(),
    related: z
      .object({
        projectDirector: z.string().trim().optional(),
        projectDirectorDesignation: z.string().trim().optional(),
        projectHead: z.string().trim().optional(),
        projectHeadDesignation: z.string().trim().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// PUT /api/projects/:id/spoc-contacts — SPOC-owned PMC / Peer Review contacts.
// Separate from the 10-section directory: canonical project contacts.
export const spocContactsSchema = z
  .object({
    pmc: contact,
    peerReview: contact,
  })
  .strict();
