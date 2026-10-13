import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startLocalFixture } from './local-fixture.mjs';

let f;
const cookies = {};
async function call(role, path, method = 'GET', body) {
  const headers = role ? { Cookie: cookies[role] } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(f.base + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, type };
}
before(async () => {
  f = process.env.TEST_FIXTURE_FILE ? JSON.parse(await readFile(process.env.TEST_FIXTURE_FILE, 'utf8')) : await startLocalFixture();
  assert(f.isolated && f.base.startsWith('http://127.0.0.1:'),'Use the disposable local fixture only.');
  for (const [key, user] of Object.entries(f.cast)) {
    const res = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: f.password }) });
    assert.equal(res.status, 200, `Login ${key}`); cookies[key] = res.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => { if (f?.stop) await f.stop(); });

test('project members see assigned records only, including direct IDs', async () => {
  for (const role of ['tl', 'spoc', 'engineer', 'qs']) {
    const res = await call(role, '/api/projects'); assert.equal(res.status, 200);
    assert(res.data.items.some(p => p._id === f.project)); assert(!res.data.items.some(p => p._id === f.other));
    assert.equal((await call(role, `/api/projects/${f.other}`)).status, 404);
    assert.equal((await call(role, `/api/projects/${f.other}/team`)).status, 404);
  }
  assert.equal((await call('spoc','/api/spoc/allocations','POST',{project:f.other,coordinator:f.cast.spoc.employee,services:['STR']})).status,403);
  const team = await call('td', `/api/projects/${f.project}/team`);
  assert(team.data.allocations.some(a => a.coordinator._id === f.cast.spoc.employee));
  const teams=await call('engineer','/api/teams');assert(teams.data.items.every(t=>t.name !== 'Unrelated team'));
  const detail=await call('dmh',`/api/teams/${teams.data.items[0].id}`);assert.equal(detail.status,200);assert(detail.data.team.members.some(m=>m.employee.experience));
});

test('new project allocation connects TD/SPOC selections to real team access', async () => {
  const created=await call('admin','/api/projects','POST',{name:'Allocation acceptance project',code:'TEST-NEW-FLOW',branch:'Test HQ',services:['STR','Peer Review'],source:'Typed referral',status:'Active'});
  assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.project._id;
  assert.equal((await call('engineer',`/api/projects/${id}`)).status,404);
  const allocation=await call('td','/api/spoc/allocations/propose','POST',{project:id,coordinator:f.cast.spoc.employee,services:['STR']});assert.equal(allocation.status,200,JSON.stringify(allocation.data));
  assert.equal((await call('dmh',`/api/spoc/allocations/${allocation.data.item._id}`,'PATCH',{status:'Approved'})).status,200);
  const lead={service:'STR',employee:f.cast.tl.employee,name:'Test tl Workflow',role:'Principal team lead',approvalStatus:'Approved'};
  assert.equal((await call('td',`/api/projects/${id}/team-leads`,'PUT',{principalTeamLeads:[lead]})).status,200);
  assert.equal((await call('tl',`/api/projects/${id}`)).status,200);
  const member={service:'Structural',employee:f.cast.engineer.employee,name:'Test engineer Workflow',role:'Engineer',approvalStatus:'Approved'};
  assert.equal((await call('spoc',`/api/projects/${id}/team-leads`,'PUT',{principalTeamLeads:[lead,member]})).status,200);
  assert.equal((await call('engineer',`/api/projects/${id}`)).status,200);
  const roster=await call('admin',`/api/projects/${id}/team`);assert(roster.data.members.some(m=>m.employee._id===f.cast.engineer.employee));
  const task=await call('tl','/api/work/tasks','POST',{project:id,members:[f.cast.engineer.employee],deliverable:'Allocated team task',stage:'CD'});assert.equal(task.status,201,JSON.stringify(task.data));
  assert((await call('engineer','/api/work/tasks/mine')).data.items.some(t=>t._id===task.data.item._id));
  assert.equal((await call('tl','/api/work/tasks','POST',{project:id,members:[f.cast.outsider.employee],deliverable:'Invalid member'})).status,400);
  assert.equal((await call('md',`/api/projects/${id}/team-leads`,'PUT',{principalTeamLeads:[lead]})).status,403);
  assert.equal((await call('admin','/api/projects','POST',{name:'Invalid service project',services:['Unknown service']})).status,400);
});

