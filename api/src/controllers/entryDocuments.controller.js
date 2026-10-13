import { User } from '../models/User.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { canReadProject } from '../utils/projectScope.js';
import { uploadMany, sendDownload } from '../utils/storage.js';

export const entryDocumentsUpload = uploadMany('files', 'work-documents', 5);
export function entryDocumentAccess(Model) {
  return async (req,res,next) => {
    try {
      const doc=await Model.findById(req.params.id);
      if(!doc || !await canReadProject(req.user,doc.project))return res.status(404).json({message:'Entry not found.'});
      if (req.method !== 'GET') {
        const me = await User.findById(req.user.id).select('employee').lean();
        const author = doc.createdBy ? String(doc.createdBy) === String(req.user.id) : me?.employee && String(doc.employee) === String(me.employee);
        if (!author) return res.status(403).json({message:'Only the entry author attaches documents.'});
      }
      req.workDocumentEntry=doc;return next();
    }catch(err){return next(err);}
  };
}
export async function attachEntryDocuments(req,res,next){
  try {
    const doc=req.workDocumentEntry;
    doc.documents.push(...(req.files??[]).map(f=>({name:f.originalname,file:`work-documents/${f.filename}`})));
    await doc.save();return res.status(201).json({item:doc});
  }catch(err){return next(err);}
}
export function downloadEntryDocument(req,res,next){
  const file=req.workDocumentEntry.documents?.[Number(req.params.index)];
  if(!file)return res.status(404).json({message:'Document not found.'});
  return sendDownload(res,file.file,next);
}
export const workDocumentAccess=entryDocumentAccess(WorkEntry);
export const spocDocumentAccess=entryDocumentAccess(SpocEntry);
