import mongoose from 'mongoose';

// Client/Architect acknowledgement of a drawing submission (§4.16).
const drawingAckSchema = new mongoose.Schema(
  {
    drawing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drawing',
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

drawingAckSchema.index({ drawing: 1, by: 1 }, { unique: true });

export const DrawingAck =
  mongoose.models.DrawingAck ??
  mongoose.model('DrawingAck', drawingAckSchema);
