import { startLocalFixture } from './local-fixture.mjs';
export async function startDmhFixture(port = 0) {
  const f = await startLocalFixture(port);
  try {
    for (const name of ['SpocEntry', 'CoordinationItem', 'DesignWorkflow', 'ProjectAudit', 'Holiday', 'LeaveRequest', 'Rfi', 'Revision']) Object.assign(f.models, await import(`../api/src/models/${name}.js`));
    await f.models.Employee.findByIdAndUpdate(f.cast.td.employee, { department: 'Design Management', reportingManager: f.cast.md.employee });
    await f.models.Employee.findByIdAndUpdate(f.cast.dmh.employee, { reportingManager: f.cast.td.employee });
    await f.models.Employee.findByIdAndUpdate(f.cast.spoc.employee, { reportingManager: f.cast.dmh.employee });
    const hash = (await f.models.User.findById(f.cast.admin.user).select('+passwordHash')).passwordHash;
    const ordinaryEmployee=await f.models.Employee.create({empId:'DMH-ORDINARY-TD',firstName:'Ordinary TD',designation:'Technical Director',department:'Structural',branch:'Test HQ'});
    const ordinaryUser=await f.models.User.create({name:'Ordinary TD',role:'technical_director',email:'ordinary-td@datum-test.example',employee:ordinaryEmployee._id,passwordHash:hash});
    f.cast.ordinaryTd={email:ordinaryUser.email,employee:String(ordinaryEmployee._id),user:String(ordinaryUser._id),role:'technical_director'};
    for (const [key, reporting] of [['spoc2', f.cast.dmh.employee], ['foreignSpoc', null]]) {
      const e = await f.models.Employee.create({ empId: 'DMH-'+key, firstName: 'Coordinator '+key, designation: 'Coordinator', department: 'Structural', reportingManager: reporting, branch: 'Test HQ' });
      const u = await f.models.User.create({ name: e.firstName, role: 'coordinator', email: key.toLowerCase()+'@datum-test.example', employee: e._id, passwordHash: hash });
      f.cast[key] = { email: u.email, employee: String(e._id), user: String(u._id), role: 'coordinator' };
    }
    await f.models.Project.findByIdAndUpdate(f.project, { jobNumber: 'DMH-001', complexity: 'High', 'activation.spoc': f.cast.spoc.employee, 'activation.status': 'Activated' });
    await f.models.Project.findByIdAndUpdate(f.other, { 'activation.spoc': f.cast.foreignSpoc.employee });
    const vacant = await f.models.Project.create({ code: 'DMH-VACANT', jobNumber: 'DMH-002', name: 'Unassigned management project', services: ['STR'], complexity: 'Medium', related: { projectDirector: f.cast.dmh.employee } });
    f.vacant = String(vacant._id);
    await f.models.SpocEntry.create({ employee: f.cast.spoc.employee, project: f.project, date: new Date(), service: 'STR', areas: [{ key: 'Meetings', update: 'Saved SPOC meeting reflection', hours: 3 }, { key: 'Client Updates', update: 'Saved client follow-up', hours: 5.5 }], createdBy: f.cast.spoc.user });
    await f.models.SpocEntry.create({ employee: f.cast.foreignSpoc.employee, project: f.other, date: new Date(), service: 'STR', areas: [{ key: 'Meetings', update: 'Outside reporting line', hours: 4 }], createdBy: f.cast.foreignSpoc.user });
    const item = await f.models.CoordinationItem.create({ project: f.project, service: 'Structural', channel: 'Client', topic: 'Saved client clarification', deadline: new Date(Date.now()-86400000), createdBy: f.cast.spoc.user });
    f.followup = String(item._id);
    const meeting = await f.models.Meeting.create({ project: f.project, title: 'Saved coordination meeting', category: 'Scheduled', date: new Date(Date.now()-86400000), status: 'Held', createdBy: f.cast.spoc.user });
    f.meeting = String(meeting._id);
    return f;
  } catch (e) { await f.stop(); throw e; }
}
