import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startLocalFixture} from './local-fixture.mjs';
let f,cookie,client;
before(async()=>{
  f=await startLocalFixture();
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.cast.admin.email,password:f.password})});
  cookie=r.headers.get('set-cookie').split(';')[0];
  const hash=(await f.models.User.findById(f.cast.admin.user).select('+passwordHash')).passwordHash;
  await f.models.User.insertMany(Array.from({length:225},(_,i)=>({name:'Roster '+i,email:`roster${i}@test.example`,role:'engineer_drafter',passwordHash:hash})));
  await f.models.Employee.insertMany(Array.from({length:225},(_,i)=>({firstName:'Roster '+i,empId:'ROSTER-'+i,email:`roster${i}@test.example`})));
  const source=(await readFile(new URL('../web/src/lib/api.js',import.meta.url),'utf8')).replace('import.meta.env.VITE_API_URL',JSON.stringify(f.base));
  client=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
});
after(async()=>{await f?.stop()});
async function get(path){const r=await fetch(f.base+path,{headers:{Cookie:cookie}});return{status:r.status,data:await r.json()}}
test('user and employee directories expose distinct bounded pages beyond 200 records',async()=>{
  for(const path of ['/api/users','/api/employees']){
    const a=await get(path+'?page=1&limit=200'),b=await get(path+'?page=2&limit=200');
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.equal(a.data.items.length,200);assert.equal(b.data.items.length,a.data.total-200);
    assert.equal(a.data.hasMore,true);assert.equal(b.data.hasMore,false);
    const ids=new Set([...a.data.items,...b.data.items].map(x=>String(x.id??x._id)));
    assert.equal(ids.size,a.data.total);
  }
});
test('directory pagination rejects invalid inputs and retains authorization',async()=>{
  for(const path of ['/api/users','/api/employees']){
    assert.equal((await get(path+'?page=0')).status,400);
    assert.equal((await get(path+'?page=1.5')).status,400);
    assert.equal((await get(path+'?limit=0')).status,400);
    assert.equal((await fetch(f.base+path)).status,401);
    const r=await get(path+'?limit=10000');assert.equal(r.data.limit,200);assert.equal(r.data.items.length,200);
  }
});
test('directory clients retrieve all authorized pages without dropping filters',async()=>{
  const native=globalThis.fetch;
  globalThis.fetch=(url,options)=>native(url,{...options,headers:{...options?.headers,Cookie:cookie}});
  try{
    for(const [api,path]of [[client.usersApi,'/api/users'],[client.employeesApi,'/api/employees']]){
      const all=await api.list({search:'Roster'});assert.equal(all.items.length,225);assert.equal(all.total,225);
      assert.equal(new Set(all.items.map(x=>String(x.id??x._id))).size,225);
      const explicit=await api.list({search:'Roster',page:2,limit:100});assert.equal(explicit.items.length,100);
      assert.equal((await get(path+'?search=does-not-exist')).data.total,0);
    }
  }finally{globalThis.fetch=native}
});
test('connection failure differs from an authenticated HTTP error and does not retry login',async()=>{
  const native=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;return Promise.reject(new TypeError('Failed to fetch'))};
  try{
    await assert.rejects(()=>client.loginApi({email:'example@test.example',password:'unused'}),e=>e.code==='NETWORK_ERROR'&&e.message.includes('connect'));
    assert.equal(calls,1);
  }finally{globalThis.fetch=native}
  await assert.rejects(()=>client.loginApi({email:'example@test.example',password:'incorrect'}),e=>e.status===401&&e.message.includes("don't match"));
});
