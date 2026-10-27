import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { ServiceDashboard } from '../models/ServiceDashboard.js';
import { expandServices } from '../config/services.js';

export const TEAM_DIRECTORS = ['associate_director', 'technical_director', 'assoc_technical_director'];
export const isTeamDirector = user => TEAM_DIRECTORS.includes(user?.role);
const id = value => String(value?._id ?? value ?? '');
const normalized = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export const teamService = value => expandServices([value]).join(' + ');

export function employeeOwnership(user, employees, users) {
  const aliases = new Map();
  function add(key, employee) {
    key = normalized(key);if (!key) return;
    if (!aliases.has(key)) aliases.set(key, new Set());aliases.get(key).add(id(employee));
  }
  for (const e of employees) for (const key of [e._id,e.empId,e.email,[e.firstName,e.lastName].filter(Boolean).join(' '),[e.firstName,e.middleName,e.lastName].filter(Boolean).join(' ')]) add(key,e._id);
  const active = new Set(employees.map(e=>id(e)));
  for (const u of users) if (active.has(id(u.employee))) for (const key of [u._id,u.name,u.email]) add(key,u.employee);
  const resolve = key => {const matches=aliases.get(normalized(key));return matches?.size===1?[...matches][0]:null;};
  const me=users.find(u=>id(u)===id(user.id));const own=id(me?.employee);
  const reporting = new Set(active.has(own) ? [own] : []);
  let changed=true;
  while(changed){changed=false;for(const e of employees){
    if (reporting.has(id(e))) continue;
    if (resolve(e.director)===own || reporting.has(resolve(e.reportingManager))) {reporting.add(id(e));changed=true;}
  }}
  return { own, active, reporting, resolve };
}

// Ownership comes from persisted exact links, never a department-wide default.
// Ambiguous legacy names resolve to nobody; missing mappings return no teams.
export async function directorTeams(user) {
  if (!isTeamDirector(user)) return null;
  const [employees, users, teams, dashboards] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } }).select('firstName middleName lastName empId email director reportingManager designation department').lean(),
    User.find({}).select('name email employee').lean(),
    Team.find({ active: { $ne: false } }).sort({ name: 1 })
      .populate('projects', 'name jobNumber code branch currentStage status services hold')
      .populate('lead', 'firstName lastName empId designation department status experience')
      .populate('members.employee', 'firstName lastName empId designation department status experience').lean(),
    ServiceDashboard.find({ technicalDirector: { $exists: true, $ne: '' } }).select('project service technicalDirector').lean(),
  ]);
  const {own,active,reporting,resolve}=employeeOwnership(user,employees,users);
  if (!active.has(own)) return [];
  const pairs=new Set(dashboards.filter(d=>resolve(d.technicalDirector)===own)
    .flatMap(d=>expandServices([d.service]).map(service=>id(d.project)+':'+service)));
  return teams.flatMap(t=>{
    const services=expandServices([t.service]);const leadOwned=reporting.has(id(t.lead));
    const memberOwned=(t.members??[]).some(m=>reporting.has(id(m.employee)));
    return services.flatMap(service => (t.projects??[]).filter(Boolean).flatMap(p=>{
      const whole=leadOwned||pairs.has(id(p)+':'+service);
      if (!whole && !memberOwned) return [];
      const lead=t.lead&&t.lead.status!=='Exited'&&(whole||reporting.has(id(t.lead)))?t.lead:null;
      const members=(t.members??[]).filter(m=>m.employee&&m.employee.status!=='Exited'&&(whole||reporting.has(id(m.employee))));
      if (!lead&&!members.length) return [];
      return [{...t,projects:[p],service,scopeKey:id(t)+':'+id(p)+':'+service,lead,members}];
    }));
  });
}
