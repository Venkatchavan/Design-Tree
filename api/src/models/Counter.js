import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Counter =
  mongoose.models.Counter ?? mongoose.model('Counter', counterSchema);

export async function nextNumber(name, prefix) {
  const year = new Date().getFullYear();
  const doc = await Counter.findOneAndUpdate(
    { name: `${name}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `${prefix}-${year}-${String(doc.seq).padStart(4, '0')}`;
}
