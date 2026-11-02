import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const f=JSON.parse(await readFile(process.env.TEST_FIXTURE_FILE,'utf8'));
assert(f.isolated && f.base==='http://127.0.0.1:19500','Use the disposable verification fixture.');
const url='https://127.0.0.1:19443', output=resolve(process.env.TEST_ARTIFACT_DIR);
await mkdir(output,{recursive:true});
// Chromium service workers need trust beyond Playwright's request-context
// ignoreHTTPSErrors option. Limit this exception to the disposable cert key.
const publicKey=execFileSync('openssl',['x509','-in',process.env.TEST_CERTIFICATE,'-pubkey','-noout']);
const der=execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:publicKey});
const spki=createHash('sha256').update(der).digest('base64');
const browser=await chromium.launch({headless:true,args:[`--ignore-certificate-errors-spki-list=${spki}`],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const checks=[],errors=[];
async function login(context,key){
  const r=await context.request.post(url+'/api/auth/login',{data:{email:f.cast[key].email,password:f.password}});
  assert.equal(r.status(),200);return r;
}
try {
  const admin=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  const staff=await browser.newContext({ignoreHTTPSErrors:true});
  if(process.env.VERIFY_RESTART_CHECK_ONLY==='1'){
    await login(staff,'engineer');
    const saved=JSON.parse(await readFile(process.env.TEST_PERSISTENCE_FILE,'utf8'));
    const r=await staff.request.get(url+saved.path);assert.equal(r.status(),200);assert.equal(await r.text(),saved.content);
    await writeFile(resolve(output,'restart-validation.json'),JSON.stringify({passed:true,upload_survived_api_and_database_restart:true},null,2)+'\n');
    console.log('PASS: uploaded document survives API and database restart.');
  } else {
    assert.equal((await admin.request.get(url+'/api/health')).status(),200);
    assert.equal((await admin.request.get(url+'/api/projects')).status(),401);
    assert.equal((await admin.request.get(url+'/dbadmin')).status(),403);
    assert.equal((await admin.request.get(url+'/dbadmin/')).status(),403);
    checks.push('HTTPS gateway, API health, authentication gate and blocked public database admin');
    await login(admin,'admin');await login(staff,'engineer');
    assert((await staff.cookies()).some(c=>c.name==='token'&&c.secure&&c.httpOnly));
    checks.push('Production secure HttpOnly cookie login through Nginx');
    const page=await admin.newPage(),employee=await staff.newPage();
    for(const p of [page,employee])p.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/projects/new');
    const teamSelect=page.getByRole('combobox',{name:'Structural team lead',exact:true});
    await expect(teamSelect).toBeEnabled();
    await page.locator('label').filter({hasText:'Import team from Excel'}).locator('input[type=file]').setInputFiles({name:'team.csv',mimeType:'text/csv',buffer:Buffer.from('Service,Team member\nStructural,VERIFY-tl\n')});
    await expect(teamSelect).toHaveValue(f.cast.tl.employee);
    checks.push('Built frontend parses team spreadsheet with the updated SheetJS library');
    await employee.goto(url+'/announcements');
    await expect(employee.getByText('Message history',{exact:true})).toBeVisible();
    await employee.evaluate(()=>{
      window.verifySocketEvents=[];
      const s=new WebSocket(`wss://${location.host}/socket.io/?EIO=4&transport=websocket`);
      window.verifySocket=s;
      s.onmessage=e=>{window.verifySocketEvents.push(e.data);if(e.data.startsWith('0'))s.send('40');if(e.data==='2')s.send('3');};
    });
    await expect.poll(()=>employee.evaluate(()=>window.verifySocketEvents.some(m=>m.startsWith('40')))).toBe(true);
    checks.push('Authenticated WebSocket upgrade through Nginx');
    await page.goto(url+'/announcements');
    await page.getByRole('button',{name:'New announcement'}).click();
    const title='Container security verification '+randomUUID().slice(0,8);
    await page.getByLabel('Title',{exact:true}).fill(title);
    await page.getByLabel('Message',{exact:true}).fill('Saved message delivered through the rebuilt containers.');
    await page.getByLabel('Ask each recipient to acknowledge this notice').check();
    await page.getByRole('button',{name:'Preview audience'}).click();
    await expect(page.getByRole('heading',{name:/staff accounts/})).toBeVisible();
    await page.getByLabel('I reviewed the message and recipient counts.').check();
    await page.getByRole('button',{name:'Send to all branches'}).click();
    await page.waitForURL(/\/announcements\/[a-f\d]{24}$/);
    await expect.poll(()=>employee.evaluate(()=>window.verifySocketEvents.some(m=>m.startsWith('42')&&m.includes('notification'))),{timeout:20000}).toBe(true);
    await employee.getByRole('link',{name:title,exact:true}).click();
    await employee.getByRole('button',{name:'Acknowledge notice'}).click();
    await expect(employee.getByText(/^Acknowledged /)).toBeVisible();
    checks.push('Announcement publish, live notification, recipient open and acknowledgment');
    const created=await staff.request.post(url+'/api/work-entries',{data:{project:f.project,hours:1,date:new Date().toISOString().slice(0,10),notes:'Container restart survival'}});
    assert.equal(created.status(),201);const entry=(await created.json()).entry;
    const path=`/api/work-entries/${entry._id}/documents`,content='Verified persistent upload from the patched Docker stack.';
    const upload=await staff.request.post(url+path,{multipart:{files:{name:'restart.txt',mimeType:'text/plain',buffer:Buffer.from(content)}}});assert.equal(upload.status(),201);
    assert.equal(await(await staff.request.get(url+path+'/0')).text(),content);
    await writeFile(process.env.TEST_PERSISTENCE_FILE,JSON.stringify({path:path+'/0',content}),{mode:0o600});
    checks.push('Upload/download through production proxy and persistent volume');
    await employee.screenshot({path:resolve(output,'gateway-browser.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    await writeFile(resolve(output,'browser-validation.json'),JSON.stringify({passed:true,checks,page_errors:errors,base:url},null,2)+'\n');
    console.log(`PASS: ${checks.length} production-container browser checks; no page errors.`);
  }
} finally {await browser.close();}
