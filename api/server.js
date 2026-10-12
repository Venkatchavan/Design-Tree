import http from 'node:http';
import { createApp } from './src/app.js';
import { config, requireJwtSecret } from './src/config/config.js';
import { connectDb } from './src/config/db.js';
import { Transmittal } from './src/models/Transmittal.js';
import { initRealtime } from './src/realtime/io.js';

requireJwtSecret();

await connectDb(config.mongoUri);

// Older Phase 3 dev builds created a unique single-field TR index. A TR number
// can cover several drawings, so replace it with the schema's non-unique index.
try {
  await Transmittal.collection.dropIndex('trNo_1');
} catch (err) {
  const okToIgnore =
    ['IndexNotFound', 'NamespaceNotFound'].includes(err?.codeName) ||
    [27, 26].includes(err?.code);
  if (!okToIgnore) throw err;
}
await Transmittal.createIndexes();

// One-time backfill: human-readable SV-/DA- sequences for site visits and
// discrepancies created before numbering existed. Idempotent (only docs
// missing the id, ordered oldest-first per calendar year).
try {
  const { SiteVisit } = await import('./src/models/SiteVisit.js');
  const { Discrepancy } = await import('./src/models/Discrepancy.js');
  const { PeerReview } = await import('./src/models/PeerReview.js');
  const { Rfi } = await import('./src/models/Rfi.js');
  const { Counter } = await import('./src/models/Counter.js');
  for (const [Model, field, prefix, pad, counterName] of [
    [SiteVisit, 'visitId', 'SV', 3, 'site-visit'],
    [Discrepancy, 'discId', 'DA', 2, 'discrepancy'],
    [PeerReview, 'jobNo', 'PR', 3, 'peer-review'],
    [Rfi, 'rfiNo', 'RFI', 3, 'rfi'],
  ]) {
    const missing = await Model.find({ [field]: { $in: [null, ''] } })
      .select('date createdAt')
      .sort({ date: 1, createdAt: 1 });
    for (const doc of missing) {
      const year = new Date(doc.date ?? doc.createdAt ?? Date.now()).getFullYear();
      const counter = await Counter.findOneAndUpdate(
        { name: `${counterName}-${year}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      await Model.updateOne(
        { _id: doc._id, [field]: { $in: [null, ''] } },
        { $set: { [field]: `${prefix}-${year}-${String(counter.seq).padStart(pad, '0')}` } },
      );
    }
  }
  // Legacy discrepancies predate kind tracking; default to Construction.
  await Discrepancy.updateMany(
    { kind: { $in: [null, ''] } },
    { $set: { kind: 'Construction' } },
  );
} catch (err) {
  console.error('ID backfill skipped:', err?.message ?? err);
}

const app = createApp();
// Plain http server (TLS terminates at nginx in production) doubling as
// the socket.io transport for live bell pushes (see src/realtime/io.js).
const httpServer = http.createServer(app);
initRealtime(httpServer);
httpServer.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
