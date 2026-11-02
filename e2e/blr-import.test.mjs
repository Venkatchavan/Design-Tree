import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startLocalFixture} from './local-fixture.mjs';
import {auditRoster,rosterFromWorkbook} from '../api/src/utils/blrUserAudit.js';
import {importRoster} from '../api/src/utils/blrUserImport.js';
import XLSX from '../api/node_modules/xlsx/xlsx.js';
let f;
before(async()=>{f=await startLocalFixture()});
after(async()=>{await f?.stop()});
test('BLR import defaults to a read-only audit and never creates accounts without apply',async()=>{
  const before=await Promise.all([f.models.User.countDocuments(),f.models.Employee.countDocuments()]);
  await promisify(execFile)(process.execPath,['src/scripts/add-blr-users.js'],{cwd:resolve(import.meta.dirname,'../api'),env:{...process.env},timeout:30000});
  assert.deepEqual(await Promise.all([f.models.User.countDocuments(),f.models.Employee.countDocuments()]),before);
});
test('normalized existing emails, employee-only records, ambiguous names and missing emails cannot create replacements',async()=>{
  const report=auditRoster([
    {name:'Existing Person',email:' EXISTING@EXAMPLE.COM '},
    {name:'Employee Only',email:'employee@example.com'},
    {name:'Legacy.Person',email:'new@example.com'},
    {name:'New Joiner',email:''},
    {name:'Fresh Person',email:'fresh@example.com'},
    {name:'Fresh Person',email:'fresh@example.com'},
  ],[{_id:'u1',name:'Existing Person',email:'Existing@Example.Com',role:'superuser',isActive:false}],
  [{_id:'e1',firstName:'Employee Only',email:'employee@example.com'},{_id:'e2',firstName:'Legacy Person'}]);
  assert.deepEqual(report.rows.map(r=>r.status),['existing_login','employee_only','review','pending_email','missing_login','duplicate_roster']);
});
test('duplicate database emails, conflicting roster identities and broken links require review',()=>{
  assert.equal(auditRoster([{name:'A',email:'a@x.example'}],[{_id:'1',email:'A@x.example'},{_id:'2',email:'a@x.example'}],[]).rows[0].status,'review');
  const shared=auditRoster([{name:'A',email:'one@x.example'},{name:'A',email:'two@x.example'}],[],[]);
  assert(shared.rows.every(r=>r.status==='review'));
  assert.equal(auditRoster([{name:'A',email:'a@x.example'}],[{_id:'u',email:'a@x.example',employee:'missing'}],[]).rows[0].status,'review');
});
test('two email values on one workbook row require review and original row numbers are retained',()=>{
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([[],['Two Emails','Admin','first@x.example','second@x.example']]),'ADMIN');
  const rows=rosterFromWorkbook(wb,XLSX);
  assert.equal(auditRoster(rows,[],[]).rows[0].status,'review');
  assert.equal(rows[0].row,2);assert.deepEqual(rows[0].emailCandidates,['first@x.example','second@x.example']);
});
test('apply is repeatable and preserves existing passwords, roles, inactive status and employee-only identities',async()=>{
  const existing=await f.models.User.findById(f.cast.admin.user).select('+passwordHash').lean();
  const employee=await f.models.Employee.create({firstName:'Employee Only',email:'only@new.example',empId:'ONLY-1'});
  const before=await f.models.Employee.countDocuments();
  const roster=[{name:existing.name,email:existing.email,role:'engineer_drafter'},{name:'Employee Only',email:employee.email,role:'engineer_drafter'},
    {name:'Email Pending',email:'',role:'engineer_drafter'},{name:'New Verified Person',email:'newverified@new.example',role:'engineer_drafter'}];
  const args={roster,User:f.models.User,Employee:f.models.Employee,passwordHash:existing.passwordHash,roleKeys:['engineer_drafter']};
  const first=await importRoster(args),second=await importRoster(args);
  assert.deepEqual(first.map(r=>r.status),['existing_login','employee_only','pending_email','created']);
  assert.deepEqual(second.map(r=>r.status),['existing_login','employee_only','pending_email','existing_login']);
  assert.equal(await f.models.Employee.countDocuments(),before+1);
  assert.equal(await f.models.User.countDocuments({email:'newverified@new.example'}),1);
  const created=await f.models.User.findOne({email:'newverified@new.example'}).lean();
  assert.equal(String((await f.models.Employee.findById(created.employee)).user),String(created._id));
  const preserved=await f.models.User.findById(existing._id).select('+passwordHash').lean();
  assert.equal(preserved.passwordHash,existing.passwordHash);assert.equal(preserved.role,existing.role);assert.equal(preserved.isActive,existing.isActive);
});
test('a reverse-link save failure rolls back both records created by this attempt',async()=>{
  const original=f.models.Employee.prototype.save;
  f.models.Employee.prototype.save=function(...args){if(this.email==='rollback@new.example'&&this.user)throw new Error('Injected reverse-link failure');return original.apply(this,args)};
  try{
    const result=await importRoster({roster:[{name:'Rollback Person',email:'rollback@new.example',role:'engineer_drafter'}],User:f.models.User,Employee:f.models.Employee,passwordHash:'local-fixture-hash',roleKeys:['engineer_drafter']});
    assert.equal(result[0].status,'failed');
    assert.equal(await f.models.User.countDocuments({email:'rollback@new.example'}),0);
    assert.equal(await f.models.Employee.countDocuments({email:'rollback@new.example'}),0);
  }finally{f.models.Employee.prototype.save=original}
});
test('the workbook audit reads all sheets, retains missing-email joiners, and never writes to the database',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'blr-audit-'));
  try{
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['New Joiner','Engineer',''],[],['New Verified Person','Engineer','newverified@new.example']]),'STR');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Next Branch Joiner','Admin','No email yet']]),'OTHER');
    const roster=rosterFromWorkbook(wb,XLSX);assert.equal(roster.length,3);assert.equal(roster[1].row,3);
    const file=resolve(dir,'roster.xlsx'),out=resolve(dir,'audit.json');XLSX.writeFile(wb,file);
    const before=await Promise.all([f.models.User.countDocuments(),f.models.Employee.countDocuments()]);
    await promisify(execFile)(process.execPath,['src/scripts/audit-blr-users.js','--file',file,'--out',out],{cwd:resolve(import.meta.dirname,'../api'),env:{...process.env},timeout:30000});
    const report=JSON.parse(await readFile(out,'utf8'));assert.equal(report.readOnly,true);assert.equal(report.counts.pending_email,2);assert.equal(report.counts.existing_login,1);
    assert.deepEqual(await Promise.all([f.models.User.countDocuments(),f.models.Employee.countDocuments()]),before);
    assert(!JSON.stringify(report).includes('passwordHash'));
  }finally{await rm(dir,{recursive:true,force:true})}
});
