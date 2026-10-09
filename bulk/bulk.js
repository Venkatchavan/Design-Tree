// bulk/bulk.js — one-shot bulk import of Sl.2–39 (Sl.1 skipped: Founding Director comes from seed).
//
// Run order (from repo root, PowerShell):
//   docker compose up -d --build
//   docker compose run --rm api npm run seed
//   docker compose run --rm -v ${PWD}/bulk:/bulk api node /bulk/bulk.js
//
// What it does (mirrors api/src/controllers/employees.controller.js createEmployee):
//   Employee.create({firstName,lastName,designation,department,branch,email,status})
//   + User.create({name(first-name only),email,passwordHash,role,employee})
//   + links both sides (employee.user <-> user.employee).
// Idempotent: existing login email => skipped. Safe to re-run.
// Shared password for all: designtree@123 (no rotation enforced, per request).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Repo root = parent of bulk/ when installed at <root>/bulk/bulk.js.
// When staged elsewhere (Temp), REPO_ROOT fallback still lets /app imports win inside Docker.
const REPO_ROOT = path.resolve(__dirname, '..');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/designtree';
const PASSWORD = 'designtree@123';
const BRANCH = 'Bengaluru HQ';

// ---------------------------------------------------------------------------
// Data: Sl.2–39. `name` = first-name only (User.name). Employee keeps full split.
// role keys must match api/src/config/roles.js ROLE_KEYS.
// ---------------------------------------------------------------------------
const USERS = [
  { role: 'working_director', name: 'Prasanna', firstName: 'B.O.', lastName: 'Prasanna Kumar', email: 'prasanna@designtreeconsultants.com', designation: 'Jt. Managing Director', department: 'Management' },
  { role: 'executive_director', name: 'Pruthviraj', firstName: 'B E', lastName: 'Pruthviraj', email: 'pruthviraj@designtreeconsultants.com', designation: 'Director', department: 'Management' },
  { role: 'executive_director', name: 'Manjunath', firstName: 'B.', lastName: 'Manjunath', email: 'manjunath@designtreeconsultants.com', designation: 'Director', department: 'Management' },
  { role: 'technical_director', name: 'Santosh', firstName: 'Santosh Kumar', lastName: 'V R', email: 'santoshkumar@designtreeconsultants.com', designation: 'Technical Director - Design Management', department: 'Design Management' },
  { role: 'coordinator', name: 'Puneeth', firstName: 'Puneeth', lastName: 'D M', email: 'puneethdm@designtreeconsultants.com', designation: 'Design Coordinator - Design Management', department: 'Design Coordination' },
  { role: 'coordinator', name: 'Deepika', firstName: 'Deepika', lastName: 'G', email: 'deepikag@designtreeconsultants.com', designation: 'Design Coordinator - Design Management', department: 'Design Management' },
  { role: 'coordinator', name: 'Chaithra', firstName: 'Chaithra', lastName: '', email: 'chaithrar@designtreeconsultants.com', designation: 'Senior Design Coordinator', department: 'Design Management' },
  { role: 'technical_director', name: 'Prakash', firstName: 'H N', lastName: 'Prakash', email: 'prakash@designtreeconsultants.com', designation: 'Technical Director - Structures', department: 'Structure' },
  { role: 'technical_director', name: 'Arun', firstName: 'Arun', lastName: 'Karanth', email: 'arun@designtreeconsultants.com', designation: 'Technical Director - Structures', department: 'Structure' },
  { role: 'team_lead', name: 'Shobhit', firstName: 'Shobhit', lastName: 'S H', email: 'shobhitsh@designtreeconsultants.com', designation: 'Team Lead - Structures', department: 'Structure' },
  { role: 'team_lead', name: 'Karthik', firstName: 'Karthik', lastName: 'H', email: 'hkarthik@designtreeconsultants.com', designation: 'Team Lead - Structures', department: 'Structure' },
  { role: 'associate_director', name: 'Srinivasa', firstName: 'Srinivasa Rao', lastName: 'Bollimuntha', email: 'srinivasarao@designtreeconsultants.com', designation: 'Associate Director - Structure', department: 'Structure' },
  { role: 'team_lead', name: 'Pradeepa', firstName: 'Pradeepa', lastName: 'J', email: 'pradeepaj@designtreeconsultants.com', designation: 'Principal Team Lead - Structure', department: 'Structure' },
  { role: 'engineer_drafter', name: 'Sandeep', firstName: 'Sandeep', lastName: 'N', email: 'sandeepn@designtreeconsultants.com', designation: 'Sr. Design Engineer - Structure', department: 'Structure' },
  { role: 'team_lead', name: 'Praveen', firstName: 'Praveen', lastName: 'Telker', email: 'praveentelkar@designtreeconsultants.com', designation: 'Sr. Team Lead - Structure', department: 'Structure' },
  { role: 'team_lead', name: 'Patil', firstName: 'Patil', lastName: 'N D', email: 'patil@designtreeconsultants.com', designation: 'Team Lead - PHE', department: 'PHE' },
  { role: 'assoc_technical_director', name: 'Lakshmi', firstName: 'Lakshmi', lastName: 'M', email: 'lakshmi@designtreeconsultants.com', designation: 'Associate Technical Director - PHE', department: 'PHE' },
  { role: 'engineer_drafter', name: 'Prasad', firstName: 'Prasad Gowda', lastName: 'M', email: 'mprasad@designtreeconsultants.com', designation: 'Sr. Design Engineer - PHE', department: 'PHE' },
  { role: 'engineer_drafter', name: 'Bindhu', firstName: 'Bindhu', lastName: '', email: 'bindusm@designtreeconsultants.com', designation: 'Asst. Design Engineer - PHE', department: 'PHE' },
  { role: 'assoc_technical_director', name: 'Sowmya', firstName: 'D U', lastName: 'Sowmya', email: 'dusowmya@designtreeconsultants.com', designation: 'Associate Technical Director - Electrical', department: 'Electrical' },
  { role: 'engineer_drafter', name: 'Kavya', firstName: 'Kavya', lastName: 'R', email: 'kavyar@designtreeconsultants.com', designation: 'Sr. Design Engineer - Electrical', department: 'Electrical' },
  { role: 'executive_director', name: 'Mitra', firstName: 'Mitra', lastName: 'Sripada', email: 'mitra@designtreeconsultants.com', designation: 'Executive Director', department: 'Electrical' },
  { role: 'team_lead', name: 'Sudheer', firstName: 'Sudheer', lastName: 'Naik', email: 'sudheernaik@designtreeconsultants.com', designation: 'Principal Team Lead - Electrical', department: 'Electrical' },
  { role: 'engineer_drafter', name: 'Basavakumar', firstName: 'Basavakumar', lastName: '', email: 'basavakumar@designtreeconsultants.com', designation: 'Sr. Design Engineer - Electrical', department: 'Electrical' },
  { role: 'team_lead', name: 'Sujiba', firstName: 'Sujiba', lastName: '', email: 'sujiba@designtreeconsultants.com', designation: 'Sr. Team Lead - Electrical', department: 'Electrical' },
  { role: 'assoc_technical_director', name: 'Azharuddin', firstName: 'Azharuddin', lastName: '', email: 'azharuddin@designtreeconsultants.com', designation: 'Associate Technical Director - Electrical', department: 'Electrical' },
  { role: 'team_lead', name: 'Prashanth', firstName: 'Prashanth', lastName: 'D.K', email: 'prashanthdk@designtreeconsultants.com', designation: 'Principal Team Lead - HVAC', department: 'HVAC' },
  { role: 'associate_director', name: 'Kartick', firstName: 'Kartick V', lastName: 'Bhatt', email: 'kvbhat@designtreeconsultants.com', designation: 'Associate Director - HVAC', department: 'HVAC' },
  { role: 'assoc_technical_director', name: 'Madhu', firstName: 'Madhu', lastName: 'C', email: 'madhuc@designtreeconsultants.com', designation: 'Associate Technical Director - HVAC', department: 'HVAC' },
  { role: 'engineer_drafter', name: 'Sagar', firstName: 'Sagar', lastName: 'Sanadi', email: 'sagars@designtreeconsultants.com', designation: 'Asst. Design Engineer - HVAC', department: 'HVAC' },
  { role: 'engineer_drafter', name: 'Sathisha', firstName: 'Sathisha', lastName: 'H', email: 'sathishah@designtreeconsultants.com', designation: 'Sr. Design Engineer - HVAC', department: 'HVAC' },
  { role: 'engineer_drafter', name: 'Dhanvantri', firstName: 'Dhanvantri', lastName: 'Prasad', email: 'dhanvantri@designtreeconsultants.com', designation: 'Design Engineer - HVAC', department: 'HVAC' },
  { role: 'engineer_drafter', name: 'Harsha', firstName: 'Harsha', lastName: 'H', email: 'harshah@designtreeconsultants.com', designation: 'Design Engineer - Fire & Life Safety', department: 'Fire & Life Safety' },
  { role: 'associate_director', name: 'Prashanth', firstName: 'Prashanth', lastName: 'Gururaj', email: 'prashanth@designtreeconsultants.com', designation: 'Associate Director - Fire & Life Safety', department: 'Fire & Life Safety' },
  { role: 'technical_director', name: 'Gowrish', firstName: 'Gowrish', lastName: 'S.B', email: 'gowrish@designtreeconsultants.com', designation: 'Technical Director - Fire & LS', department: 'Fire & Life Safety' },
  { role: 'team_lead', name: 'Nagabhushan', firstName: 'Nagabhushan', lastName: 'Singri', email: 'nagabhushansingri@designtreeconsultants.com', designation: 'Team Lead - Fire & Life Safety', department: 'Fire & Life Safety' },
  { role: 'team_lead', name: 'Mohana', firstName: 'Mohana', lastName: 'R', email: 'mohanar@designtreeconsultants.com', designation: 'Team Lead - Fire & Life Safety', department: 'Fire & Life Safety' },
  { role: 'engineer_drafter', name: 'Shrikanth', firstName: 'Shrikanth', lastName: '', email: 'shrikanth@designtreeconsultants.com', designation: 'Sr. Design Engineer - Fire & Life Safety', department: 'Fire & Life Safety' },
];

