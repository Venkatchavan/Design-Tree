import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve}from'node:path';
import assert from'node:assert/strict';
import{chromium,expect}from'@playwright/test';
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));assert(f.isolated);
const extra=JSON.parse(await readFile('/tmp/designtree-director-ready.json','utf8'));
const out=resolve(import.meta.dirname,'../../stakeholder-updates-2026-10-26/implementation/evidence'),base='http://127.0.0.1:5173';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const sessions=[],errors=[],checks=[];
const panel=(p,title)=>p.locator('.panel').filter({has:p.locator('.panel-title',{hasText:new RegExp('^'+title+'$')})});
async function session(role){const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});sessions.push(c);const r=await c.request.post(base+'/api/auth/login',{data:{email:f.cast[role].email,password:f.password}});assert(r.ok());const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));return{page,context:c};}
async function check(name,requirements,fn){await fn();checks.push({name,requirements,passed:true});console.log('PASS '+name);}
try{
 const ad=await session('associate'),td=await session('td'),atd=await session('atd'),tl=await session('tl'),eng=await session('engineer'),admin=await session('admin');
 assert((await admin.context.request.put(base+`/api/employees/${f.cast.tl.employee}`,{data:{director:f.cast.associate.employee,reportingManager:f.cast.atd.employee}})).ok());
 await check('AD TD ATD navigation removes marked links and exposes My team',['R-D26-01','R-D26-02','R-D26-03','R-D26-15'],async()=>{
  for(const s of[ad,td,atd]){
   await s.page.goto(base+'/my-team');await expect(s.page.getByLabel('Department / Service',{exact:true})).toBeVisible();
   for(const name of['BIM','GBS','Peer Review','QS'])await expect(s.page.getByRole('button',{name,exact:true})).toHaveCount(0);
   await expect(s.page.getByRole('button',{name:'Announcements',exact:true})).toBeVisible();
  }
 });
 await check('AD and ATD service panels retain logs without marked editors',['R-D26-04','R-D26-05','R-D26-06','R-D26-07','R-D26-08','R-D26-09','R-D26-10'],async()=>{
  for(const s of[ad,atd]){
   await s.page.goto(base+'/projects/'+f.project);
   for(const name of['Structural','Electrical','Mechanical','Plumbing','Fire','QS','QAQC','GBS','BIM']){
    await s.page.getByRole('tab',{name,exact:true}).click();
    for(const action of['Edit team & scope status','Edit team','Edit QS details','+ Add revision'])await expect(s.page.getByRole('button',{name:action,exact:true})).toHaveCount(0);
   }
  }
  await atd.page.getByRole('tab',{name:'Variations',exact:true}).click();await expect(panel(atd.page,'Variation log')).toBeVisible();await expect(atd.page.getByRole('button',{name:'+ Record variation',exact:true})).toHaveCount(0);
  await atd.page.getByRole('tab',{name:'Peer review',exact:true}).click();await expect(panel(atd.page,'Review log')).toBeVisible();await expect(atd.page.getByRole('button',{name:'+ Add review',exact:true})).toHaveCount(0);
  await atd.page.getByRole('tab',{name:'QS',exact:true}).click();await atd.page.getByRole('tab',{name:'Work log',exact:true}).click();await expect(panel(atd.page,'Work log')).toBeVisible();await expect(atd.page.getByRole('button',{name:'+ Add work item',exact:true})).toHaveCount(0);
 });
 await check('TD marked PTL SPOC and stage panels are removed while ATD completion remains',['R-D26-12','R-D26-13','R-D26-14'],async()=>{
  await td.page.goto(base+'/projects/'+f.project);await expect(panel(td.page,'Project summary')).toBeVisible();
  for(const title of['Principal team leads — per service','SPOC for this project','Stage completion approvals'])await expect(panel(td.page,title)).toHaveCount(0);
  await atd.page.goto(base+'/projects/'+f.project);await expect(panel(atd.page,'Stage completion approvals')).toBeVisible();
 });
 await check('Director cascade uses saved jobs, real members, counts and separated project/service assignments',['R-D26-16','R-D26-17','R-D26-18','R-D26-19','R-D26-20','R-D26-21','R-D26-23'],async()=>{
  await ad.page.goto(base+'/my-team');await expect(ad.page.getByLabel('Project',{exact:true}).locator('option')).toHaveCount(3);
  await ad.page.getByLabel('Department / Service',{exact:true}).selectOption('Electrical');await expect(ad.page.getByLabel('Project',{exact:true}).locator('option')).toHaveCount(2);
  await ad.page.getByLabel('Project',{exact:true}).selectOption(extra.project);await expect(panel(ad.page,'JOB-26002 · Second authorized electrical project')).toBeVisible();
  await expect(panel(ad.page,'JOB-26002 · Second authorized electrical project').getByText('Test engineer Workflow',{exact:true})).toBeVisible();
  await ad.page.getByLabel('Department / Service',{exact:true}).selectOption('Structural');await expect(ad.page.getByLabel('Project',{exact:true})).toHaveValue('');
  await ad.page.getByLabel('Project',{exact:true}).selectOption(f.project);await expect(panel(ad.page,'JOB-26001 · Assigned workflow project')).toBeVisible();
  await expect(panel(ad.page,'JOB-26001 · Assigned workflow project').getByText('Test tl Workflow',{exact:true})).toBeVisible();
  await expect(ad.page.getByText('Unrelated project',{exact:true})).toHaveCount(0);
  await ad.page.getByLabel('Search team members',{exact:true}).fill('missing-member-987');await expect(ad.page.getByText('No team members match these filters.',{exact:true})).toBeVisible();
  await ad.page.getByLabel('Search team members',{exact:true}).fill('');await ad.page.locator('#director-project-search').fill('JOB-26001');await expect(ad.page.getByLabel('Project',{exact:true}).locator('option')).toHaveCount(2);
 });
 await check('ATD Assign Task includes actual project leads and delivers work to TL and engineer',['R-D26-11'],async()=>{
  await atd.page.goto(base+'/my-team');await atd.page.getByRole('tab',{name:'Assign work',exact:true}).click();await atd.page.getByRole('tab',{name:'Assign Task',exact:true}).click();
  const form=panel(atd.page,'Assign work to a team member');await form.getByLabel('Task project',{exact:true}).selectOption(f.project);
  await form.getByLabel('Test tl Workflow',{exact:true}).check();await form.getByLabel('Test engineer Workflow',{exact:true}).check();
  const task='Director browser assignment '+Date.now();await form.getByPlaceholder('Bore hole location and specifications').fill(task);
  const saved=atd.page.waitForResponse(r=>r.url().endsWith('/api/work/tasks')&&r.request().method()==='POST');await form.getByRole('button',{name:'Assign task',exact:true}).click();assert((await saved).ok());
  const list=await tl.context.request.get(base+'/api/work/tasks/mine');assert((await list.json()).items.some(t=>t.deliverable===task));
  await eng.page.goto(base+'/my-work');await expect(eng.page.getByText(task,{exact:false})).toBeVisible();
 });
 await check('Empty scoped teams, dynamic revocation and mobile layout are handled',['R-D26-22','R-D26-17','R-D26-23'],async()=>{
  await admin.page.goto(base+'/dashboard');
  const changed=await admin.context.request.put(base+`/api/employees/${f.cast.tl.employee}`,{data:{director:'',reportingManager:''}});
  assert(changed.ok());{await ad.page.goto(base+'/my-team');await expect(ad.page.getByText('No teams are linked to your director or reporting assignments. Ask the allocation owner to check the saved reporting links.',{exact:true})).toBeVisible();}
  assert((await admin.context.request.put(base+`/api/employees/${f.cast.tl.employee}`,{data:{director:f.cast.associate.employee,reportingManager:f.cast.atd.employee}})).ok());
  await td.page.goto(base+'/my-team');await td.page.setViewportSize({width:390,height:844});await expect(td.page.getByLabel('Department / Service',{exact:true})).toBeVisible();
  assert(await td.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await td.page.screenshot({path:resolve(out,'director-mobile.png'),fullPage:true});
 });
 await check('Prior employee submission and held TL submit remain available',['R-ST06'],async()=>{
  await tl.page.goto(base+'/work/update');await expect(tl.page.getByRole('button',{name:'Submit for team lead action',exact:true})).toBeVisible();
  await eng.page.goto(base+'/my-work');await eng.page.getByRole('tab',{name:'Update progress',exact:true}).click();await expect(eng.page.getByRole('button',{name:'Submit for team lead action',exact:true})).toBeVisible();
 });
 await td.page.setViewportSize({width:1440,height:1000});await td.page.screenshot({path:resolve(out,'director-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'director-browser-tests.json'),JSON.stringify({passed:true,checks,page_errors:errors,scope:'Isolated native API/MongoDB and production frontend bundle. No company production.'},null,2)+'\n');console.log('Seven director browser checks passed.');
}catch(e){await writeFile(resolve(out,'director-browser-tests.json'),JSON.stringify({passed:false,error:e.message,checks,page_errors:errors},null,2)+'\n');throw e;}
finally{for(const c of sessions)await c.close();await browser.close();}
