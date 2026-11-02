import {before,after,test}from'node:test';
import assert from'node:assert/strict';
import {startLocalFixture}from'./local-fixture.mjs';
let f,team,otherTeam;const cookies={};
async function call(role,path,method='GET',body){const r=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};}
before(async()=>{
 f=await startLocalFixture();
 for(const [role,u]of Object.entries(f.cast)){
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:f.password})});cookies[role]=r.headers.get('set-cookie').split(';')[0];
 }
 await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee,{$set:{director:f.cast.associate.employee,reportingManager:f.cast.atd.employee}});
 // The engineer reports to the linked TL. TD ownership is recorded by service and project.
 await f.models.Employee.findByIdAndUpdate(f.cast.engineer.employee,{$set:{reportingManager:f.cast.tl.employee}});
 const {ServiceDashboard}=await import('../api/src/models/ServiceDashboard.js');
 await ServiceDashboard.create({project:f.project,service:'STR',technicalDirector:'TEST-td'});
 await f.models.Project.findByIdAndUpdate(f.project,{$set:{jobNumber:'JOB-26001'}});
 team=await f.models.Team.findOne({name:'Assigned Structural team'});otherTeam=await f.models.Team.findOne({name:'Unrelated team'});
});
after(async()=>f?.stop());

test('AD TD ATD navigation removes the four marked services and keeps My team',async()=>{
 const{NAV_BY_ROLE}=await import('../api/src/config/roles.js');
 for(const role of['associate_director','technical_director','assoc_technical_director']){
  const nav=NAV_BY_ROLE[role].map(x=>x.view);assert(nav.includes('my-team'));
  for(const forbidden of['bim-head','gbs-head','peer-review-head','qs-head'])assert(!nav.includes(forbidden));
 }
 assert(NAV_BY_ROLE.bim_head.some(x=>x.view==='bim-head'));
});

test('director lists and direct team/project-roster IDs return only authorized assignments',async()=>{
 for(const role of['associate','td','atd']){
  const r=await call(role,'/api/teams/mine');assert.equal(r.status,200);assert(r.data.items.some(t=>t._id===String(team._id)));
  assert(!r.data.items.some(t=>t._id===String(otherTeam._id)));
  assert.equal(r.data.items[0].projects[0].jobNumber,'JOB-26001');
  assert.equal((await call(role,`/api/teams/${otherTeam._id}`)).status,404);
  assert.equal((await call(role,`/api/projects/${f.other}/team`)).status,404);
  const listed=await call(role,'/api/teams');assert(!listed.data.items.some(t=>t.id===String(otherTeam._id)));
 }
 const r=await call('associate',`/api/projects/${f.project}/team`);
 assert(r.data.members.some(m=>m.employee._id===f.cast.tl.employee));assert(!r.data.members.some(m=>m.employee._id===f.cast.peer.employee));
});

test('member-only ownership excludes the unrelated lead and members of a shared team',async()=>{
 const p=await f.models.Project.create({code:'DIR-MEMBER',name:'Member-only project'});
 const t=await f.models.Team.create({name:'Member-only service team',service:'ELE',lead:f.cast.outsider.employee,projects:[p._id],members:[{employee:f.cast.engineer.employee},{employee:f.cast.outsider.employee}]});
 const r=await call('associate','/api/teams/mine');const row=r.data.items.find(x=>x._id===String(t._id));assert(row);assert.equal(row.lead,null);assert.equal(row.members.length,1);assert.equal(row.members[0].employee._id,f.cast.engineer.employee);
 const direct=await call('associate',`/api/teams/${t._id}`);assert.equal(direct.status,200);assert.equal(direct.data.team.members.length,1);
});

test('service director ownership does not expose another service or project from a shared team',async()=>{
 const p=await f.models.Project.create({code:'DIR-SPLIT',name:'Separate assignment'});
 await f.models.Team.findByIdAndUpdate(team._id,{$addToSet:{projects:p._id}});
 const r=await call('td','/api/teams/mine');const rows=r.data.items.filter(t=>t._id===String(team._id));assert.equal(rows.length,1);assert.deepEqual(rows[0].projects.map(p=>p._id),[f.project]);
 assert.equal((await call('td',`/api/projects/${p._id}/team`)).status,404);
 await f.models.Team.findByIdAndUpdate(team._id,{$pull:{projects:p._id}});
});

test('ambiguous names and missing director mappings grant no company-wide fallback',async()=>{
 await f.models.Employee.create({empId:'DUP-DIR',firstName:'Test associate',lastName:'Workflow',designation:'Associate Director'});
 const p=await f.models.Project.create({code:'DIR-AMBIG',name:'Ambiguous reporting project'});
 const e=await f.models.Employee.create({empId:'AMBIG-MEMBER',firstName:'Ambiguous',lastName:'Member',director:'Test associate Workflow'});
 await f.models.Team.create({name:'Ambiguous name team',service:'STR',projects:[p._id],members:[{employee:e._id}]});
 assert(!(await call('associate','/api/teams/mine')).data.items.some(t=>t.projects.some(x=>x._id===String(p._id))));
 await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee,{$unset:{director:1}});
 assert.equal((await call('associate','/api/teams/mine')).data.items.length,0);
 await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee,{$set:{director:f.cast.associate.employee}});
});

