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
import {
  FIN_OCC_APPROVALS,
  FIN_OCC_KINDS,
  FIN_OCC_PAYMENTS,
  FIN_OCC_SETTLEMENTS,
  FIN_OCC_STATUSES,
} from '../models/FinanceOccEntry.js';

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
    issuedTo: z.enum(TRANSMITTAL_RECIPIENTS).optional(),
    method: z.enum(TRANSMITTAL_METHODS).optional(),
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
    service: strOpt,
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

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date.').refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, 'Enter a valid calendar date.');
export const stageStatusSchema = z.object({
  project: objectId, service: z.string().trim().min(1), stage: z.enum(['CD','SD','DD','TD','GFC']),
  expectedVersion: z.number().int().min(0),
  planDates: z.boolean().optional(), startDate: calendarDate.optional(), plannedCompletion: calendarDate.optional(), actualCompletion: calendarDate.optional(), reason: strOpt,
  ptlRemark: strOpt, spocRemark: strOpt, tdRemark: strOpt,
  requestCompletion: z.boolean().optional(), confirmCompletion: z.boolean().optional(), approveCompletion: z.boolean().optional(),
  billingReadiness: z.enum(BILLING_READINESS).optional(),
}).strict();
export const stageStatusUpdateSchema = stageStatusSchema.partial();

export const paymentSchema = z
  .object({
    project: objectId,
    amount: z.number().min(0),
    service: strOpt,
    date: dateOpt,
    reference: strOpt,
  })
  .strict();

export const certificateSchema = z
  .object({
    project: objectId,
    certType: z.string().trim().min(1),
    certNo: strOpt,
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

// Detailed cross-field checks run after merging edits with the persisted record.
const bookingFields = z
  .object({
    employee: objectId,
    department: strOpt,
    project: objectId.nullable().optional(),
    fromCity: strOpt,
    toCity: strOpt,
    departureDate: z.string().optional(),
    returnDate: z.string().optional(),
    mode: strOpt,
    preferredSeat: strOpt,
    checkIn: strOpt,
    checkOut: strOpt,
    hotel: strOpt,
    location: strOpt,
    nights: z.number().min(0).optional(),
    reason: strOpt,
    extraCharges: z.union([z.string(), z.number()]).optional(),
    transportFare: z.union([z.string(), z.number()]).optional(),
    hotelAmount: z.union([z.string(), z.number()]).optional(),
    hotelDatesSameAsTravel: z.boolean().optional(),
  })
  .strict();
export const bookingSchema = bookingFields;
export const bookingUpdateSchema = bookingFields
  .omit({ employee: true, department: true })
  .partial()
  .extend({ expectedVersion: z.number().int().min(0) })
  .strict();
export const bookingStatusSchema = z
  .object({ status: z.enum(BOOKING_STATUSES) })
  .strict();
const operationMoney = z
  .object({
    originalAmount: z.union([z.string(), z.number()]).optional(),
    newAmount: z.union([z.string(), z.number()]).optional(),
    fee: z.union([z.string(), z.number()]).optional(),
  })
  .strict();
const cancelMoney = z
  .object({
    amountPaid: z.union([z.string(), z.number()]).optional(),
    fee: z.union([z.string(), z.number()]).optional(),
  })
  .strict();
export const bookingRescheduleSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    changes: bookingFields
      .omit({
        employee: true,
        department: true,
        project: true,
        transportFare: true,
        hotelAmount: true,
        extraCharges: true,
        reason: true,
        nights: true,
      })
      .partial(),
    reason: z.string(),
    note: strOpt,
    transport: operationMoney.optional(),
    stay: operationMoney.optional(),
  })
  .strict();
export const bookingCancelSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    reason: z.string(),
    note: strOpt,
    transport: cancelMoney.optional(),
    stay: cancelMoney.optional(),
  })
  .strict();

export const financeOccSchema = z
  .object({
    kind: z.enum(FIN_OCC_KINDS),
    employee: objectId,
    project: objectId.optional(),
    amount: z.number().min(0).optional(),
    purpose: strOpt,
    remarks: strOpt,
    poNo: strOpt,
    vendor: strOpt,
    dept: strOpt,
    approval: z.enum(FIN_OCC_APPROVALS).optional(),
    payment: z.enum(FIN_OCC_PAYMENTS).optional(),
    requestedBy: strOpt,
    location: strOpt,
    fromDate: dateOpt,
    toDate: dateOpt,
    settlement: z.enum(FIN_OCC_SETTLEMENTS).optional(),
    advanceReceived: z.number().min(0).optional(),
    advanceDate: dateOpt,
    fare: z.number().min(0).optional(),
    lodgingAmount: z.number().min(0).optional(),
    foodPerDiem: z.number().min(0).optional(),
    localConveyance: z.number().min(0).optional(),
    cabBills: z.number().min(0).optional(),
    misc: z.number().min(0).optional(),
    billsSubmitted: z.boolean().optional(),
    hardcopyReceived: z.boolean().optional(),
    client: strOpt,
    hosp: z.enum(['Yes', 'No']).optional(),
    hospTypes: z.array(z.string()).optional(),
    refNo: strOpt,
    raisedDate: dateOpt,
    linkedTravel: objectId.optional(),
    verification: z
      .object({
        checks: z.record(z.string(), z.boolean()).optional(),
        missing: strOpt,
      })
      .strict()
      .optional(),
  })
  .strict();
export const financeOccUpdateSchema = financeOccSchema
  .omit({ kind: true, employee: true })
  .partial();
export const financeOccStatusSchema = z
  .object({
    status: z.enum(FIN_OCC_STATUSES),
    approval: z.enum(FIN_OCC_APPROVALS).optional(),
    payment: z.enum(FIN_OCC_PAYMENTS).optional(),
    settlement: z.enum(FIN_OCC_SETTLEMENTS).optional(),
    verification: z
      .object({
        checks: z.record(z.string(), z.boolean()).optional(),
        missing: strOpt,
      })
      .strict()
      .optional(),
    remark: strOpt,
  })
  .strict();

export const quoteSchema = z
  .object({
    quotedFee: z.number().min(0).optional(),
    quotedHospitality: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
