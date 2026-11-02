// Disposable browser fixture for the eight-page client PDF.
await import('./stakeholder-local-server.mjs');
import {readFile,writeFile} from 'node:fs/promises';
import {Employee} from '../api/src/models/Employee.js';
import {Project} from '../api/src/models/Project.js';
const f=JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json','utf8'));
await Employee.findByIdAndUpdate(f.cast.tl.employee,{$set:{director:f.cast.associate.employee,reportingManager:f.cast.atd.employee}});
await Employee.findByIdAndUpdate(f.cast.engineer.employee,{$set:{reportingManager:f.cast.tl.employee}});
await Employee.create({empId:'PDF-TD-DIRECT',firstName:'TD reporting person',director:f.cast.td.employee,department:'Structure',branch:'Branch A'});
await Employee.create({empId:'PDF-AD-DIRECT',firstName:'AD reporting person',director:f.cast.associate.employee,department:'Structural',branch:'Branch A'});
await Employee.create({empId:'PDF-COMPANY',firstName:'Company branch person',department:'Electrical',branch:'Branch B'});
await Project.findByIdAndUpdate(f.project,{$set:{jobNumber:'JOB-26001'}});
const extra=await Project.create({code:'PDF-COMPANY',jobNumber:'JOB-COMPANY-27',name:'Company electrical project',services:['ELE'],branch:'Branch B'});
await writeFile('/tmp/designtree-pdf-ready.json',JSON.stringify({companyProject:String(extra._id)}),{mode:0o600});
console.log('PDF browser relationships ready.');