// ---------------------------------------------------------------------------
// Dependency loading: works inside the api image (/app/...) AND from repo root.
// Inside Docker (mount-run) /app/package.json + /app/src/... always exist.
// ---------------------------------------------------------------------------
function loadLib(libName) {
  const candidates = ['/app/package.json', path.join(REPO_ROOT, 'api', 'package.json')];
  for (const pkgPath of candidates) {
    try {
      if (fs.existsSync(pkgPath)) return createRequire(pkgPath)(libName);
    } catch {
      // try next
    }
  }
  return createRequire(import.meta.url)(libName);
}

async function loadModels() {
  const inContainer =
    fs.existsSync('/app/src/models/User.js') && fs.existsSync('/app/src/models/Employee.js');
  if (inContainer) {
    const [{ User }, { Employee }, roles] = await Promise.all([
      import('file:///app/src/models/User.js'),
      import('file:///app/src/models/Employee.js'),
      import('file:///app/src/config/roles.js').catch(() => ({})),
    ]);
    return { User, Employee, ROLE_KEYS: roles?.ROLE_KEYS ?? null };
  }
  // Local fallback: <repo>/api/src/...
  const userUrl = pathToFileURL(path.join(REPO_ROOT, 'api', 'src', 'models', 'User.js')).href;
  const empUrl = pathToFileURL(path.join(REPO_ROOT, 'api', 'src', 'models', 'Employee.js')).href;
  const rolesUrl = pathToFileURL(path.join(REPO_ROOT, 'api', 'src', 'config', 'roles.js')).href;
  const [{ User }, { Employee }, roles] = await Promise.all([
    import(userUrl),
    import(empUrl),
    import(rolesUrl).catch(() => ({})),
  ]);
  return { User, Employee, ROLE_KEYS: roles?.ROLE_KEYS ?? null };
}

