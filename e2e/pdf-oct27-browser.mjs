import{readFile,writeFile}from'node:fs/promises';
import{resolve}from'node:path';
import assert from'node:assert/strict';
import{chromium,expect}from'@playwright/test';
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));assert(f.isolated);
const base='http://127.0.0.1:5173',out=resolve(import.meta.dirname,'../../client-pdf-review-2026-10-27/evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const checks=[],errors=[];
async function session(role){const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});assert((await c.request.post(base+'/api/auth/login',{data:{email:f.cast[role].email,password:f.password}})).ok());const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return{c,p};}
try{
 for(const role of['associate','td','atd']){
  const{c,p}=await session(role);await p.goto(base+'/my-team');
  await expect(p.locator('#director-service')).toBeVisible();await expect(p.getByLabel('Search departments or services',{exact:true})).toHaveCount(0);
  await expect(p.locator('#director-member')).toContainText(role==='td'?'TD reporting person':'Test engineer Workflow');
  await expect(p.locator('.nav').getByRole('button',{name:'QA/QC Specifications',exact:true})).toHaveCount(0);
  await expect(p.getByText('Company branch person',{exact:true})).toHaveCount(0);
  await p.goto(base+'/teams');await expect(p.locator('.page-title')).toHaveText('Teams');await expect(p.locator('#director-member')).toContainText('Company branch person');
  await expect(p.locator('#director-service')).toContainText('Electrical');await expect(p.locator('#director-project')).toContainText('Company electrical project');
  await p.locator('#director-branch').selectOption('Branch B');await expect(p.locator('#director-member option')).toHaveCount(2);
  await p.locator('#director-service').selectOption('Electrical');await expect(p.getByRole('cell',{name:'Company branch person',exact:true})).toBeVisible();
  await p.goto(base+'/projects/'+f.project);await p.getByRole('tab',{name:'Meetings',exact:true}).first().click();
  await expect(p.locator('.panel-title').filter({hasText:/^Assigned SPOC$|^SPOC for this project$/})).toHaveCount(0);
  if(role==='td'){await expect(p.locator('#pd-spoc option')).toHaveCount(2);assert(!(await p.locator('#pd-spoc').textContent()).includes('Test engineer'));}
  await p.screenshot({path:resolve(out,'director-'+role+'.png')});checks.push({name:role+' reporting people, company services/projects/branch directory, navigation and removed SPOC panel',passed:true});await c.close();
 }
 {
  const{c,p}=await session('associate');await p.goto(base+'/my-team');await p.locator('#director-service').selectOption('Structural');await p.locator('#director-project').selectOption(f.project);await p.locator('#director-member').selectOption(f.cast.engineer.employee);
  await expect(p.getByRole('cell',{name:'Test engineer Workflow',exact:true})).toBeVisible();await expect(p.getByRole('cell',{name:'AD reporting person',exact:true})).toHaveCount(0);
  checks.push({name:'Service/project/member choices cascade without losing allocated members',passed:true});await c.close();
 }
 for(const role of['spoc','tl','engineer']){
  const{c,p}=await session(role);let samples=0;
  await c.route('**/api/spoc/man-hours/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({required:false,logged:true})}));
  await c.route('**/api/attendance/status',r=>{samples++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({required:true,late:false,underHours:true,workingDay:true,elapsedSeconds:samples>=3?7200:1080,durationHours:samples>=3?2:0.3})})});
  await p.clock.install();await p.goto(base);await p.getByRole('button',{name:/^Sign out \(/}).first().click();
  const dialog=p.getByRole('dialog',{name:'A reason is needed to sign out',exact:true});
  await expect(dialog).toContainText('0h 18m');await p.clock.fastForward(11000);await expect(dialog).toContainText('2h 0m');
  assert(samples>=3);checks.push({name:role+' sign-out elapsed time updates while the reason dialog remains open',passed:true});await c.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'browser-tests.json'),JSON.stringify({passed:true,checks,page_errors:errors,scope:'Disposable database and production frontend; company acceptance pending'},null,2)+'\n');console.log('All seven PDF browser checks passed.');
}finally{await browser.close()}
