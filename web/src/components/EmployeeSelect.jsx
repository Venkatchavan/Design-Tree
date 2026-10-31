import { Children, useId, useState } from 'react';
import { employeeId, employeeName, employeeRecord, employeeServices, filterEmployees } from '../lib/employeeFilters.js';

// Callers supply their existing authorized candidates. This control never fetches
// people or changes a selection when a filter changes.
export function EmployeeFilter({employees=[],selectedIds=[],getId=employeeId,label='Employee',children,disabled=false}) {
 const [search,setSearch]=useState(''),[branch,setBranch]=useState(''),[service,setService]=useState('');const uid=useId();
 const branches=[...new Set(employees.map(e=>employeeRecord(e)?.branch||'Not recorded'))].sort();
 const services=[...new Set(employees.flatMap(e=>employeeServices(e).length?employeeServices(e):['Not recorded']))].sort();
 const shown=filterEmployees(employees,{search,branch,service,selectedIds},getId);
 return <div className="employee-filter" style={{minWidth:0,width:'100%'}}>
  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
   <input id={uid+'-search'} className="form-input" aria-label={`${label} search`} placeholder="Search name or employee ID" value={search} disabled={disabled} onChange={e=>setSearch(e.target.value)} style={{flex:'1 1 150px',minWidth:0}} />
   <select className="filter-select" aria-label={`${label} branch`} value={branch} disabled={disabled} onChange={e=>setBranch(e.target.value)} style={{flex:'1 1 110px',minWidth:0}}><option value="">All branches</option>{branches.map(b=><option key={b}>{b}</option>)}</select>
   <select className="filter-select" aria-label={`${label} service`} value={service} disabled={disabled} onChange={e=>setService(e.target.value)} style={{flex:'1 1 130px',minWidth:0}}><option value="">All services / departments</option>{services.map(s=><option key={s}>{s}</option>)}</select>
  </div>
  {children(shown)}
  {(search||branch||service)&&<small aria-live="polite">{shown.length} of {employees.length} candidates · selected people stay visible</small>}
 </div>;
}

export default function EmployeeSelect({employees=[],getValue=employeeId,children,...props}) {
 const options=Children.toArray(children);const selected=Array.isArray(props.value)?props.value:[props.value];
 const label=props['aria-label']||'Employee';
 // The rendered options remain the authority too: metadata cannot add an option.
 return <EmployeeFilter employees={employees} selectedIds={selected} getId={getValue} label={label} disabled={props.disabled}>{shown=>{
   const allowed=new Set(shown.map(e=>String(getValue(e))));
   const visible=options.filter(option=>{ const value=String(option?.props?.value??option?.props?.children??''); return option?.type!=='option'||!value||allowed.has(value)||selected.map(String).includes(value); });
   const values=new Set(options.filter(o=>o?.type==='option').map(o=>String(o.props.value??o.props.children)));
   return <select {...props}>{visible}{selected.filter(v=>v&&!values.has(String(v))).map(v=><option key={'saved:'+v} value={v} disabled>{employeeName(employees.find(e=>String(getValue(e))===String(v)))||`Saved selection (${v})`}</option>)}</select>;
 }}</EmployeeFilter>;
}