test('director QS logs reflect project BOQ and pending area settlements',async()=>{
  const boq=await call('qs','/api/functions/boq','POST',{project:f.project,description:'BOQ acceptance item',qty:10,unit:'m2',status:'Submitted'});assert.equal(boq.status,201);
  const area=await call('qs','/api/functions/area-settlements','POST',{project:f.project,zone:'Acceptance zone',initial:100,revised:110,status:'Pending'});assert.equal(area.status,201);
  for(const role of ['td','associate','atd']) {
    assert((await call(role,'/api/functions/boq?project='+f.project)).data.items.some(r=>r._id===boq.data.item._id&&r.qty===10));
    assert((await call(role,'/api/functions/area-settlements?project='+f.project)).data.items.some(r=>r._id===area.data.item._id&&r.status==='Pending'));
  }
});

test('Finance alone can access bookings; role navigation reflects requirements', async () => {
  for (const role of ['md', 'td', 'associate', 'atd', 'dmh', 'tl', 'spoc', 'engineer']) assert.equal((await call(role, '/api/travel-bookings')).status, 403, role);
  assert.equal((await call('finance', '/api/travel-bookings')).status, 200);
  for (const role of ['td', 'associate']) {
    const nav = (await call(role, '/api/meta/bootstrap')).data.nav.map(n => n.view);
    assert(!nav.includes('design-mgmt')); assert(nav.includes('billing-status')); assert(nav.includes('qs-head')); assert(!nav.includes('qs-log'));
  }
  {
    const nav = (await call('atd', '/api/meta/bootstrap')).data.nav.map(n => n.view);
    assert(!nav.includes('design-mgmt')); assert(nav.includes('billing-status')); assert(nav.includes('qs-log'));
  }
  const nav = (await call('dmh', '/api/meta/bootstrap')).data.nav.map(n => n.view);
  assert(nav.includes('design-mgmt')); assert(nav.includes('certificates'));
});

test('billing requires PTL then SPOC then TD and MD is read-only', async () => {
  const identity = { project: f.project, service: 'STR', stage: 'CD' };
  assert.equal((await call('admin', '/api/billing/claims', 'POST', { ...identity, amount: 100 })).status, 409);
  assert.equal((await call('admin', '/api/billing/stages', 'POST', { ...identity, confirmCompletion: true })).status, 403);
  assert.equal((await call('tl', '/api/billing/stages', 'POST', { ...identity, requestCompletion: true })).status, 200);
  assert.equal((await call('td', '/api/billing/stages', 'POST', { ...identity, approveCompletion: true })).status, 409);
  const confirm = await call('spoc', '/api/billing/stages', 'POST', { ...identity, confirmCompletion: true });
  assert.equal(confirm.status, 200); assert.equal(confirm.data.item.billingReadiness, 'Pending');
  assert.equal((await call('admin', '/api/billing/stages', 'PUT', { ...identity, currentStatus: 'Completed' })).status, 404);
  assert.equal((await call('admin', `/api/billing/stages/${confirm.data.item._id}`, 'PUT', { billingReadiness: 'Ready for billing' })).status, 409);
  assert.equal((await call('md', '/api/billing/stages', 'POST', { ...identity, approveCompletion: true })).status, 403);
  const approve = await call('td', '/api/billing/stages', 'POST', { ...identity, approveCompletion: true });
  assert.equal(approve.status, 200); assert.equal(approve.data.item.billingReadiness, 'Ready for billing');
  assert.equal(approve.data.item.confirmationStatus, 'TD Approved'); assert.equal(approve.data.item.history.length, 3);
  assert.equal((await call('td', '/api/billing/stages', 'POST', { ...identity, approveCompletion: true })).status, 409);
  const claim = await call('admin', '/api/billing/claims', 'POST', { ...identity, amount: 100 }); assert.equal(claim.status, 201);
  assert.equal((await call('admin', `/api/billing/claims/${claim.data.item._id}/status`, 'PATCH', { status: 'Billed' })).status, 200);
});

