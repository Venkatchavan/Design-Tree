import { User } from '../models/User.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { canReadProject } from '../utils/projectScope.js';
import { uploadMany, sendDownload, removeFile } from '../utils/storage.js';

export const entryDocumentsUpload = uploadMany('files', 'work-documents', 5);
export function entryDocumentAccess(Model) {
  return async (req,res,next) => {
    try {
      const doc=await Model.findById(req.params.id);
      const me = Model === SpocEntry ? await User.findById(req.user.id).select('employee').lean() : null;
      const ownsSpoc = Model === SpocEntry && me?.employee && String(doc?.employee) === String(me.employee);
      if(!doc || (!ownsSpoc && !await canReadProject(req.user,doc.project)))return res.status(404).json({message:'Entry not found.'});
      if (req.method !== 'GET') {
        const me = await User.findById(req.user.id).select('employee').lean();
        const author = doc.createdBy ? String(doc.createdBy) === String(req.user.id) : me?.employee && String(doc.employee) === String(me.employee);
        if (!author) return res.status(403).json({message:'Only the entry author attaches documents.'});
      }
      req.workDocumentEntry=doc;return next();
    }catch(err){return next(err);}
  };
}
function discardNewUploads(req, referenced = []) {
  const saved = new Set(referenced.map(document => document.file));
  for (const file of req.files ?? []) {
    const stored = `work-documents/${file.filename}`;
    if (!saved.has(stored)) removeFile(stored);
  }
}
export async function attachEntryDocuments(req,res,next){
  try {
    const doc=req.workDocumentEntry;
    const additions=(req.files??[]).map(f=>({name:f.originalname,file:`work-documents/${f.filename}`}));
    const filter={_id:doc._id};
    if(req.body?.expectedVersion !== undefined) {
      const version=Number(req.body.expectedVersion);
      if(!Number.isInteger(version)||version<0) { discardNewUploads(req); return res.status(400).json({message:'Invalid document entry version.'}); }
      Object.assign(filter,version===0?{$or:[{__v:0},{__v:{$exists:false}}]}:{__v:version});
    }
    const item=await doc.constructor.findOneAndUpdate(filter,{$push:{documents:{$each:additions}},$inc:{__v:1}},{returnDocument:'after',runValidators:true});
    if(!item) { discardNewUploads(req); return res.status(409).json({message:'Work entry changed. Reload it before attaching documents.'}); }
    return res.status(201).json({item});
  }catch(err){
    // A post-write audit hook can also throw a validation error. Confirm
    // references before cleaning those files; ambiguous failures retain them.
    if (['ValidationError', 'CastError'].includes(err.name)) {
      try {
        const saved = await req.workDocumentEntry.constructor.findById(req.workDocumentEntry._id).select('documents').lean();
        discardNewUploads(req, saved?.documents ?? []);
      } catch { /* Unknown persistence outcome: preserve the upload. */ }
    }
    return next(err);
  }
}
export function downloadEntryDocument(req,res,next){
  const file=req.workDocumentEntry.documents?.[Number(req.params.index)];
  if(!file)return res.status(404).json({message:'Document not found.'});
  return sendDownload(res,file.file,next);
}
export const workDocumentAccess=entryDocumentAccess(WorkEntry);
export const spocDocumentAccess=entryDocumentAccess(SpocEntry);
