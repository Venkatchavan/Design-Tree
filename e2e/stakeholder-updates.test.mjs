import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import {startLocalFixture} from './local-fixture.mjs';
let f; const cookies={};
async function call(role,path,method='GET',body){
 const response=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json()};
}
before(async()=>{
 f=await startLocalFixture();
 for(const [role,u]of Object.entries(f.cast)){
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:f.password})});
  assert.equal(r.status,200);cookies[role]=r.headers.get('set-cookie').split(';')[0];
 }
});
after(async()=>f?.stop());

test('saved project DD stage reaches AD list, detail, summary and statistics without changing billing stages',async()=>{
 const stage=await f.models.StageStatus.create({project:f.project,service:'Structural',stage:'CD',currentStatus:'In progress',billingReadiness:'Pending'});
 const result=await call('admin',`/api/projects/${f.project}`,'PUT',{currentStage:'DD'});
 assert.equal(result.status,200);assert.equal(result.data.project.currentStage,'DD');
 assert.equal((await call('associate',`/api/projects/${f.project}`)).data.project.currentStage,'DD');
 assert.equal((await call('associate','/api/projects')).data.items.find(p=>p._id===f.project).currentStage,'DD');
 assert.equal((await call('associate','/api/projects/status-summary')).data.items.find(p=>p._id===f.project).currentStage,'DD');
 assert((await call('associate','/api/projects/stats')).data.byStage.some(p=>p.stage==='DD'&&p.count===1));
 assert.equal((await f.models.StageStatus.findById(stage._id)).billingReadiness,'Pending');
 assert.equal((await call('spoc',`/api/projects/${f.project}`,'PUT',{currentStage:'GFC'})).status,403);
});

test('summary lists are scoped, filterable and not truncated at the table limit',async()=>{
 await f.models.Project.insertMany(Array.from({length:205},(_,i)=>({name:`Summary volume ${i}`,code:`ST-VOL-${i}`,branch:'Test HQ',status:'Active',services:['STR']})));
 const summary=await call('associate','/api/projects/status-summary?search=Summary%20volume&service=STR');
 assert.equal(summary.status,200);assert.equal(summary.data.total,205);assert.equal(summary.data.items.length,205);
 const engineer=await call('engineer','/api/projects/status-summary');
 assert(engineer.data.items.some(p=>p._id===f.project));
 assert(!engineer.data.items.some(p=>p._id===f.other||p.code.startsWith('ST-VOL-')));
 assert.equal((await call('engineer','/api/projects/status-summary?search=Summary%20volume')).data.total,0);
});

test('assigned SPOC hold requires a reason, persists actor/history, supports resume and preserves approvals',async()=>{
 const beforeStage=await f.models.StageStatus.findOne({project:f.project}).lean();
 for(const body of [{status:'On Hold',reason:''},{status:'On Hold',reason:'   '},{status:'On Hold',reason:'Wait',currentStage:'GFC'}])assert.equal((await call('spoc',`/api/projects/${f.project}/hold`,'PUT',body)).status,400);
 assert.equal((await call('tl',`/api/projects/${f.project}/hold`,'PUT',{status:'On Hold',reason:'Wait'})).status,403);
 assert.equal((await call('spoc',`/api/projects/${f.other}/hold`,'PUT',{status:'On Hold',reason:'Wait'})).status,404);
 const held=await call('spoc',`/api/projects/${f.project}/hold`,'PUT',{status:'On Hold',reason:'Awaiting client inputs'});
 assert.equal(held.status,200,JSON.stringify(held.data));assert.equal(held.data.project.status,'On Hold');
 assert.equal(held.data.project.hold.reason,'Awaiting client inputs');assert.equal(held.data.project.hold.updatedBy,f.cast.spoc.user);
 assert.equal(held.data.project.hold.history[0].from,'Active');assert(held.data.project.hold.updatedAt);
 assert.equal((await call('engineer','/api/teams/mine')).data.items.flatMap(t=>t.projects).find(p=>p._id===f.project).hold.reason,'Awaiting client inputs');
 assert.equal((await call('associate','/api/projects?status=On%20Hold')).data.items.length,1);
 const updated=await call('spoc',`/api/projects/${f.project}/hold`,'PUT',{status:'On Hold',reason:'Revised hold reason'});
 assert.equal(updated.data.project.hold.history.length,2);
 const resumed=await call('spoc',`/api/projects/${f.project}/hold`,'PUT',{status:'Active',reason:'Inputs received'});
 assert.equal(resumed.status,200);assert.equal(resumed.data.project.hold.history.length,3);assert.equal(resumed.data.project.currentStage,'DD');
 assert.deepEqual(await f.models.StageStatus.findById(beforeStage._id).lean(),beforeStage);
});

