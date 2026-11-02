import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { spocApi } from '../../lib/spocApi.js';
import { addHours, businessDate, collectPages, groupWorkDays, hoursText } from '../../lib/workReport.js';
import { isPendingLogout, performLogout, takePendingLogout } from '../../lib/session.js';
import { MAN_HOUR_NOTE } from '../SignOutButton.jsx';
import Panel from '../Panel.jsx';
import EntryDocuments from '../EntryDocuments.jsx';

const SERVICES=['SMEPF','SMEP','MEP','STR','PHE','ELE','HVAC','FIRE','BIM','GBS'];
const AREAS=['Documents','Meetings','Meeting Scheduling & Coordination','Drawings Sharing / Issuing','Architectural Updates','Client Updates','Revision Status','Project Status','Other'];
const REVISIONS=['Addressed','In Progress','Pending','Awaiting Client','Awaiting Architect','Awaiting Internal Team'];
const key=()=>crypto.randomUUID();
const blank=()=>({clientKey:key(),project:'',service:'',areas:[{key:'Documents',update:'',hours:''}],dirty:true});
const editRow=entry=>({...entry,id:entry._id,project:String(entry.project?._id??entry.project),projectLabel:entry.project?.name??entry.project?.code??'Saved project',expectedVersion:entry.__v??0,dirty:false});
const sum=rows=>rows.reduce((s,r)=>addHours(s,r.areas.reduce((n,a)=>addHours(n,Number(a.hours)||0),0)),0);

