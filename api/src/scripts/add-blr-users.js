import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { ROLE_KEYS } from '../config/roles.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { USERS } from '../data/blr-users.js';
import { auditRoster } from '../utils/blrUserAudit.js';
import { importRoster } from '../utils/blrUserImport.js';

const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => !['--apply', '--dry-run'].includes(arg))) throw new Error('Use --dry-run (default) or --apply.');
if (apply && process.argv.includes('--dry-run')) throw new Error('Choose either --dry-run or --apply.');
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly. No default database is assumed.');
if (apply && (!process.env.BLR_INITIAL_PASSWORD || process.env.BLR_INITIAL_PASSWORD.length < 8)) {
  throw new Error('For --apply, set BLR_INITIAL_PASSWORD to an initial password of at least eight characters. Existing passwords are never reset.');
}
try {
  await connectDb(config.mongoUri);
  if (!apply) {
    const [users, employees] = await Promise.all([
      User.find({}).select('_id name email role isActive employee').lean(),
      Employee.find({}).select('_id firstName middleName lastName email user').lean(),
    ]);
    const report = auditRoster(USERS, users, employees);
    console.log(JSON.stringify({ mode: 'dry-run', writes: 0, rosterRows: report.rosterRows, databaseUsers: users.length, databaseEmployees: employees.length, counts: report.counts }));
  } else {
    const results = await importRoster({ roster: USERS, User, Employee, roleKeys: ROLE_KEYS, passwordHash: await bcrypt.hash(process.env.BLR_INITIAL_PASSWORD, 10) });
    const counts = {};
    for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
    console.log(JSON.stringify({ mode: 'apply', processed: results.length, counts }));
    if (results.some(result => result.status === 'failed')) process.exitCode = 1;
  }
} finally { await mongoose.disconnect(); }
