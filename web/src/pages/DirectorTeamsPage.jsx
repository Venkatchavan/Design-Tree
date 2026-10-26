import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamsMineApi } from '../lib/workApi.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import EmptyState from '../components/EmptyState.jsx';

const id = value => String(value?._id ?? value?.id ?? value ?? '');
const name = e => [e.firstName,e.lastName].filter(Boolean).join(' ') || e.empId;
const projectLabel = p => `${p.jobNumber || 'Job number not recorded'} · ${p.name}`;

export default function DirectorTeamsPage() {
  const q=useQuery({queryKey:['director-teams'],queryFn:teamsMineApi.list,refetchInterval:10000});
  const [service,setService]=useState(''),[project,setProject]=useState(''),[member,setMember]=useState('');
  const [serviceSearch,setServiceSearch]=useState(''),[projectSearch,setProjectSearch]=useState(''),[memberSearch,setMemberSearch]=useState('');
  const teams=q.data?.items??[];
  const services=[...new Set(teams.map(t=>t.service))].sort();
  // Derive every level from the latest authorized response. Revoked or stale
  // selections render an empty state and never fall back to company data.
  const serviceTeams=teams.filter(t=>!service||t.service===service);
  const projects=[...new Map(serviceTeams.flatMap(t=>t.projects.map(p=>[id(p),p]))).values()];
  const visibleProjects=projects.filter(p=>(!project||id(p)===project)&&projectLabel(p).toLowerCase().includes(projectSearch.toLowerCase()));
  const assignments=visibleProjects.flatMap(p=>{
    const members=serviceTeams.filter(t=>t.projects.some(v=>id(v)===id(p))).flatMap(t=>[
      ...(t.lead?[{employee:t.lead,service:t.service,kind:'Team Lead'}]:[]),
      ...t.members.map(m=>({...m,service:t.service,kind:m.employee.designation||'Team member'})),
    ]);
    return [...new Map(members.map(m=>[id(m.employee)+':'+m.service,{...m,project:p}])).values()];
  });
  const memberOptions=[...new Map(assignments.map(m=>[id(m.employee),m.employee])).values()];
  const displayed=assignments.filter(m=>(!member||id(m.employee)===member)&&`${name(m.employee)} ${m.employee.designation||''}`.toLowerCase().includes(memberSearch.toLowerCase()));
  function chooseService(value){setService(value);setProject('');setMember('');setProjectSearch('');setMemberSearch('');}
  function chooseProject(value){setProject(value);setMember('');setMemberSearch('');}
  return <>
    <div className="page-head"><div className="page-title">My Team</div><div className="page-sub">Your assigned departments, services, projects and team members</div></div>
    {q.isError&&<div className="login-error" role="alert" style={{display:'block'}}>{q.error.message}</div>}
    {q.isLoading?<EmptyState text="Loading your teams…"/>:<>
      <Panel title="Find your team">
        <div className="field-grid">
          <div className="form-row"><label className="form-label" htmlFor="director-service-search">Search departments or services</label><input id="director-service-search" className="form-input" value={serviceSearch} onChange={e=>setServiceSearch(e.target.value)}/><label className="form-label" htmlFor="director-service">Department / Service</label><select id="director-service" className="filter-select" value={service} onChange={e=>chooseService(e.target.value)}><option value="">All authorized departments / services</option>{services.filter(s=>s.toLowerCase().includes(serviceSearch.toLowerCase())||s===service).map(s=><option key={s}>{s}</option>)}</select></div>
          <div className="form-row"><label className="form-label" htmlFor="director-project-search">Search projects</label><input id="director-project-search" className="form-input" value={projectSearch} onChange={e=>{setProjectSearch(e.target.value);setMember('');}}/><label className="form-label" htmlFor="director-project">Project</label><select id="director-project" className="filter-select" value={project} onChange={e=>chooseProject(e.target.value)}><option value="">All authorized projects</option>{projects.filter(p=>projectLabel(p).toLowerCase().includes(projectSearch.toLowerCase())||id(p)===project).map(p=><option key={id(p)} value={id(p)}>{projectLabel(p)}</option>)}</select></div>
          <div className="form-row"><label className="form-label" htmlFor="director-member-search">Search team members</label><input id="director-member-search" className="form-input" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)}/><label className="form-label" htmlFor="director-member">Team Members</label><select id="director-member" className="filter-select" value={member} onChange={e=>setMember(e.target.value)}><option value="">All assigned members</option>{memberOptions.filter(e=>name(e).toLowerCase().includes(memberSearch.toLowerCase())||id(e)===member).map(e=><option key={id(e)} value={id(e)}>{name(e)}</option>)}</select></div>
        </div>
        <p aria-live="polite">{visibleProjects.length} {visibleProjects.length===1?'project':'projects'} · {new Set(displayed.map(m=>id(m.employee))).size} members · {displayed.length} service and project assignments</p>
      </Panel>
      {!teams.length?<EmptyState text="No teams are linked to your director or reporting assignments. Ask the allocation owner to check the saved reporting links."/>:!displayed.length?<EmptyState text="No team members match these filters."/>:
        [...new Set(displayed.map(m=>m.service))].sort().map(s=><section key={s}><h2 style={{fontSize:18,marginTop:24}}>{s}</h2>{visibleProjects.map(p=>{
          const rows=displayed.filter(m=>m.service===s&&id(m.project)===id(p));if(!rows.length)return null;
          return <Panel key={id(p)} title={projectLabel(p)} sub={`${s} · ${rows.length} members`}><DataTable rows={rows} columns={[
            {key:'name',label:'Team member',render:m=>name(m.employee)},
            {key:'designation',label:'Designation',render:m=>m.kind},
            {key:'department',label:'Department / Service',render:m=>[...new Map([m.employee.department,s].filter(Boolean).map(v=>[v.toLowerCase(),v])).values()].join(' / ')},
            {key:'job',label:'Job Number',render:()=>p.jobNumber||'Not recorded'},
            {key:'project',label:'Project Name',render:()=>p.name},
          ]}/></Panel>;
        })}</section>)
      }
    </>}
  </>;
}
