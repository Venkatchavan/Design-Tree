import mongoose from 'mongoose';

export const SUPPORT_KINDS = ['salary-slip', 'complaint', 'suggestion', 'query'];
export const SUPPORT_STATUSES = ['Open', 'In Progress', 'Resolved', 'Issued'];

const remarkSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, trim: true },
    _id: false,
  },
);

const supportTicketSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: SUPPORT_KINDS, required: true, index: true },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
    month: { type: String, trim: true },
    category: { type: String, trim: true },
    subject: { type: String, trim: true },
    details: { type: String, trim: true },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: 'Open',
      index: true,
    },
    assignedTo: { type: String, trim: true },
    remarks: [remarkSchema],
    issuedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const SupportTicket =
  mongoose.models.SupportTicket ??
  mongoose.model('SupportTicket', supportTicketSchema);
