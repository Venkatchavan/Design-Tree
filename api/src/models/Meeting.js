import mongoose from 'mongoose';

export const MEETING_CATEGORIES = ['Scheduled', 'Sudden'];
export const MEETING_TYPES = ['Client / DRM', 'DesignTree / Arictech', 'PMC', 'Other'];
export const MEETING_MODES = ['Online', 'Offline'];
export const MEETING_STATUSES = ['Scheduled', 'Held', 'Cancelled'];
export const INVITE_RESPONSES = ['Pending', 'Available', 'Not Available'];
export const UNAVAILABLE_REASONS = [
  'Another scheduled meeting',
  'Project work / deadline',
  'Leave',
  'Client engagement',
  'Personal reason',
  'Other — specify',
];
export const ACTION_STATUSES = ['Open', 'In Progress', 'Completed'];

const inviteSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    response: {
      type: String,
      enum: INVITE_RESPONSES,
      default: 'Pending',
    },
    reason: { type: String, trim: true },
    note: { type: String, trim: true },
    respondedAt: { type: Date },
    invitedAt: { type: Date, default: Date.now },
    _id: false,
  },
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    present: { type: Boolean, default: true },
    reason: { type: String, trim: true },
    _id: false,
  },
);

const actionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    due: { type: Date },
    status: { type: String, enum: ACTION_STATUSES, default: 'Open' },
    note: { type: String, trim: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

// SPOC + Employee meetings (consolidated docs R1–R12, E1–E11).
const meetingSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    agenda: { type: String, trim: true },
    category: {
      type: String,
      enum: MEETING_CATEGORIES,
      required: true,
      index: true,
    },
    type: { type: String, enum: MEETING_TYPES, default: 'Other' },
    services: [{ type: String, trim: true }],
    date: { type: Date, required: true, index: true },
    originalDate: { type: Date },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    mode: { type: String, enum: MEETING_MODES, default: 'Offline' },
    link: { type: String, trim: true },
    location: { type: String, trim: true },
    responsible: { type: String, trim: true },
    reason: { type: String, trim: true },
    stage: { type: String, trim: true },
    participants: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
        },
        name: { type: String, trim: true },
        _id: false,
      },
    ],
    momNo: { type: String, trim: true, uppercase: true, index: true },
    invites: [inviteSchema],
    attendance: [attendanceSchema],
    refDocs: [{ type: String, trim: true }],
    mom: {
      discussion: { type: String, trim: true },
      decisions: { type: String, trim: true },
      followUp: { type: String, trim: true },
      nextMeeting: { type: Date },
    },
    momDoc: { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    actions: [actionSchema],
    status: {
      type: String,
      enum: MEETING_STATUSES,
      default: 'Scheduled',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Meeting =
  mongoose.models.Meeting ?? mongoose.model('Meeting', meetingSchema);