async function main() {
  const mongoose = loadLib('mongoose');
  const bcrypt = loadLib('bcryptjs');
  const { User, Employee, ROLE_KEYS } = await loadModels();

  if (!MONGO_URI) throw new Error('MONGO_URI is empty. In Docker it comes from compose; locally set api/.env.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Importing ${USERS.length} users (Sl.2-39, Sl.1 skipped)...`);

  let created = 0;
  let skipped = 0;
  const failed = [];

  for (const u of USERS) {
    const email = String(u.email).toLowerCase().trim();
    try {
      if (ROLE_KEYS && !ROLE_KEYS.includes(u.role)) throw new Error(`Unknown role: ${u.role}`);
      const clash = await User.findOne({ email });
      if (clash) {
        console.log(`SKIP  ${email} (login exists, role=${clash.role})`);
        skipped += 1;
        continue;
      }
      const employee = await Employee.create({
        firstName: u.firstName,
        lastName: u.lastName || undefined,
        designation: u.designation,
        department: u.department,
        branch: BRANCH,
        email,
        status: 'Active',
      });
      try {
        const displayName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
        const user = await User.create({
          name: u.name || displayName || email,
          email,
          passwordHash: await bcrypt.hash(PASSWORD, 10),
          role: u.role,
          employee: employee._id,
        });
        employee.user = user._id;
        await employee.save();
      } catch (err) {
        await Employee.findByIdAndDelete(employee._id).catch(() => {});
        throw err;
      }
      console.log(`OK    ${email} role=${u.role} name=${u.name}`);
      created += 1;
    } catch (err) {
      const msg = err?.code === 11000 ? 'duplicate key' : (err?.message ?? String(err));
      console.error(`FAIL  ${email}: ${msg}`);
      failed.push({ email, error: msg });
    }
  }

  console.log('----------------------------------------');
  console.log(`Done. created=${created} skipped=${skipped} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.error(` - ${f.email}: ${f.error}`);
  }
  await mongoose.disconnect();
  if (failed.length) process.exit(1);
}

await main().catch(async (err) => {
  console.error('Bulk import crashed:', err?.message ?? err);
  try {
    const mongoose = loadLib('mongoose');
    await mongoose.disconnect().catch(() => {});
  } catch {
    // ignore
  }
  process.exit(1);
});
