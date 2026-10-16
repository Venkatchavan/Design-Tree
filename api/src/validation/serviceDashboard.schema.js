import { z } from 'zod';
import { DASHBOARD_SERVICES } from '../models/ServiceDashboard.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();
const countOpt = z.number().int().min(0).optional();
const numOpt = z.number().min(0).optional();
const areaRevisionOpt = z
  .object({
    name: strOpt,
    date: z.coerce.date().optional(),
    reason: strOpt,
    preparedBy: strOpt,
    approvedBy: strOpt,
    document: strOpt,
  })
  .strict();

export const serviceDashboardSchema = z
  .object({
    project: objectId,
    service: z.enum(DASHBOARD_SERVICES),
    technicalDirector: strOpt,
    modelers: countOpt,
    teamMembers: countOpt,
    coordinators: countOpt,
    modelVersion: strOpt,
    lod: strOpt,
    lastClashRun: z.coerce.date().optional(),
    clashesFound: countOpt,
    clashesResolved: countOpt,
    designers: countOpt,
    drafters: countOpt,
    auditors: countOpt,
    reviewers: countOpt,
    scopeStatus: strOpt,
    scopeStartDate: z.coerce.date().optional(),
    scopeCompletedDate: z.coerce.date().optional(),
    milestoneLabel: strOpt,
    milestoneValue: strOpt,
    boqBuiltUpArea: numOpt,
    boqEnteredBy: strOpt,
    boqEnteredOn: z.coerce.date().optional(),
    workOrderQuotedArea: numOpt,
    initialArea: numOpt,
    revisedArea: numOpt,
    revisedAreaLabel: strOpt,
    areaFinal: strOpt,
    areaAlertSentOn: z.coerce.date().optional(),
    areaRevisions: z.array(areaRevisionOpt).optional(),
  })
  .strict();
