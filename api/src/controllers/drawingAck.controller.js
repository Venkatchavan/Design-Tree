import { Drawing } from '../models/Drawing.js';
import { DrawingAck } from '../models/DrawingAck.js';

// Client / architect acknowledgements for a project's drawings.
export async function listDrawingAcks(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) {
      const ids = await Drawing.find({ project: req.query.project }).distinct('_id');
      filter.drawing = { $in: ids };
    }
    const items = await DrawingAck.find(filter).select('drawing at');
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
