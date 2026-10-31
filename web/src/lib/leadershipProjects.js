import { committedServiceNames, serviceNames } from './services.js';
import { workAllocations } from './workAllocations.js';
import { addHours } from './workHours.js';
const id=p=>String(p?._id??p?.id??p??'');
export function leadershipProjectRows(projects,entries,{branch='',service='',stage='',project=''}={}) {
 const components=entries.flatMap(workAllocations);
 const matchesService = values => !service || serviceNames(values).some(name => serviceNames([service]).includes(name));
 return projects.filter(p=>(!project||id(p)===project)&&(!branch||p.branch===branch)&&(!service||matchesService(committedServiceNames(p))||components.some(e=>id(e.project)===id(p)&&matchesService([e.service])))&&(!stage||(p.currentStage??'Not recorded')===stage||components.some(e=>id(e.project)===id(p)&&(e.stage??'Not recorded')===stage))).map(p=>{
   const work=components.filter(e=>id(e.project)===id(p)&&matchesService([e.service])&&(!stage||(e.stage??'Not recorded')===stage));
   const progress=entries.filter(e=>id(e.project)===id(p)&&matchesService([e.service])&&(!stage||(e.stage??'Not recorded')===stage)).map(e=>e.progressPct).filter(n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))).map(Number);
   return {key:id(p),pid:id(p),name:p.name,branch:p.branch||'Not recorded',stage:p.currentStage||'Not recorded',hours:addHours(...work.map(e=>e.hours??0)),entries:work.length,progress:progress.length?`${(progress.reduce((a,b)=>a+b,0)/progress.length).toFixed(1)}%`:'Not recorded'};
 });
}
