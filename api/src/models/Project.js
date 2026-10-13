import mongoose from 'mongoose';
import { PROJECT_SERVICES } from '../config/services.js';

export const SERVICES = PROJECT_SERVICES;
// Legacy service labels retained for old scope rows (read-only compat).
export const LEGACY_SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'BIM',
  'QA/QC',
  'Peer Review',
  'QS/BOQ',
  'Other',
  'Structure',
  'Architecture',
];
export const STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];
export const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Other'];
export const PROJECT_COMPLEXITIES = ['Low', 'Medium', 'High'];
export const ACTIVATION_STATUSES = ['Pending', 'Activated'];
export const TEAM_CONFIRMATION_STATUSES = ['Pending', 'Confirmed'];
export const FINAL_APPROVAL_STATUSES = ['Pending', 'Approved'];
export const PROJECT_PRIORITIES = ['High', 'Medium', 'Low'];
export const PROJECT_CATEGORIES = ['Category A', 'Category B', 'Category C'];

const contactSchema = new mongoose.Schema(
  {
    salutation: { type: String, trim: true },
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    state: { type: String, trim: true },
    projectType: { type: String, trim: true },
    branch: { type: String, trim: true, index: true },
    usedFor: { type: String, trim: true },
    services: [{ type: String, trim: true }],
    source: { type: String, trim: true },
    entityName: { type: String, trim: true },
    location: {
      label: { type: String, trim: true },
      address1: { type: String, trim: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
    },
    jobNumber: { type: String, trim: true },
    scope: [
      {
        service: { type: String, trim: true },
        scope: { type: String, trim: true },
        fee: { type: Number, min: 0 },
        _id: false,
      },
    ],
    hospitalityByClient: { type: Boolean, default: false },
    bimWorkOrder: {
      no: { type: String, trim: true },
      date: { type: Date },
      scope: { type: String, trim: true },
      fee: { type: Number, min: 0 },
      description: { type: String, trim: true },
      status: { type: String, trim: true },
    },
    principalTeamLeads: [
      {
        employee: {type:mongoose.Schema.Types.ObjectId,ref:'Employee'},
        service: { type: String, trim: true },
        name: { type: String, trim: true },
        // Multiple people per service: either several rows with the same
        // service or a single row with names[].
        names: [{ type: String, trim: true }],
        // Team allocation (SPOC record, as nominated by Directors).
        role: { type: String, trim: true },
        nominatedBy: { type: String, trim: true },
        approvalStatus: {
          type: String,
          enum: ['Proposed', 'Approved'],
        },
        _id: false,
      },
    ],
    contacts: {
      client: { type: contactSchema },
      architect: { type: contactSchema },
      pmc: { type: contactSchema },
      peerReview: { type: contactSchema },
      billing: { type: contactSchema },
    },
    clientName: { type: String, trim: true, index: true },
    related: {
      projectDirector: { type: String, trim: true },
      projectDirectorDesignation: { type: String, trim: true },
      projectHead: { type: String, trim: true },
      projectHeadDesignation: { type: String, trim: true },
    },
    owner: { type: String, trim: true },
    startDate: { type: Date },
    expectedCompletion: { type: Date },
    actualCompletion: { type: Date },
    description: { type: String, trim: true },
    requirements: { type: String, trim: true },
    complexity: { type: String, enum: PROJECT_COMPLEXITIES, trim: true },
    priority: { type: String, enum: PROJECT_PRIORITIES, trim: true },
    category: { type: String, enum: PROJECT_CATEGORIES, trim: true },
    referral: { type: String, trim: true },
    sourcePerson: { type: String, trim: true },
    clientSpoc: { type: String, trim: true },
    workOrderDate: { type: Date },
    workOrderDocument: { type: String, trim: true },
    // Project activation: Admin activates the project and assigns the
    // confirmed SPOC. New projects default to Pending; Admin confirms via
    // POST /api/projects/:id/activate which assigns the SPOC.
    activation: {
      status: {
        type: String,
        enum: ACTIVATION_STATUSES,
        default: 'Pending',
        index: true,
      },
      activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      activatedAt: { type: Date },
      spoc: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    },
    // Team finalisation: Design Management Head confirms the discipline
    // teams (SPOC/PTL/TL/designers/engineers/drafting-BIM/QAQC/peer/QS)
    // and shares the details back to Admin.
    teamConfirmation: {
      status: {
        type: String,
        enum: TEAM_CONFIRMATION_STATUSES,
        default: 'Pending',
        index: true,
      },
      disciplines: [
        {
          discipline: { type: String, trim: true },
          spoc: { type: String, trim: true },
          ptlTl: { type: String, trim: true },
          detail: { type: String, trim: true },
          _id: false,
        },
      ],
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      confirmedAt: { type: Date },
      sharedToAdminAt: { type: Date },
    },
    // Final approval before GFC submission (directors sign-off).
    finalApproval: {
      status: {
        type: String,
        enum: FINAL_APPROVAL_STATUSES,
        default: 'Pending',
        index: true,
      },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: { type: Date },
      remarks: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'Active',
      index: true,
    },
    completion: { type: Number, min: 0, max: 100, default: 0 },
    currentStage: { type: String, enum: STAGES, default: 'CD', index: true },
    quotedFee: { type: Number, min: 0 },
    quotedHospitality: { type: Boolean, default: false },
    portalUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

projectSchema.pre('validate', function setClientName() {
  if (!this.clientName) {
    this.clientName =
      this.contacts?.client?.company?.trim() ||
      this.contacts?.client?.name?.trim() ||
      '';
  }
});

export const Project =
  mongoose.models.Project ?? mongoose.model('Project', projectSchema);
