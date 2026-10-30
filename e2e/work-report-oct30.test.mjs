import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
let f, SpocEntry, WorkEntry, uploadDirectory; const cookies={};
before(async()=>{
 uploadDirectory=await mkdtemp('/tmp/designtree-work-report-');process.env.TEST_UPLOAD_DIR=uploadDirectory;
 f=await startLocalFixture(); ({SpocEntry}=await import('../api/src/models/SpocEntry.js')); ({WorkEntry}=await import('../api/src/models/WorkEntry.js'));
 for(const key of ['spoc','dmh','md','outsider','td','engineer']){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast[key].email,password:f.password})});cookies[key]=r.headers.get('set-cookie').split(';')[0];}
 await SpocEntry.init();
});
after(async()=>{await f?.stop();if(uploadDirectory)await rm(uploadDirectory,{recursive:true,force:true});});
async function call(role,path,body,method=body?'POST':'GET'){const r=await fetch(f.base+path,{method,headers:{Cookie:cookies[role],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const row=(over={})=>({project:f.project,service:'STR',areas:[{key:'Documents',update:'Full saved remarks',hours:1.125}],...over});
async function create(over={}){return SpocEntry.create({...row(),employee:f.cast.spoc.employee,createdBy:f.cast.spoc.user,date:'2026-10-29T18:30:00Z',...over});}
test('own correction preserves identity, documents and immutable previous details; stale/foreign/director denied',async()=>{
 const old=await create({documents:[{name:'saved.pdf',file:'saved-file'}]});
 for(const role of ['dmh','md','outsider']) assert.equal((await call(role,`/api/spoc/entries/${old.id}`,{...row(),expectedVersion:0},'PATCH')).status,403);
 assert.equal((await call('spoc',`/api/spoc/entries/${old.id}`,{...row(),employee:f.cast.outsider.employee,expectedVersion:0},'PATCH')).status,400);
 const result=await call('spoc',`/api/spoc/entries/${old.id}`,{...row({areas:[{key:'Meetings',update:'Corrected',hours:2.375}]}),expectedVersion:0},'PATCH');
 assert.equal(result.status,200,JSON.stringify(result));const doc=await SpocEntry.findById(old.id).lean();
 assert.equal(String(doc.createdBy),f.cast.spoc.user);assert.equal(doc.documents[0].file,'saved-file');assert.equal(doc.totalHours,2.375);assert.equal(doc.history[0].previous.areas[0].update,'Full saved remarks');assert.equal(String(doc.history[0].actor),f.cast.spoc.user);
 assert.equal((await call('spoc',`/api/spoc/entries/${old.id}`,{...row(),expectedVersion:0},'PATCH')).status,409);
});
test('day prevalidation writes nothing on invalid/stale payload; partial race outcomes and idempotent create retry',async()=>{
 const old=await create();const before=await SpocEntry.countDocuments();
 assert.equal((await call('spoc','/api/spoc/entries/day',{date:'2026-10-30',rows:[{...row(),date:'2026-10-29',clientKey:'wrong-day'}]})).status,400);
 assert.equal((await call('spoc','/api/spoc/entries/day',{date:'2026-10-30',rows:[{...row(),clientKey:'valid-before-invalid'},row({service:'INVALID'})]})).status,400);
 assert.equal(await SpocEntry.countDocuments(),before);
 assert.equal((await call('spoc','/api/spoc/entries/day',{date:'2026-10-30',rows:[{...row(),clientKey:'valid-before-stale'},{...row(),id:old.id,expectedVersion:50}]})).status,409);
 assert.equal(await SpocEntry.countDocuments(),before);
 const body={date:'2026-10-30',rows:[{...row(),clientKey:'retry-a'},{...row({service:'HVAC'}),clientKey:'retry-b'}]};
 const first=await call('spoc','/api/spoc/entries/day',body); assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.complete,true);
 const retry=await call('spoc','/api/spoc/entries/day',body);assert.deepEqual(retry.data.results.map(x=>x.item._id),first.data.results.map(x=>x.item._id));assert.equal(await SpocEntry.countDocuments(),before+2);
 const raceDoc=await create();const raceBody={date:'2026-10-30',rows:[{...row(),id:raceDoc.id,expectedVersion:0},{...row(),clientKey:'race-create'}]};
 const races=await Promise.all([call('spoc','/api/spoc/entries/day',raceBody),call('spoc','/api/spoc/entries/day',raceBody)]);
 assert.ok(races.some(x=>[200,207,409].includes(x.status)));assert.equal(await SpocEntry.countDocuments({clientKey:'race-create'}),1);
});
test('combined report full IST bounds, stable source ids, missing stage, exact hours, pagination and scope',async()=>{
 await SpocEntry.deleteMany({});await WorkEntry.deleteMany({});
 await create({date:'2026-10-29T18:29:59.999Z'});await create({date:'2026-10-29T18:30:00Z'});await create({date:'2026-10-30T18:29:59.999Z'});await create({date:'2026-10-30T18:30:00Z'});
 await WorkEntry.create({project:f.project,employee:f.cast.engineer.employee,date:'2026-10-30T10:00:00Z',hours:2.375,otherHours:[{project:f.project,hours:0.125}]});
 const first=await call('md','/api/reports/work-hours?from=2026-10-30&to=2026-10-30&limit=2');assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.total,3);assert.equal(first.data.items.length,2);
 const second=await call('md','/api/reports/work-hours?from=2026-10-30&to=2026-10-30&limit=2&offset=2');const items=[...first.data.items,...second.data.items];assert.equal(new Set(items.map(x=>x.key)).size,3);assert.ok(items.every(x=>x.workDate==='2026-10-30'));assert.equal(items.reduce((s,x)=>s+x.hours,0),4.75);assert.equal(items.find(x=>x.source==='SpocEntry').stage,null);
 assert.equal((await call('outsider','/api/reports/work-hours?from=2026-10-30&to=2026-10-30')).data.total,0);
 assert.equal((await call('td','/api/reports/work-hours?from=2026-10-30&to=2026-10-30')).data.total,0);
 assert.equal((await call('md','/api/reports/work-hours?from=2026-02-30')).status,400);
});
test('atomic correction conflict during day save reports partial success and retries failed creations safely',async()=>{
 const old=await create();
 const originalUpdate=SpocEntry.findOneAndUpdate;
 let interfered=false;
 SpocEntry.findOneAndUpdate=async function(filter,...args){
   if(String(filter._id)===old.id&&!interfered){interfered=true;await SpocEntry.collection.updateOne({_id:old._id},{$inc:{__v:1}});}
   return originalUpdate.call(this,filter,...args);
 };
 let response;
 try {response=await call('spoc','/api/spoc/entries/day',{date:'2026-10-30',rows:[{...row(),id:old.id,expectedVersion:0},{...row(),clientKey:'partial-success'}]});}
 finally{SpocEntry.findOneAndUpdate=originalUpdate;}
 assert.equal(response.status,207);assert.equal(response.data.complete,false);assert.equal(response.data.results[0].status,'conflict');assert.equal(response.data.results[1].status,'saved');
 assert.equal((await SpocEntry.findById(old.id)).history.length,0,'Lost CAS creates no correction history');
 const originalCreate=SpocEntry.create;let failed=false;
 SpocEntry.create=async function(data){if(data.clientKey==='partial-retry'&&!failed){failed=true;throw new Error('Test transient creation failure');}return originalCreate.call(this,data);};
 const body={date:'2026-10-30',rows:[{...row(),clientKey:'partial-retry'},{...row(),clientKey:'partial-retained'}]};
 try {response=await call('spoc','/api/spoc/entries/day',body);assert.equal(response.status,207);assert.equal(response.data.results[0].status,'failed');assert.equal(response.data.results[1].status,'saved');}
 finally {SpocEntry.create=originalCreate;}
 const retry=await call('spoc','/api/spoc/entries/day',body);assert.equal(retry.status,200);assert.equal(retry.data.results[1].item._id,response.data.results[1].item._id);assert.equal(await SpocEntry.countDocuments({clientKey:{$in:['partial-retry','partial-retained']}}),2);
});
test('historical own projects remain listed/correctable and document upload cannot overwrite work correction',async()=>{
 const old=await create({project:f.other});
 const listed=await call('spoc','/api/spoc/entries?mine=true');assert.ok(listed.data.items.some(e=>e._id===old.id));
 const corrected=await call('spoc',`/api/spoc/entries/${old.id}`,{...row({project:f.other}),expectedVersion:0},'PATCH');assert.equal(corrected.status,200);
 const form=new FormData();form.append('files',new Blob(['document content']), 'own-legacy.txt');
 const upload=await fetch(f.base+`/api/spoc/entries/${old.id}/documents`,{method:'POST',headers:{Cookie:cookies.spoc},body:form});assert.equal(upload.status,201);const saved=(await upload.json()).item;
 assert.equal(saved.__v,2);assert.equal(saved.totalHours,1.125);assert.equal(saved.history.length,1);
 assert.equal((await call('spoc',`/api/spoc/entries/${old.id}`,{...row({project:f.other}),expectedVersion:1},'PATCH')).status,409);
 const download=await fetch(f.base+`/api/spoc/entries/${old.id}/documents/0`,{headers:{Cookie:cookies.spoc}});assert.equal(await download.text(),'document content');
 const reread=await call('md','/api/reports/work-hours?from=2026-10-30&to=2026-10-30');assert.ok(reread.data.items.some(e=>e.sourceId===old.id&&e.documents[0].name==='own-legacy.txt'));
});
test('page aggregation reads beyond old 200 record cap without dropping source ties',async()=>{
 await SpocEntry.deleteMany({});await WorkEntry.deleteMany({});
 await SpocEntry.insertMany(Array.from({length:205},()=>({...row(),employee:f.cast.spoc.employee,date:'2026-10-30T12:00Z',totalHours:1.125})));
 await WorkEntry.insertMany(Array.from({length:15},(_,i)=>({project:f.project,employee:f.cast.engineer.employee,date:'2026-10-30T12:00Z',hours:0.375,refNo:`PAG-${i}`})));
 const keys=[];for(let offset=0;offset<220;offset+=37){const page=await call('md',`/api/reports/work-hours?from=2026-10-30&to=2026-10-30&limit=37&offset=${offset}`);assert.equal(page.data.total,220);keys.push(...page.data.items.map(e=>e.key));}
 assert.equal(keys.length,220);assert.equal(new Set(keys).size,220);
 const scope=await call('spoc','/api/reports/work-hours?mine=true&from=2026-10-30&to=2026-10-30');assert.equal(scope.data.total,205);
});
test('decimal activity totals retain 0.1 + 0.2 as 0.3 without display rounding or binary tails',async()=>{
 const created=await call('spoc','/api/spoc/entries/day',{date:'2026-10-28',rows:[{...row({areas:[{key:'Documents',hours:0.1},{key:'Meetings',hours:0.2}]}),clientKey:'decimal-exact'}]});
 assert.equal(created.data.results[0].item.totalHours,0.3);
});
test('correction validates real dates, protected fields, cleared revision details and upload version conflicts',async()=>{
 const old=await create({revisionNo:'R1',revisionStatus:'Pending',revisionRemarks:'Old revision'});
 for(const change of [{date:'2026-02-30'},{createdBy:f.cast.md.user},{history:[]},{documents:[]},{areas:[{key:'Other',hours:-1}]}]) {
   assert.equal((await call('spoc',`/api/spoc/entries/${old.id}`,{...row(),expectedVersion:0,...change},'PATCH')).status,400);
 }
 assert.equal((await SpocEntry.findById(old.id)).__v,0);
 const cleared=await call('spoc',`/api/spoc/entries/${old.id}`,{...row(),expectedVersion:0,revisionNo:'',revisionStatus:null,revisionRemarks:''},'PATCH');assert.equal(cleared.status,200);assert.equal(cleared.data.item.revisionStatus,null);assert.equal(cleared.data.item.revisionRemarks,'');assert.equal(cleared.data.item.history[0].previous.revisionRemarks,'Old revision');
 const form=new FormData();form.append('files',new Blob(['stale file']), 'stale-version.txt');form.append('expectedVersion','0');
 const response=await fetch(f.base+`/api/spoc/entries/${old.id}/documents`,{method:'POST',headers:{Cookie:cookies.spoc},body:form});assert.equal(response.status,409);assert.equal((await SpocEntry.findById(old.id)).documents.length,0);
});
test('one day persists several authorized projects and services without combining original entry identities',async()=>{
 await f.models.SpocAllocation.create({project:f.other,coordinator:f.cast.spoc.employee,status:'Approved',services:['HVAC']});
 const body={date:'2026-10-27',rows:[{...row(),clientKey:'multi-project-a'},{...row({project:f.other,service:'HVAC',areas:[{key:'Meetings',hours:0.375,update:'Other project meeting'},{key:'Documents',hours:0.125,update:'Other project document'}]}),clientKey:'multi-project-b'}]};
 const result=await call('spoc','/api/spoc/entries/day',body);assert.equal(result.status,200);assert.equal(result.data.results.length,2);assert.notEqual(result.data.results[0].item._id,result.data.results[1].item._id);
 const list=await call('spoc','/api/spoc/entries?mine=true&date=2026-10-27');assert.equal(list.data.total,2);assert.equal(new Set(list.data.items.map(e=>e.project._id)).size,2);assert.equal(list.data.items.reduce((s,e)=>s+e.totalHours,0),1.625);assert.equal(list.data.items.find(e=>e.service==='HVAC').areas[1].update,'Other project document');
});

test('project summaries allocate saved WorkEntry otherHours without duplicating canonical source hours',async()=>{
 const {workAllocations}=await import('../web/src/lib/workAllocations.js');
 const components=workAllocations({key:'WorkEntry:abc',source:'WorkEntry',project:{_id:f.project},primaryHours:1.125,hours:1.5,otherHours:[{project:{_id:f.other},hours:0.375}]});
 assert.equal(components.length,2);assert.equal(components[0].hours,1.125);assert.equal(components[1].project._id,f.other);assert.equal(components[1].hours,0.375);assert.equal(components.reduce((s,e)=>s+e.hours,0),1.5);
});

test('failed attachment validation/CAS cleans only new temp uploads; an ambiguous committed write retains referenced files',async()=>{
 const old=await create();
 const upload=async(version,name)=>{const form=new FormData();form.append('files',new Blob([name]),name);if(version!==undefined)form.append('expectedVersion',String(version));return fetch(f.base+`/api/spoc/entries/${old.id}/documents`,{method:'POST',headers:{Cookie:cookies.spoc},body:form});};
 assert.equal((await upload(0,'retained.txt')).status,201);
 const before=(await readdir(join(uploadDirectory,'work-documents'))).sort();
 assert.equal((await upload(-1,'invalid.txt')).status,400);assert.deepEqual((await readdir(join(uploadDirectory,'work-documents'))).sort(),before);
 assert.equal((await upload(0,'stale.txt')).status,409);assert.deepEqual((await readdir(join(uploadDirectory,'work-documents'))).sort(),before);
 const original=SpocEntry.findOneAndUpdate;
 SpocEntry.findOneAndUpdate=async function(){throw new this.base.Error.ValidationError();};
 try {assert.ok((await upload(1,'validation.txt')).status>=400);}finally{SpocEntry.findOneAndUpdate=original;}
 assert.deepEqual((await readdir(join(uploadDirectory,'work-documents'))).sort(),before);
 SpocEntry.findOneAndUpdate=async function(...args){await original.apply(this,args);throw new Error('Simulated post-write audit transport failure');};
 try {assert.ok((await upload(1,'committed.txt')).status>=400);}finally{SpocEntry.findOneAndUpdate=original;}
 SpocEntry.findOneAndUpdate=async function(...args){await original.apply(this,args);throw new this.base.Error.ValidationError();};
 try {assert.ok((await upload(2,'committed-validation.txt')).status>=400);}finally{SpocEntry.findOneAndUpdate=original;}
 const saved=await SpocEntry.findById(old.id).lean();assert.equal(saved.documents.length,3);
 for(const document of saved.documents) assert.equal(await readFile(join(uploadDirectory,document.file),'utf8'),document.name);
 assert.equal((await readdir(join(uploadDirectory,'work-documents'))).length,before.length+2);
});

test('other-project allocations have missing stage; project filters retain only matching hours and authorized source scope',async()=>{
 const {workAllocations}=await import('../web/src/lib/workAllocations.js');
 const source=await WorkEntry.create({project:f.project,employee:f.cast.engineer.employee,date:'2026-09-01T10:00Z',stage:'CD',hours:1.125,otherHours:[{project:f.other,hours:0.375}],notes:'Original primary work',documents:[{name:'source-only.txt',file:'source-only.txt'}]});
 const original=await WorkEntry.findById(source.id).lean();
 const secondary=workAllocations({key:'WorkEntry:'+source.id,source:'WorkEntry',project:{_id:f.project},stage:'CD',primaryHours:1.125,hours:1.5,otherHours:[{project:{_id:f.other},hours:0.375}]})[1];
 assert.equal(secondary.hours,0.375);
 for(const [project,hours,stage] of [[f.project,1.125,'CD'],[f.other,0.375,null]]) {
   const response=await call('md',`/api/reports/work-hours?date=2026-09-01&project=${project}`);assert.equal(response.status,200);assert.equal(response.data.total,1);const item=response.data.items[0];
   assert.equal(item.key,'WorkEntry:'+source.id);assert.equal(item.hours,hours);assert.equal(item.reportHours,hours);assert.equal(item.reportAllocations.length,1);assert.equal(String(item.reportAllocations[0].project._id),project);assert.equal(item.reportAllocations[0].stage,stage);
   assert.equal(item.sourceRecord.hours,1.125);assert.equal(item.sourceRecord.stage,'CD');assert.equal(String(item.sourceRecord.project._id),f.project);assert.equal(item.sourceRecord.otherHours[0].hours,0.375);
   const allocations=workAllocations(item);assert.equal(allocations.length,1);assert.equal(allocations[0].hours,hours);assert.equal(allocations[0].stage,stage);
 }
 const all=await call('md','/api/reports/work-hours?date=2026-09-01');assert.equal(all.data.items[0].hours,1.5);assert.deepEqual(workAllocations(all.data.items[0]).map(e=>[String(e.project._id),e.stage,e.hours]),[[f.project,'CD',1.125],[f.other,null,0.375]]);
 const ownContext=await call('engineer',`/api/reports/work-hours?date=2026-09-01&project=${f.other}`);assert.equal(ownContext.data.total,1);assert.equal(ownContext.data.items[0].hours,0.375);
 assert.equal((await call('engineer',`/api/projects/${f.other}`)).status,404,'Context does not grant secondary project authority');
 assert.equal((await call('outsider',`/api/reports/work-hours?date=2026-09-01&project=${f.other}`)).data.total,0,'Secondary project access cannot expose unauthorized primary-source work');
 assert.equal((await call('td',`/api/reports/work-hours?date=2026-09-01&project=${f.other}`)).data.total,0,'Director without source-team employee ownership remains excluded');
 await f.models.Employee.findByIdAndUpdate(f.cast.engineer.employee,{director:f.cast.td.employee});
 const owned=await call('td',`/api/reports/work-hours?date=2026-09-01&project=${f.other}&employee=${f.cast.engineer.employee}`);assert.equal(owned.data.total,1);assert.equal(owned.data.items[0].hours,0.375);
 assert.equal((await call('td',`/api/reports/work-hours?date=2026-09-01&project=${f.other}&employee=${f.cast.outsider.employee}`)).data.total,0);
 const ownFilter=await call('engineer',`/api/reports/work-hours?date=2026-09-01&project=${f.other}&mine=true`);assert.equal(ownFilter.data.total,1);
 assert.equal((await call('outsider',`/api/work-entries/${source.id}/documents/0`)).status,404,'Secondary project context does not widen document access');
 const reverse=await WorkEntry.create({project:f.other,employee:f.cast.engineer.employee,date:'2026-09-01T10:01Z',stage:'DD',hours:9,otherHours:[{project:f.project,hours:0.875}]});
 for(const role of ['engineer','td']) {const restricted=await call(role,`/api/reports/work-hours?date=2026-09-01&project=${f.project}`);assert.equal(restricted.data.total,1);assert.equal(restricted.data.items[0].hours,1.125);}
 const pages=[];for(const offset of [0,1]) {const page=await call('md',`/api/reports/work-hours?date=2026-09-01&project=${f.project}&limit=1&offset=${offset}`);assert.equal(page.data.total,2);pages.push(...page.data.items);}
 assert.equal(new Set(pages.map(e=>e.key)).size,2);assert.equal(pages.reduce((sum,e)=>sum+e.hours,0),2);assert.equal(pages.find(e=>e.sourceId===reverse.id).reportAllocations[0].stage,null);
 assert.deepEqual(await WorkEntry.findById(source.id).lean(),original,'Projection never rewrites source snapshots or history');
});

test('secondary project stage never inherits primary CD without saved secondary-stage evidence',async()=>{
 const {workAllocations}=await import('../web/src/lib/workAllocations.js');
 const allocations=workAllocations({key:'WorkEntry:stage',source:'WorkEntry',project:'A',stage:'CD',primaryHours:1.125,hours:1.5,otherHours:[{project:'B',hours:0.375}]});
 assert.equal(allocations[0].stage,'CD');assert.equal(allocations[1].stage,null);
});
