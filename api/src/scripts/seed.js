import bcrypt from 'bcryptjs';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';

// Seeds ONLY the superuser login (employee + login provisioning). Nothing else.
const { seedName, seedEmail, seedPassword } = config;

if (!seedName || !seedEmail || !seedPassword) {
  console.error('Missing SEED_NAME, SEED_EMAIL, or SEED_PASSWORD.');
  process.exit(1);
}

await connectDb(config.mongoUri);

const passwordHash = await bcrypt.hash(seedPassword, 10);

const user = await User.findOneAndUpdate(
  { email: seedEmail },
  {
    $set: {
      name: seedName,
      passwordHash,
      role: 'superuser',
      isActive: true,
    },
  },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
);

console.log(`Seeded superuser: ${user.email}`);
process.exit(0);
