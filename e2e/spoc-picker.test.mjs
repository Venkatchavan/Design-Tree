import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {startLocalFixture} from './local-fixture.mjs';
let f,cookies={};
before(async()=>{
 f=await startLocalFixture();
 for(const role of ['admin','td','engineer']){
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[role].email,password:f.password})});cookies[role]=r.headers.get('set-cookie').split(';')[0];
 }
});
after(async()=>{await f?.stop()});
async function call(role,path,method='GET',body){const r=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
test('activation rejects a real employee who has no active SPOC login before any writes',async()=>{
 const p=await f.models.Project.create({name:'Eligibility guard',code:'SPOC-GUARD',services:['STR']});
 const r=await call('td',`/api/projects/${p._id}/activate`,'POST',{coordinator:f.cast.engineer.employee});
 assert.equal(r.status,400);assert.notEqual((await f.models.Project.findById(p._id)).activation?.status,'Activated');
 assert.equal(await f.models.SpocAllocation.countDocuments({project:p._id}),0);
});
test('SPOC picker includes only eligible linked coordinators, all pages, with review reasons',async()=>{
 const hash=(await f.models.User.findById(f.cast.admin.user).select('+passwordHash')).passwordHash;
 const employees=await f.models.Employee.insertMany(Array.from({length:205},(_,i)=>({firstName:'Picker coordinator '+i,empId:'PICKER-'+i})));
 await f.models.User.insertMany(employees.map((e,i)=>({name:e.firstName,email:`picker${i}@test.example`,role:'coordinator',passwordHash:hash,employee:e._id})));
 await f.models.User.create({name:'Unlinked SPOC',email:'unlinked@picker.example',role:'coordinator',passwordHash:hash});
 await f.models.User.findByIdAndUpdate(f.cast.spoc.user,{isActive:false});
 const r=await call('td','/api/employees/spoc-options');assert.equal(r.status,200);
 assert.equal(r.data.items.length,205);assert.equal(new Set(r.data.items.map(e=>e._id)).size,205);
 assert(!r.data.items.some(e=>e._id===f.cast.engineer.employee||e._id===f.cast.spoc.employee));
 assert(r.data.unavailable.some(e=>e.name==='Unlinked SPOC'&&e.reason.includes('employee')));
 assert.equal((await call('engineer','/api/employees/spoc-options')).status,403);
 assert(!JSON.stringify(r.data).includes('passwordHash'));assert(!JSON.stringify(r.data).includes('@test.example'));
 await f.models.User.findByIdAndUpdate(f.cast.spoc.user,{isActive:true});
});
test('activation requires an eligible SPOC and preserves approved allocation and workspace access',async()=>{
 const p=await f.models.Project.create({name:'Eligible activation',code:'SPOC-ACTIVATE',services:['STR']});
 assert.equal((await call('td',`/api/projects/${p._id}/activate`,'POST',{})).status,400);
 const r=await call('td',`/api/projects/${p._id}/activate`,'POST',{coordinator:f.cast.spoc.employee});
 assert.equal(r.status,200);assert.equal(r.data.project.activation.status,'Activated');assert.equal(r.data.allocation.status,'Approved');
 assert.equal(String(r.data.allocation.coordinator),f.cast.spoc.employee);
});
test('role corrections appear on the next list read and stale eligibility is rejected on submit',async()=>{
 await f.models.User.findByIdAndUpdate(f.cast.engineer.user,{role:'coordinator'});
 assert((await call('td','/api/employees/spoc-options')).data.items.some(e=>e._id===f.cast.engineer.employee));
 await f.models.User.findByIdAndUpdate(f.cast.engineer.user,{role:'engineer_drafter'});
 const p=await f.models.Project.create({name:'Stale picker',code:'SPOC-STALE',services:['STR']});
 assert.equal((await call('td',`/api/projects/${p._id}/activate`,'POST',{coordinator:f.cast.engineer.employee})).status,400);
 assert.equal(await f.models.SpocAllocation.countDocuments({project:p._id}),0);
});
test('exited, conflicting and multiply linked SPOC identities are excluded without changing records',async()=>{
 const hash=(await f.models.User.findById(f.cast.admin.user).select('+passwordHash')).passwordHash;
 const exited=await f.models.Employee.create({firstName:'Exited SPOC',empId:'PICK-EXIT',status:'Exited'});
 const conflict=await f.models.Employee.create({firstName:'Conflicting SPOC',empId:'PICK-CONFLICT',user:f.cast.admin.user});
 const shared=await f.models.Employee.create({firstName:'Shared identity',empId:'PICK-SHARED'});
 for(const [i,e]of[exited,conflict,shared,shared].entries())await f.models.User.create({name:'Excluded coordinator '+i,email:`excluded${i}@picker.example`,role:'coordinator',isActive:true,employee:e._id,passwordHash:hash});
 const result=await call('td','/api/employees/spoc-options');assert.equal(result.status,200);
 assert(!result.data.items.some(e=>[exited,conflict,shared].some(x=>String(x._id)===e._id)));
 assert(result.data.unavailable.some(u=>u.reason.includes('exited')));assert(result.data.unavailable.some(u=>u.reason.includes('conflict')));assert(result.data.unavailable.some(u=>u.reason.includes('multiple')));
 assert.equal(String((await f.models.Employee.findById(conflict._id)).user),f.cast.admin.user);
});
