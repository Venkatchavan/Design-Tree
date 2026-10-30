import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, meApi } from '../lib/api.js';

export default function EntryDocuments({ entry, spoc = false, readOnly = false, onUploaded }) {
  const me=useQuery({queryKey:['me'],queryFn:meApi});
  const mine=String(entry.createdBy ?? '')===String(me.data?.user?.id ?? '') || String(entry.employee?._id ?? entry.employee ?? '')===String(me.data?.user?.employee ?? '');
  const qc=useQueryClient();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const path=spoc?`/api/spoc/entries/${entry._id}/documents`:`/api/work-entries/${entry._id}/documents`;
  async function upload(files){
    if(!files.length)return;setBusy(true);setError('');
    try{const body=new FormData();for(const f of files)body.append('files',f);
      if(entry.expectedVersion !== undefined) body.append('expectedVersion',String(entry.expectedVersion));
      const res=await fetch(`${API_BASE}${path}`,{method:'POST',credentials:'include',body});
      const data=await res.json();if(!res.ok)throw new Error(data.message);onUploaded?.(data.item);qc.invalidateQueries();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div>
    {(entry.documents??[]).map((d,i)=><p key={d.file}><a href={`${API_BASE}${path}/${i}`} download>{d.name}</a></p>)}
    {mine && !readOnly && <label className="form-label">Attach documents <input aria-label="Attach work documents" type="file" multiple disabled={busy} onChange={e=>upload([...(e.target.files??[])])}/></label>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
