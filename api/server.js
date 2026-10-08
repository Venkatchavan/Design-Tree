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
  if (err?.codeName !== 'IndexNotFound' && err?.code !== 27) throw err;
}
await Transmittal.createIndexes();

const app = createApp();
// Plain http server (TLS terminates at nginx in production) doubling as
// the socket.io transport for live bell pushes (see src/realtime/io.js).
const httpServer = http.createServer(app);
initRealtime(httpServer);
httpServer.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
