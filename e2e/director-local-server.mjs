// Disposable local fixture; does not read or modify company data.
import {writeFile}from'node:fs/promises';
// The shared production-bundle server starts the fixture itself. Seed the
// director relationships after its startup, before writing the ready marker.
await import('./stakeholder-local-server.mjs');
const{Employee}=await import('../api/src/models/Employee.js');
const{Project}=await import('../api/src/models/Project.js');
const{Team}=await import('../api/src/models/Team.js');
const{ServiceDashboard}=await import('../api/src/models/ServiceDashboard.js');
const{readFile}=await import('node:fs/promises');
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));
await Employee.findByIdAndUpdate(f.cast.tl.employee,{$set:{director:f.cast.associate.employee,reportingManager:f.cast.atd.employee}});
await Employee.findByIdAndUpdate(f.cast.engineer.employee,{$set:{reportingManager:f.cast.tl.employee}});
await Project.findByIdAndUpdate(f.project,{$set:{jobNumber:'JOB-26001'}});
await ServiceDashboard.create({project:f.project,service:'STR',technicalDirector:'TEST-td'});
const project=await Project.create({code:'DIR-SECOND',jobNumber:'JOB-26002',name:'Second authorized electrical project',services:['ELE']});
await Team.create({name:'Separate electrical team',service:'ELE',projects:[project._id],members:[{employee:f.cast.engineer.employee}]});
await writeFile('/tmp/designtree-director-ready.json',JSON.stringify({project:String(project._id)}),{mode:0o600});
console.log('Director fixture relationships ready.');
