import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const f=JSON.parse(await readFile('/tmp/designtree-dmh-fixture.json','utf8')),base='http://127.0.0.1:5173',out=resolve(import.meta.dirname,'../../dmh-dashboard-review-2026-10-29/evidence');
assert(f.isolated);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}),checks=[],errors=[];
function done(name){checks.push({name,passed:true});}
async function session(role){const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100}});assert((await c.request.post(base+'/api/auth/login',{data:{email:f.cast[role].email,password:f.password}})).ok());const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};}
try{
 const {c,p}=await session('td');await p.goto(base+'/my-team');
 await expect(p.getByText('SPOCs reporting to you:',{exact:false})).toBeVisible();await expect(p.locator('.dm-card')).toHaveCount(2);
 await expect(p.locator('.dm-register')).toContainText('Saved SPOC meeting reflection');await expect(p.locator('.dm-register')).toContainText('8.5');
 done('TD Design Management login opens live saved-entry dashboard with two scoped SPOCs and 8.5 actual hours');
 await p.getByRole('textbox',{name:'Search SPOCs',exact:true}).fill('spoc2');await expect(p.locator('.dm-card')).toHaveCount(1);await p.getByRole('textbox',{name:'Search SPOCs',exact:true}).fill('');
 done('Search filters actual SPOC cards and restores total');
 await p.locator('.dm-card').filter({hasText:'Test spoc Workflow'}).getByRole('button',{name:'View details',exact:true}).click();
 const dialog=p.getByRole('dialog');await expect(dialog).toBeVisible();
 for(const tab of ['Overview','Assigned Projects','Daily Work Updates','Workload','Coordination & Follow-ups','Meetings & MOM','Activity Logs','Allocation History']){await dialog.getByRole('tab',{name:tab,exact:true}).click();}
 await dialog.getByRole('tab',{name:'Daily Work Updates',exact:true}).click();await expect(dialog).toContainText('Saved SPOC meeting reflection');
 await dialog.getByRole('tab',{name:'Activity Logs',exact:true}).click();await expect(dialog).toContainText('SPOC daily work update saved');
 done('All eight detail tabs open; daily updates and activity reflect saved entries');
 await dialog.getByRole('tab',{name:'Overview',exact:true}).click();await dialog.getByRole('textbox',{name:'Design Management Head remark'}).fill('Browser verified review remark');await dialog.getByRole('button',{name:'Save remark',exact:true}).click();await expect(dialog).toContainText('Browser verified review remark');
 await dialog.getByRole('tab',{name:'Coordination & Follow-ups',exact:true}).click();await dialog.getByRole('button',{name:'Mark closed',exact:true}).first().click();await expect(dialog.getByText('Closed',{exact:true})).toBeVisible();
 await dialog.getByRole('tab',{name:'Meetings & MOM',exact:true}).click();await dialog.getByRole('button',{name:'Mark MOM circulated',exact:true}).click();await expect(dialog).toContainText('MOM circulated');
 done('Head remarks, follow-up closure and MOM actions persist and refresh');
 await p.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await p.locator('.dm-card').filter({hasText:'Test spoc Workflow'}).getByRole('button',{name:/DMH-001/}).first().click();

 await expect(dialog.getByRole('button',{name:'Save step 1',exact:true})).toBeVisible();
 await dialog.getByRole('combobox',{name:'Step 2 status',exact:true}).selectOption('In Progress');await dialog.getByRole('textbox',{name:'Step 2 remarks',exact:true}).fill('Browser workflow scope checked');await dialog.getByRole('button',{name:'Save step 2',exact:true}).click();
 await expect.poll(async()=>{const r=await c.request.get(base+'/api/design-team/projects/'+f.project);return (await r.json()).workflow.steps.find(s=>s.n===2).remarks;}).toBe('Browser workflow scope checked');
 await p.screenshot({path:resolve(out,'project-workflow.png'),fullPage:true});done('Project record exposes sixteen workflow steps and saves a dated actor-attributed change');
 await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'Assign SPOC',exact:true}).click();await dialog.getByRole('combobox',{name:'New SPOC',exact:true}).selectOption(f.cast.spoc2.employee);await dialog.getByRole('button',{name:'Review assignment',exact:true}).click();await expect(dialog).toContainText('Admin activation');await dialog.getByRole('button',{name:'Confirm assignment',exact:true}).click();await expect(dialog).toHaveCount(0);
 done('Unassigned project assignment requires review and confirmation and refreshes dashboard');
 await p.screenshot({path:resolve(out,'td-design-management-dashboard.png'),fullPage:true});
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await p.locator('.dm-card').first().getByRole('button',{name:'View details',exact:true}).click();await expect(dialog).toBeVisible();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));const rect=await dialog.boundingBox();assert.equal(rect.y,0);assert(rect.height<=844);await p.screenshot({path:resolve(out,'mobile-dashboard-details.png')});await p.keyboard.press('Escape');await expect(dialog).toHaveCount(0);done('Dashboard and detail drawer fit mobile width and Escape closes the drawer');await c.close();
 for(const role of ['dmh','atd','spoc','ordinaryTd']){const s=await session(role);await s.p.goto(base+'/my-team');if(role==='ordinaryTd')await expect(s.p.locator('#director-service')).toBeVisible();if(role==='dmh')await expect(s.p.locator('.dm-card')).toHaveCount(2);if(role==='atd')await expect(s.p.getByRole('tab',{name:'Assign work',exact:true})).toBeVisible();if(role==='spoc')await expect(s.p.locator('.dm-card')).toHaveCount(0);done(role+' retains the intended workspace');await s.c.close();}
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'browser-tests.json'),JSON.stringify({passed:true,checks,page_errors:errors,scope:'Production frontend and disposable local API/MongoDB; company deployment not tested'},null,2)+'\n');console.log('All '+checks.length+' browser checks passed');
}finally{await browser.close();}