export default function SpocDailyWork({myAllocs,activeProjects,canWrite=true}) {
  const qc=useQueryClient(),navigate=useNavigate();
  const [date,setDate]=useState(businessDate),[rows,setRows]=useState(()=>[blank()]);
  const [editing,setEditing]=useState(false),[partial,setPartial]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const entries=useQuery({queryKey:['spoc-entries','all-mine'],queryFn:()=>collectPages(spocApi.entriesList,{mine:true})});
  const options=new Map((myAllocs.length?myAllocs.map(a=>a.project):activeProjects).filter(Boolean).map(p=>[String(p._id??p),p.name??p.code??String(p)]));
  for(const row of rows) if(row.project&&!options.has(row.project)) options.set(row.project,row.projectLabel??'Saved project');
  function patch(index,changes){setMessage('');setRows(prev=>prev.map((r,i)=>i===index?{...r,...changes,dirty:true,error:''}:r));}
  function area(index,activity,changes){patch(index,{areas:rows[index].areas.map((a,i)=>i===activity?{...a,...changes}:a)});}
  function editDay(group){setEditing(true);setPartial(false);setDate(/^\d{4}-\d{2}-\d{2}$/.test(group.date)?group.date:'');setRows(group.items.map(editRow));setError('');setMessage('');window.scrollTo({top:0,behavior:'smooth'});}
  async function save(event){
    event.preventDefault();setError('');setMessage('');setBusy(true);
    const pending=rows.filter(r=>r.dirty);
    try {
      const body={date,rows:pending.map(r=>({...(r.id?{id:r.id,expectedVersion:r.expectedVersion}:{clientKey:r.clientKey}),project:r.project,service:r.service,areas:r.areas.map(a=>({key:a.key,update:a.update??'',hours:Number(a.hours)})),revisionNo:r.revisionNo??'',revisionStatus:r.revisionStatus||null,revisionRemarks:r.revisionRemarks??''}))};
      const result=await spocApi.daySave(body);
      setRows(previous=>previous.map(r=>{
        const outcome=result.results.find(o=>r.id?o.id===r.id:o.clientKey===r.clientKey);
        if(!outcome) return r;
        if(outcome.status!=='saved') return {...r,error:outcome.message};
        return {...r,...outcome.item,id:outcome.item._id,project:String(outcome.item.project?._id??outcome.item.project),expectedVersion:outcome.item.__v??0,dirty:false,error:''};
      }));
      await qc.invalidateQueries();
      if(result.complete){setPartial(false);setMessage('Daily work saved.');if(date===businessDate()&&takePendingLogout()){await performLogout(qc);navigate('/');}}
      else {setPartial(true);setError('Some rows were not saved. Saved rows are retained; retry saves only the remaining drafts. Reload a conflicting day before correcting it.');}
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <>
    {isPendingLogout()&&<p role="alert">{MAN_HOUR_NOTE} Save today&apos;s work to complete sign-out.</p>}
    <Panel title="SPOC daily work update / man-hour entry" sub="Record each project, service and activity under one date. Eight hours is a normal-day reference; fractional and extra hours are retained.">
      {canWrite?<form onSubmit={save}>
        <label className="form-label">Work date<input aria-label="Work date" type="date" className="form-input" required value={date} disabled={busy} onChange={e=>{setDate(e.target.value);setRows(prev=>editing?prev.map(r=>({...r,dirty:true})):[blank()]);setPartial(false);setError('');setMessage('');}} /></label>
        {editing&&<p>Editing saved work. Changing the date moves these entries and preserves their history.</p>}
        {rows.map((r,index)=><fieldset key={r.id??r.clientKey} style={{minWidth:0,margin:'12px 0',padding:12,border:'1px solid var(--line)'}} disabled={busy}>
          <legend>Project / service {index+1}{r.id?' · saved entry':''}{!r.dirty?' · saved':''}</legend>
          <div className="field-grid">
            <label className="form-label">Project<select aria-label={`Project ${index+1}`} className="form-input" required value={r.project} onChange={e=>patch(index,{project:e.target.value})}><option value="">Select project</option>{[...options].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="form-label">Service<select aria-label={`Service ${index+1}`} className="form-input" required value={r.service} onChange={e=>patch(index,{service:e.target.value})}><option value="">Select service</option>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></label>
          </div>
          {r.areas.map((a,i)=><div key={i} className="field-grid" style={{marginTop:10}}>
            <label className="form-label">Activity<select aria-label={`Activity ${index+1}.${i+1}`} className="form-input" value={a.key} onChange={e=>area(index,i,{key:e.target.value})}>{[...new Set([...AREAS,a.key])].map(k=><option key={k}>{k}</option>)}</select></label>
            <label className="form-label">Daily update / remarks<textarea aria-label={`Remarks ${index+1}.${i+1}`} className="form-input" value={a.update??''} onChange={e=>area(index,i,{update:e.target.value})}/></label>
            <label className="form-label">Hours<input aria-label={`Hours ${index+1}.${i+1}`} className="form-input" type="number" required min="0" max="24" step="any" value={a.hours??''} onChange={e=>area(index,i,{hours:e.target.value})}/></label>
            {r.areas.length>1&&<button type="button" className="approve-btn" onClick={()=>patch(index,{areas:r.areas.filter((_,j)=>i!==j)})}>Remove activity {i+1}</button>}
          </div>)}
          <button type="button" className="approve-btn" onClick={()=>patch(index,{areas:[...r.areas,{key:'Other',update:'',hours:''}]})}>Add activity to row {index+1}</button>
          <details style={{marginTop:10}}><summary>Revision details</summary><div className="field-grid">
            <label className="form-label">Revision number<input className="form-input" value={r.revisionNo??''} onChange={e=>patch(index,{revisionNo:e.target.value})}/></label>
            <label className="form-label">Revision status<select className="form-input" value={r.revisionStatus??''} onChange={e=>patch(index,{revisionStatus:e.target.value})}><option value="">Not recorded</option>{REVISIONS.map(s=><option key={s}>{s}</option>)}</select></label>
            <label className="form-label">Revision remarks<textarea className="form-input" value={r.revisionRemarks??''} onChange={e=>patch(index,{revisionRemarks:e.target.value})}/></label>
          </div></details>
          {r.id&&<EntryDocuments entry={r} spoc onUploaded={item=>setRows(prev=>prev.map(row=>row.id===r.id?{...row,documents:item.documents,__v:item.__v,expectedVersion:item.__v??0}:row))} />}
          {!r.id&&rows.length>1&&<button type="button" className="approve-btn" onClick={()=>setRows(prev=>prev.filter((_,i)=>i!==index))}>Remove draft row {index+1}</button>}
          {r.error&&<p role="alert">{r.error}</p>}
        </fieldset>)}
        <p>Daily total: <b>{hoursText(sum(rows))}</b> hours</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}><button type="button" className="approve-btn" disabled={busy} onClick={()=>{setEditing(false);setPartial(false);setDate(businessDate());setRows([blank()]);setError('');setMessage('');}}>New day</button><button type="button" className="approve-btn" disabled={busy} onClick={()=>setRows(prev=>[...prev,blank()])}>Add project / service</button><button className="btn-primary" disabled={busy||!rows.some(r=>r.dirty)}>{busy?'Saving…':partial?'Save remaining changes':'Save daily work'}</button></div>
      </form>:<p>Daily work is view-only for this role.</p>}
      {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    </Panel>
    <Panel title="My daily entries" sub="Expand a date to see saved remarks, individual hours and original documents.">
      {entries.isLoading?<p>Loading daily entries…</p>:entries.isError?<p role="alert">{entries.error.message} <button className="approve-btn" onClick={()=>entries.refetch()}>Retry daily entries</button></p>:!entries.data.items.length?<p>No entries saved yet.</p>:groupWorkDays(entries.data.items).map(group=><details key={group.date} data-work-day={group.date} style={{padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
        <summary>{group.date} · {hoursText(group.hours)} hours · {group.items.length} project / service entries</summary>
        {canWrite&&<button className="approve-btn" onClick={()=>editDay(group)}>Edit {group.date}</button>}
        {group.items.map(entry=><article key={entry._id} style={{padding:'12px 0',overflowWrap:'anywhere'}}>
          <b>{entry.project?.name??entry.project?.code??'Saved project'} · {entry.service} · {hoursText(entry.totalHours)} hours</b>
          {(entry.areas??[]).map((a,i)=><p key={i} style={{whiteSpace:'pre-wrap'}}>{a.key} · {hoursText(a.hours)} hours<br/>{a.update||'No remarks recorded'}</p>)}
          {(entry.revisionNo||entry.revisionStatus||entry.revisionRemarks)&&<p>Revision {entry.revisionNo??'—'} · {entry.revisionStatus??'Not recorded'}<br/>{entry.revisionRemarks}</p>}
          <EntryDocuments entry={entry} spoc readOnly={!canWrite}/>
          {!!entry.history?.length&&<details><summary>Correction history ({entry.history.length})</summary>{entry.history.map((h,i)=><div key={i}><p>{new Date(h.at).toLocaleString()} · Actor {String(h.actor)} · Previous {hoursText(h.previous.totalHours)} hours</p>{(h.previous.areas??[]).map((a,j)=><p key={j}>{a.key} · {hoursText(a.hours)} hours · {a.update}</p>)}</div>)}</details>}
        </article>)}
      </details>)}
    </Panel>
  </>;
}
