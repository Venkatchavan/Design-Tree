// Run inside the disposable verification API container, never against live data.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=process.env.TEST_API_ROOT || '/app';
assert(new URL(process.env.MONGO_URI).pathname === '/designtree_verify', 'Disposable database required.');
const require=createRequire(`${root}/package.json`), mongoose=require('mongoose'), bcrypt=require('bcryptjs');
await mongoose.connect(process.env.MONGO_URI);
try {
  assert.equal(await mongoose.connection.db.collection('users').countDocuments(),0,'Seed only a fresh verification database.');
  const api=p=>import(pathToFileURL(`${root}/src/${p}.js`).href), models={};
  for(const name of ['User','Employee','Branch','Project','Team','SpocAllocation'])Object.assign(models,await api(`models/${name}`));
  const password='Verify-'+randomBytes(20).toString('hex'), hash=await bcrypt.hash(password,4),cast={};
  for(const [key,role] of Object.entries({admin:'admin_billing',dmh:'design_mgmt_head',td:'technical_director',md:'founding_director',associate:'associate_director',atd:'assoc_technical_director',finance:'finance',tl:'team_lead',spoc:'coordinator',engineer:'engineer_drafter',outsider:'engineer_drafter',qs:'qs'})){
    const employee=await models.Employee.create({empId:`VERIFY-${key}`,firstName:`Test ${key}`,lastName:'Workflow',designation:key==='tl'?'Team Lead':role,department:'Structural',branch:'Test HQ',experience:'5'});
    const user=await models.User.create({name:`Test ${key}`,email:`${key}@datum-test.example`,role,employee:employee._id,passwordHash:hash});
    cast[key]={email:user.email,employee:String(employee._id),user:String(user._id),role};
  }
  await models.Branch.create({name:'Test HQ'});
  const project=await models.Project.create({name:'Assigned workflow project',code:'TEST-ASSIGNED',branch:'Test HQ',services:['SMEPF'],scope:[{service:'SMEPF'}],currentStage:'CD',status:'Active'});
  const other=await models.Project.create({name:'Unrelated project',code:'TEST-OTHER',branch:'Test HQ',services:['STR']});
  await models.Team.create({name:'Assigned Structural team',service:'STR',branch:'Test HQ',lead:cast.tl.employee,projects:[project._id],members:[{employee:cast.engineer.employee},{employee:cast.qs.employee}]});
  await models.Team.create({name:'Unrelated team',service:'HVAC',branch:'Test HQ',lead:cast.outsider.employee,projects:[other._id],members:[{employee:cast.outsider.employee}]});
  await models.SpocAllocation.create({project:project._id,coordinator:cast.spoc.employee,status:'Approved',services:['SMEPF']});
  // Saved via redirected stdout as a private local test fixture, not a report.
  console.log(JSON.stringify({isolated:true,base:'http://127.0.0.1:19500',password,cast,project:String(project._id),other:String(other._id)}));
} finally {await mongoose.disconnect();}
