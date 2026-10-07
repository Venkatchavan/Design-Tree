import { createApp } from './src/app.js';
import { config, requireJwtSecret } from './src/config/config.js';
import { connectDb } from './src/config/db.js';

requireJwtSecret();

await connectDb(config.mongoUri);

const app = createApp();
app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
