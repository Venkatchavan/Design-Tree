import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deliverablesApi } from '../lib/workApi.js';
import { manualStage } from '../lib/processManual.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';
import StatusPill, { statusTone } from './StatusPill.jsx';

const idOf = (v) => (v == null ? '' : typeof v === 'object' ? String(v._id ?? v.id ?? '') : String(v));
const personName = (e) =>
  !e ? '—' : typeof e === 'string' ? e : [e.firstName, e.lastName].filter(Boolean).join(' ') || e.name || e.email || e.empId || '—';
const day = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};
const projectName = (p) => (typeof p === 'object' && p ? p.name ?? p.code ?? '—' : String(p ?? '—'));

// Read-only view of a project's deliverables and the log of every change made to
// them. Shown to the whole project team, so a list the Team Lead edits is the
// same list everyone works from.
//   projects: [{ _id, name, jobNumber }] the viewer can see
//   showList: also show the current list (default true)
export default function ProjectDeliverables({ projects = [], showList = true, myEmployeeId = '' }) {
  const [picked, setPicked] = useState('');
  const options = projects.map((p) => ({ id: idOf(p), label: [p.jobNumber, p.name ?? p.code].filter(Boolean).join(' · ') || '—' }));
  const projectId = picked && options.some((o) => o.id === picked) ? picked : options[0]?.id ?? '';

  const listQ = useQuery({
    queryKey: ['deliverables-project', projectId],
    queryFn: () => deliverablesApi.list({ project: projectId }),
    enabled: !!projectId && showList,
    refetchInterval: 15000,
  });
  const logQ = useQuery({
    queryKey: ['deliverables-log-project', projectId],
    queryFn: () => deliverablesApi.log({ project: projectId }),
    enabled: !!projectId,
    refetchInterval: 15000,
  });
  const rows = (listQ.data?.items ?? [])
    .filter((d) => idOf(d.project) === projectId)
    .sort((a, b) => String(manualStage(a.stage)).localeCompare(String(manualStage(b.stage))));
  const log = logQ.data?.items ?? [];

  if (options.length === 0) {
    return <Panel title="Deliverables"><EmptyState text="No projects to show deliverables for." /></Panel>;
  }

  return (
    <>
      {options.length > 1 && (
        <div className="form-row" style={{ maxWidth: 360 }}>
          <label className="form-label" htmlFor="deliverables-project">Project</label>
          <select id="deliverables-project" className="filter-select" style={{ width: '100%' }} value={projectId} onChange={(e) => setPicked(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}
      {showList && (
        <Panel title="List of deliverables" sub="Maintained by the Team Lead — the same list for everyone working on this project">
          {listQ.isLoading ? <EmptyState text="Loading deliverables…" /> : listQ.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
          ) : (
            <DataTable
              columns={[
                { key: 'stage', label: 'Stage', render: (d) => manualStage(d.stage) || '—' },
                { key: 'deliverable', label: 'Deliverable', render: (d) => d.deliverable ?? d.specify ?? '—' },
                {
                  key: 'assigned',
                  label: 'Assigned to',
                  render: (d) => {
                    const mine = myEmployeeId && idOf(d.assignedTo) === String(myEmployeeId);
                    return mine ? <b>{personName(d.assignedTo)} (you)</b> : d.assignedTo ? personName(d.assignedTo) : 'Unassigned';
                  },
                },
                { key: 'planned', label: 'Planned date', render: (d) => day(d.plannedDate) },
                { key: 'due', label: 'Due date', render: (d) => day(d.dueDate) },
                { key: 'status', label: 'Status', render: (d) => <StatusPill tone={statusTone(d.status)}>{d.status ?? '—'}</StatusPill> },
              ]}
              rows={rows}
              emptyText="No deliverables have been listed for this project yet."
            />
          )}
        </Panel>
      )}
      <Panel title="Deliverables log" sub="Every deliverable added, changed or removed from the list, newest first">
        {logQ.isLoading ? <EmptyState text="Loading log…" /> : logQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{logQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'when', label: 'When', render: (l) => (l.createdAt ? new Date(l.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—') },
              { key: 'project', label: 'Project', render: (l) => projectName(l.project) },
              { key: 'action', label: 'Action', render: (l) => l.action ?? '—' },
              { key: 'stage', label: 'Stage', render: (l) => manualStage(l.stage) || '—' },
              { key: 'deliverable', label: 'Deliverable', render: (l) => l.deliverable ?? '—' },
              { key: 'details', label: 'Details', render: (l) => l.details ?? '—' },
              { key: 'by', label: 'By', render: (l) => personName(l.by) },
            ]}
            rows={log}
            emptyText="Nothing has been logged for this project yet."
          />
        )}
      </Panel>
    </>
  );
}
