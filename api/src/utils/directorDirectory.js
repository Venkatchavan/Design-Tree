import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Project } from '../models/Project.js';
import { PROJECT_SERVICES, expandServices } from '../config/services.js';
import { directorTeams, employeeOwnership } from './directorTeams.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { addHours } from './workHours.js';
const id = value => String(value?._id ?? value ?? '');

// Total saved hours each listed employee has put on each listed project:
// work-entry primary + other-project hours and SPOC daily-work hours.
async function projectHours(employeeIds, projectIds) {
  const employees = [...employeeIds], projects = [...projectIds];
  if (!employees.length || !projects.length) return [];
  const emp = { $in: employees.map(v => new mongoose.Types.ObjectId(v)) }, proj = { $in: projects.map(v => new mongoose.Types.ObjectId(v)) };
  const [primary, other, spoc] = await Promise.all([
    WorkEntry.aggregate([{ $match: { employee: emp, project: proj } }, { $group: { _id: { employee: '$employee', project: '$project' }, hours: { $push: '$hours' } } }]),
    WorkEntry.aggregate([{ $match: { employee: emp, 'otherHours.project': proj } }, { $unwind: '$otherHours' }, { $match: { 'otherHours.project': proj } },
      { $group: { _id: { employee: '$employee', project: '$otherHours.project' }, hours: { $push: '$otherHours.hours' } } }]),
    SpocEntry.aggregate([{ $match: { employee: emp, project: proj } }, { $group: { _id: { employee: '$employee', project: '$project' }, hours: { $push: '$totalHours' } } }]),
  ]);
  const totals = new Map();
  for (const row of [...primary, ...other, ...spoc]) {
    const key = id(row._id.employee) + ':' + id(row._id.project);
    totals.set(key, addHours(totals.get(key) ?? 0, ...row.hours));
  }
  return [...totals].map(([key, hours]) => { const [employee, project] = key.split(':'); return { employee, project, hours }; });
}
const publicEmployee = e => Object.fromEntries(['_id','firstName','middleName','lastName','empId','designation','department','branch','status','experience','dateOfJoining','reportingManager'].filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));

export async function directorDirectory(user, company, branch = '') {
  const employees = await Employee.find(company ? {} : {status:{$ne:'Exited'}})
    .select('firstName middleName lastName empId designation department branch status experience dateOfJoining director reportingManager teamViewOf headOfDepartments email').sort({firstName:1,_id:1}).lean();
  let people=employees, teams, projects, departments=null;
  if (company) {
    [teams,projects]=await Promise.all([
      Team.find({active:{$ne:false}}).select('service branch lead members projects').lean(),
      Project.find({}).select('name jobNumber code branch services').sort({name:1,_id:1}).lean(),
    ]);
    // 02 Nov 2026: Technical Directors see Teams for their own departments
    // only — their saved department plus any departments they head.
    if (user?.role==='technical_director') {
      const me=await User.findById(user.id).select('employee').lean();
      const self=employees.find(e=>id(e)===id(me?.employee));
      departments=new Set(expandServices([self?.department,...(self?.headOfDepartments??[])].filter(Boolean)).map(d=>d.toLowerCase()));
      const inDept=values=>expandServices(values.filter(Boolean)).some(d=>departments.has(d.toLowerCase()));
      people=employees.filter(e=>e.status!=='Exited'&&inDept([e.department]));
      teams=teams.filter(t=>inDept([t.service]));
      const teamProjects=new Set(teams.flatMap(t=>(t.projects??[]).map(id)));
      projects=projects.filter(p=>teamProjects.has(id(p)));
    }
  } else {
    const users=await User.find({}).select('name email employee').lean();
    const {own,reporting}=employeeOwnership(user,employees,users);
    const scoped=await directorTeams(user);
    teams=scoped??[];
    // 05 Nov 2026: TLs and other non-director callers have no director scope, so
    // their log would list people with no project. Use the saved Teams their
    // reporting people sit on; the people listed remain the reporting team only.
    if(scoped===null){
      const ids=[...reporting].filter(v=>v!==own);
      teams=ids.length?await Team.find({active:{$ne:false},$or:[{lead:{$in:ids}},{'members.employee':{$in:ids}}]})
        .select('service branch lead members projects').populate('projects','name jobNumber code branch services').lean():[];
    }
    const allowed=new Set([...reporting,...(scoped?teams.flatMap(t=>[id(t.lead),...t.members.map(m=>id(m.employee))]):[])]);allowed.delete(own);
    people=employees.filter(e=>allowed.has(id(e)));
    projects=[...new Map(teams.flatMap(t=>t.projects.map(p=>[id(p),p]))).values()];
  }
  const branches=[...new Set([...people.map(e=>e.branch),...projects.map(p=>p.branch)].filter(Boolean))].sort();
  const services=[...new Set(expandServices([...(company&&!departments?PROJECT_SERVICES:[]),...people.map(e=>e.department),...teams.map(t=>t.service),...projects.flatMap(p=>p.services??[])]))].filter(sv=>!departments||departments.has(sv.toLowerCase())).sort();
  if(branch){people=people.filter(e=>e.branch===branch);projects=projects.filter(p=>p.branch===branch);}
  const employeeIds=new Set(people.map(id)), projectIds=new Set(projects.map(id));
  const assignments=teams.flatMap(t=>expandServices([t.service]).flatMap(service=>(t.projects??[]).filter(p=>projectIds.has(id(p))).flatMap(project=>
    [...new Set([id(t.lead),...(t.members??[]).map(m=>id(m.employee))])].filter(employee=>employeeIds.has(employee)).map(employee=>({employee,project:id(project),service,lead:employee===id(t.lead)})))));
  const hours=await projectHours(employeeIds,projectIds);
  return {employees:people.map(publicEmployee),hours,projects:projects.map(p=>({_id:p._id,name:p.name,jobNumber:p.jobNumber,branch:p.branch,services:p.services??[]})),
    assignments:[...new Map(assignments.map(a=>[a.employee+':'+a.project+':'+a.service,a])).values()],services,branches,total:people.length,scope:departments?'department':company?'company':'reporting',departments:departments?[...departments]:undefined};
}
