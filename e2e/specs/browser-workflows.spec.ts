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
  await signIn(page,'td');await page.goto('/qs-log');await page.locator('select').selectOption(fixture.project);await expect(page.getByText('BOQ acceptance item',{exact:true}).first()).toBeVisible();await expect(page.getByText('Acceptance zone',{exact:true}).first()).toBeVisible();await expect(page.getByText('10',{exact:true}).first()).toBeVisible();
});
