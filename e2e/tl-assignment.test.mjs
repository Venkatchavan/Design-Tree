import {before,after,test}from'node:test';
import assert from'node:assert/strict';
import {startLocalFixture}from'./local-fixture.mjs';
let f;const cookies={};
before(async()=>{f=await startLocalFixture();for(const role of ['tl','engineer','admin','atd']){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[role].email,password:f.password})});cookies[role]=r.headers.get('set-cookie').split(';')[0]}});
after(async()=>{await f?.stop()});
async function call(role,path,method='GET',body){const r=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()}}
test('TL project options retain the actual saved job number, including absence when genuinely unset',async()=>{
 await f.models.Project.findByIdAndUpdate(f.project,{jobNumber:'JOB-26-442'});
 const r=await call('tl','/api/teams/mine');assert.equal(r.status,200);
 const project=r.data.items.flatMap(t=>t.projects).find(p=>p._id===f.project);assert.equal(project.jobNumber,'JOB-26-442');
});
test('TL assignees include active saved project members even when the TL team row has no members',async()=>{
 await f.models.Team.updateMany({lead:f.cast.tl.employee},{$set:{members:[]}});
 await f.models.Team.create({name:'Saved project delivery roster',service:'STR',projects:[f.project],lead:f.cast.outsider.employee,members:[{employee:f.cast.engineer.employee}]});
 const r=await call('tl','/api/work/tasks/assignees?project='+f.project);assert.equal(r.status,200);
 assert(r.data.items.some(m=>String(m.employee._id)===f.cast.engineer.employee));
 const task=await call('tl','/api/work/tasks','POST',{project:f.project,members:[f.cast.engineer.employee],deliverable:'Confirmed roster task'});assert.equal(task.status,201);
 assert((await call('engineer','/api/work/tasks/mine')).data.items.some(t=>t._id===task.data.item._id));
});
test('assignee scope excludes unrelated projects, inactive teams and exited employees',async()=>{
 const exited=await f.models.Employee.create({firstName:'Exited recipient',empId:'TL-EXIT',status:'Exited'});
 await f.models.Team.create({name:'Disabled roster',service:'ELEC',projects:[f.project],active:false,members:[{employee:f.cast.qs.employee}]});
 await f.models.Team.create({name:'Exited roster',service:'STR',projects:[f.project],members:[{employee:exited._id}]});
 const r=await call('tl','/api/work/tasks/assignees?project='+f.project);assert.equal(r.status,200);
 assert(!r.data.items.some(m=>String(m.employee._id)===String(exited._id)));
 assert(!r.data.items.some(m=>String(m.employee._id)===f.cast.qs.employee));
 assert.equal((await call('tl','/api/work/tasks/assignees?project='+f.other)).status,403);
 assert.equal((await call('engineer','/api/work/tasks/assignees?project='+f.project)).status,403);
 assert.equal((await call('tl','/api/work/tasks','POST',{project:f.project,members:[String(exited._id)],deliverable:'Invalid recipient'})).status,400);
});
