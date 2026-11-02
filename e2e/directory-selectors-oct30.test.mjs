import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
let f; const cookies={};
before(async()=>{f=await startLocalFixture();for(const role of ['md','ed','wd','td','engineer','dmh']){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[role].email,password:f.password})});cookies[role]=r.headers.get('set-cookie').split(';')[0];}});
after(async()=>f?.stop());
test('company directory includes founding and executive observers without opening unrelated roles or writes',async()=>{
 for(const role of ['md','ed','wd','td']){const r=await fetch(f.base+'/api/teams/company-directory',{headers:{Cookie:cookies[role]}});assert.equal(r.status,200,role);const d=await r.json();assert(d.employees.some(e=>e._id===f.cast.outsider.employee));assert(d.projects.some(p=>p._id===f.other));assert(!JSON.stringify(d).includes('passwordHash'));}
 for(const role of ['engineer','dmh'])assert.equal((await fetch(f.base+'/api/teams/company-directory',{headers:{Cookie:cookies[role]}})).status,403,role);
 for(const role of ['md','ed'])assert.equal((await fetch(f.base+'/api/teams',{method:'POST',headers:{Cookie:cookies[role],'Content-Type':'application/json'},body:JSON.stringify({name:'Forbidden'})})).status,403);
});
test('employee filters only narrow authorized identities and retain selected candidates across aliases',async()=>{
 const {filterEmployees}=await import('../web/src/lib/employeeFilters.js');
 const a={_id:'a',firstName:'Asha',empId:'E1',branch:'North',department:'STR'};const b={_id:'b',firstName:'Bina',branch:'South',department:'HVAC'};const c={_id:'c',firstName:'Chitra',branch:'North',department:'SMEPF'};
 assert.deepEqual(filterEmployees([a,b,c],{search:'E1',branch:'North',service:'Structural'}),[a]);
 assert.deepEqual(filterEmployees([a,b,c],{branch:'North',service:'Mechanical',selectedIds:['b','outside']}),[b,c]);
 assert.deepEqual(filterEmployees([a,b,c],{search:'no match',selectedIds:['a']}),[a]);
 assert.deepEqual(filterEmployees([a,b],{branch:'North',selectedIds:['outside']}),[a]);
 assert.deepEqual(filterEmployees([{employee:a,service:'HVAC'},{employee:b}],{service:'Mechanical'}).map(x=>x.employee._id),['a','b']);
});
test('leadership project rows start with authorized roster, preserve distinct identities, fractional hours and unknown progress',async()=>{
 const {leadershipProjectRows}=await import('../web/src/lib/leadershipProjects.js');
 const projects=[{_id:'a',name:'Same name',branch:'North',services:['STR'],currentStage:'CD'},{_id:'b',name:'Same name',branch:'South',services:['HVAC'],currentStage:'SD'},{_id:'c',name:'Zero work',branch:'North',services:['STR'],currentStage:'CD'}];
 const entries=[{_id:'w',source:'WorkEntry',project:{_id:'a'},hours:0.375,stage:'CD',service:'STR',progressPct:0},{_id:'foreign',project:{_id:'outside'},hours:99}];
 const rows=leadershipProjectRows(projects,entries,{});assert.equal(rows.length,3);assert.equal(rows.find(r=>r.pid==='a').hours,0.375);assert.equal(rows.find(r=>r.pid==='a').progress,'0.0%');assert.equal(rows.find(r=>r.pid==='b').hours,0);assert.equal(rows.find(r=>r.pid==='b').progress,'Not recorded');
 assert.deepEqual(leadershipProjectRows(projects,entries,{branch:'North',service:'Structural',stage:'CD'}).map(r=>r.pid),['a','c']);
 assert.equal(leadershipProjectRows(projects,entries,{project:'b'})[0].hours,0);
});
test('DMH with no saved reporting links returns explicit empty scope, never company SPOCs',async()=>{
 const r=await fetch(f.base+'/api/design-team',{headers:{Cookie:cookies.dmh}});assert.equal(r.status,200);const d=await r.json();assert.equal(d.spocs.length,0);assert.equal(d.summary.spocs,0);assert(!JSON.stringify(d).includes(f.cast.spoc.employee));
});
test('project roster pages cover saved projects beyond 200 without widening engineer scope',async()=>{
 const rows=Array.from({length:205},(_,i)=>({name:`Roster ${i}`,code:`LOCAL-${i}`,branch:'Test HQ',services:['STR']}));await f.models.Project.insertMany(rows);
 const get=async(role,page)=>fetch(f.base+`/api/projects?page=${page}&limit=200`,{headers:{Cookie:cookies[role]}}).then(r=>r.json());
 const a=await get('md',1),b=await get('md',2);assert(a.hasMore);assert.equal(a.items.length,200);assert(b.items.length>0);assert(!a.items.some(x=>b.items.some(y=>x._id===y._id)));assert.equal(a.items.length+b.items.length,a.total);
 const engineer=await get('engineer',1);assert(engineer.items.every(p=>p._id===f.project));assert.equal(engineer.total,1);
 await f.models.Project.deleteMany({code:/^LOCAL-/});
});
test('meeting candidates with saved composite service labels match each component without widening their authorized roster',async()=>{
 const {filterEmployees,employeeServices}=await import('../web/src/lib/employeeFilters.js');
 const {serviceNames}=await import('../web/src/lib/services.js');
 const {expandServices}=await import('../api/src/config/services.js');
 const member={employee:{_id:'meeting-member',firstName:'Saved member',department:'Structural',branch:'North'},service:'Structural + Mechanical + Electrical + Plumbing + Fire'};
 const structural={employee:{_id:'structural-only',department:'Structural',branch:'South'},service:'STR'};
 assert(employeeServices(member).includes('Mechanical'),'a saved composite team supplies Mechanical independently of employee department');
 assert.deepEqual(filterEmployees([member,structural],{service:'Mechanical'}),[member]);
 assert.deepEqual(filterEmployees([member,structural],{service:'Mechanical',branch:'South',selectedIds:['meeting-member','outside-roster']}),[member]);
 assert.deepEqual(filterEmployees([member,structural],{service:'BIM',selectedIds:['outside-roster']}),[]);
 assert.deepEqual(filterEmployees([member,structural],{service:'BIM',selectedIds:['meeting-member']}),[member]);
 const saved=[' STR + hvac + ELE + PHE + FIRE ','SMEPF + Peer Review + Saved specialty','mep + BIM',' +  '];
 assert.deepEqual(serviceNames(saved),expandServices(saved),'aliases, bundles, blanks and unknown labels follow server comparisons');
});
