import { z } from 'zod';
import {
  ACTION_STATUSES,
  INVITE_RESPONSES,
  MEETING_CATEGORIES,
  MEETING_MODES,
  MEETING_STATUSES,
  MEETING_TYPES,
  UNAVAILABLE_REASONS,
} from '../models/Meeting.js';
import { ALLOWANCE_STATUSES, ALLOWANCE_TYPES } from '../models/AllowanceRequest.js';
import { BOOKING_STATUSES } from '../models/TravelBooking.js';
import { LEAVE_STATUSES } from '../models/LeaveRequest.js';
import { SUPPORT_KINDS, SUPPORT_STATUSES } from '../models/SupportTicket.js';
import { TRAVEL_STATUSES } from '../models/TravelRequest.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const strOpt = z.string().trim().optional();
const dateOpt = z.coerce.date().optional();

export const workflowStepsSchema = z
  .object({
    project: objectId,
    steps: z
      .array(
        z
          .object({
            n: z.number(),
            status: z.enum(['Not Started', 'In Progress', 'Completed', 'Blocked']).optional(),
            remarks: strOpt,
            date: dateOpt,
          })
          .strict(),
      )
      .min(1),
    matrix: z
      .array(
        z
          .object({
            discipline: strOpt,
            spoc: strOpt,
            td: strOpt,
            channel: strOpt,
            frequency: strOpt,
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const briefSchema = z
  .object({
    project: objectId,
    marketingReady: z.boolean().optional(),
    category: strOpt,
    description: strOpt,
    highlights: z.array(z.string().trim()).optional(),
    testimonial: strOpt,
    awards: strOpt,
    photos: z.array(z.string().trim()).optional(),
  })
  .strict();

export const collateralSchema = z
  .object({
    project: objectId.optional(),
    requestType: z.string().trim().min(1),
    notes: strOpt,
    status: z.enum(['Requested', 'In Progress', 'Delivered']).optional(),
  })
  .strict();

export const contactSchema = z
  .object({
    type: z.string().trim().min(1),
    name: z.string().trim().min(1),
    organization: z.string().trim().min(1),
    designation: strOpt,
    phone: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
    city: strOpt,
    project: objectId.optional(),
    trade: strOpt,
    department: strOpt,
    notes: strOpt,
  })
  .strict();

export const leaveSchema = z
  .object({
    employee: objectId.optional(),
    reportingManager: strOpt,
    leaveType: z.string().trim().min(1),
    from: z.coerce.date(),
    to: z.coerce.date(),
    reason: strOpt,
  })
  .strict()
  .refine((v) => new Date(v.to) >= new Date(v.from), {
    message: 'To date must be on or after from date.',
  });
export const leaveDecisionSchema = z
  .object({
    status: z.enum(LEAVE_STATUSES),
    remarks: strOpt,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.status === 'Rejected' && !v.remarks?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'A reason is required when rejecting leave.' });
    }
  });

export const travelSchema = z
  .object({
    employee: objectId.optional(),
    project: objectId.optional(),
    purpose: strOpt,
    fromCity: strOpt,
    toCity: strOpt,
    departureDate: dateOpt,
    returnDate: dateOpt,
    mode: strOpt,
    estExpense: z.number().min(0).optional(),
    advanceRequested: z.number().min(0).optional(),
  })
  .strict();
export const travelDecisionSchema = z
  .object({ status: z.enum(TRAVEL_STATUSES), remarks: strOpt })
  .strict();
export const travelSettleSchema = z
  .object({
    advanceReceived: z.number().min(0).optional(),
    fare: z.number().min(0).optional(),
    lodging: z
      .object({
        hotel: strOpt, location: strOpt, checkIn: strOpt, checkOut: strOpt,
        nights: z.number().min(0).optional(),
      })
      .strict()
      .optional(),
    foodPerDiem: z.number().min(0).optional(),
    localConveyance: z.number().min(0).optional(),
    misc: z.number().min(0).optional(),
    hospitality: z.boolean().optional(),
    settlementStatus: strOpt,
    settlementDate: dateOpt,
  })
  .strict();

export const allowanceSchema = z
  .object({
    employee: objectId.optional(),
    reqType: z.enum(ALLOWANCE_TYPES),
    date: dateOpt,
    project: objectId.optional(),
    amount: z.number().min(0).optional(),
    days: z.number().min(0).optional(),
    route: strOpt,
    pickup: strOpt,
    drop: strOpt,
    meetingTime: strOpt,
    vehicle: strOpt,
    passengers: z.number().min(0).optional(),
    description: strOpt,
    purpose: strOpt,
    bill: strOpt,
  })
  .strict();
export const allowanceDecisionSchema = z
  .object({ status: z.enum(ALLOWANCE_STATUSES), remarks: strOpt })
  .strict();

export const supportSchema = z
  .object({
    employee: objectId.optional(),
    kind: z.enum(SUPPORT_KINDS),
    month: strOpt,
    category: strOpt,
    subject: strOpt,
    details: strOpt,
  })
  .strict();
export const supportUpdateSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    assignedTo: strOpt,
    remark: strOpt,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export const holidaySchema = z
  .object({
    date: z.coerce.date(),
    name: z.string().trim().min(1),
    type: z.enum(['Public holiday', 'Restricted holiday']).optional(),
  })
  .strict();

export const meetingSchema = z
  .object({
    project: objectId.optional(),
    title: z.string().trim().min(1, 'Add a meeting title to continue.'),
    agenda: strOpt,
    category: z.enum(MEETING_CATEGORIES).optional(),
    type: z.enum(MEETING_TYPES).optional(),
    services: z.array(z.string().trim()).min(1, 'Add at least one service to continue.'),
    date: z.coerce.date(),
    startTime: strOpt,
    endTime: strOpt,
    mode: z.enum(MEETING_MODES).optional(),
    link: strOpt,
    location: strOpt,
    responsible: strOpt,
    responsibleRole: strOpt,
    conductedBy: strOpt,
    externalParticipants: strOpt,
    additionalParticipantsText: strOpt,
    additionalParticipants: z
      .array(
        z.object({ name: strOpt, organisation: strOpt }).strict(),
      )
      .optional(),
    reason: strOpt,
    stage: strOpt,
    participants: z
      .array(
        z.object({ employee: objectId.optional(), name: strOpt }).strict(),
      )
      .min(1, 'Select at least one team member to continue.'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.startTime && v.endTime && v.endTime <= v.startTime) {
      ctx.addIssue({ code: 'custom', message: 'End time must be after start time.' });
    }
    if (v.category === 'Sudden' && !v.reason?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Add the reason for the sudden meeting.' });
    }
  });
export const meetingUpdateSchema = z
  .object({
    project: objectId.optional(),
    title: z.string().trim().min(1).optional(),
    agenda: strOpt,
    type: z.enum(MEETING_TYPES).optional(),
    services: z.array(z.string().trim()).optional(),
    date: dateOpt,
    startTime: strOpt,
    endTime: strOpt,
    mode: z.enum(MEETING_MODES).optional(),
    link: strOpt,
    location: strOpt,
    responsible: strOpt,
    responsibleRole: strOpt,
    conductedBy: strOpt,
    externalParticipants: strOpt,
    additionalParticipantsText: strOpt,
    stage: strOpt,
    status: z.enum(MEETING_STATUSES).optional(),
  })
  .strict();
export const momSchema = z
  .object({
    discussion: z.string().trim().optional(),
    decisions: z.string().trim().optional(),
    followUp: z.string().trim().optional(),
    nextMeeting: dateOpt,
    momDoc: strOpt,
    // Legacy single-text MOM from earlier builds.
    mom: z.string().trim().optional(),
  })
  .strict();
export const attendanceSchema = z
  .object({
    attendance: z
      .array(
        z
          .object({
            employee: objectId,
            present: z.boolean().optional(),
            reason: strOpt,
          })
          .strict(),
      )
      .optional(),
    additionalParticipants: z
      .array(z.object({ name: strOpt, organisation: strOpt }).strict())
      .optional(),
  })
  .strict()
  .refine(
    (v) => (v.attendance?.length ?? 0) > 0 || (v.additionalParticipants?.length ?? 0) > 0,
    { message: 'Mark attendance or add a participant who attended.' },
  );
export const actionSchema = z
  .object({
    text: z.string().trim().min(1, 'Enter the task first.'),
    owner: objectId.optional(),
    service: strOpt,
    priority: z.enum(['High', 'Medium', 'Low']).optional(),
    due: dateOpt,
    note: strOpt,
    remarks: strOpt,
  })
  .strict();
export const actionStatusSchema = z
  .object({ status: z.enum(ACTION_STATUSES) })
  .strict();
export const inviteResponseSchema = z
  .object({
    response: z.enum(INVITE_RESPONSES),
    reason: strOpt,
    note: strOpt,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.response === 'Not Available' && !v.reason?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'A reason is required.' });
    }
    if (v.response === 'Not Available' && v.reason === 'Other — specify' && !v.note?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Specify the reason.' });
    }
  });

export const ackSchema = z
  .object({ drawing: objectId, remarks: strOpt })
  .strict();

export const portalRespondSchema = z
  .object({ remarks: strOpt })
  .strict();

export const stageAckSchema = z
  .object({ stageStatus: objectId, remarks: strOpt })
  .strict();

export const portalUsersSchema = z
  .object({ userIds: z.array(objectId) })
  .strict();
