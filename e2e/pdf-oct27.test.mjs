import {before,after,test}from'node:test';
import assert from'node:assert/strict';
import {startLocalFixture}from'./local-fixture.mjs';
let f;const cookies={};
before(async()=>{f=await startLocalFixture();for(const role of ['associate','td','atd','engineer','spoc','tl']){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[role].email,password:f.password})});cookies[role]=r.headers.get('set-cookie').split(';')[0]}});
after(async()=>{await f?.stop()});
async function call(role,path){const r=await fetch(f.base+path,{headers:{Cookie:cookies[role]}});return {status:r.status,data:await r.json()}}
test('active sessions use current elapsed time and same-day relogin clears the prior logout without resetting first login',async()=>{
 const {AttendanceDay}=await import('../api/src/models/AttendanceDay.js');const {recordLogin}=await import('../api/src/controllers/attendance.controller.js');const {istDayKey}=await import('../api/src/config/attendance.js');
 const now=new Date(),loginAt=new Date(now-2*3600000);await AttendanceDay.deleteMany({employee:f.cast.engineer.employee});
 await AttendanceDay.create({employee:f.cast.engineer.employee,date:istDayKey(now),loginAt,logoutAt:new Date(loginAt.getTime()+18*60000),workingDay:true});
 const status=await call('engineer','/api/attendance/status');assert.equal(status.status,200);assert(status.data.durationHours>=2);assert(status.data.elapsedSeconds>=7200);
 await recordLogin(f.cast.engineer.user,'engineer_drafter',now);
 const day=await AttendanceDay.findOne({employee:f.cast.engineer.employee,date:istDayKey(now)});assert.equal(day.loginAt.toISOString(),loginAt.toISOString());assert.equal(day.logoutAt,null);
});
test('My Team includes reporting employees without a project and excludes self and unrelated employees',async()=>{
 const report=await f.models.Employee.create({empId:'PDF-DIRECT',firstName:'Direct Report',department:'Structural',branch:'Branch A',director:f.cast.associate.employee});
 const down=await f.models.Employee.create({empId:'PDF-INDIRECT',firstName:'Indirect Report',reportingManager:report._id});
 const r=await call('associate','/api/teams/reporting-directory');assert.equal(r.status,200);
 assert(r.data.employees.some(e=>e._id===String(report._id)));assert(r.data.employees.some(e=>e._id===String(down._id)));
 assert(!r.data.employees.some(e=>e._id===f.cast.associate.employee||e._id===f.cast.outsider.employee));
});
test('company Teams directory includes all services projects and employees, filtered by branch without broadening My Team',async()=>{
 await f.models.Employee.insertMany(Array.from({length:205},(_,i)=>({empId:'PDF-COMPANY-'+i,firstName:'Company Person '+i,department:'Electrical',branch:'Branch B'})));
 const r=await call('td','/api/teams/company-directory');assert.equal(r.status,200);assert(r.data.employees.length>205);
 assert(r.data.projects.some(p=>p._id===f.other));assert(r.data.services.includes('Structural')&&r.data.services.includes('Electrical'));
 const filtered=await call('td','/api/teams/company-directory?branch=Branch%20B');assert.equal(filtered.data.employees.length,205);assert(filtered.data.employees.every(e=>e.branch==='Branch B'));
 assert.equal((await call('engineer','/api/teams/company-directory')).status,403);
 assert(!(await call('td','/api/teams/mine')).data.items.some(t=>t.name==='Unrelated team'));
 assert(!JSON.stringify(r.data).includes('passwordHash'));assert(!JSON.stringify(r.data).includes('@datum-test.example'));
});
test('company employee inventory retains exited records with status while My Team remains current reporting staff',async()=>{
 const past=await f.models.Employee.create({empId:'PDF-PAST',firstName:'Former employee',status:'Exited',director:f.cast.associate.employee});
 const company=await call('associate','/api/teams/company-directory');assert(company.data.employees.some(e=>e._id===String(past._id)&&e.status==='Exited'));
 const personal=await call('associate','/api/teams/reporting-directory');assert(!personal.data.employees.some(e=>e._id===String(past._id)));
});
test('attendance is live for each covered login and exempt roles and nonworking days retain their policy',async()=>{
 const {AttendanceDay}=await import('../api/src/models/AttendanceDay.js');const {istDayKey}=await import('../api/src/config/attendance.js');const now=new Date();
 for(const role of ['tl','spoc','engineer']){
  await AttendanceDay.findOneAndUpdate({employee:f.cast[role].employee,date:istDayKey(now)},{$set:{loginAt:new Date(now-3600000),logoutAt:new Date(now-3420000),workingDay:true}},{upsert:true});
  const r=await call(role,'/api/attendance/status');assert.equal(r.data.required,true);assert(r.data.elapsedSeconds>=3600);
 }
 assert.equal((await call('td','/api/attendance/status')).data.exempt,true);
 await AttendanceDay.updateOne({employee:f.cast.engineer.employee,date:istDayKey(now)},{$set:{workingDay:false}});
 assert.equal((await call('engineer','/api/attendance/status')).data.underHours,false);
});
test('AD TD ATD lose only the requested QAQC sidebar entry',async()=>{
 const {NAV_BY_ROLE}=await import('../api/src/config/roles.js');
 for(const role of ['associate_director','technical_director','assoc_technical_director']){assert(!NAV_BY_ROLE[role].some(n=>n.view==='qaqc-specs'));assert(NAV_BY_ROLE[role].some(n=>n.view==='my-team'));assert(NAV_BY_ROLE[role].some(n=>n.view==='teams'))}
 assert(NAV_BY_ROLE.qaqc_head.some(n=>n.view==='qaqc-specs'));
});
