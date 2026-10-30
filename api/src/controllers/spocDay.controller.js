import { addHours } from '../utils/workHours.js';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { SpocEntry } from '../models/SpocEntry.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { spocEntrySchema } from '../validation/phase2.schema.js';
import { canReadProject } from '../utils/projectScope.js';
import { dayStart } from '../utils/workDates.js';

// Deliberately no generic super-role bypass: directors are observers.
export function requireSpocWriter(req, res, next) {
  if (!['coordinator', 'design_mgmt_head'].includes(req.user?.role)) return res.status(403).json({ message: 'Only SPOC work owners may record or correct their daily work.' });
  next();
}
const rowSchema = spocEntrySchema.omit({ employee: true }).extend({
  revisionStatus: spocEntrySchema.shape.revisionStatus.nullable(),
  id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  expectedVersion: z.number().int().min(0).optional(),
  clientKey: z.string().min(1).max(120).optional(),
}).strict();
const snapshot = doc => Object.fromEntries(['date','project','service','areas','revisionNo','revisionStatus','revisionRemarks','totalHours','documents','employee','createdBy'].map(key => [key, doc[key] ?? null]));
const fail = (status,message) => Object.assign(new Error(message), {status});

async function prepare(req, rows, date) {
  const me = await User.findById(req.user.id).select('employee');
  if (!me?.employee) throw fail(400, 'No linked employee record.');
  const seen = new Set(), sourceIds = new Set(); const prepared=[];
  for (const row of rows) {
    const parsed=rowSchema.safeParse(row);
    if(!parsed.success) throw fail(400,'Invalid daily work row.');
    const {id, expectedVersion, clientKey, ...data}=parsed.data;
    const identity=id || clientKey;
    if (!identity || seen.has(identity) || (id && expectedVersion === undefined)) throw fail(400,'Each row needs a unique id and expectedVersion, or a unique clientKey.');
    seen.add(identity);
    if(date) data.date=dayStart(date);
    else if(data.date === undefined && !id) data.date=new Date();
    if (typeof row.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) data.date=dayStart(row.date);
    const old=id ? await SpocEntry.findById(id).lean() : null;
    if(id && !old) throw fail(404,'Work entry not found.');
    if(old && String(old.employee)!==String(me.employee)) throw fail(403,'Correct only your own daily work.');
    if(old && (old.__v ?? 0)!==expectedVersion) throw fail(409,'This work entry changed. Reload it before correcting.');
    // Old projects remain correctable even if allocation has since ended.
    if(!old || String(old.project)!==data.project) {
      if(!await canReadProject(req.user,data.project)) throw fail(403,'Project is not assigned to you.');
      if(!await Project.exists({_id:data.project})) throw fail(400,'Project not found.');
    }
    data.totalHours=data.areas.reduce((sum,a)=>addHours(sum,a.hours),0);
    if(!Number.isFinite(data.totalHours)) throw fail(400,'Invalid hours.');
    const creationHash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existing=!id ? await SpocEntry.findOne({employee:me.employee,clientKey}).lean() : null;
    const sourceId=String(old?._id ?? existing?._id ?? '');
    if(sourceId && sourceIds.has(sourceId)) throw fail(400,'A saved entry may appear only once in a day save.');
    if(sourceId) sourceIds.add(sourceId);
    if(existing && existing.creationHash!==creationHash) throw fail(409,'Creation key already belongs to different work. Reload saved entries.');
    prepared.push({id,expectedVersion,clientKey,data,old,existing,creationHash,employee:me.employee});
  }
  return prepared;
}
async function persist(req, row) {
  const {id,expectedVersion,clientKey,data,old,existing,creationHash,employee}=row;
  if(existing) return {id: String(existing._id),clientKey,status:'saved',item:existing};
  if(!id) {
    try {
      const item=await SpocEntry.create({...data,employee,createdBy:req.user.id,clientKey,creationHash});
      return {clientKey,status:'saved',item};
    } catch(err) {
      if(err.code!==11000) throw err;
      const item=await SpocEntry.findOne({employee,clientKey}).lean();
      if(item?.creationHash===creationHash) return {clientKey,status:'saved',item};
      return {clientKey,status:'conflict',message:'Creation key conflict.'};
    }
  }
  const version=expectedVersion===0 ? {$or:[{__v:0},{__v:{$exists:false}}]} : {__v:expectedVersion};
  const item=await SpocEntry.findOneAndUpdate({_id:id,employee,...version},{
    $set:data,$inc:{__v:1},$push:{history:{actor:req.user.id,at:new Date(),previous:snapshot(old),updated:snapshot({...old,...data})}},
  },{returnDocument:'after',runValidators:true});
  return item ? {id,status:'saved',item} : {id,status:'conflict',message:'Entry changed during save. Reload before retrying this row.'};
}
export async function saveSpocDay(req,res,next) {
  try {
    const schema=z.object({date:z.string(),rows:z.array(rowSchema.omit({date:true})).min(1)}).strict();
    const body=schema.safeParse(req.body);
    if(!body.success) return res.status(400).json({message:'Invalid day data.'});
    dayStart(body.data.date);
    const prepared=await prepare(req,body.data.rows,body.data.date);
    // Standalone Mongo supports atomic individual entries. Never promise a day transaction.
    const results=[];
    for(const row of prepared) {
      try {results.push(await persist(req,row));}
      catch(err) {results.push({id:row.id,clientKey:row.clientKey,status:'failed',message:err.message});}
    }
    const complete=results.every(r=>r.status==='saved');
    return res.status(complete?200:207).json({complete,results});
  }catch(err){if(err.status || err.message.includes('date')) return res.status(err.status ?? 400).json({message:err.message});next(err);}
}
export async function updateSpocEntry(req,res,next) {
  try {
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({message:'Invalid entry id.'});
    const [row]=await prepare(req,[{...req.body,id:req.params.id}]);
    const result=await persist(req,row);
    return res.status(result.status==='saved'?200:409).json(result);
  }catch(err){if(err.status || err.message.includes('date')) return res.status(err.status ?? 400).json({message:err.message});next(err);}
}
