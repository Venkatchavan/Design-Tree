// Actual import/export requests against the rebuilt API, using disposable data.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const root=process.env.TEST_API_ROOT || '/app', require=createRequire(`${root}/package.json`),XLSX=require('xlsx');
const f=JSON.parse(await readFile(process.env.TEST_FIXTURE_FILE,'utf8'));
assert(f.isolated && f.base==='http://127.0.0.1:5000','Use the disposable in-container API only.');
let cookie;
before(async()=>{
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast.admin.email,password:f.password})});
  assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
});
function workbook(rows,bookType='xlsx',name='Projects'){
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),name);
  return XLSX.write(book,{type:'buffer',bookType});
}
test('fixed spreadsheet release supports XLSX, legacy XLS and CSV imports through the real project API',async()=>{
  assert.equal(XLSX.version,'0.20.3');
  for(const [type,ext] of [['xlsx','xlsx'],['biff8','xls'],['csv','csv']]){
    const code=`VERIFY-${ext.toUpperCase()}`;
    const form=new FormData();form.append('file',new Blob([workbook([{'Project Name':`Verified ${ext} project`,'Project Code':code,Branch:'Test HQ',Services:'STR',Status:'Active'}],type)]),`projects.${ext}`);
    const r=await fetch(f.base+'/api/projects/import',{method:'POST',headers:{Cookie:cookie},body:form});
    assert.equal(r.status,200);const result=await r.json();assert.equal(result.created,1,JSON.stringify(result));assert.deepEqual(result.errors,[]);
    const list=await(await fetch(f.base+`/api/projects?search=${code}`,{headers:{Cookie:cookie}})).json();assert(list.items.some(p=>p.code===code));
  }
});
test('spreadsheet row validation is retained and unrelated invalid rows do not prevent valid imports',async()=>{
  const form=new FormData();form.append('file',new Blob([workbook([{'Project Name':'Valid mixed import','Project Code':'VERIFY-MIXED',Branch:'Test HQ',Services:'STR'},{'Project Name':'','Project Code':'VERIFY-INVALID',Branch:'Test HQ',Services:'Unknown service'}])]),'mixed.xlsx');
  const r=await fetch(f.base+'/api/projects/import',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.created,1);assert.equal(result.errors.length,1);
});
test('transmittal preview reads the new workbook and export remains a readable XLSX workbook',async()=>{
  const form=new FormData();form.append('file',new Blob([workbook([{'TR No.':'VERIFY-TR','Project':'Assigned workflow project','Drawing No.':'VERIFY-DWG','Title':'Verification drawing','Service':'STR','Stage':'GFC','Revision':'R0','Issued to':'Test client','Method':'Email','Status':'Draft'}],'xlsx','Transmittal Log')]),'transmittals.xlsx');
  const r=await fetch(f.base+'/api/transmittals/import/preview',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(r.status,200);const preview=await r.json();assert(preview.rows?.length===1,JSON.stringify(preview));
  const exported=await fetch(f.base+'/api/transmittals/export',{headers:{Cookie:cookie}});assert.equal(exported.status,200);
  const book=XLSX.read(Buffer.from(await exported.arrayBuffer()),{type:'buffer'});assert(book.SheetNames.includes('Transmittal Log'));assert(book.SheetNames.includes('TL drawing list'));
});