test('a shared employee remains visible under each actual project without merging services',async()=>{
 const p=await f.models.Project.create({code:'DIR-MULTI',name:'Second project',jobNumber:'JOB-26002'});
 await f.models.Team.create({name:'Second electrical assignment',service:'ELE',projects:[p._id],members:[{employee:f.cast.engineer.employee}]});
 const r=await call('associate','/api/teams/mine');assert(r.data.items.some(t=>t.service==='Electrical'&&t.projects.some(x=>x._id===String(p._id))&&t.members.some(m=>m.employee._id===f.cast.engineer.employee)));
 assert(r.data.items.some(t=>t.service==='Structural'&&t.projects.some(x=>x._id===f.project)));
});

test('ATD tasks can target assigned TLs but not another project, service or stale members',async()=>{
 const task=await call('atd','/api/work/tasks','POST',{project:f.project,members:[f.cast.tl.employee,f.cast.engineer.employee],deliverable:'Director assigned review'});
 assert.equal(task.status,201,JSON.stringify(task.data));
 assert.equal((await call('atd','/api/work/tasks','POST',{project:f.other,members:[f.cast.outsider.employee],deliverable:'Outside project'})).status,403);
 assert.equal((await call('atd','/api/work/tasks','POST',{project:f.project,members:[f.cast.peer.employee],deliverable:'Other service'})).status,400);
 assert.equal((await call('atd',`/api/work/tasks/${task.data.item._id}`,'PUT',{project:f.other})).status,403);
 assert((await call('tl','/api/work/tasks/mine')).data.items.some(t=>t._id===task.data.item._id));
});

test('marked service API mutations deny the requested roles and retain authorized writers',async()=>{
 const routes=['/api/variations','/api/stage-reviews','/api/service-dashboards','/api/work-items'];
 for(const route of routes){
  assert.equal((await call('atd',route,route.endsWith('service-dashboards')?'PUT':'POST',{project:f.project})).status,403,route);
  assert.equal((await call('atd',route+'/012345678901234567890123','PUT',{project:f.project})).status,route.endsWith('service-dashboards')?404:403,route);
 }
 for(const route of['/api/service-dashboards','/api/work-items'])assert.equal((await call('associate',route,route.endsWith('service-dashboards')?'PUT':'POST',{project:f.project})).status,403);
 assert.equal((await call('qs','/api/service-dashboards','PUT',{project:f.project,service:'QS',boqBuiltUpArea:120})).status,200);
});

test('TD project panel removal does not alter stage completion or billing state',async()=>{
 const stage=await f.models.StageStatus.create({project:f.project,service:'Structural',stage:'CD',confirmationStatus:'PTL Requested',billingReadiness:'Pending'});
 const before=await f.models.StageStatus.findById(stage._id).lean();
 await call('td',`/api/projects/${f.project}`);await call('td','/api/teams/mine');
 assert.deepEqual(await f.models.StageStatus.findById(stage._id).lean(),before);
 // Reading the removed TD panel must also leave legacy approvals/billing and
 // their genuinely unknown timeline dates intact.
 const approved=await f.models.StageStatus.create({project:f.project,service:'Structural',stage:'SD',confirmationStatus:'TD Approved',billingReadiness:'Billed'});
 await call('td',`/api/billing/stage-timeline?project=${f.project}`);
 const persisted=await f.models.StageStatus.findById(approved._id).lean();
 assert.equal(persisted.confirmationStatus,'TD Approved');assert.equal(persisted.billingReadiness,'Billed');assert.equal(persisted.actualCompletion,undefined);assert.equal(persisted.baselineCompletion,undefined);

});

test('one service ownership does not grant every service in a bundled team',async()=>{
 const p=await f.models.Project.create({code:'DIR-BUNDLE',name:'Bundled project'});
 await f.models.Team.create({name:'Unowned MEP team',service:'MEP',projects:[p._id],lead:f.cast.outsider.employee,members:[{employee:f.cast.outsider.employee}]});
 const {ServiceDashboard}=await import('../api/src/models/ServiceDashboard.js');
 await ServiceDashboard.create({project:p._id,service:'ELE',technicalDirector:'TEST-td'});
 const r=await call('td','/api/teams/mine');const rows=r.data.items.filter(t=>t.projects.some(x=>x._id===String(p._id)));
 assert.equal(rows.length,1);assert.equal(rows[0].service,'Electrical');
});

test('director task list and direct IDs do not expose another creators task',async()=>{
 const r=await call('tl','/api/work/tasks','POST',{project:f.project,members:[f.cast.engineer.employee],deliverable:'TL private task'});assert.equal(r.status,201);
 assert(!(await call('atd','/api/work/tasks')).data.items.some(t=>t._id===r.data.item._id));
 assert.equal((await call('atd',`/api/work/tasks/${r.data.item._id}`)).status,404);
});
