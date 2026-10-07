import mongoose from 'mongoose';

const briefSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
      index: true,
    },
    marketingReady: { type: Boolean, default: false },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    highlights: [{ type: String, trim: true }],
    testimonial: { type: String, trim: true },
    awards: { type: String, trim: true },
    photos: [{ type: String, trim: true }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const collateralSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    requestType: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Requested', 'In Progress', 'Delivered'],
      default: 'Requested',
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const contactSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    organization: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    trade: { type: String, trim: true },
    department: { type: String, trim: true },
    notes: { type: String, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const MarketingBrief =
  mongoose.models.MarketingBrief ??
  mongoose.model('MarketingBrief', briefSchema);
export const CollateralRequest =
  mongoose.models.CollateralRequest ??
  mongoose.model('CollateralRequest', collateralSchema);
export const Contact =
  mongoose.models.Contact ?? mongoose.model('Contact', contactSchema);
