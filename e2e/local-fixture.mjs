import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function startLocalFixture(port = 0) {
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24', downloadDir: process.env.MONGOMS_DOWNLOAD_DIR || '/tmp/designtree-mongo-binaries' }, instance: { dbName: 'designtree-workflow-test' } });
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.MONGO_URI = mongo.getUri();
  process.env.UPLOAD_DIR = resolve(process.env.TEST_UPLOAD_DIR || '/tmp/designtree-test-uploads');
  process.env.NODE_ENV = 'development';
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5173';
  const api = path => import(pathToFileURL(resolve(import.meta.dirname, '../api', path)).href);
  const { default: mongoose } = await api('node_modules/mongoose/index.js');
  const { default: bcrypt } = await api('node_modules/bcryptjs/index.js');
  await mongoose.connect(mongo.getUri());
  const models = {};
  for (const name of ['User', 'Employee', 'Branch', 'Project', 'Team', 'SpocAllocation', 'Certificate', 'Meeting', 'TransmittalRecord', 'StageStatus']) Object.assign(models, await api(`src/models/${name}.js`));
  const password = 'LocalFlow-' + randomBytes(12).toString('hex');
  const passwordHash = await bcrypt.hash(password, 4);
  const cast = {};
  for (const [key, role] of Object.entries({ admin: 'admin_billing', dmh: 'design_mgmt_head', td: 'technical_director', md: 'founding_director', associate: 'associate_director', atd: 'assoc_technical_director', finance: 'finance', tl: 'team_lead', spoc: 'coordinator', engineer: 'engineer_drafter', outsider: 'engineer_drafter', qs: 'qs' })) {
    const employee = await models.Employee.create({ empId: `TEST-${key}`, firstName: `Test ${key}`, lastName: 'Workflow', designation: key === 'tl' ? 'Team Lead' : role, department: 'Structural', branch: 'Test HQ', experience: '5' });
    const user = await models.User.create({ name: `Test ${key}`, email: `${key}@datum-test.example`, role, employee: employee._id, passwordHash });
    cast[key] = { email: user.email, employee: String(employee._id), user: String(user._id), role };
  }
  await models.Branch.create({ name: 'Test HQ' });
  const project = await models.Project.create({ name: 'Assigned workflow project', code: 'TEST-ASSIGNED', branch: 'Test HQ', services: ['SMEPF'], scope: [{ service: 'SMEPF' }], currentStage: 'CD', status: 'Active' });
  const other = await models.Project.create({ name: 'Unrelated project', code: 'TEST-OTHER', branch: 'Test HQ', services: ['STR'] });
  await models.Team.create({ name: 'Assigned Structural team', service: 'STR', branch: 'Test HQ', lead: cast.tl.employee, projects: [project._id], members: [{ employee: cast.engineer.employee }, { employee: cast.qs.employee }] });
  await models.Team.create({ name: 'Unrelated team', service: 'HVAC', branch: 'Test HQ', lead: cast.outsider.employee, projects: [other._id], members: [{ employee: cast.outsider.employee }] });
  await models.SpocAllocation.create({ project: project._id, coordinator: cast.spoc.employee, status: 'Approved', services: ['SMEPF'] });
  const { createApp } = await api('src/app.js');
  const server = await new Promise(resolve => { const s = createApp().listen(port, '127.0.0.1', () => resolve(s)); });
  const {initRealtime} = await api('src/realtime/io.js');
  const realtime = initRealtime(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const fixture = { isolated: true, base, password, cast, project: String(project._id), other: String(other._id) };
  return { ...fixture, models, stop: async () => { await new Promise(resolve => realtime.close(resolve)); await mongoose.disconnect(); await mongo.stop(); } };
}
