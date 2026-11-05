// One-off data repair (05 Nov 2026 client note): "Arun Kumar S R" (DT-CON-28,
// Principal Team Lead - Structure) is listed as "Arunkumar Sekar", an engineer.
// The seed list had given the PTL's email to a different person, Arunkumar Sekar
// (DT-25-1559, PHE), so the PTL's login and employee took that name and role.
//   node src/scripts/repair-arun-kumar-sr.js [--dry-run | --apply]
// Dry run (default) writes nothing. Only this one login/employee pair is touched.
import mongoose from 'mongoose';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';

const EMAIL = 'arunkumar@designtreeconsultants.com';
const NAME = 'Arun Kumar S R';
const EMP_ID = 'DT-CON-28';
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some((a) => !['--apply', '--dry-run'].includes(a))) throw new Error('Use --dry-run (default) or --apply.');
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly. No default database is assumed.');

try {
  await connectDb(config.mongoUri);
  const [user, employees] = await Promise.all([User.findOne({ email: EMAIL }), Employee.find({ $or: [{ email: EMAIL }, { empId: EMP_ID }] })]);
  const ptl = employees.find((e) => e.empId === EMP_ID) ?? employees.find((e) => e.email === EMAIL);
  if (!user && !ptl) throw new Error(`Neither a login for ${EMAIL} nor employee ${EMP_ID} exists; nothing to repair.`);
  const plan = [];
  if (user && (user.name !== NAME || user.role !== 'team_lead')) plan.push({ record: 'User', id: String(user._id), from: { name: user.name, role: user.role }, to: { name: NAME, role: 'team_lead' } });
  if (ptl && [ptl.firstName, ptl.middleName, ptl.lastName].filter(Boolean).join(' ') !== NAME) {
    plan.push({ record: 'Employee', id: String(ptl._id), empId: ptl.empId, from: { firstName: ptl.firstName, middleName: ptl.middleName, lastName: ptl.lastName }, to: { firstName: NAME } });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', plan }, null, 2));
  if (apply) {
    for (const step of plan) {
      if (step.record === 'User') await User.updateOne({ _id: step.id }, { $set: step.to });
      else await Employee.updateOne({ _id: step.id }, { $set: { firstName: NAME }, $unset: { middleName: 1, lastName: 1 } });
    }
    console.log(`Applied ${plan.length} change(s). Ask the user to sign in again so the Team Lead role applies.`);
  }
} finally { await mongoose.disconnect(); }
