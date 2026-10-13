import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';

export default function StageApprovalPanel({ projectId, role }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['stage-approvals', projectId], queryFn: () => billingApi.stages({ project: projectId }) });
  const save = useMutation({ mutationFn: billingApi.saveStage, onSuccess: () => {
    for (const key of ['stage-approvals', 'project-stages', 'billing-status-stages', 'billing-stages']) qc.invalidateQueries({ queryKey: [key] });
  } });
  const flag = role === 'coordinator' ? 'confirmCompletion' : role === 'technical_director' ? 'approveCompletion' : '';
  const expected = role === 'coordinator' ? 'PTL Requested' : 'SPOC Confirmed';
  return <Panel title="Stage completion approvals" sub="PTL request → SPOC approval → Technical Director approval → Admin billing">
    {list.isError && <p role="alert">{list.error.message}</p>}
    {save.isError && <p role="alert">{save.error.message}</p>}
    <DataTable columns={[
      { key: 'service', label: 'Service' }, { key: 'stage', label: 'Stage' },
      { key: 'confirmationStatus', label: 'Approval' }, { key: 'billingReadiness', label: 'Billing status' },
      { key: 'approve', label: 'Action', render: r => flag && r.confirmationStatus === expected ? <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ project: projectId, service: r.service, stage: r.stage, [flag]: true })}>{role === 'coordinator' ? 'Confirm completion' : 'Approve for billing'}</button> : '—' },
    ]} rows={list.data?.items ?? []} emptyText="No stage completion requests yet." />
  </Panel>;
}
