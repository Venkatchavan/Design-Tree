import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(process.env.TEST_FIXTURE_FILE || '/tmp/designtree-local-fixture.json', 'utf8'));
if(!fixture.isolated || !fixture.base.startsWith('http://127.0.0.1:'))throw new Error('Start the disposable local fixture first.');
const browserErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const errors:string[]=[];browserErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));});
test.afterEach(({page})=>expect(browserErrors.get(page)||[]).toEqual([]));
async function signIn(page: Page, role: string) {
  const r = await page.context().request.post(`${fixture.base}/api/auth/login`, { data: { email: fixture.cast[role].email, password: fixture.password } });
  expect(r.status()).toBe(200);
}
function panel(page: Page, title: string) { return page.locator('.panel').filter({has:page.locator('.panel-title').filter({hasText:new RegExp('^'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}); }
function field(root: any, label: string) { return root.locator('.form-row').filter({has:root.page().locator('label',{hasText:new RegExp(`^${label} ?\\*?$`)})}); }

async function spocProjectMeetings(page:Page,meetingId?:string) {
  await page.goto(`/projects/${fixture.project}${meetingId ? `?meeting=${meetingId}` : ''}`);
  await page.getByRole('tab',{name:'Coordinator',exact:true}).click();await page.getByRole('tab',{name:'Meetings',exact:true}).click();
}

test('updated login enters the employee dashboard; assigned projects survive reload', async ({page}) => {
  await page.goto('/'); await page.locator('#loginEmail').fill(fixture.cast.engineer.email); await page.locator('#loginPassword').fill(fixture.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const skip = page.getByRole('button',{name:/Skip|Later/});
  await expect(page.locator('.nav').or(skip)).toBeVisible();
  if(await skip.isVisible())await skip.click();
  await expect(page.locator('.nav')).toBeVisible();
  await page.locator('.nav').getByRole('button',{name:'Projects',exact:true}).click();
  await expect(page.getByText('Assigned workflow project',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Unrelated project',{exact:true})).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Assigned workflow project',{exact:true}).first()).toBeVisible();
});

test('TL My Team has Assign work only; all workspace tabs are scoped to the project', async ({page}) => {
  await signIn(page,'tl'); await page.goto('/my-team');
  await expect(page.getByRole('tab')).toHaveText(['Assign work']);
  await expect(panel(page,'Assign work to a team member')).toBeVisible();
  await page.goto(`/projects/${fixture.project}`);
  await expect(page.getByRole('tab',{name:'Team workspace',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Assign work',exact:true})).toHaveCount(0);
  for (const name of ['Project & team','Team work monitoring','List of deliverables','Revision log','Drawing register','Transmittal status','Recruitment requests']) {
    await page.getByRole('tab',{name,exact:true}).click();
    await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.getByText('Unrelated project',{exact:true})).toHaveCount(0);
  }
  await page.screenshot({path:'test-results/tl-project-workspace.png',fullPage:true});
});

test('PTL request reflects to SPOC, TD approval and MD read-only view', async ({page,browser}) => {
  await signIn(page,'tl'); await page.goto(`/projects/${fixture.project}`); await page.getByRole('tab',{name:'Stage completion',exact:true}).click();
  const tracker=await page.context().request.get(`${fixture.base}/api/billing/stages?project=${fixture.project}`);const existing=(await tracker.json()).items;const stage=['CD','SD','DD','TD','GFC'].find(s=>!existing.some(r=>r.service==='STR'&&r.stage===s));expect(stage).toBeTruthy();
  const request=panel(page,'Stage completed — request to SPOC');
  await field(request,'Service').locator('select').selectOption('STR'); await field(request,'Stage').locator('select').selectOption(stage!);
  await request.getByRole('button',{name:/Request/}).click(); await expect(request.getByText(/Stage completion requested/)).toBeVisible();
  for(const [role,button] of [['spoc','Confirm completion'],['td','Approve for billing']]) {
    const ctx=await browser.newContext();const next=await ctx.newPage();await signIn(next,role);await next.goto(`/projects/${fixture.project}`);
    const approval=panel(next,'Stage completion approvals');await approval.getByRole('button',{name:button,exact:true}).click();
    await expect(approval.getByRole('button',{name:button,exact:true})).toHaveCount(0);await ctx.close();
  }
  const ctx=await browser.newContext();const md=await ctx.newPage();await signIn(md,'md');await md.goto(`/projects/${fixture.project}`);
  const approval=panel(md,'Stage completion approvals');await expect(approval.getByText('TD Approved',{exact:true}).first()).toBeVisible();await expect(approval.getByRole('button')).toHaveCount(0);await ctx.close();
});

test('employee Meetings dashboard supports own action updates across reload',async({page})=>{
  await signIn(page,'engineer');await page.goto('/meetings/mine');
  await expect(page.getByRole('tab')).toHaveText(['Overview','Meeting invitations','Meeting log',/My action items/]);
  await expect(page.getByRole('button',{name:/Schedule meeting|New meeting/})).toHaveCount(0);
  await page.getByRole('tab',{name:/My action items/}).click();
  await page.getByLabel('Action status').first().selectOption('In Progress');
  await expect(page.getByLabel('Action status').first()).toHaveValue('In Progress');
  await page.getByRole('button',{name:'Progress update',exact:true}).first().click();await page.getByPlaceholder('Progress update').fill('Browser workflow update');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByText('Browser workflow update',{exact:true})).toBeVisible();await page.reload();await page.getByRole('tab',{name:/My action items/}).click();await expect(page.getByText('Browser workflow update',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Meeting log',exact:true}).click();await expect(page.getByText('Scheduled acceptance meeting',{exact:true})).toBeVisible();
});

test('public certificate page has template, upload and issued download without login',async({page,browser})=>{
  await signIn(page,'admin');const request=await page.context().request.post(`${fixture.base}/api/certificates/requests`,{data:{project:fixture.project,category:'Structural completion'}});expect(request.status()).toBe(201);const id=(await request.json()).item._id;
  const link=await page.context().request.post(`${fixture.base}/api/certificates/requests/${id}/link`);const path=(await link.json()).path;
  const ctx=await browser.newContext();const client=await ctx.newPage();await client.goto(path);await expect(client.getByRole('heading',{name:'Completion certificate',exact:true})).toBeVisible();
  await expect(client.getByRole('link',{name:'Download template',exact:true})).toBeVisible();await expect(client.getByRole('link',{name:'Download issued certificate',exact:true})).toBeVisible();await expect(client.locator('#loginEmail')).toHaveCount(0);
  await client.locator('input[type=file]').setInputFiles({name:'browser-client.txt',mimeType:'text/plain',buffer:Buffer.from('Browser client certificate')});await client.getByRole('button',{name:'Upload certificate',exact:true}).click();await expect(client.getByText('Certificate submitted.',{exact:true})).toBeVisible();
  const download=client.waitForEvent('download');await client.getByRole('link',{name:'Download issued certificate',exact:true}).click();expect((await download).suggestedFilename()).toContain('issued.txt');await ctx.close();
});

test('Finance owns Travel Booking; DMH keeps Design Management and certificate logs',async({page,browser})=>{
  await signIn(page,'finance');await page.goto('/travel-booking');await expect(page.locator('.page-title',{hasText:'Travel Booking'})).toBeVisible();await expect(page.locator('.nav').getByRole('button',{name:'Travel Booking',exact:true})).toBeVisible();
  const ctx=await browser.newContext();const dmh=await ctx.newPage();await signIn(dmh,'dmh');await dmh.goto('/certificates');await expect(dmh.locator('.page-title',{hasText:'Completion Certificates'})).toBeVisible();await expect(dmh.getByRole('button',{name:/Generate|Add template|Issue certificate/})).toHaveCount(0);await expect(dmh.locator('.nav').getByRole('button',{name:'Design Management',exact:true})).toBeVisible();await ctx.close();
});

test('Admin project creation exposes the requested service checkboxes and typed source',async({page})=>{
  await signIn(page,'admin');await page.goto('/projects/new');
  const labels=await page.locator('label').filter({has:page.locator('input[type=checkbox]')}).allTextContents();
  for(const name of ['Str','Phe','Elec','HVAC','Fire','Smep','Smepf','Mep','Bim','Gbs','Peer Review'])expect(labels.map(x=>x.trim())).toContain(name);
  await expect(page.locator('label',{hasText:/^Priority/})).toHaveCount(0);
  await expect(page.locator('input[list="np-sources"]')).toBeVisible();
});

test('TD project Coordinator shows assigned SPOC; SPOC directory and Meetings stay under project',async({page,browser})=>{
  await signIn(page,'td');await page.goto(`/projects/${fixture.project}`);await page.getByRole('tab',{name:'Coordinator',exact:true}).click();await expect(panel(page,'Assigned SPOC').getByText('Test spoc Workflow',{exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:/RFI/})).toHaveCount(0);
  const ctx=await browser.newContext();const spoc=await ctx.newPage();await signIn(spoc,'spoc');await spoc.goto(`/projects/${fixture.project}`);await spoc.getByRole('tab',{name:'Coordinator',exact:true}).click();await spoc.getByRole('tab',{name:'Project directory',exact:true}).click();await expect(panel(spoc,'Project team')).toBeVisible();await spoc.getByRole('tab',{name:'Meetings',exact:true}).click();await expect(spoc.getByRole('button',{name:/Schedule/}).first()).toBeVisible();await ctx.close();
});

test('sidebar reordering persists and meeting notification opens the shared details',async({page})=>{
  await signIn(page,'engineer');await page.goto('/meetings/mine');
  const links=page.locator('.nav [draggable=true]');const before=await links.allTextContents();await links.first().dragTo(links.nth(2));await expect(links.first()).not.toHaveText(before[0]);const after=await links.allTextContents();await page.reload();await expect(links).toHaveText(after);
  await page.getByRole('button',{name:'Notifications',exact:true}).click();await page.locator('.notif-item').filter({hasText:/MOM document uploaded: Scheduled acceptance meeting/}).first().click();
  await expect(page).toHaveURL(/meeting=/);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByText('Scheduled acceptance meeting',{exact:true}).first()).toBeVisible();
});

test('MD has no quoted-fee or project edit controls',async({page})=>{
  await signIn(page,'md');await page.goto('/billing');await page.getByRole('tab',{name:/quoted/i}).click();await expect(page.getByText('Set / update quoted fee',{exact:true})).toHaveCount(0);
  await page.goto(`/projects/${fixture.project}`);await expect(page.getByRole('button',{name:/Change owner|Edit dates|Change Location|Activate project/})).toHaveCount(0);
});

test('meeting invitation reaches an already-open employee dashboard live',async({page,browser})=>{
  await signIn(page,'engineer');const connected=page.waitForResponse(r=>r.url().includes('/socket.io/')&&r.status()===200);await page.goto('/meetings/mine');await connected;await expect(page.getByRole('tab',{name:'Overview',exact:true})).toBeVisible();
  const ctx=await browser.newContext();const spoc=await ctx.newPage();await signIn(spoc,'spoc');const title='Live invitation '+Date.now();
  const response=await spoc.context().request.post(`${fixture.base}/api/meetings`,{data:{project:fixture.project,title,category:'Scheduled',date:new Date(Date.now()+86400000).toISOString().slice(0,10),services:['Structural'],participants:[{employee:fixture.cast.engineer.employee}],startTime:'10:00',endTime:'11:00',type:'PMC',mode:'Online',link:'https://example.com/live'}});expect(response.status()).toBe(201);
  await expect(page.getByText(title,{exact:true}).first()).toBeVisible({timeout:10000});await ctx.close();
});

test('director QS screen shows real BOQ quantities and pending area review',async({page})=>{
  await signIn(page,'atd');await page.goto('/qs-log');await page.locator('select').selectOption(fixture.project);await expect(page.getByText('BOQ acceptance item',{exact:true}).first()).toBeVisible();await expect(page.getByText('Acceptance zone',{exact:true}).first()).toBeVisible();await expect(page.getByText('10',{exact:true}).first()).toBeVisible();
});

test('SPOC counts, bundle chart and combined filters match stored meetings',async({page})=>{
  await signIn(page,'spoc');const data=await page.context().request.get(`${fixture.base}/api/meetings`);const meetings=(await data.json()).items;
  await spocProjectMeetings(page);await expect(page.locator('.kpi-grid.cols-5 .kpi-card')).toHaveCount(10);await expect(page.locator('.kpi-card').filter({has:page.locator('.kpi-label',{hasText:'Total meetings'})}).locator('.kpi-value')).toHaveText(String(meetings.length));
  await expect(page.locator('canvas[aria-label^="Service meeting counts"]')).toHaveAttribute('aria-label',new RegExp(`SMEPF: ${meetings.filter(m=>m.project._id===fixture.project).length}`));
  const chart=page.locator('canvas').first();const box=await chart.boundingBox();expect(box).toBeTruthy();await expect.poll(()=>chart.evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(Math.floor(c.width*.65),Math.floor(c.height*.5),1,1).data[3])).toBeGreaterThan(200);await chart.click({position:{x:box!.width*.65,y:box!.height*.5}});await expect(page.getByRole('tab',{name:'All meetings',exact:true})).toHaveAttribute('aria-selected','true');const list=page.locator('.panel').filter({has:page.locator('.panel-title',{hasText:/^All meetings/})});
  await field(list,'Service').locator('select').selectOption('SMEPF');await expect(list.getByText('Scheduled acceptance meeting',{exact:true})).toBeVisible();
  await field(list,'Project').locator('select').selectOption(fixture.project);await field(list,'Category').locator('select').selectOption('Scheduled');await field(list,'Meeting type').locator('select').selectOption('PMC');await field(list,'SPOC / coordinator').locator('select').selectOption('Test spoc Workflow');
  await expect(list.getByText('Scheduled acceptance meeting',{exact:true})).toBeVisible();await field(list,'Meeting type').locator('select').selectOption('');
  await field(list,'Meeting status').locator('select').selectOption('Cancelled');await expect(list.getByText('Cancelled acceptance meeting',{exact:true})).toBeVisible();await expect(list.getByText('Sudden acceptance meeting',{exact:true})).toHaveCount(0);
  await list.getByRole('button',{name:'Clear filters',exact:true}).click();await field(list,'Attendance').locator('select').selectOption('Some absent');await field(list,'Action items').locator('select').selectOption('Has pending');await expect(list.getByText('Scheduled acceptance meeting',{exact:true})).toBeVisible();
  await list.getByRole('button',{name:'Clear filters',exact:true}).click();await field(list,'From').locator('input').fill(new Date(Date.now()+10*86400000).toISOString().slice(0,10));await expect(list.getByText('No meetings match these filters.',{exact:true})).toBeVisible();
});

test('SPOC absence export and chronological project history share persisted attendance',async({page})=>{
  await signIn(page,'spoc');await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).testClipboard=text;}}}));await spocProjectMeetings(page);await page.getByRole('tab',{name:'Absence log',exact:true}).click();
  const filters=panel(page,'Absence log filters');await expect(field(filters,'Project').locator('select')).toHaveValue(fixture.project);await field(filters,'Service').locator('select').selectOption('Structural');await field(filters,'Team member').locator('select').selectOption(fixture.cast.engineer.employee);await field(filters,'Meeting type').locator('select').selectOption('PMC');
  await expect(page.getByRole('button',{name:'Copy log for Excel',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Copy log for Excel',exact:true}).click();await expect(page.getByText('Copied 1 absence record for Excel.',{exact:true})).toBeVisible();const text=await page.evaluate(()=>(window as any).testClipboard);expect(text.split('\n')[0].split('\t')).toHaveLength(17);expect(text).toContain('Leave');
  await page.getByRole('tab',{name:'Project history',exact:true}).click();const history=panel(page,'Project history');await history.locator('select').selectOption(fixture.project);await expect(history.getByText('Scope S, M, E, P, F',{exact:false})).toBeVisible();await expect(history.getByRole('cell',{name:'Ad-hoc',exact:true})).toBeVisible();await expect(history.getByRole('cell',{name:/Test engineer Workflow/}).first()).toBeVisible();
  const raw=await page.context().request.get(`${fixture.base}/api/meetings`);const meetings=(await raw.json()).items.filter(m=>m.project._id===fixture.project).sort((a,b)=>+new Date(a.date)-+new Date(b.date));expect(await history.locator('tbody tr').count()).toBe(meetings.length);
});

test('meeting audit actors, reminders and the six-stage tracker reflect real state',async({page})=>{
  await signIn(page,'spoc');const response=await page.context().request.get(`${fixture.base}/api/meetings`);const meetings=(await response.json()).items;const stored=meetings.find(m=>m.title==='Scheduled acceptance meeting');const detail=await page.context().request.get(`${fixture.base}/api/meetings/${stored._id}`);const history=(await detail.json()).item.history;expect(history.length).toBeGreaterThan(5);expect(history.every(e=>e.by&&e.at)).toBe(true);
  await spocProjectMeetings(page);await expect(panel(page,'Alerts & reminders').getByRole('button',{name:/MOM pending: Sudden acceptance meeting/})).toBeVisible();await spocProjectMeetings(page,stored._id);const dialog=page.getByRole('dialog',{name:'Meeting details',exact:true});
  for(const label of ['Planned','Conducted','Attendance','MOM','Action items','Tracked'])await expect(dialog.getByText(label,{exact:true}).first()).toBeVisible();
  expect(await dialog.getByText('Tracked',{exact:true}).first().evaluate(el=>el.style.background)).toBe('');
  const sudden=meetings.find(m=>m.title==='Sudden acceptance meeting');await spocProjectMeetings(page,sudden._id);expect(await page.getByRole('dialog').getByText('Attendance',{exact:true}).first().evaluate(el=>el.style.background)).toBe('');
  await signIn(page,'engineer');await page.goto('/meetings/mine');await expect(panel(page,'Alerts & reminders')).toBeVisible();
});
