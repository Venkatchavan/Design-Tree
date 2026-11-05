import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '../lib/api.js';
import { serviceNames } from '../lib/services.js';
import { hoursText } from '../lib/workReport.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
const id=value=>String(value?._id??value?.id??value??'');
const name=e=>[e.firstName,e.middleName,e.lastName].filter(Boolean).join(' ')||e.empId||'Not recorded';
const projectLabel=p=>`${p.jobNumber||'Job number not recorded'} · ${p.name}`;
// Experience as imported from Saral; a bare number is read as years.
const experienceText=e=>{const t=String(e?.experience??'').trim();return !t?'Not recorded':/^\d+(\.\d+)?$/.test(t)?`${t} yrs`:t;};

// embedded: shown inside another My Team page; renders only when the caller
// has people in their saved reporting chain.
export default function DirectorTeamsPage({company=false,embedded=false}) {
 const [service,setService]=useState(''),[project,setProject]=useState(''),[member,setMember]=useState(''),[branch,setBranch]=useState('');
 const [projectSearch,setProjectSearch]=useState(''),[memberSearch,setMemberSearch]=useState('');
 const q=useQuery({queryKey:['director-directory',company,branch],queryFn:()=>teamsApi.directory(company,branch),refetchInterval:10000});
 const data=q.data??{},employees=data.employees??[],assignments=data.assignments??[];
 const projectOptions=(data.projects??[]).filter(p=>!service||serviceNames(p.services).includes(service)||assignments.some(a=>a.project===id(p)&&a.service===service));
 const projects=projectOptions.filter(p=>(!project||id(p)===project)&&projectLabel(p).toLowerCase().includes(projectSearch.toLowerCase()));
 const projectIds=new Set(projects.map(id));
 const memberOptions=employees.filter(e=>(!service||serviceNames([e.department]).includes(service)||assignments.some(a=>a.employee===id(e)&&a.service===service))&&
   ((!project&&!projectSearch)||assignments.some(a=>a.employee===id(e)&&projectIds.has(a.project)&&(!service||a.service===service))));
 const shown=memberOptions.filter(e=>(!member||id(e)===member)&&`${name(e)} ${e.designation??''}`.toLowerCase().includes(memberSearch.toLowerCase()));
 // Embedded (TL / Sr. TL) has no filter panel (05 Nov 2026), so the log lists the whole saved team.
 const hasFilter=embedded||Boolean(service||project||member||projectSearch.trim()||memberSearch.trim()||(company&&branch));
 const projectFilter=Boolean(project||projectSearch.trim());
 const hoursByPair=new Map((data.hours??[]).map(h=>[h.employee+':'+h.project,h.hours]));
 const projectById=new Map(projects.map(p=>[id(p),p]));
 const logRows=hasFilter?shown.flatMap(e=>{
   const rows=assignments.filter(a=>a.employee===id(e)&&projectById.has(a.project)&&(!service||a.service===service))
     .map(a=>({key:`${a.employee}:${a.project}:${a.service}`,employee:e,project:projectById.get(a.project),service:a.service,lead:!!a.lead}));
   return rows.length||projectFilter?rows:[{key:id(e)+':none',employee:e,project:null,service:'',lead:false}];
 }).sort((a,b)=>String(a.project?.name??'~').localeCompare(String(b.project?.name??'~'))||Number(b.lead)-Number(a.lead)||name(a.employee).localeCompare(name(b.employee))):[];
 function resetMembers(){setMember('');setMemberSearch('');}
 function chooseService(value){setService(value);setProject('');setProjectSearch('');resetMembers();}
 if (embedded && (q.isLoading || q.isError || !employees.length)) return null;
 return <>
  {!embedded&&<div className="page-head"><div className="page-title">{company?'Teams':'My Team'}</div><div className="page-sub">{company?'Company services, projects and employees by branch':'People in your saved director, reporting and team assignments'}</div></div>}
  {q.isError?<div role="alert">{q.error.message} <button type="button" onClick={()=>q.refetch()}>Retry directory</button></div>:q.isLoading?<EmptyState text="Loading directory…"/>:<>
   {!embedded&&<Panel title={company?'Find company teams':'Find your team'}><div className="field-grid">
    {company&&<div className="form-row"><label className="form-label" htmlFor="director-branch">Branch</label><select id="director-branch" className="filter-select" value={branch} onChange={e=>{setBranch(e.target.value);setService('');setProject('');setProjectSearch('');resetMembers();}}><option value="">All branches</option>{(data.branches??[]).map(b=><option key={b}>{b}</option>)}</select></div>}
    <div className="form-row"><label className="form-label" htmlFor="director-service">Department / Service</label><select id="director-service" className="filter-select" value={service} onChange={e=>chooseService(e.target.value)}><option value="">All services</option>{(data.services??[]).map(s=><option key={s}>{s}</option>)}</select></div>
    <div className="form-row"><label className="form-label" htmlFor="director-project-search">Search projects</label><input id="director-project-search" className="form-input" value={projectSearch} onChange={e=>{setProjectSearch(e.target.value);resetMembers();}}/><label className="form-label" htmlFor="director-project">Project</label><select id="director-project" className="filter-select" value={project} onChange={e=>{setProject(e.target.value);resetMembers();}}><option value="">All projects</option>{projectOptions.filter(p=>projectLabel(p).toLowerCase().includes(projectSearch.toLowerCase())||id(p)===project).map(p=><option key={id(p)} value={id(p)}>{projectLabel(p)}</option>)}</select></div>
    <div className="form-row"><label className="form-label" htmlFor="director-member-search">Search team members</label><input id="director-member-search" className="form-input" value={memberSearch} onChange={e=>{setMemberSearch(e.target.value);setMember('');}}/><label className="form-label" htmlFor="director-member">Team Members</label><select id="director-member" className="filter-select" value={member} onChange={e=>setMember(e.target.value)}><option value="">All listed members</option>{memberOptions.filter(e=>name(e).toLowerCase().includes(memberSearch.toLowerCase())||id(e)===member).map(e=><option key={id(e)} value={id(e)}>{name(e)}</option>)}</select></div>
   </div><p aria-live="polite">{projects.length} projects · {shown.length} members</p></Panel>}
   {/* 02 Nov 2026: a log of project team assignments driven by the filters
       above, not the whole employee list. No job number column. */}
   <Panel title="Project team log" sub={hasFilter?`${logRows.length} entries`:undefined}>{hasFilter?<DataTable rows={logRows} emptyText={company?'No project team entries match these filters.':'No project team entries match these filters or saved reporting links. Ask the allocation owner to verify the existing relationships.'} columns={[
    {key:'project',label:'Project Name',render:r=>r.project?.name||'Not allocated'},
    {key:'service',label:'Department / Service',render:r=>r.service||serviceNames([r.employee.department]).join(', ')||'Not recorded'},
    {key:'name',label:'Team member',render:r=><>{name(r.employee)}{r.lead&&<span className="load-badge" style={{marginLeft:6}}>TL</span>}</>},
    {key:'designation',label:'Designation',render:r=>r.employee.designation||'Not recorded'},
    // 05 Nov 2026: total hours this employee has logged on the project, in the same row.
    {key:'hours',label:'Total hours',render:r=>r.project?hoursText(hoursByPair.get(id(r.employee)+':'+id(r.project))):'—'},
    {key:'experience',label:'Experience',render:r=>experienceText(r.employee)},
    {key:'branch',label:'Branch',render:r=>r.employee.branch||'Not recorded'},
    {key:'status',label:'Status',render:r=>r.employee.status||'Not recorded'},
   ]}/>:<EmptyState text="Select a department / service, project or team member above to see the project team log."/>}</Panel>
   <Panel title="Projects"><DataTable rows={projects} emptyText="No projects match these filters." columns={[{key:'jobNumber',label:'Job Number',render:p=>p.jobNumber||'Not recorded'},{key:'name',label:'Project Name'},{key:'branch',label:'Branch',render:p=>p.branch||'Not recorded'},{key:'services',label:'Services',render:p=>serviceNames(p.services).join(', ')||'Not recorded'}]}/></Panel>
  </>}
 </>;
}
