import mongoose from 'mongoose';

// Client/Architect acknowledgement of a stage submission (§4.16, portal).
const stageAckSchema = new mongoose.Schema(
  {
    stageStatus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StageStatus',
      required: true,
      index: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    remarks: { type: String, trim: true },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

stageAckSchema.index({ stageStatus: 1, by: 1 }, { unique: true });

export const StageAck =
  mongoose.models.StageAck ?? mongoose.model('StageAck', stageAckSchema);
