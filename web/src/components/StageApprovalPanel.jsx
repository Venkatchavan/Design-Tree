import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import { projectsApi } from '../lib/api.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';

const ALL_STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];

function keyOf(service, stage) {
  return `${String(service ?? '').toLowerCase()}||${String(stage ?? '').toLowerCase()}`;
}

// Individual project view: PTL (team_lead) requests completion,
// SPOC (coordinator) confirms, TD / ATD marks complete + approves.
// Every action notifies all related project users (backend fan-out).
export default function StageApprovalPanel({ projectId, role }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['stage-approvals', projectId], queryFn: () => billingApi.stages({ project: projectId }) });
  const projectQ = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId), enabled: !!projectId });
  const save = useMutation({
    mutationFn: billingApi.saveStage,
    onSuccess: () => {
      for (const key of ['stage-approvals', 'project-stages', 'billing-status-stages', 'billing-stages']) qc.invalidateQueries({ queryKey: [key] });
    },
  });

  const rows = list.data?.items ?? [];
  const byKey = new Map(rows.map((r) => [keyOf(r.service, r.stage), r]));
  const project = projectQ.data?.project ?? {};
  const services = [...new Set([...(project.services ?? []), ...rows.map((r) => r.service).filter(Boolean)])];
  const grid = services.length > 0
    ? services.flatMap((service) => ALL_STAGES.map((stage) => byKey.get(keyOf(service, stage)) ?? { service, stage, confirmationStatus: 'None', billingReadiness: '—', _pending: true }))
    : rows;

  const canAct = ['team_lead', 'coordinator', 'technical_director', 'assoc_technical_director'].includes(role);

  function actionFor(r) {
    if (!canAct || r.confirmationStatus === 'TD Approved' || r.billingReadiness === 'Billed') return '—';
    if (role === 'team_lead') {
      if (!r._pending && !['None'].includes(r.confirmationStatus)) return r.confirmationStatus === 'PTL Requested' ? 'Sent to SPOC' : r.confirmationStatus;
      return (
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ project: projectId, service: r.service, stage: r.stage, requestCompletion: true })}>
          Mark complete
        </button>
      );
    }
    if (role === 'coordinator') {
      if (r.confirmationStatus !== 'PTL Requested') return '—';
      return (
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ project: projectId, service: r.service, stage: r.stage, confirmCompletion: true })}>
          Confirm completion
        </button>
      );
    }
    if (role === 'technical_director' || role === 'assoc_technical_director') {
      return (
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ project: projectId, service: r.service, stage: r.stage, approveCompletion: true })}>
          Mark complete
        </button>
      );
    }
    return '—';
  }

  return (
    <Panel title="Stage completion approvals" sub="PTL marks complete → SPOC confirms → TD / ATD marks complete, per stage and service. Everyone related is notified.">
      {list.isError && <p role="alert">{list.error.message}</p>}
      {save.isError && <p role="alert">{save.error.message}</p>}
      <DataTable
        columns={[
          { key: 'service', label: 'Service' },
          { key: 'stage', label: 'Stage' },
          { key: 'confirmationStatus', label: 'PTL / SPOC / TD' },
          { key: 'billingReadiness', label: 'Billing status' },
          { key: 'action', label: 'Complete stage', render: actionFor },
        ]}
        rows={grid}
        emptyText="No services or stages on this project yet."
      />
    </Panel>
  );
}
