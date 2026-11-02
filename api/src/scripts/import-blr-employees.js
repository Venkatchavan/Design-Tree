// Import the final Bengaluru employee list with team hierarchy.
//   node src/scripts/import-blr-employees.js [--dry-run | --apply] [--file <updated list.xlsx>] [--branch "<name>"]
// Dry run (default) writes nothing. Existing employees, logins, roles and filled
// fields are never duplicated or overwritten; only empty fields/links are added.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { Branch } from '../models/Branch.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { USERS } from '../data/blr-users.js';
import { ROSTER, DEPARTMENT_HEADS } from '../data/blr-roster-20261031.js';
import { applyImport, mergeEmails, normalizedEmail, pickBranch, planHeads, planImport } from '../utils/blrEmployeeImport.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const known = new Set(['--apply', '--dry-run', '--file', '--branch', '--verbose']);
for (let i = 0; i < args.length; i += 1) {
  if (!known.has(args[i])) throw new Error(`Unknown argument ${args[i]}. Use --dry-run (default), --apply, --file <xlsx>, --branch "<name>", --verbose.`);
  if (['--file', '--branch'].includes(args[i])) i += 1;
}
const apply = flag('--apply');
if (apply && flag('--dry-run')) throw new Error('Choose either --dry-run or --apply.');
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly. No default database is assumed.');
if (apply && (!process.env.BLR_INITIAL_PASSWORD || process.env.BLR_INITIAL_PASSWORD.length < 8)) {
  throw new Error('For --apply, set BLR_INITIAL_PASSWORD (at least 8 characters). It is used only for new logins; existing passwords are never changed.');
}

// Optional updated copy of the main list (same layout: EMP ID in column B, Email ID in column E).
async function emailUpdates(path) {
  const updates = new Map();
  if (!path) return updates;
  const book = XLSX.read(await readFile(resolve(path)), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase());
  const empCol = header.findIndex((h) => h.startsWith('emp id'));
  const mailCol = header.findIndex((h) => h.startsWith('email'));
  if (empCol < 0 || mailCol < 0) throw new Error('The workbook needs "EMP ID" and "Email ID" columns in its first row.');
  for (const row of rows.slice(1)) {
    const empId = String(row[empCol] ?? '').trim().toUpperCase();
    const email = normalizedEmail(row[mailCol]);
    if (empId && email) updates.set(empId, email);
  }
  return updates;
}

const count = (rows, key) => rows.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] ?? 0) + 1 }), {});

try {
  const updates = await emailUpdates(option('--file'));
  const roster = mergeEmails(ROSTER, updates);
  const notInRoster = [...updates.keys()].filter((empId) => !roster.some((r) => r.empId === empId));
  await connectDb(config.mongoUri);
  const [employees, users, branches] = await Promise.all([
    Employee.find({}).select('_id empId firstName middleName lastName email designation department branch reportingManager teamViewOf headOfDepartments user status').lean(),
    User.find({}).select('_id name email role isActive employee').lean(),
    Branch.find({}).select('name isActive').lean(),
  ]);
  const picked = pickBranch({ branches, employees, override: option('--branch') });
  if (picked.error) {
    console.error(JSON.stringify({ error: picked.error, activeBranches: picked.active, branchValuesOnEmployees: picked.legacy }, null, 2));
    process.exitCode = 1;
  } else {
    const roleByEmail = new Map(USERS.map((u) => [normalizedEmail(u.email), u.role]));
    const plan = planImport({ roster, employees, users, branch: picked.branch, roleByEmail });
    const heads = planHeads({ heads: DEPARTMENT_HEADS, employees, users });
    const header = { mode: apply ? 'apply' : 'dry-run', branch: picked.branch, branchSource: picked.source, rosterRows: roster.length, databaseEmployees: employees.length, databaseLogins: users.length, emailsFromFile: updates.size, fileRowsNotInRoster: notInRoster };
    const conflicts = plan.filter((r) => r.action === 'conflict' || r.login.action === 'conflict').map((r) => ({ name: r.name, empId: r.empId, reason: r.reason ?? r.login.reason }));
    const kept = plan.filter((r) => r.kept?.length).map((r) => ({ name: r.name, empId: r.empId, keptExisting: r.kept }));
    const noLogin = plan.filter((r) => r.action !== 'conflict' && r.login.action === 'none' && r.login.reason).map((r) => ({ name: r.name, empId: r.empId, department: r.department, reason: r.login.reason }));
    if (!apply) {
      console.log(JSON.stringify({ ...header, writes: 0,
        employees: count(plan, 'action'),
        logins: count(plan.map((r) => ({ a: r.action === 'conflict' ? 'skipped (conflict)' : r.login.action })), 'a'),
        departmentHeads: heads.map((h) => ({ name: h.name, action: h.action, departments: h.departments, reason: h.reason })),
        conflicts, keptExistingValues: kept.length, withoutLogin: noLogin.length }, null, 2));
      if (flag('--verbose')) console.log(JSON.stringify({ keptExisting: kept, withoutLogin: noLogin }, null, 2));
    } else {
      const passwordHash = await bcrypt.hash(process.env.BLR_INITIAL_PASSWORD, 10);
      const { results, headResults } = await applyImport({ plan, heads, Employee, User, passwordHash });
      console.log(JSON.stringify({ ...header,
        employees: count(results, 'status'),
        logins: count(results.filter((r) => r.login), 'login'),
        departmentHeads: headResults,
        conflicts: results.filter((r) => ['conflict', 'failed'].includes(r.status) || r.login === 'conflict'),
        keptExistingValues: kept.length, withoutLogin: noLogin.length }, null, 2));
      if (flag('--verbose')) console.log(JSON.stringify({ keptExisting: kept, withoutLogin: noLogin }, null, 2));
      if (results.some((r) => r.status === 'failed') || headResults.some((h) => h.status === 'failed')) process.exitCode = 1;
    }
  }
} finally { await mongoose.disconnect(); }
