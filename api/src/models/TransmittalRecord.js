import mongoose from 'mongoose';

// Company-wide historical register of printed/issued transmittals (§4.9).
// Separate from the Admin Transmittal workflow (§4.10).
const transmittalRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    projectName: { type: String, trim: true },
    dept: { type: String, trim: true },
    print: { type: String, trim: true },
    docType: { type: String, trim: true },
    service: { type: String, trim: true },
    team: { type: String, trim: true },
    trNo: { type: String, trim: true, uppercase: true },
    qty: { type: Number, min: 0, default: 0 },
    sets: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    rev: { type: String, trim: true },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

transmittalRecordSchema.pre('validate', function autoTotal() {
  if ((this.qty ?? 0) > 0 && (this.sets ?? 0) > 0) {
    this.total = this.qty * this.sets;
  }
});

export const TransmittalRecord =
  mongoose.models.TransmittalRecord ??
  mongoose.model('TransmittalRecord', transmittalRecordSchema);
