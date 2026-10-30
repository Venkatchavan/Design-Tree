import { addHours } from '../utils/workHours.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { narrowByProject, projectScopeIds } from '../utils/projectScope.js';
import { directorEntryScope } from './workEntries.controller.js';
import { workDate, workDateFilter } from '../utils/workDates.js';

export async function listWorkHours(req,res,next) {
  try {
    const filter={};
    narrowByProject(filter,'project',await projectScopeIds(req.user));
    if(req.query.mine==='true') {
      const me=await User.findById(req.user.id).select('employee');
      filter.employee=me?.employee ?? {$in:[]};
    } else if(req.query.employee) filter.employee=req.query.employee;
    if(req.query.team) {
      const team=await Team.findById(req.query.team);
      if(!team) return res.status(404).json({message:'Team not found.'});
      const members=(team.members??[]).map(m=>m.employee);
      filter.$and=[{employee:{$in:members}}];
    }
    const scope=await directorEntryScope(req.user,req.query.team);
    if(scope!==null) (filter.$and??=[]).push(scope.length?{$or:scope}:{_id:{$in:[]}});
    try {const dates=workDateFilter(req.query);if(dates) filter.date=dates;}
    catch(err){return res.status(400).json({message:err.message});}
    const limit=Math.min(200,Math.max(1,Math.floor(Number(req.query.limit)||100)));
    const offset=Math.max(0,Math.floor(Number(req.query.offset)||0));
    // Merge sorted prefixes: any item in the combined page must be in either
    // source's first offset+limit records. Ties use source then original id.
    // Authorization stays on the original source's primary project/employee.
    // A selected report project then matches primary or saved secondary hours
    // within those authorized sources; it grants no project/document authority.
    const workFilter={...filter}, spocFilter={...filter};
    if(req.query.project) {
      workFilter.$and=[...(filter.$and??[]),{$or:[{project:req.query.project},{'otherHours.project':req.query.project}]}];
      spocFilter.$and=[...(filter.$and??[]),{project:req.query.project}];
    }
    const load=(Model,sourceFilter)=>{
      const query=Model.find(sourceFilter).sort({date:-1,_id:-1}).limit(offset+limit)
        .populate('employee','firstName lastName empId designation department branch')
        .populate('project','name code branch');
      if(Model === WorkEntry) query.populate('otherHours.project','name code branch');
      return query.lean();
    };
    const [work,spoc,workCount,spocCount]=await Promise.all([load(WorkEntry,workFilter),load(SpocEntry,spocFilter),WorkEntry.countDocuments(workFilter),SpocEntry.countDocuments(spocFilter)]);
    const normalize=(e,source)=>{
      const key=`${source}:${e._id}`,service=e.service??e.employee?.department??null;
      const activities=source==='SpocEntry'?e.areas:[{key:e.category??e.type??'Work',update:e.notes??e.taskActivity??e.deliverable??e.drawing??'',hours:e.hours},...(e.otherHours??[]).map(r=>({key:'Other project',project:r.project,update:r.project?.name??'Saved other project',hours:r.hours}))];
      const notes=source==='SpocEntry'?(e.areas??[]).map(a=>`${a.key}: ${a.update??''} (${a.hours??0}h)`).join('\n'):e.notes;
      const allocations=[{key,component:'primary',project:e.project,stage:e.stage||null,service,hours:source==='WorkEntry'?e.hours:e.totalHours,activities:source==='WorkEntry'?activities.slice(0,1):activities,notes},
        ...(source==='WorkEntry'?(e.otherHours??[]).map((r,index)=>({key:`${key}:other:${index}`,component:'other',project:r.project,stage:null,service,hours:r.hours??0,activities:[activities[index+1]],notes:'Saved other-project hours; stage not recorded.'})):[])];
      const reportAllocations=allocations.filter(allocation=>!req.query.project || String(allocation.project?._id??allocation.project)===String(req.query.project));
      const reportHours=reportAllocations.reduce((sum,allocation)=>addHours(sum,allocation.hours),0);
      // Original project/stage/activities remain source context. Report
      // consumers use reportAllocations and reportHours for scoped summaries.
      return {...e,source,sourceId:String(e._id),key,sourceRecord:e,
        workDate:e.date?workDate(e.date):null,stage:e.stage||null,service,
        primaryHours:source==='WorkEntry'?e.hours:e.totalHours,
        hours:reportHours,reportHours,reportAllocations,activities,notes,
      };
    };
    const items=[...work.map(e=>normalize(e,'WorkEntry')),...spoc.map(e=>normalize(e,'SpocEntry'))]
      .sort((a,b)=>(Number(new Date(b.date))||0)-(Number(new Date(a.date))||0)||a.source.localeCompare(b.source)||b.sourceId.localeCompare(a.sourceId)).slice(offset,offset+limit);
    return res.json({items,total:workCount+spocCount,offset,limit,period:{from:req.query.date??req.query.from??null,to:req.query.date??req.query.to??null,timeZone:'Asia/Kolkata'}});
  }catch(err){next(err);}
}
