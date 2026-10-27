import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Project } from '../models/Project.js';
import { PROJECT_SERVICES, expandServices } from '../config/services.js';
import { directorTeams, employeeOwnership } from './directorTeams.js';
const id = value => String(value?._id ?? value ?? '');
const publicEmployee = e => Object.fromEntries(['_id','firstName','middleName','lastName','empId','designation','department','branch','status'].filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));

export async function directorDirectory(user, company, branch = '') {
  const employees = await Employee.find(company ? {} : {status:{$ne:'Exited'}})
    .select('firstName middleName lastName empId designation department branch status director reportingManager email').sort({firstName:1,_id:1}).lean();
  let people=employees, teams, projects;
  if (company) {
    [teams,projects]=await Promise.all([
      Team.find({active:{$ne:false}}).select('service branch lead members projects').lean(),
      Project.find({}).select('name jobNumber code branch services').sort({name:1,_id:1}).lean(),
    ]);
  } else {
    const users=await User.find({}).select('name email employee').lean();
    const {own,reporting}=employeeOwnership(user,employees,users);
    teams=await directorTeams(user)??[];
    const allowed=new Set([...reporting,...teams.flatMap(t=>[id(t.lead),...t.members.map(m=>id(m.employee))])]);allowed.delete(own);
    people=employees.filter(e=>allowed.has(id(e)));
    projects=[...new Map(teams.flatMap(t=>t.projects.map(p=>[id(p),p]))).values()];
  }
  const branches=[...new Set([...people.map(e=>e.branch),...projects.map(p=>p.branch)].filter(Boolean))].sort();
  const services=[...new Set(expandServices([...(company?PROJECT_SERVICES:[]),...people.map(e=>e.department),...teams.map(t=>t.service),...projects.flatMap(p=>p.services??[])]))].sort();
  if(branch){people=people.filter(e=>e.branch===branch);projects=projects.filter(p=>p.branch===branch);}
  const employeeIds=new Set(people.map(id)), projectIds=new Set(projects.map(id));
  const assignments=teams.flatMap(t=>expandServices([t.service]).flatMap(service=>(t.projects??[]).filter(p=>projectIds.has(id(p))).flatMap(project=>
    [...new Set([id(t.lead),...(t.members??[]).map(m=>id(m.employee))])].filter(employee=>employeeIds.has(employee)).map(employee=>({employee,project:id(project),service})))));
  return {employees:people.map(publicEmployee),projects:projects.map(p=>({_id:p._id,name:p.name,jobNumber:p.jobNumber,branch:p.branch,services:p.services??[]})),
    assignments:[...new Map(assignments.map(a=>[a.employee+':'+a.project+':'+a.service,a])).values()],services,branches,total:people.length,scope:company?'company':'reporting'};
}
