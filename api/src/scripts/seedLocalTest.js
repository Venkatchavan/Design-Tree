// LOCAL DEVELOPMENT ONLY — small test dataset for checking the 13 Nov 2026
// changes (meetings, RFIs, DBR, revisions, My Team hours). Never run against
// production. Idempotent: re-running updates the same records.
//
//   node src/scripts/seedLocalTest.js
//
// Logins (all share LOCAL_TEST_PASSWORD, default below):
//   td.test@designtree.local    Technical Director
//   ad.test@designtree.local    Associate Director
//   tl.test@designtree.local    Team Lead (Principal Team Lead - Structure)
//   eng.test@designtree.local   Engineer / Drafter
//   spoc.test@designtree.local  Coordinator (SPOC)
//   ed.test@designtree.local    Executive Director
import bcrypt from 'bcryptjs';
import { config } from '../config/config.js';
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { SpocAllocation } from '../models/SpocAllocation.js';

if (config.nodeEnv === 'production') {
  console.error('Refusing to seed test data in production.');
  process.exit(1);
}
const password = process.env.LOCAL_TEST_PASSWORD || 'LocalTest-2026!';
await connectDb(config.mongoUri);
const passwordHash = await bcrypt.hash(password, 10);

const people = [
  { key: 'ad', empId: 'TEST-AD', firstName: 'Asha', lastName: 'Director', designation: 'Associate Director - Structure', department: 'Structure', role: 'associate_director' },
  { key: 'td', empId: 'TEST-TD', firstName: 'Tarun', lastName: 'Director', designation: 'Technical Director - Structures', department: 'Structure', role: 'technical_director', reportsTo: 'TEST-AD' },
  { key: 'tl', empId: 'TEST-TL', firstName: 'Tara', lastName: 'Lead', designation: 'Principal Team Lead - Structure', department: 'Structure', role: 'team_lead', reportsTo: 'TEST-TD' },
  { key: 'eng', empId: 'TEST-ENG', firstName: 'Eshan', lastName: 'Engineer', designation: 'Design Engineer - Structure', department: 'Structure', role: 'engineer_drafter', reportsTo: 'TEST-TL' },
  { key: 'spoc', empId: 'TEST-SPOC', firstName: 'Sana', lastName: 'Spoc', designation: 'Design Coordinator - Design Management', department: 'Design Management', role: 'coordinator' },
  { key: 'ed', empId: 'TEST-ED', firstName: 'Eva', lastName: 'Executive', designation: 'Executive Director', department: 'Management', role: 'executive_director' },
];

const emp = {};
for (const p of people) {
  const email = `${p.key}.test@designtree.local`;
  emp[p.key] = await Employee.findOneAndUpdate(
    { empId: p.empId },
    { $set: { firstName: p.firstName, lastName: p.lastName, designation: p.designation, department: p.department, email, branch: 'Bangalore', status: 'Active', reportingManager: p.reportsTo } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name: `${p.firstName} ${p.lastName}`, passwordHash, role: p.role, isActive: true, employee: emp[p.key]._id } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  await Employee.updateOne({ _id: emp[p.key]._id }, { $set: { user: user._id } });
}

const project = await Project.findOneAndUpdate(
  { code: 'TEST-0001' },
  { $set: { name: 'Local Test Tower', jobNumber: 'KA-TEST-001', branch: 'Bangalore', services: ['STR'], status: 'Active', 'activation.status': 'Activated', 'activation.spoc': emp.spoc._id, 'contacts.client.name': 'Test Client', 'contacts.client.email': 'client.test@example.com' } },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
);
await Team.findOneAndUpdate(
  { name: 'Test Structure Team' },
  { $set: { service: 'Structural', branch: 'Bangalore', lead: emp.tl._id, projects: [project._id], members: [{ employee: emp.eng._id }], active: true } },
  { upsert: true, returnDocument: 'after' },
);
await SpocAllocation.findOneAndUpdate(
  { project: project._id, coordinator: emp.spoc._id },
  { $set: { status: 'Approved', active: true, services: ['STR'] } },
  { upsert: true, returnDocument: 'after' },
);

console.log(`Seeded local test data: project ${project.code} and ${people.length} logins (*.test@designtree.local).`);
process.exit(0);
