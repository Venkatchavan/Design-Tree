import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../lib/api.js';
import { boqApi, areaApi } from '../lib/functionsApi.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';

export default function QSLogPage() {
  const [project, setProject] = useState('');
  const projects = useQuery({ queryKey: ['qs-log-projects'], queryFn: () => projectsApi.list({}) });
  const boq = useQuery({ queryKey: ['qs-log-boq', project], queryFn: () => boqApi.list({ project }), enabled: !!project });
  const area = useQuery({ queryKey: ['qs-log-area', project], queryFn: () => areaApi.list({ project }), enabled: !!project });
  const columns = [{ key: 'description', label: 'BOQ item' }, { key: 'qty', label: 'Quantity' }, { key: 'unit', label: 'Unit' }, { key: 'status', label: 'Status' }];
  const items = boq.data?.items ?? [];
  return <>
    <div className="page-head"><div className="page-title">QS Log</div><div className="page-sub">BOQ, area settlement and pending review by project</div></div>
    <label className="form-label">Project <select className="filter-select" value={project} onChange={e => setProject(e.target.value)}><option value="">Select project</option>{(projects.data?.items ?? []).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
    {[boq, area].filter(q => q.isError).map((q,i) => <p key={i} role="alert">{q.error.message}</p>)}
    <Panel title="BOQ log"><DataTable columns={columns} rows={items} emptyText={project ? 'No BOQ records.' : 'Select a project.'} /></Panel>
    <Panel title="Area settlement log"><DataTable columns={[{ key: 'zone', label: 'Zone / block' }, { key: 'initial', label: 'Initial area' }, { key: 'revised', label: 'Revised area' }, { key: 'status', label: 'Status' }]} rows={area.data?.items ?? []} emptyText="No area settlements." /></Panel>
    <Panel title="Pending review"><DataTable columns={columns} rows={items.filter(r => !['Approved', 'Closed'].includes(r.status))} emptyText="No BOQ items awaiting review." /><DataTable columns={[{key:'zone',label:'Area settlement'}, {key:'status',label:'Status'}]} rows={(area.data?.items ?? []).filter(r => r.status === 'Pending')} emptyText="No area settlements awaiting review." /></Panel>
  </>;
}
