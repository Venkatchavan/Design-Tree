// Create employee records + logins for the other branches' 2026 mail-ID workbooks.
//   node src/scripts/import-branch-employees.js --dir "<folder with the .xlsx files>" [--dry-run | --apply] [--verbose]
// Dry run (default) writes nothing. Rules:
//   - a row with no usable email is skipped (listed in the report);
//   - a row whose email already belongs to an employee or a login is skipped untouched;
//   - existing employees/logins/roles are never overwritten (same planner as the BLR import).
// New logins use BRANCH_INITIAL_PASSWORD (>= 8 chars) for --apply; it is never printed.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { Branch } from '../models/Branch.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { applyImport, normalizedEmail, pickBranch, planImport } from '../utils/blrEmployeeImport.js';
import { cleanBranchRows, readBranchWorkbooks } from '../utils/branchRosterImport.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const option = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
for (let i = 0; i < args.length; i += 1) {
  if (!['--dir', '--apply', '--dry-run', '--verbose'].includes(args[i])) throw new Error(`Unknown argument ${args[i]}.`);
  if (args[i] === '--dir') i += 1;
}
const apply = flag('--apply');
if (apply && flag('--dry-run')) throw new Error('Choose either --dry-run or --apply.');
if (!option('--dir')) throw new Error('Pass --dir <folder containing the branch .xlsx files>.');
if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI explicitly. No default database is assumed.');
if (apply && (process.env.BRANCH_INITIAL_PASSWORD ?? '').length < 8) throw new Error('For --apply set BRANCH_INITIAL_PASSWORD (at least 8 characters).');

const count = (rows, key) => rows.reduce((a, r) => ({ ...a, [r[key]]: (a[r[key]] ?? 0) + 1 }), {});

try {
  const { roster, skipped } = cleanBranchRows(await readBranchWorkbooks(option('--dir')));
  await connectDb(config.mongoUri);
  const [employees, users, branches] = await Promise.all([
    Employee.find({}).select('_id empId firstName middleName lastName email designation department branch reportingManager teamViewOf headOfDepartments user status').lean(),
    User.find({}).select('_id name email role isActive employee').lean(),
    Branch.find({}).select('name isActive').lean(),
  ]);

  // Rule: an email that already exists (employee or login) is skipped untouched.
  const taken = new Set([...employees.map((e) => normalizedEmail(e.email)), ...users.map((u) => normalizedEmail(u.email))].filter(Boolean));
  const existing = roster.filter((r) => taken.has(r.email)).map((r) => ({ branch: r.branch, empId: r.empId, name: r.name, reason: `Email ${r.email} already exists.` }));
  const fresh = roster.filter((r) => !taken.has(r.email));

  const byBranch = new Map();
  for (const r of fresh) (byBranch.get(r.branch) ?? byBranch.set(r.branch, []).get(r.branch)).push(r);
  const plan = [], branchProblems = [];
  for (const [name, rows] of byBranch) {
    const picked = pickBranch({ branches, employees, override: name });
    if (picked.error) { branchProblems.push({ branch: name, people: rows.length, problem: picked.error }); continue; }
    plan.push(...planImport({ roster: rows, employees, users, branch: picked.branch }).map((p) => ({ ...p, branch: picked.branch })));
  }
  const conflicts = plan.filter((r) => r.action === 'conflict' || r.login.action === 'conflict').map((r) => ({ branch: r.branch, empId: r.empId, name: r.name, reason: r.reason ?? r.login.reason }));
  const willCreate = plan.filter((r) => r.action !== 'conflict' && r.login.action === 'create');
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    database: mongoose.connection.host + '/' + mongoose.connection.name,
    rowsInWorkbooks: roster.length + skipped.length,
    skippedNoUsableEmail: skipped.length, skippedEmailExists: existing.length,
    branchesMissingFromApp: branchProblems, conflicts,
    loginsToCreate: willCreate.length,
    loginsByBranch: count(willCreate, 'branch'),
    loginsByRole: willCreate.reduce((a, r) => ({ ...a, [r.login.role]: (a[r.login.role] ?? 0) + 1 }), {}),
  };

  if (!apply) {
    console.log(JSON.stringify({ ...summary, writes: 0 }, null, 2));
    if (flag('--verbose')) console.log(JSON.stringify({ skipped, existing, creating: willCreate.map((r) => ({ branch: r.branch, empId: r.empId, name: r.name, designation: r.create?.designation, department: r.department, role: r.login.role, email: r.create?.email })) }, null, 2));
  } else {
    const passwordHash = await bcrypt.hash(process.env.BRANCH_INITIAL_PASSWORD, 10);
    const { results } = await applyImport({ plan, heads: [], Employee, User, passwordHash });
    console.log(JSON.stringify({ ...summary, employees: count(results, 'status'), logins: count(results.filter((r) => r.login), 'login'), failures: results.filter((r) => ['failed', 'conflict'].includes(r.status)) }, null, 2));
    if (results.some((r) => r.status === 'failed')) process.exitCode = 1;
  }
} finally { await mongoose.disconnect(); }
