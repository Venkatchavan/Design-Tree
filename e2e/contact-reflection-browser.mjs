import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve}from'node:path';
import assert from'node:assert/strict';
import{chromium,expect}from'@playwright/test';
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));assert(f.isolated);
const out=process.env.TEST_REPORT_DIR?resolve(process.env.TEST_REPORT_DIR):resolve(import.meta.dirname,'../../contact-reflection-2026-10-26/evidence'),base='http://127.0.0.1:5173';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const contexts=[],checks=[],errors=[],run=Date.now();
const panel=(p,title)=>p.locator('.panel').filter({has:p.locator('.panel-title',{hasText:new RegExp('^'+title+'$')})});
async function session(role){const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(context);assert((await context.request.post(base+'/api/auth/login',{data:{email:f.cast[role].email,password:f.password}})).ok());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};}
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS '+name);}
try{
 const spoc=await session('spoc'),admin=await session('admin');
 assert((await spoc.context.request.put(base+`/api/projects/${f.project}/spoc-contacts`,{data:{pmc:null,peerReview:null}})).ok());
 await admin.page.goto(base+'/projects/'+f.project);await expect(panel(admin.page,'Client contact details')).toBeVisible();
 await spoc.page.goto(base+'/projects/'+f.project);await spoc.page.getByRole('tab',{name:'Project Directory',exact:true}).first().click();
 const contacts=panel(spoc.page,'PMC and Peer Review contacts');
 const pmc='Saved PMC '+run,peer='Saved Peer '+run;
 await check('Creating a contact saves its project link without a second Save contacts click',async()=>{
  for(const [index,type,name,company]of[[0,'PMC',pmc,'PMC organization'],[1,'Peer Review',peer,'Peer organization']]){
   const picker=contacts.locator('.field-grid').first().locator(':scope > .form-row').nth(index);
   await picker.getByRole('button',{name:'Add',exact:true}).click();
   for(const [i,value]of[name,company,'100200'+index,`contact${index}@example.test`].entries())await picker.locator('input').nth(i).fill(value);
   await picker.getByRole('button',{name:'Save contact',exact:true}).click();
   await expect(panel(spoc.page,'Client contact details').getByText(name,{exact:true})).toBeVisible({timeout:6000});
   const r=await spoc.context.request.get(base+`/api/projects/${f.project}`);const p=(await r.json()).project;
   assert.equal(p.contacts[index?'peerReview':'pmc'].name,name);assert.equal(p.contacts[index?'peerReview':'pmc'].company,company);
  }
  await expect(contacts.getByText('Contacts saved.',{exact:true})).toBeVisible();
 });
 await check('Saved name company phone and email survive reload and reach another open login',async()=>{
  await spoc.page.reload();
  for(const name of[pmc,peer]){
   await expect(panel(spoc.page,'Client contact details').getByText(name,{exact:true})).toBeVisible();
   await expect(panel(admin.page,'Client contact details').getByText(name,{exact:true})).toBeVisible({timeout:15000});
  }
  await expect(panel(spoc.page,'Client contact details').getByText('PMC organization',{exact:true})).toBeVisible();
  await expect(panel(spoc.page,'Client contact details').getByText('contact0@example.test',{exact:true})).toBeVisible();
 });
 await check('Choosing an existing contact links it immediately and preserves the other saved contact',async()=>{
  const newName='Replacement PMC '+run;assert((await spoc.context.request.post(base+'/api/marketing/contacts',{data:{type:'PMC',name:newName,organization:'Replacement organization',phone:'333444'}})).ok());
  await spoc.page.getByRole('tab',{name:'Project Directory',exact:true}).first().click();
  const picker=contacts.locator('.field-grid').first().locator(':scope > .form-row').nth(0);
  await picker.getByRole('button',{name:'Change',exact:true}).click();await picker.getByPlaceholder('Search Contacts...').fill(newName);
  await picker.locator('.location-result-row').filter({hasText:newName}).click();
  await expect(panel(spoc.page,'Client contact details').getByText(newName,{exact:true})).toBeVisible();
  await expect(panel(spoc.page,'Client contact details').getByText(peer,{exact:true})).toBeVisible();
 });
 await check('Project-link save failure is visible and can be retried without recreating the contact',async()=>{
  const rejected='Retry Peer '+run;
  await spoc.context.route('**/api/projects/*/spoc-contacts',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated project save failure'})}));
  const picker=contacts.locator('.field-grid').first().locator(':scope > .form-row').nth(1);
  await picker.getByRole('button',{name:'Change',exact:true}).click();await picker.getByRole('button',{name:'Add',exact:true}).click();
  for(const [i,value]of[rejected,'Retry organization','555666','retry@example.test'].entries())await picker.locator('input').nth(i).fill(value);
  await picker.getByRole('button',{name:'Save contact',exact:true}).click();
  await expect(contacts.getByRole('alert')).toContainText('Simulated project save failure');
  await expect(panel(spoc.page,'Client contact details').getByText(rejected,{exact:true})).toHaveCount(0);
  await spoc.context.unroute('**/api/projects/*/spoc-contacts');await contacts.getByRole('button',{name:'Save contacts',exact:true}).click();
  await expect(panel(spoc.page,'Client contact details').getByText(rejected,{exact:true})).toBeVisible();
 });
 await spoc.page.screenshot({path:resolve(out,'contacts-fixed.png'),fullPage:true});assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'browser-tests.json'),JSON.stringify({passed:true,checks,page_errors:errors,scope:'Disposable local API/MongoDB and production frontend bundle; original company record not inspected'},null,2)+'\n');
}catch(e){await writeFile(resolve(out,process.env.CONTACT_BASELINE?'baseline-browser-tests.json':'browser-tests.json'),JSON.stringify({passed:false,error:e.message,checks,page_errors:errors},null,2)+'\n');throw e;}
finally{for(const c of contexts)await c.close();await browser.close();}
