import { z } from 'zod';
import { DELIVERABLE_STATUSES } from '../models/Deliverable.js';
import { RECRUITMENT_STATUSES } from '../models/Recruitment.js';
import { REVISION_STATUSES } from '../models/Revision.js';
import { SPOC_REVISION_STATUSES, SPOC_SERVICES, SPOC_WORK_AREAS } from '../models/SpocEntry.js';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();
const dateOpt = z.coerce.date().optional();

export const taskSchema = z
  .object({
    members: z.array(objectId).min(1),
    project: objectId,
    stage: strOpt,
    deliverable: strOpt,
    dueDate: dateOpt,
    priority: z.enum(TASK_PRIORITIES).optional(),
    notes: strOpt,
    status: z.enum(TASK_STATUSES).optional(),
  })
  .strict();
export const taskUpdateSchema = taskSchema.partial();

export const deliverableSchema = z
  .object({
    project: objectId,
    deliverable: z.string().trim().min(1),
    specify: strOpt,
    stage: strOpt,
    assignedTo: objectId.optional(),
    plannedDate: dateOpt,
    dueDate: dateOpt,
    status: z.enum(DELIVERABLE_STATUSES).optional(),
  })
  .strict();
export const deliverableUpdateSchema = deliverableSchema.partial();

export const revisionSchema = z
  .object({
    project: objectId,
    stage: strOpt,
    drawing: strOpt,
    revNo: strOpt,
    assignedTo: objectId.optional(),
    raisedBy: strOpt,
    dateRaised: dateOpt,
    resubmissionDue: dateOpt,
    details: z.string().trim().min(1),
    notify: z.boolean().optional(),
  })
  .strict();
export const revisionUpdateSchema = revisionSchema.partial();
export const revisionStatusSchema = z
  .object({ status: z.enum(REVISION_STATUSES) })
  .strict();

export const drawingSchema = z
  .object({
    project: objectId,
    drawingNo: z.string().trim().min(1),
    title: z.string().trim().min(1),
    service: strOpt,
    stage: strOpt,
    rev: strOpt,
    date: dateOpt,
    issuedTo: strOpt,
    method: strOpt,
  })
  .strict();
export const drawingUpdateSchema = drawingSchema.partial();

export const recruitmentSchema = z
  .object({
    department: z.string().trim().min(1),
    position: z.string().trim().min(1),
    headcount: z.number().min(1),
    fresherExperienced: strOpt,
    experience: strOpt,
    timeline: strOpt,
    qualifications: strOpt,
    skills: strOpt,
    tools: strOpt,
    jd: strOpt,
    workload: strOpt,
    reason: strOpt,
    remarks: strOpt,
    status: z.enum(RECRUITMENT_STATUSES).optional(),
  })
  .strict();
export const recruitmentUpdateSchema = recruitmentSchema.partial();
export const recruitmentStatusSchema = z
  .object({ status: z.enum(RECRUITMENT_STATUSES) })
  .strict();

export const areaSettlementSchema = z
  .object({
    project: objectId,
    zone: z.string().trim().min(1),
    initial: z.number().min(0),
    revised: z.number().min(0),
    remarks: strOpt,
  })
  .strict();
export const areaSettlementReviewSchema = z
  .object({
    status: z.enum(['Approved', 'Rejected']),
    remark: strOpt,
  })
  .strict();

export const siteVisitSchema = z
  .object({
    project: objectId,
    visitType: z.string().trim().min(1),
    date: dateOpt,
    photos: z.array(z.string().trim()).optional(),
    remarksClient: strOpt,
    remarksDesigner: strOpt,
    additionalVisit: z.boolean().optional(),
    discrepancyFound: z.boolean().optional(),
    severity: strOpt,
  })
  .strict();

export const discrepancySchema = z
  .object({
    project: objectId,
    discipline: strOpt,
    severity: strOpt,
    issue: z.string().trim().min(1),
    raised: dateOpt,
    due: dateOpt,
    status: z.enum(['Open', 'In Progress', 'Closed']).optional(),
  })
  .strict();
export const discrepancyUpdateSchema = discrepancySchema.partial();

export const conveyanceSchema = z
  .object({
    date: dateOpt,
    project: objectId.optional(),
    employee: objectId.optional(),
    purpose: strOpt,
    area: strOpt,
    vehicle: strOpt,
    kilometers: z.number().min(0).optional(),
    amount: z.number().min(0).optional(),
    document: strOpt,
  })
  .strict();

export const rfiSchema = z
  .object({
    project: objectId.optional(),
    type: z.string().trim().min(1),
    description: z.string().trim().min(1),
    team: strOpt,
    assignedTo: strOpt,
    due: dateOpt,
    status: z.enum(['Open', 'Responded', 'Closed']).optional(),
  })
  .strict();
export const rfiUpdateSchema = rfiSchema.partial();

export const bimWorkOrderSchema = z
  .object({
    woNo: z.string().trim().min(1),
    project: objectId.optional(),
    scope: strOpt,
    date: dateOpt,
    fee: z.number().min(0).optional(),
    status: z.enum(['Open', 'In Progress', 'Completed', 'Closed']).optional(),
  })
  .strict();
export const bimWorkOrderUpdateSchema = bimWorkOrderSchema.partial();

export const gbsStepsSchema = z
  .object({
    project: objectId,
    steps: z
      .array(
        z
          .object({
            n: z.number(),
            phase: z.string().trim().min(1),
            status: z.enum(['Not Started', 'In Progress', 'Completed']).optional(),
            remarks: strOpt,
            date: dateOpt,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const peerReviewSchema = z
  .object({
    jobNo: strOpt,
    project: objectId.optional(),
    stage: strOpt,
    discipline: strOpt,
    submission: strOpt,
    reviewer: strOpt,
    respEngineer: strOpt,
    dueDate: dateOpt,
    status: z.enum(['Pending', 'In Progress', 'Overdue', 'Approved for Issue']).optional(),
  })
  .strict();
export const peerReviewUpdateSchema = peerReviewSchema.partial();
export const peerChecklistSchema = z
  .object({
    section: strOpt,
    item: strOpt,
    requirement: strOpt,
    status: z.enum(['Pending', 'Pass', 'Fail', 'N/A']).optional(),
    reviewer: strOpt,
    remarks: strOpt,
    date: dateOpt,
  })
  .strict();
export const peerCommentSchema = z
  .object({
    no: strOpt,
    docRef: strOpt,
    observation: z.string().trim().min(1),
    reviewer: strOpt,
    respEngineer: strOpt,
    actionRequired: strOpt,
    response: strOpt,
    rev: strOpt,
    closureStatus: z.enum(['Open', 'Closed', 'Re-opened']).optional(),
    verifiedBy: strOpt,
  })
  .strict();
export const peerFinalSchema = z
  .object({
    finalVerified: z.boolean().optional(),
    finalApproved: z.boolean().optional(),
    issuedAt: dateOpt,
    status: z.enum(['Pending', 'In Progress', 'Overdue', 'Approved for Issue']).optional(),
  })
  .strict();

export const spocEntrySchema = z
  .object({
    date: dateOpt,
    employee: objectId.optional(),
    project: objectId,
    service: z.enum(SPOC_SERVICES),
    areas: z
      .array(
        z
          .object({
            key: z.enum(SPOC_WORK_AREAS),
            update: strOpt,
            hours: z.number().min(0).max(24).optional(),
          })
          .strict(),
      )
      .min(1),
    revisionNo: strOpt,
    revisionStatus: z.enum(SPOC_REVISION_STATUSES).optional(),
    revisionRemarks: strOpt,
  })
  .strict();
