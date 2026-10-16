import mongoose from 'mongoose';
import {
  FLOW_STATUSES,
  approvalStagesField,
  deriveFlowStatus,
} from '../config/approvalFlow.js';

export const TRAVEL_STATUSES = FLOW_STATUSES;

const lodgingSchema = new mongoose.Schema(
  {
    hotel: { type: String, trim: true },
    location: { type: String, trim: true },
    checkIn: { type: String, trim: true },
    checkOut: { type: String, trim: true },
    nights: { type: Number, min: 0, default: 0 },
    _id: false,
  },
);

const travelRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    purpose: { type: String, trim: true },
    fromCity: { type: String, trim: true },
    toCity: { type: String, trim: true },
    departureDate: { type: Date },
    returnDate: { type: Date },
    mode: { type: String, trim: true },
    estExpense: { type: Number, min: 0, default: 0 },
    advanceRequested: { type: Number, min: 0, default: 0 },
    advanceReceived: { type: Number, min: 0, default: 0 },
    fare: { type: Number, min: 0, default: 0 },
    lodging: { type: lodgingSchema },
    lodgingAmount: { type: Number, min: 0, default: 0 },
    foodPerDiem: { type: Number, min: 0, default: 0 },
    localConveyance: { type: Number, min: 0, default: 0 },
    misc: { type: Number, min: 0, default: 0 },
    actualExpense: { type: Number, min: 0, default: 0 },
    hospitality: { type: Boolean, default: false },
    // Expense lines the client arranged directly (excluded from reimbursement).
    hospitalityLines: [{ type: String, trim: true }],
    hospitalityAmount: { type: Number, min: 0, default: 0 },
    balance: { type: Number, default: 0 },
    settlementStatus: { type: String, trim: true },
    settlementDate: { type: Date },
    // Which stages this request clears — Team Lead → HR → Finance.
    flowStages: { type: [String], default: () => ['tl', 'hr'] },
    stages: { type: approvalStagesField(), default: () => ({}) },
    status: {
      type: String,
      enum: TRAVEL_STATUSES,
      default: FLOW_STATUSES[0],
      index: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

travelRequestSchema.pre('validate', function autoBalance() {
  const lines = {
    fare: this.fare ?? 0,
    lodging: this.lodgingAmount ?? 0,
    foodPerDiem: this.foodPerDiem ?? 0,
    localConveyance: this.localConveyance ?? 0,
    misc: this.misc ?? 0,
  };
  const ticked = new Set(this.hospitalityLines ?? []);
  let actual = 0;
  let hospitality = 0;
  for (const [k, v] of Object.entries(lines)) {
    if (ticked.has(k)) hospitality += v;
    else actual += v;
  }
  if (actual > 0 || hospitality > 0 || this.actualExpense || this.hospitalityAmount) {
    this.actualExpense = actual;
    this.hospitalityAmount = hospitality;
  }
  this.hospitality = ticked.size > 0;
  this.balance = (this.advanceReceived ?? 0) - (this.actualExpense ?? 0);
  this.status = deriveFlowStatus(this.stages, this.flowStages);
});

export const TravelRequest =
  mongoose.models.TravelRequest ??
  mongoose.model('TravelRequest', travelRequestSchema);
