import{before,after,test}from'node:test';import assert from'node:assert/strict';import{startPdfFixture}from'./pdf-oct28-fixture.mjs';
let f;const cookies={};
before(async()=>{f=await startPdfFixture();for(const[k,u]of Object.entries(f.cast)){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:f.password})});cookies[k]=r.headers.get('set-cookie').split(';')[0]}});
after(async()=>f?.stop());
async function call(role,path,method='GET',body){const r=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()}}
test('HR reads the complete company Teams directory without gaining directory writes',async()=>{
 const r=await call('hr','/api/teams/company-directory');assert.equal(r.status,200);assert(r.data.employees.some(e=>e._id===f.cast.outsider.employee));assert(r.data.projects.some(p=>p._id===f.other));assert(r.data.services.includes('Structural'));assert(!JSON.stringify(r.data).includes('passwordHash'));
 assert.equal((await call('engineer','/api/teams/company-directory')).status,403);
});
test('HR cannot provision or edit external portal logins through any login writer',async()=>{
 const before=await f.models.User.countDocuments();const body={name:'External test',email:'external28@datum-test.example',password:f.password,role:'client'};
 assert.equal((await call('hr','/api/users/portal','POST',body)).status,403);
 assert.equal((await call('hr','/api/users','POST',body)).status,403);
 assert.equal((await call('hr',`/api/users/${f.cast.engineer.user}`,'PATCH',{role:'architect',employeeId:null})).status,403);
 assert.equal(await f.models.User.countDocuments(),before);
 const admin=await call('admin','/api/users/portal','POST',body);assert.equal(admin.status,201);const user=admin.data.user??admin.data.item;
 assert.equal((await call('hr',`/api/users/${user.id??user._id}`,'PATCH',{isActive:false})).status,403);
 assert((await f.models.User.findById(f.cast.engineer.user)).employee);
});
test('leadership service team and scope logs reject direct writes but retain saved logs and permitted TL editing',async()=>{
 for(const role of['md','wd','ed']){
  for(const service of['STR','ELE','HVAC','PHE','FIRE','QS','QAQC','GBS','BIM'])assert.equal((await call(role,'/api/service-dashboards','PUT',{project:f.project,service,scopeStatus:'Completed'})).status,403,role+service);
  assert.equal((await call(role,'/api/work-items','POST',{project:f.project})).status,403);
  assert.equal((await call(role,'/api/service-dashboards?project='+f.project)).status,200);
 }
 assert.equal((await f.models.ServiceDashboard.findOne({project:f.project,service:'STR'})).scopeStatus,'In Progress');
 assert.equal((await call('tl','/api/service-dashboards','PUT',{project:f.project,service:'STR',scopeStatus:'In Progress'})).status,200);
});
test('leadership reads the marked stage review log while all matching review writes are denied',async()=>{
 const saved=await f.models.StageReview.findOne({project:f.project});
 for(const role of['md','wd','ed']){
  const r=await call(role,'/api/stage-reviews?project='+f.project);assert(r.data.items.some(x=>x._id===String(saved._id)));
  assert.equal((await call(role,'/api/stage-reviews','POST',{project:f.project,stage:'CD'})).status,403);
  assert.equal((await call(role,'/api/stage-reviews/'+saved._id,'PUT',{outcome:'Rejected'})).status,403);
  assert.equal((await call(role,'/api/functions/peer-reviews','POST',{project:f.project})).status,403);
 }
 assert.equal((await f.models.StageReview.findById(saved._id)).outcome,'Approved');
 assert.equal((await call('associate','/api/stage-reviews','POST',{project:f.project,stage:'CD'})).status,201);
});
test('leadership calendar removal rejects writes while HR and working-day holiday reads remain',async()=>{
 for(const role of['md','wd','ed']){
  assert.equal((await call(role,'/api/leave-travel/holidays','POST',{date:'2026-12-25',name:'Test holiday'})).status,403);
  assert.equal((await call(role,'/api/leave-travel/holidays/012345678901234567890123','DELETE')).status,403);
 }
 assert.equal((await call('hr','/api/leave-travel/holidays','POST',{date:'2026-12-25',name:'Test holiday'})).status,201);
 assert.equal((await call('engineer','/api/leave-travel/holidays')).status,200);
});
test('HR and all board roles see historical requests plus Finance bookings with explicit sources and no record writes',async()=>{
 const requests=await f.models.TravelRequest.countDocuments(),bookings=await f.models.TravelBooking.countDocuments();
 for(const role of['hr','md','wd','ed']){
  const r=await call(role,'/api/leave-travel/travel/log');assert.equal(r.status,200);
  assert(r.data.items.some(x=>x.source==='Request'&&x.purpose==='Historical site inspection'));
  assert(r.data.items.some(x=>x.source==='Booking'&&x.purpose==='Historical finance booking'&&x.status==='Completed'));
  assert(!JSON.stringify(r.data).includes('passwordHash'));
  assert.equal((await call(role,'/api/travel-bookings')).status,403);
 }
 assert.equal((await call('engineer','/api/leave-travel/travel/log')).status,403);
 assert.equal(await f.models.TravelRequest.countDocuments(),requests);assert.equal(await f.models.TravelBooking.countDocuments(),bookings);
});
test('travel report pages are bounded stable and reach old records beyond the first 200',async()=>{
 await f.models.TravelBooking.insertMany(Array.from({length:205},(_,i)=>({employee:f.cast.engineer.employee,reason:'Bulk history '+i,departureDate:'2025-01-01'})));
 const a=await call('hr','/api/leave-travel/travel/log?limit=200&page=1'),b=await call('hr','/api/leave-travel/travel/log?limit=200&page=2');assert.equal(a.status,200);assert.equal(a.data.items.length,200);assert.equal(a.data.total,207);assert(a.data.hasMore);assert.equal(b.data.items.length,7);
 assert.equal(new Set([...a.data.items,...b.data.items].map(x=>x.id)).size,207);assert.equal((await call('hr','/api/leave-travel/travel/log?page=-1')).status,400);
});
