import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));
assert(f.isolated&&f.base.startsWith('http://127.0.0.1:'));
const base='http://127.0.0.1:5173',out=resolve(import.meta.dirname,'../../stakeholder-updates-2026-10-24/implementation/evidence');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const errors=[],checks=[],sessions=[];
const TASK='Stakeholder roster acceptance task '+Date.now();
const panel=(page,title)=>page.locator('.panel').filter({has:page.locator('.panel-title',{hasText:new RegExp('^'+title+'$')})});
async function session(role){
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});sessions.push(context);
 const login=await context.request.post(base+'/api/auth/login',{data:{email:f.cast[role].email,password:f.password}});assert(login.ok());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
}
async function check(name,requirements,fn){await fn();checks.push({name,requirements,passed:true});console.log('PASS '+name);}
try{
 const admin=await session('admin'),ad=await session('associate'),spoc=await session('spoc'),tl=await session('tl'),engineer=await session('engineer');
 assert((await admin.context.request.put(base+`/api/projects/${f.project}`,{data:{status:'Active',currentStage:'CD'}})).ok());
 await check('Saved DD project stage is visible to AD and SPOC after the admin edit',['R-ST01'],async()=>{
  await admin.page.goto(base+'/projects/'+f.project);
  await admin.page.getByRole('button',{name:'Edit project details',exact:true}).click();
  const modal=admin.page.getByRole('dialog',{name:'Edit project details'});
  await modal.getByLabel('Current stage',{exact:true}).selectOption('DD');
  await modal.getByRole('button',{name:'Save project details',exact:true}).click();
  await expect(modal).toHaveCount(0);
  await ad.page.goto(base+'/dashboard');
  await expect(ad.page.locator('tr').filter({hasText:'Assigned workflow project'}).getByText('DD',{exact:true})).toBeVisible();
  await spoc.page.goto(base+'/projects/'+f.project);
  await expect(panel(spoc.page,'Project summary').getByText('DD',{exact:true})).toBeVisible();
 });
 await check('History UI is hidden while the server retains actor and stage edit history',['R-ST02'],async()=>{
  for(const s of [admin,ad,tl,spoc]){
   await s.page.goto(base+'/projects/'+f.project);
   await expect(panel(s.page,'Project summary')).toBeVisible();
   await expect(panel(s.page,'Project update history')).toHaveCount(0);
  }
  const response=await admin.context.request.get(base+`/api/projects/${f.project}/history`);assert(response.ok());
  assert((await response.json()).items.some(r=>r.changes.some(c=>c.field==='currentStage'&&c.updated==='DD')));
 });
 await check('AD, Admin, TL and SPOC summary arrows expand scoped project names',['R-ST03'],async()=>{
  for(const [s,label]of [[ad,'Active'],[admin,'Active'],[tl,'Active'],[spoc,'My projects']]){
   await s.page.goto(base+'/dashboard');
   const card=s.page.locator('.kpi-card').filter({has:s.page.locator('.kpi-label',{hasText:new RegExp('^'+label+'$')})});
   await card.click();
   await expect(card.getByText('Assigned workflow project',{exact:true})).toBeVisible();
   if(s===tl||s===spoc)await expect(card.getByText('Unrelated project',{exact:true})).toHaveCount(0);
  }
 });
 await check('SPOC hold and resume update engineer project sections, reason and saved state',['R-ST07','R-ST08'],async()=>{
  await engineer.page.goto(base+'/my-work');await engineer.page.getByRole('tab',{name:'My Projects',exact:true}).click();
  await expect(panel(engineer.page,'My Projects').getByText('Assigned workflow project',{exact:true})).toBeVisible();
  await spoc.page.goto(base+'/projects/'+f.project);
  const hold=panel(spoc.page,'Project hold status');
  await hold.getByLabel('Project hold status',{exact:true}).selectOption('On Hold');
  await hold.getByLabel('Project status reason',{exact:true}).fill('Waiting for approved client input');
  const saved=spoc.page.waitForResponse(r=>r.url().endsWith('/hold')&&r.request().method()==='PUT');
  await hold.getByRole('button',{name:'Save project status',exact:true}).click();assert((await saved).ok());
  await expect(hold.locator('b').filter({hasText:/^On Hold$/})).toBeVisible();
  await engineer.page.getByRole('tab',{name:'Projects on Hold',exact:true}).click();
  await expect(panel(engineer.page,'Projects on Hold').getByText('Assigned workflow project',{exact:true})).toBeVisible({timeout:15000});
  await expect(panel(engineer.page,'Projects on Hold').getByText('Hold reason: Waiting for approved client input',{exact:true})).toBeVisible();
  await engineer.page.getByRole('tab',{name:'My Projects',exact:true}).click();
  await expect(panel(engineer.page,'My Projects').getByText('Assigned workflow project',{exact:true})).toHaveCount(0);
  await spoc.page.reload();await expect(hold.getByText('Last status reason: Waiting for approved client input',{exact:true})).toBeVisible();
  await hold.getByLabel('Project hold status',{exact:true}).selectOption('Active');await hold.getByLabel('Project status reason',{exact:true}).fill('Client input received');
  await hold.getByRole('button',{name:'Save project status',exact:true}).click();
  await expect(hold.locator('b').filter({hasText:/^Active$/})).toBeVisible();
  await expect(panel(engineer.page,'My Projects').getByText('Assigned workflow project',{exact:true})).toBeVisible({timeout:15000});
 });
 await check('An empty nomination roster does not hide an active project team; TL assigns from that roster',['R-ST04','R-ST05'],async()=>{
  const saved=await spoc.context.request.put(base+`/api/projects/${f.project}/team-leads`,{data:{principalTeamLeads:[{service:'STR',employee:f.cast.tl.employee,name:'Test tl Workflow',approvalStatus:'Approved'}]}});assert(saved.ok());
  await tl.page.goto(base+'/my-team');await tl.page.getByRole('tab',{name:'Project & team',exact:true}).click();
  await expect(panel(tl.page,'Assigned workflow project').getByText('Test engineer Workflow',{exact:true})).toBeVisible();
  await tl.page.getByRole('tab',{name:'Assign work',exact:true}).click();await tl.page.getByRole('tab',{name:'Assign Task',exact:true}).click();
  const form=panel(tl.page,'Assign work to a team member');
  await form.getByLabel('Task project',{exact:true}).selectOption(f.project);
  await form.getByLabel('Test engineer Workflow',{exact:true}).check();
  await form.getByPlaceholder('Bore hole location and specifications').fill(TASK);
  const created=tl.page.waitForResponse(r=>r.url().endsWith('/api/work/tasks')&&r.request().method()==='POST');
  await form.getByRole('button',{name:'Assign task',exact:true}).click();assert((await created).ok());
  await engineer.page.goto(base+'/my-work');await engineer.page.getByRole('tab',{name:'Overview',exact:true}).click();await expect(panel(engineer.page,'Assigned to me').getByText(TASK,{exact:false})).toBeVisible();
 });
 await check('SPOC can explicitly refresh exact legacy names into saved employee links',['R-ST04','R-ST05'],async()=>{
  const saved=await admin.context.request.put(base+`/api/projects/${f.project}`,{data:{principalTeamLeads:[
   {service:'Mechanical',name:'Test tl Workflow',approvalStatus:'Approved'},
   {service:'Mechanical',name:'Test engineer Workflow',approvalStatus:'Approved'},
  ]}});assert(saved.ok());
  await spoc.page.goto(base+'/projects/'+f.project);
  await spoc.page.getByRole('tab',{name:'Project Directory',exact:true}).first().click();
  const allocation=panel(spoc.page,'Team allocation');
  await allocation.locator('select').filter({has:spoc.page.locator(`option[value="${f.project}"]`)}).selectOption(f.project);
  const refreshed=spoc.page.waitForResponse(r=>r.url().endsWith('/reconcile-team')&&r.request().method()==='POST');
  await allocation.getByRole('button',{name:'Refresh saved team allocations',exact:true}).click();
  const response=await refreshed;assert(response.ok());const result=await response.json();
  assert(result.project.principalTeamLeads.some(r=>r.employee===f.cast.engineer.employee));
  await expect(allocation.getByText('Saved team allocations refreshed.',{exact:true})).toBeVisible();
 });
 await check('Held TL submit button and lower-employee submit action remain available',['R-ST06'],async()=>{
  await tl.page.goto(base+'/work/update');
  await expect(tl.page.getByRole('button',{name:'Submit for team lead action',exact:true})).toBeVisible();
  await engineer.page.goto(base+'/my-work');await engineer.page.getByRole('tab',{name:'Update progress',exact:true}).click();
  await expect(engineer.page.getByRole('button',{name:'Submit for team lead action',exact:true})).toBeVisible();
  await expect(tl.page.getByRole('button',{name:'Announcements',exact:true})).toBeVisible();
 });
 await tl.page.screenshot({path:resolve(out,'held-tl-submit.png')});
 await engineer.page.screenshot({path:resolve(out,'engineer-dashboard.png')});
 assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'stakeholder-browser-tests.json'),JSON.stringify({passed:true,checks,covered:[...new Set(checks.flatMap(c=>c.requirements))],page_errors:errors,scope:'New production frontend bundle served locally with disposable native API/MongoDB. Not company production.'},null,2)+'\n');
 console.log('Seven stakeholder browser checks passed; all eight request IDs covered including the held button.');
}catch(e){await writeFile(resolve(out,'stakeholder-browser-tests.json'),JSON.stringify({passed:false,error:e.message,checks,page_errors:errors},null,2)+'\n');throw e;}
finally{for(const c of sessions)await c.close();await browser.close();}
