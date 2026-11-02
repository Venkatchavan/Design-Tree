import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { auditRoster, rosterFromWorkbook } from '../utils/blrUserAudit.js';

const args = process.argv.slice(2);
function argument(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; }
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly to the database to audit. No default database is assumed.');
const file = argument('--file');
if (!file) throw new Error('Provide --file with the employee workbook path.');
const workbook = XLSX.read(await readFile(resolve(file)), { type: 'buffer' });
try {
  await connectDb(config.mongoUri);
  const [users, employees] = await Promise.all([
    User.find({}).select('_id name email role isActive employee').lean(),
    Employee.find({}).select('_id firstName middleName lastName email user').lean(),
  ]);
  const report = auditRoster(rosterFromWorkbook(workbook, XLSX), users, employees);
  if (argument('--out')) await writeFile(resolve(argument('--out')), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ readOnly: true, databaseUsers: users.length, databaseEmployees: employees.length, rosterRows: report.rosterRows, counts: report.counts,
    duplicateUserEmails: report.duplicateDatabaseEmails.users.length, duplicateEmployeeEmails: report.duplicateDatabaseEmails.employees.length, reportWritten: Boolean(argument('--out')) }));
} finally { await mongoose.disconnect(); }
