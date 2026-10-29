import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startDmhFixture } from './dmh-fixture.mjs';
let f; const cookies = {};
before(async () => {
  f = await startDmhFixture();
  for (const role of ['dmh','td','md','spoc','spoc2','foreignSpoc','atd','engineer','admin']) {
    const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[role].email,password:f.password})});
    cookies[role]=r.headers.get('set-cookie').split(';')[0];
  }
});
after(async()=>f?.stop());
async function call(role,path='',method='GET',body){const r=await fetch(f.base+'/api/design-team'+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
test('dashboard reflects saved SPOC entries and excludes other reporting lines and non-SPOCs',async()=>{
  const r=await call('dmh'); assert.equal(r.status,200);
  assert.equal(r.data.spocs.length,2);assert.equal(r.data.summary.spocs,2);assert.equal(r.data.summary.todayUpdated,1);
  const person=r.data.spocs.find(e=>e.employee._id===f.cast.spoc.employee);assert.equal(person.totalHours,8.5);assert.equal(person.load,3);
  assert(r.data.entries.some(e=>e.areas.some(a=>a.update==='Saved SPOC meeting reflection')));
  assert(!JSON.stringify(r.data).includes('Outside reporting line'));assert(!r.data.spocs.some(e=>e.employee._id===f.cast.engineer.employee));
  assert(r.data.unassigned.some(p=>p._id===f.vacant));assert(!r.data.projects.some(p=>p._id===f.other));
});
test('Design Management TD retains TD role with selective capability; ordinary TD and unrelated roles have no module access',async()=>{
  const r=await call('td');assert.equal(r.status,200);assert.equal(r.data.spocs.length,2);
  const bootstrap=await fetch(f.base+'/api/meta/bootstrap',{headers:{Cookie:cookies.td}}).then(r=>r.json());assert.equal(bootstrap.role.key,'technical_director');assert.equal(bootstrap.capabilities.designTeam,true);
  await f.models.Employee.findByIdAndUpdate(f.cast.td.employee,{department:'Structural'});
  assert.equal((await call('td')).status,403);
  await f.models.Employee.findByIdAndUpdate(f.cast.td.employee,{department:'Design Management'});
  for(const role of ['atd','engineer','admin'])assert.equal((await call(role)).status,403);
});
test('SPOC sees only their own reflection and cannot mutate management data',async()=>{
  const r=await call('spoc');assert.equal(r.status,200);assert.equal(r.data.spocs.length,1);assert.equal(r.data.canEdit,false);
  assert.equal((await call('spoc','/remarks','POST',{spoc:f.cast.spoc.employee,text:'Not permitted'})).status,403);
  assert.equal((await call('dmh','/spocs/'+f.cast.foreignSpoc.employee)).status,404);
});
test('assigned project detail returns sixteen saved workflow steps and real source records',async()=>{
  const r=await call('dmh','/projects/'+f.project);assert.equal(r.status,200);assert.equal(r.data.workflow.steps.length,16);
  assert.equal(r.data.hours,8.5);assert(r.data.followups.some(x=>x.id===f.followup));
  assert.equal((await call('dmh','/projects/'+f.other)).status,404);
});
test('management changes remarks, follow-up closure, MOM and workflow with actor/time audit',async()=>{
  assert.equal((await call('dmh','/remarks','POST',{spoc:f.cast.spoc.employee,text:'Actual head review remark'})).status,201);
  assert.equal((await call('dmh','/followups/coordination/'+f.followup,'PATCH',{closed:true})).status,200);
  assert.equal((await call('dmh','/meetings/'+f.meeting+'/mom','PATCH',{})).status,200);
  assert.equal((await call('dmh','/projects/'+f.project+'/workflow','PATCH',{n:2,status:'In Progress',remarks:'Checked scope with SPOC'})).status,200);
  const r=await call('dmh','/spocs/'+f.cast.spoc.employee);assert.equal(r.status,200);
  assert(r.data.remarks.some(x=>x.text==='Actual head review remark'));assert(r.data.events.length>=4);
  assert(r.data.events.every(x=>x.actor&&x.at));assert.equal((await f.models.CoordinationItem.findById(f.followup)).status,'Resolved');
});
test('allocation validates scope, current SPOC and reason before changing existing records',async()=>{
  assert.equal((await call('dmh','/projects/'+f.project+'/assign','POST',{spoc:f.cast.spoc.employee,expectedSpoc:f.cast.spoc.employee})).status,409);
  assert.equal((await call('dmh','/projects/'+f.project+'/assign','POST',{spoc:f.cast.spoc2.employee,expectedSpoc:f.cast.spoc.employee})).status,400);
  assert.equal((await call('dmh','/projects/'+f.project+'/assign','POST',{spoc:f.cast.foreignSpoc.employee,expectedSpoc:f.cast.spoc.employee,reason:'Wrong team'})).status,404);
  assert.equal((await call('dmh','/projects/'+f.other+'/assign','POST',{spoc:f.cast.spoc2.employee,expectedSpoc:f.cast.foreignSpoc.employee,reason:'Wrong project'})).status,404);
});
test('concurrent assignments have one winner, append history once and move current SPOC project access',async()=>{
  const count=await f.models.Project.countDocuments(),employees=await f.models.Employee.countDocuments();
  const auditBefore=await f.models.ProjectAudit.countDocuments({project:f.project,'changes.field':'activation.spoc'});
  const body={spoc:f.cast.spoc2.employee,expectedSpoc:f.cast.spoc.employee,reason:'Balance actual coordination work'};
  const results=await Promise.all([call('dmh','/projects/'+f.project+'/assign','POST',body),call('dmh','/projects/'+f.project+'/assign','POST',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(await f.models.ProjectAudit.countDocuments({project:f.project,'changes.field':'activation.spoc'}),auditBefore+1,'Only the winning update receives a project audit record');
  const r=await call('dmh','/spocs/'+f.cast.spoc2.employee);assert.equal(r.data.allocations.length,1);assert.equal(r.data.allocations[0].fromSpoc,f.cast.spoc.employee);
  const {projectScopeIds}=await import('../api/src/utils/projectScope.js');
  assert(!(await projectScopeIds({id:f.cast.spoc.user,role:'coordinator'})).includes(f.project));
  assert((await projectScopeIds({id:f.cast.spoc2.user,role:'coordinator'})).includes(f.project));
  assert.equal(await f.models.Project.countDocuments(),count);assert.equal(await f.models.Employee.countDocuments(),employees);
});
test('status changes update counts without changing billing approval records',async()=>{
  const before=await f.models.StageStatus.countDocuments();
  assert.equal((await call('dmh','/projects/'+f.project+'/status','PATCH',{status:'Delayed'})).status,200);
  const r=await call('dmh');assert.equal(r.data.summary.delayed,1);assert.equal(await f.models.StageStatus.countDocuments(),before);
});
test('calendar skips weekends and HR holidays; IST boundaries and workload formula are explicit',async()=>{
 const {workingDays,loadPoints,band,dayOf}=await import('../api/src/utils/designTeam.js');
 assert.deepEqual(workingDays('2026-10-26',['2026-10-23','2026-10-26'],3),['2026-10-20','2026-10-21','2026-10-22']);
 assert.equal(dayOf('2026-10-28T19:00:00Z'),'2026-10-29');
 assert.equal(loadPoints({status:'On Hold',complexity:'High'}),1.5);assert.equal(loadPoints({status:'Completed',complexity:'High'}),0);assert.equal(loadPoints({status:'Active'}),2);
 assert.deepEqual([4.5,5,8,8.5].map(band),['Light','Balanced','Balanced','Heavy']);
});
test('assignment retains Admin activation; coordination status preserves active SPOC work-entry queries',async()=>{
 const before=await f.models.Project.findById(f.vacant).lean();
 assert.equal((await call('td','/projects/'+f.vacant+'/assign','POST',{spoc:f.cast.spoc.employee,expectedSpoc:null})).status,200);
 const after=await f.models.Project.findById(f.vacant).lean();assert.equal(after.activation.status,before.activation.status);assert.equal(String(after.activation.spoc),f.cast.spoc.employee);
 const active=await f.models.Project.findOne({_id:f.project,status:'Active'}).lean();assert(active);assert.equal(active.coordinationStatus,'Delayed');
});
test('approved leave and travel are labelled separately from missing daily entries',async()=>{
 const days=(await call('dmh')).data.days,employee=(await f.models.Employee.findById(f.cast.spoc2.employee))._id;
 const leave=await f.models.LeaveRequest.collection.insertOne({employee,status:'Approved',from:new Date(days[1]+'T00:00:00Z'),to:new Date(days[1]+'T12:00:00Z')});
 const {TravelRequest}=await import('../api/src/models/TravelRequest.js');
 const travel=await TravelRequest.collection.insertOne({employee,status:'Approved',departureDate:new Date(days[2]+'T00:00:00Z'),returnDate:new Date(days[2]+'T12:00:00Z')});
 const s=(await call('dmh')).data.spocs.find(s=>s.employee._id===String(employee));assert.equal(s.daily[1].status,'Approved leave');assert.equal(s.daily[2].status,'Approved travel');assert.equal(s.daily[0].status,'No entry');
 await f.models.LeaveRequest.collection.deleteOne({_id:leave.insertedId});await TravelRequest.collection.deleteOne({_id:travel.insertedId});
});
test('daily work outside current allocation remains read-only without foreign project contacts',async()=>{
 await f.models.SpocEntry.create({employee:f.cast.spoc.employee,project:f.other,date:new Date(),service:'STR',areas:[{key:'Meetings',update:'Historical project work',hours:1}],createdBy:f.cast.spoc.user});
 const r=await call('dmh','/projects/'+f.other);assert.equal(r.status,200);assert.equal(r.data.canEdit,false);assert.equal(r.data.loggedOutsideAllocation,true);assert.equal(r.data.hours,1);assert.equal(r.data.project.contacts,undefined);assert.deepEqual(r.data.followups,[]);
 assert.equal((await call('dmh','/projects/'+f.other+'/status','PATCH',{status:'Delayed'})).status,404);
 const p=await call('dmh','/spocs/'+f.cast.spoc.employee);assert(p.data.activity.some(e=>e.source==='daily'&&e.detail.areas.some(a=>a.update==='Saved SPOC meeting reflection')));
});
test('follow-up and MOM actions are idempotent; history rejects editing or deletion',async()=>{
 const {DesignTeamEvent}=await import('../api/src/models/DesignTeamEvent.js');const count=await DesignTeamEvent.countDocuments();
 assert.equal((await call('dmh','/followups/coordination/'+f.followup,'PATCH',{closed:true})).status,200);assert.equal((await call('dmh','/meetings/'+f.meeting+'/mom','PATCH',{})).status,200);assert.equal(await DesignTeamEvent.countDocuments(),count);
 const row=await DesignTeamEvent.findOne();await assert.rejects(DesignTeamEvent.updateOne({_id:row._id},{$set:{actorName:'tampered'}}),/append-only/);await assert.rejects(DesignTeamEvent.deleteOne({_id:row._id}),/append-only/);
});
test('ambiguous employee/login links are omitted without guessing a SPOC',async()=>{
 const u=await f.models.User.findById(f.cast.spoc2.user).select('+passwordHash').lean();const duplicate=await f.models.User.create({name:'Conflicting coordinator',email:'duplicate-coordinator@datum-test.example',role:'coordinator',employee:u.employee,passwordHash:u.passwordHash});
 const r=await call('dmh');assert(!r.data.spocs.some(s=>s.employee._id===f.cast.spoc2.employee));await f.models.User.deleteOne({_id:duplicate._id});
});