test('a merely proposed SPOC and completed projects cannot use the hold action',async()=>{
 const p=await f.models.Project.create({name:'Proposed allocation',code:'ST-PROPOSED',status:'Active'});
 await f.models.SpocAllocation.create({project:p._id,coordinator:f.cast.spoc.employee,status:'Proposed'});
 assert.equal((await call('spoc',`/api/projects/${p._id}/hold`,'PUT',{status:'On Hold',reason:'Wait'})).status,404);
 await f.models.Project.findByIdAndUpdate(f.project,{$set:{status:'Completed'}});
 assert.equal((await call('spoc',`/api/projects/${f.project}/hold`,'PUT',{status:'On Hold',reason:'Wait'})).status,409);
 await f.models.Project.findByIdAndUpdate(f.project,{$set:{status:'Active'}});
});

test('audit records continue to record edits and hold reasons after UI history removal',async()=>{
 const history=await call('admin',`/api/projects/${f.project}/history`);
 assert.equal(history.status,200);
 assert(history.data.items.some(r=>r.actor===f.cast.spoc.user&&r.changes.some(c=>c.field==='hold.reason')));
 assert(history.data.items.some(r=>r.changes.some(c=>c.field==='currentStage'&&c.updated==='DD')));
});

test('legacy named approved nominations reconcile into real employee-backed teams; proposed names stay unassigned',async()=>{
 await f.models.Project.findByIdAndUpdate(f.project,{$set:{principalTeamLeads:[
  {service:'STR',name:'Test tl Workflow',approvalStatus:'Approved'},
  {service:'Structural',name:'Test engineer Workflow',approvalStatus:'Approved'},
  {service:'Structural',name:'Test outsider Workflow',approvalStatus:'Proposed'},
 ]}});
 assert.equal((await call('engineer',`/api/projects/${f.project}/reconcile-team`,'POST')).status,403);
 const result=await call('spoc',`/api/projects/${f.project}/reconcile-team`,'POST');
 assert.equal(result.status,200,JSON.stringify(result.data));assert.deepEqual(result.data.allocationWarnings,[]);
 const team=(await call('tl','/api/teams/mine')).data.items.find(t=>t.allocationProject===f.project);
 assert(team);assert.equal(team.lead._id,f.cast.tl.employee);
 assert(team.members.some(m=>m.employee._id===f.cast.engineer.employee));
 assert(!team.members.some(m=>m.employee._id===f.cast.outsider.employee));
 const task=await call('tl','/api/work/tasks','POST',{project:f.project,members:[f.cast.engineer.employee],deliverable:'Reconciled allocation task'});
 assert.equal(task.status,201,JSON.stringify(task.data));
 assert((await call('engineer','/api/work/tasks/mine')).data.items.some(t=>t._id===task.data.item._id));
 assert.equal((await call('tl','/api/work/tasks','POST',{project:f.project,members:[f.cast.outsider.employee],deliverable:'Out of scope'})).status,400);
});

test('ambiguous legacy names are not guessed and do not erase an existing service roster',async()=>{
 await f.models.Employee.create({empId:'ST-DUPLICATE',firstName:'Test engineer',lastName:'Workflow',designation:'Engineer'});
 await f.models.Project.findByIdAndUpdate(f.project,{$set:{principalTeamLeads:[
  {service:'STR',name:'Test tl Workflow',employee:f.cast.tl.employee,approvalStatus:'Approved'},
  {service:'Structural',name:'Test engineer Workflow',approvalStatus:'Approved'},
 ]}});
 const result=await call('spoc',`/api/projects/${f.project}/reconcile-team`,'POST');
 assert.equal(result.status,200);assert(result.data.allocationWarnings.some(w=>w.includes('multiple employees')));
 const team=(await call('tl','/api/teams/mine')).data.items.find(t=>t.allocationProject===f.project);
 assert(team.members.some(m=>m.employee._id===f.cast.engineer.employee));
 assert(!result.data.project.principalTeamLeads[1].employee);
});
