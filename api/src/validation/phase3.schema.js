import { z } from 'zod';
import {
  TRANSMITTAL_METHODS,
  TRANSMITTAL_RECIPIENTS,
  TRANSMITTAL_STATUSES,
} from '../models/Transmittal.js';
import { BILLING_READINESS } from '../models/StageStatus.js';
import { BOOKING_STATUSES } from '../models/TravelBooking.js';
import { CERT_STATUSES } from '../models/Certificate.js';
import { CLAIM_STATUSES } from '../models/Claim.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();
const dateOpt = z.coerce.date().optional();

export const transmittalSchema = z
  .object({
    drawing: objectId,
    rev: strOpt,
    trNo: z.string().trim().optional(),
    date: dateOpt,
    issuedTo: z.enum(TRANSMITTAL_RECIPIENTS),
    method: z.enum(TRANSMITTAL_METHODS),
    status: z.enum(TRANSMITTAL_STATUSES).optional(),
    sentAt: dateOpt,
    ackAt: dateOpt,
    handledBy: strOpt,
    remarks: strOpt,
  })
  .strict();
export const transmittalUpdateSchema = transmittalSchema.partial();
export const transmittalStatusSchema = z
  .object({ status: z.enum(TRANSMITTAL_STATUSES) })
  .strict();
export const fromDrawingsSchema = z
  .object({
    drawingIds: z.array(objectId).min(1),
    date: dateOpt,
    issuedTo: z.enum(TRANSMITTAL_RECIPIENTS),
    method: z.enum(TRANSMITTAL_METHODS),
    remarks: strOpt,
  })
  .strict();
export const importConfirmSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            action: z.enum(['New', 'Update']),
            data: z.record(z.string(), z.any()),
            trNo: z.string().trim().optional(),
            entryId: objectId.optional(),
          })
          .strict(),
      )
      .min(1),
    updateExisting: z.boolean().optional(),
    fileName: strOpt,
  })
  .strict();

export const transmittalRecordSchema = z
  .object({
    date: dateOpt,
    project: objectId.optional(),
    projectName: strOpt,
    dept: strOpt,
    print: strOpt,
    docType: strOpt,
    service: strOpt,
    team: strOpt,
    trNo: strOpt,
    qty: z.number().min(0).optional(),
    sets: z.number().min(0).optional(),
    rev: strOpt,
    reason: strOpt,
  })
  .strict();
export const transmittalRecordUpdateSchema = transmittalRecordSchema.partial();

export const claimSchema = z
  .object({
    project: objectId,
    stage: strOpt,
    amount: z.number().min(0),
    submissionDate: dateOpt,
    status: z.enum(CLAIM_STATUSES).optional(),
    flagged: z.boolean().optional(),
  })
  .strict();
export const claimUpdateSchema = claimSchema.partial();
export const claimStatusSchema = z
  .object({ status: z.enum(CLAIM_STATUSES) })
  .strict();

export const stageStatusSchema = z
  .object({
    project: objectId,
    service: strOpt,
    stage: strOpt,
    plannedCompletion: dateOpt,
    currentStatus: strOpt,
    delayDays: z.number().optional(),
    reason: strOpt,
    billingReadiness: z.enum(BILLING_READINESS).optional(),
  })
  .strict();
export const stageStatusUpdateSchema = stageStatusSchema.partial();

export const paymentSchema = z
  .object({
    project: objectId,
    amount: z.number().min(0),
    date: dateOpt,
    reference: strOpt,
  })
  .strict();

export const certificateSchema = z
  .object({
    project: objectId,
    certType: z.string().trim().min(1),
    stage: strOpt,
    status: z.enum(CERT_STATUSES).optional(),
    issuedDate: dateOpt,
    issuedBy: strOpt,
    file: strOpt,
  })
  .strict();
export const certRequestSchema = z
  .object({
    project: objectId,
    category: z.string().trim().min(1),
  })
  .strict();

export const bookingSchema = z
  .object({
    employee: objectId,
    department: strOpt,
    project: objectId.optional(),
    fromCity: strOpt,
    toCity: strOpt,
    departureDate: dateOpt,
    returnDate: dateOpt,
    mode: strOpt,
    checkIn: strOpt,
    checkOut: strOpt,
    hotel: strOpt,
    location: strOpt,
    nights: z.number().min(0).optional(),
    reason: strOpt,
    extraCharges: z.number().min(0).optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
  })
  .strict();
export const bookingUpdateSchema = bookingSchema.partial();
export const bookingStatusSchema = z
  .object({ status: z.enum(BOOKING_STATUSES) })
  .strict();

export const quoteSchema = z
  .object({
    quotedFee: z.number().min(0).optional(),
    quotedHospitality: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