let meetingId;
test('only SPOC schedules; invitations, reschedule, attendance, MOM and actions share records', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const body = { project: f.project, title: 'Scheduled acceptance meeting', category: 'Scheduled', services: ['Structural'], date: tomorrow, startTime: '10:00', endTime: '11:00', type: 'PMC', mode: 'Online', link: 'https://example.com/meeting', participants: [{ employee: f.cast.engineer.employee }] };
  for (const role of ['dmh', 'td', 'md', 'tl']) assert.equal((await call(role, '/api/meetings', 'POST', body)).status, 403, role);
  const created = await call('spoc', '/api/meetings', 'POST', body); assert.equal(created.status, 201, JSON.stringify(created.data));
  meetingId = created.data.item._id; assert.equal(created.data.item.responsibleRole, 'SPOC');
  assert.equal((await call('outsider', `/api/meetings/${meetingId}`)).status, 404);
  assert.equal((await call('engineer', '/api/meetings?mine=true')).data.items.filter(m => m._id === meetingId).length, 1);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/respond`, 'POST', { response: 'Not Available' })).status, 400);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/respond`, 'POST', { response: 'Not Available', reason: 'Other — specify' })).status, 400);
  assert.equal((await call('spoc', `/api/meetings/${meetingId}/reschedule`, 'PATCH', { date: tomorrow, startTime: '12:00', endTime: '13:00' })).status, 200);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/respond`, 'POST', { response: 'Not Available', reason: 'Leave' })).status, 200);
  const held = await call('spoc', `/api/meetings/${meetingId}/held`, 'PATCH'); assert.equal(held.status, 200); assert.equal(held.data.item.attendance.length, 0);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/respond`, 'POST', { response: 'Available' })).status, 422);
  assert.equal((await call('spoc', `/api/meetings/${meetingId}/attendance`, 'PUT', { attendance: [{ employee: f.cast.engineer.employee, present: false, reason: 'Leave' }] })).status, 200);
  assert.equal((await call('spoc', `/api/meetings/${meetingId}/mom`, 'PUT', { discussion: 'Test discussion', decisions: 'Test decision' })).status, 200);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/mom/download`)).status, 200);
  const action = await call('spoc', `/api/meetings/${meetingId}/actions`, 'POST', { text: 'Check revised drawing', owner: f.cast.engineer.employee, due: tomorrow }); assert.equal(action.status, 201);
  const id = action.data.item.actions[0]._id;
  assert.equal((await call('tl', `/api/meetings/${meetingId}/actions/${id}`, 'PATCH', { status: 'Completed' })).status, 403);
  const done = await call('engineer', `/api/meetings/${meetingId}/actions/${id}`, 'PATCH', { status: 'Completed' }); assert(done.data.item.actions[0].completedAt);
  const reopen = await call('engineer', `/api/meetings/${meetingId}/actions/${id}`, 'PATCH', { status: 'In Progress' }); assert.equal(reopen.status, 200); assert(!reopen.data.item.actions[0].completedAt);
  assert.equal((await call('engineer', `/api/meetings/${meetingId}/actions/${id}/note`, 'PATCH', { note: 'Checking now' })).status, 200);
  assert.equal((await call('spoc', `/api/meetings/${meetingId}`)).data.item.actions[0].note, 'Checking now');
});

test('meeting reference and original MOM files persist with audience-scoped downloads',async()=>{
  const refs=new FormData();refs.append('files',new Blob(['reference content']),'reference.txt');
  assert.equal((await call('spoc',`/api/meetings/${meetingId}/refdocs`,'POST',refs)).status,200);
  const mom=new FormData();mom.append('files',new Blob(['original MOM content']),'mom.txt');
  assert.equal((await call('spoc',`/api/meetings/${meetingId}/mom-doc`,'POST',mom)).status,200);
  assert.equal((await call('engineer',`/api/meetings/${meetingId}/file?index=0`)).data.toString(),'reference content');
  assert.equal((await call('engineer',`/api/meetings/${meetingId}/file?mom=true`)).data.toString(),'original MOM content');
  assert.equal((await call('outsider',`/api/meetings/${meetingId}/file?mom=true`)).status,404);
  const notifications=await call('engineer','/api/notifications');assert(notifications.data.items.some(n=>n.link?.view==='meeting'&&n.link.id===meetingId));
  const spoc=await call('spoc','/api/notifications');assert(spoc.data.items.some(n=>n.type==='meeting-response'||n.title.includes('action')||n.title.includes('Action')));
});

test('ad-hoc and cancelled meetings remain visible to selected employees', async () => {
  const body = { project: f.project, title: 'Sudden acceptance meeting', category: 'Sudden', reason: 'Site clarification', services: ['Structural'], date: new Date().toISOString().slice(0, 10), participants: [{ employee: f.cast.engineer.employee }] };
  const res = await call('spoc', '/api/meetings', 'POST', body); assert.equal(res.status, 201); assert.equal(res.data.item.status, 'Held'); assert.equal(res.data.item.invites.length, 0);
  assert((await call('engineer', '/api/meetings?mine=true')).data.items.some(m => m._id === res.data.item._id));
  const scheduled = await call('spoc', '/api/meetings', 'POST', { ...body, category: 'Scheduled', title: 'Cancelled acceptance meeting' });
  const id=scheduled.data.item._id;
  assert.equal((await call('spoc', `/api/meetings/${id}/cancel`, 'PATCH', {})).status, 400);
  assert.equal((await call('spoc', `/api/meetings/${id}/cancel`, 'PATCH', { reason: 'Client moved date' })).status, 200);
  assert((await call('engineer', '/api/meetings?mine=true')).data.items.some(m => m._id === id && m.status === 'Cancelled'));
});

test('no-login certificate link provides template, upload and issued file only for its request', async () => {
  const template=new FormData();template.append('category','Structural completion');template.append('file',new Blob(['template bytes']),'template.txt');
  assert.equal((await call('admin','/api/certificates/templates','POST',template)).status,201);
  const request=await call('admin','/api/certificates/requests','POST',{project:f.project,category:'Structural completion'});assert.equal(request.status,201);
  const link=await call('admin',`/api/certificates/requests/${request.data.item._id}/link`,'POST');assert.equal(link.status,200);
  const token=link.data.path.split('/').pop(); const base=`/api/certificates/public/${token}`;
  assert.equal((await call(null,base)).data.template,true);
  assert.equal((await call(null,base+'/template')).data.toString(),'template bytes');
  assert.equal((await call(null,base+'/issued')).status,404);
  const issued=await call('admin','/api/certificates','POST',{project:f.project,certType:'Structural completion',status:'Issued'});assert.equal(issued.status,201);
  const issuedFile=new FormData();issuedFile.append('file',new Blob(['issued certificate bytes']),'issued.txt');
  assert.equal((await call('admin',`/api/certificates/${issued.data.item._id}/file`,'POST',issuedFile)).status,201);
  assert.equal((await call(null,base+'/issued')).data.toString(),'issued certificate bytes');
  assert.equal((await call('td','/api/certificates','POST',{project:f.project,certType:'Structural completion'})).status,403);
  const upload=new FormData();upload.append('file',new Blob(['client certificate']),'completion.txt');
  assert.equal((await call(null,base+'/upload','POST',upload)).status,201);
  assert.equal((await call(null,base)).data.status,'Uploaded');
  assert.equal((await call(null,base+'/upload','POST',upload)).status,409);
  assert.equal((await call(null,'/api/certificates/public/'+ '0'.repeat(64))).status,404);
  assert.equal((await call('md',`/api/certificates/requests/${request.data.item._id}/link`,'POST')).status,403);
  const newLink=await call('admin',`/api/certificates/requests/${request.data.item._id}/link`,'POST');assert.equal(newLink.status,200);assert.equal((await call(null,base)).status,404);
});

test('daily work attachments persist and reject unrelated project access',async()=>{
  const entry=await call('spoc','/api/spoc/entries','POST',{project:f.project,service:'STR',areas:[{key:'Meetings',hours:1,update:'Meeting notes'}]});assert.equal(entry.status,201);
  const body=new FormData();body.append('files',new Blob(['work attachment']),'work.txt');
  const path=`/api/spoc/entries/${entry.data.item._id}/documents`;
  assert.equal((await call('spoc',path,'POST',body)).status,201);
  assert.equal((await call('spoc',path+'/0')).data.toString(),'work attachment');
  assert.equal((await call('outsider',path+'/0')).status,404);
  const work=await call('engineer','/api/work-entries','POST',{project:f.project,hours:1,date:new Date().toISOString().slice(0,10),notes:'Daily work attachment test'});assert.equal(work.status,201);
  const workPath=`/api/work-entries/${work.data.entry._id}/documents`;const file=new FormData();file.append('files',new Blob(['employee document']),'employee.txt');
  assert.equal((await call('engineer',workPath,'POST',file)).status,201);assert.equal((await call('engineer',workPath+'/0')).data.toString(),'employee document');assert.equal((await call('tl',workPath,'POST',file)).status,403);
  assert.equal((await call('spoc','/api/spoc/entries','POST',{project:f.other,service:'STR',areas:[{key:'Meetings',hours:1}]})).status,403);
});

test('meeting reporting includes more than 200 persisted records',{skip:!!process.env.TEST_FIXTURE_FILE},async()=>{
  if(!f.models)return;
  await f.models.Meeting.insertMany(Array.from({length:205},(_,i)=>({project:f.project,title:`Reporting acceptance ${i}`,category:'Scheduled',date:new Date(),services:['Structural'],participants:[{employee:f.cast.engineer.employee}],invites:[{employee:f.cast.engineer.employee,response:'Pending'}]})));
  const report=await call('engineer','/api/meetings?mine=true');assert.equal(report.status,200);assert.equal(report.data.items.filter(m=>m.title.startsWith('Reporting acceptance')).length,205);
});

test('legacy service/priority values survive reads and edits; old readiness needs TD approval',{skip:!!process.env.TEST_FIXTURE_FILE},async()=>{
  if(!f.models)return;
  const legacy=await f.models.Project.collection.insertOne({name:'Legacy compatibility project',code:'TEST-LEGACY',services:['Structural','Historic service'],priority:'Historic priority',branch:'Test HQ'});
  const read=await call('td',`/api/projects/${legacy.insertedId}`);assert.equal(read.status,200);assert(read.data.project.services.includes('Historic service'));assert.equal(read.data.project.priority,'Historic priority');
  assert.equal((await call('admin',`/api/projects/${legacy.insertedId}`,'PUT',{name:'Legacy edited project'})).status,200);
  const reread=await call('td',`/api/projects/${legacy.insertedId}`);assert(reread.data.project.services.includes('Historic service'));assert.equal(reread.data.project.priority,'Historic priority');
  await f.models.StageStatus.create({project:legacy.insertedId,service:'STR',stage:'CD',currentStatus:'Completed',billingReadiness:'Ready for billing',confirmationStatus:'SPOC Confirmed'});
  assert.equal((await call('admin','/api/billing/claims','POST',{project:String(legacy.insertedId),service:'STR',stage:'CD',amount:100})).status,409);
});

test('filtered transmittal PDF is a real downloadable document',async()=>{
  if(f.models) {
    await f.models.TransmittalRecord.insertMany(Array.from({length:75},(_,i)=>({project:f.project,projectName:'Assigned workflow project',trNo:`TR-ACCEPT-${i}`,service:'STR',dept:'Design',docType:'Drawing',print:'A1',qty:10,sets:2,total:20,reason:'Filtered PDF acceptance - wrapped reason text for page layout verification'})));
    await f.models.TransmittalRecord.create({project:f.other,trNo:'TR-EXCLUDED',reason:'EXCLUDED_SECRET_PROJECT'});
  }
  const log=await call('td','/api/transmittal-register?projects='+f.project+'&docType=Drawing');assert.equal(log.status,200);assert(log.data.items.every(r=>r.project._id===f.project));
  const res=await call('td','/api/transmittal-register?format=pdf&projects='+f.project+'&docType=Drawing');assert.equal(res.status,200);assert(res.type.includes('application/pdf'));assert.equal(res.data.subarray(0,5).toString(),'%PDF-');
  if(process.env.TEST_PDF_OUTPUT)await writeFile(process.env.TEST_PDF_OUTPUT,res.data);
});
