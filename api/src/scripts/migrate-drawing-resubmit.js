// One-off: drawings set to the retired "Resubmit" status become "Awaiting"
// (client list 11-11-2026), and old revision rows saved with coded stages
// (CD/SD/DD/TD) get the process-manual stage name.
// Usage: MONGO_URI=... node src/scripts/migrate-drawing-resubmit.js [--apply]
import mongoose from 'mongoose';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { Drawing } from '../models/Drawing.js';
import { Revision } from '../models/Revision.js';

const apply = process.argv.includes('--apply');
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly. No default database is assumed.');

const STAGE_CODES = { CD: 'Concept', SD: 'Schematic', DD: 'Design development', TD: 'Tender' };

try {
  await connectDb(config.mongoUri);
  const drawings = await Drawing.countDocuments({ status: 'Resubmit' });
  const stages = {};
  for (const code of Object.keys(STAGE_CODES)) stages[code] = await Revision.countDocuments({ stage: code });
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', drawingsResubmit: drawings, revisionStageCodes: stages }));
  } else {
    const d = await Drawing.updateMany({ status: 'Resubmit' }, { $set: { status: 'Awaiting' } });
    const r = {};
    for (const [code, name] of Object.entries(STAGE_CODES)) {
      r[code] = (await Revision.updateMany({ stage: code }, { $set: { stage: name } })).modifiedCount;
    }
    console.log(JSON.stringify({ mode: 'apply', drawingsUpdated: d.modifiedCount, revisionStagesUpdated: r }));
  }
} finally {
  await mongoose.disconnect();
}
