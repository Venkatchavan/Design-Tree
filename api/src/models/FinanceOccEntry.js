import mongoose from 'mongoose';

// Finance Operation Control Center (OCC) — reference: FIN_OCC_HTML iframe app.
// Three logical types in one collection (S.pos / S.travel / S.reimb):
//   po      = purchase order (poNo, vendor, dept, approval, payment)
//   advance = travel advance & settlement (location, dates, settlement, checklist)
//   claim   = hospitality / reimbursement claim (client, linked travel, payment)
// Shared: docsBlock(docs) + histBlock(history) + bill-verification checklist.
export const FIN_OCC_KINDS = ['advance', 'claim', 'po'];
export const FIN_OCC_STATUSES = [
  'Pending',
  'Verified',
  'Approved',
  'Paid',
  'Rejected',
];
export const FIN_OCC_APPROVALS = ['Pending', 'In Review', 'Approved'];
export const FIN_OCC_PAYMENTS = ['Pending', 'Paid'];
export const FIN_OCC_SETTLEMENTS = ['Not started', 'Pending', 'Settled'];

const docSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    file: { type: String, trim: true },
    _id: false,
  },
);

const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, trim: true },
    _id: false,
  },
);

const financeOccSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: FIN_OCC_KINDS, required: true, index: true },
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
    amount: { type: Number, min: 0, default: 0 },
    purpose: { type: String, trim: true },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: FIN_OCC_STATUSES,
      default: 'Pending',
      index: true,
    },
    // PO fields (reference S.pos)
    poNo: { type: String, trim: true, sparse: true },
    vendor: { type: String, trim: true },
    dept: { type: String, trim: true },
    approval: { type: String, enum: FIN_OCC_APPROVALS, default: 'Pending' },
    payment: { type: String, enum: FIN_OCC_PAYMENTS, default: 'Pending' },
    requestedBy: { type: String, trim: true },
    // Travel-advance fields (reference S.travel)
    location: { type: String, trim: true },
    fromDate: { type: Date },
    toDate: { type: Date },
    settlement: {
      type: String,
      enum: FIN_OCC_SETTLEMENTS,
      default: 'Not started',
    },
    // Hospitality-claim fields (reference S.reimb)
    client: { type: String, trim: true },
    linkedTravel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinanceOccEntry',
    },
    // Physical bill checklist (reference v{} + missing remarks).
    // Verified/Approved/Paid stay locked until checklist complete.
    verification: {
      checks: { type: Map, of: Boolean, default: {} },
      missing: { type: String, trim: true },
      completed: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    docs: [docSchema],
    history: [historySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

financeOccSchema.index({ kind: 1, status: 1, createdAt: -1 });

export const FinanceOccEntry =
  mongoose.models.FinanceOccEntry ??
  mongoose.model('FinanceOccEntry', financeOccSchema);
