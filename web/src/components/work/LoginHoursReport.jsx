import { workAllocations } from '../../lib/workAllocations.js';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addHours, businessDate, hoursText, workReportApi } from '../../lib/workReport.js';
import Panel from '../Panel.jsx';
import DataTable from '../DataTable.jsx';
import KpiCard from '../KpiCard.jsx';
import EntryDocuments from '../EntryDocuments.jsx';
import WorkReportStatus from './WorkReportStatus.jsx';

export default function LoginHoursReport() {
  const [from,setFrom]=useState(businessDate),[to,setTo]=useState(businessDate);
  const q=useQuery({queryKey:['work-report','hr',from,to],queryFn:()=>workReportApi.list({from,to}),refetchInterval:10000});
  const groups=useMemo(()=>{
    const m=new Map();
    for(const e of (q.data?.items??[]).flatMap(workAllocations)) {
      const key=`${e.project?._id??e.project}|${e.stage??''}`;
      const g=m.get(key)??{key,project:e.project?.name??'Missing project',stage:e.stage??'Not recorded',employees:new Set(),hours:0};
      g.employees.add(e.employee?._id??e.employee);g.hours=addHours(g.hours,e.hours);m.set(key,g);
    }
    return [...m.values()].map(g=>({...g,count:g.employees.size}));
  },[q.data]);
  return <>
    <div className="field-grid"><label className="form-label">From date<input aria-label="Work report from" type="date" className="form-input" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="form-label">To date<input aria-label="Work report to" type="date" className="form-input" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    <WorkReportStatus query={q}/>
    {!q.isError&&!q.isLoading&&<>
      <div className="kpi-grid cols-3"><KpiCard label={`Total work hours · ${from||'all dates'} to ${to||'latest saved date'} (IST)`} value={hoursText(groups.reduce((s,g)=>addHours(s,g.hours),0))}/><KpiCard label="Projects with activity" value={new Set(groups.map(g=>g.project)).size}/><KpiCard label="Source entries" value={q.data?.total??0}/></div>
      <Panel title="Login hours by project and stage" sub="Saved work hours from daily work and SPOC entries. Attendance session duration is reported separately."><DataTable columns={[{key:'project',label:'Project'},{key:'stage',label:'Stage'},{key:'count',label:'Employees'},{key:'hours',label:'Total hours',render:r=>hoursText(r.hours)}]} rows={groups} emptyText="No work logged in this period."/></Panel>
      <Panel title="Saved work entries"><DataTable columns={[
        {key:'workDate',label:'Work date (IST)'},{key:'employee',label:'Employee',render:e=>[e.employee?.firstName,e.employee?.lastName].filter(Boolean).join(' ')||'Missing employee'},
        {key:'project',label:'Source project',render:e=>e.project?.name??'Missing project'},{key:'service',label:'Service'},{key:'stage',label:'Source stage',render:e=>e.stage??'Not recorded'},
        {key:'hours',label:'Reported hours',render:e=>hoursText(e.hours)}, {key:'source',label:'Source'},
        {key:'details',label:'Source activities / documents',render:e=><details><summary>View saved details</summary>{e.activities.map((a,i)=><p key={i} style={{whiteSpace:'pre-wrap'}}>{a.key} · {hoursText(a.hours)} hours<br/>{a.update}</p>)}<EntryDocuments entry={e} spoc={e.source==='SpocEntry'} readOnly/></details>},
      ]} rows={q.data?.items??[]} emptyText="No work logged in this period."/></Panel>
    </>}
  </>;
}
