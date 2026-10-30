import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../lib/phase3Api.js';
import { dateOnly, calendarDays, today, varianceLabel } from '../lib/stageTimeline.js';
import Panel from './Panel.jsx';
import Modal from './Modal.jsx';
const NAMES = {
  CD: 'Concept Design',
  SD: 'Schematic Design',
  DD: 'Design Development',
  TD: 'Tender Design',
  GFC: 'Good for Construction'
};
const COLORS = {
  red: '#a12c28',
  green: '#1b6b49',
  amber: '#8c5900',
  blue: '#245d9c',
  grey: '#666'
};
function Chip({
  metrics
}) {
  return <span style={{
    color: COLORS[metrics.color],
    fontWeight: 600
  }}>{metrics.label}</span>;
}
function Approval({
  row
}) {
  const n = ['None', 'PTL Requested', 'SPOC Confirmed', 'TD Approved'].indexOf(row.confirmationStatus);
  return <><span aria-label={`${Math.max(n, 0)} of 3 approvals`}>{['PTL', 'SPOC', 'TD'].map((label, i) => <span key={label} style={{
        color: n > i ? '#1b6b49' : '#777'
      }}>{n > i ? '●' : '○'} {label}{i < 2 ? ' → ' : ''}</span>)}</span><br />{row.confirmationStatus === 'PTL Requested' ? 'PTL Completed' : row.confirmationStatus}</>;
}
export default function StageTimelinePanel({
  projectId
}) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const list = useQuery({
    queryKey: ['stage-approvals', projectId],
    queryFn: () => billingApi.timeline(projectId),
    enabled: !!projectId
  });
  const save = useMutation({
    mutationFn: billingApi.saveStage,
    onSuccess: result => {
      for (const key of ['stage-approvals', 'project-stages', 'billing-status-stages', 'billing-stages', 'notifications']) qc.invalidateQueries({
        queryKey: [key]
      });
      if (result.nextStage) {
        const target = result.nextStage;
        setDialog({
          mode: 'plan',
          row: {
            ...target,
            __v: target.expectedVersion
          },
          startDate: dateOnly(target.startDate) || target.defaultStartDate || '',
          plannedCompletion: dateOnly(target.plannedCompletion),
          reason: '',
          heading: `${result.item.stage} completed — Plan the ${target.stage} stage`,
          previous: target.previousActualCompletion
        });
      } else setDialog(null);
    }
  });
  const rows = list.data?.items ?? [],
    summaries = list.data?.summaries ?? [];
  function openPlan(row) {
    save.reset();
    setDialog({
      mode: 'plan',
      row,
      startDate: dateOnly(row.startDate) || row.planningTarget?.defaultStartDate || '',
      plannedCompletion: dateOnly(row.plannedCompletion),
      reason: '',
      heading: `${row.baselineCompletion ? 'Revise' : 'Plan'} the ${row.stage} stage`,
      previous: row.planningTarget?.previousActualCompletion
    });
  }
  function submit(event) {
    event.preventDefault();
    const {
      row,
      mode
    } = dialog;
    save.mutate({
      project: projectId,
      service: row.service,
      stage: row.stage,
      expectedVersion: row.__v ?? 0,
      ...(mode === 'plan' ? {
        planDates: true,
        startDate: dialog.startDate,
        plannedCompletion: dialog.plannedCompletion,
        ...(row.baselineCompletion ? {
          reason: dialog.reason
        } : {})
      } : {
        requestCompletion: true,
        actualCompletion: dialog.actualCompletion
      })
    });
  }
  function act(row, action) {
    save.reset();
    save.mutate({
      project: projectId,
      service: row.service,
      stage: row.stage,
      expectedVersion: row.__v ?? 0,
      [action]: true
    });
  }
  function action(row) {
    if (row.confirmationStatus === 'TD Approved' || row.billingReadiness === 'Billed') return '—';
    if (!row.isCurrent) return <span>Awaiting {row.currentStage}</span>;
    const p = row.permissions;
    if (!row.startDate || !row.plannedCompletion) return p.plan ? <button type="button" className="approve-btn" onClick={() => openPlan(row)}>Set dates</button> : <span>Dates not set</span>;
    if (p.request) return <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => {
      save.reset();
      setDialog({
        mode: 'submit',
        row,
        actualCompletion: today(),
        heading: `Submit ${row.stage} completion`
      });
    }}>Mark complete</button>;
    if (p.confirm) return <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => act(row, 'confirmCompletion')}>SPOC confirm</button>;
    if (p.approve) return <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => act(row, 'approveCompletion')}>TD approve</button>;
    return '—';
  }
  const duration = dialog?.mode === 'plan' ? calendarDays(dialog.plannedCompletion, dialog.startDate) : null;
  return <Panel title="Stage completion approvals" sub="PTL marks complete → assigned SPOC confirms → TD / ATD approves. Dates and variance use calendar days.">
    {list.isLoading && <p role="status">Loading stage timeline…</p>}
    {list.isError && <p role="alert">{list.error.message}</p>}
    {save.isError && !dialog && <p role="alert">{save.error.message}</p>}
    {summaries.map(s => <div key={s.service} className="stage-summary" style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 14
    }} aria-label={`${s.service} stage summary`}><b>{s.service}</b><span>Stages completed: {s.completed} / {s.total}</span><span>On time / early: {s.onTime}</span><span>Delayed: {s.delayed}</span><span>Net variance: {s.netVariance} d</span><span>Original baseline: {s.baselineNetVariance} d</span><span>Current stage: {s.currentStage ?? 'All completed'} · {s.currentStatus}</span></div>)}
    {!list.isLoading && !list.isError && rows.length === 0 && <p>No services or stages on this project yet.</p>}
    {rows.length > 0 && <div style={{
      overflowX: 'auto'
    }}><table className="data stage-timeline"><thead><tr>{['Service', 'Stage', 'PTL / SPOC / TD', 'Start Date', 'Planned Completion', 'Actual Completion', 'Variance', 'Billing Status', 'Complete Stage'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={`${row.service}-${row.stage}`} data-service={row.service} data-stage={row.stage} aria-current={row.isCurrent ? 'step' : undefined} style={row.isCurrent ? {
            background: '#eef5ff'
          } : undefined}>
      <td>{row.service}</td><td>{row.stage} – {NAMES[row.stage]}</td><td><Approval row={row} /></td>
      <td>{dateOnly(row.startDate) || (row.planningTarget.previousStage ? `Set on ${row.planningTarget.previousStage} completion` : 'Dates not set')}</td>
      <td>{dateOnly(row.plannedCompletion) || '—'}{row.metrics.plannedDuration !== null && <small style={{
                display: 'block'
              }}>{row.metrics.plannedDuration} d planned</small>}{row.plannedCompletion && row.permissions.plan && <button type="button" className="approve-btn" onClick={() => openPlan(row)}>Edit dates</button>}</td>
      <td>{dateOnly(row.actualCompletion) || '—'}{row.metrics.actualDuration !== null && <small style={{
                display: 'block'
              }}>{row.metrics.actualDuration} d taken</small>}</td>
      <td><Chip metrics={row.metrics} />{row.baselineCompletion && dateOnly(row.baselineCompletion) !== dateOnly(row.plannedCompletion) && <small style={{
                display: 'block'
              }}>Original baseline {dateOnly(row.baselineCompletion)}: {row.actualCompletion ? varianceLabel(row.actualCompletion, row.baselineCompletion) : 'submission pending'}</small>}{row.planRevisions?.length > 0 && <details><summary>{row.planRevisions.length} revision(s)</summary>{row.planRevisions.map((rev, i) => <p key={i}>{dateOnly(rev.at)}: {dateOnly(rev.previousPlannedCompletion)} → {dateOnly(rev.plannedCompletion)} · {rev.reason}</p>)}</details>}</td>
      <td>{row.billingReadiness}</td><td>{action(row)}</td>
    </tr>)}</tbody></table></div>}
    {dialog && <Modal title={dialog.heading} onClose={() => {
      if (!save.isPending) setDialog(null);
    }}><form onSubmit={submit}>
      <p>{dialog.row.service} · {dialog.row.stage} – {NAMES[dialog.row.stage]}</p>
      {dialog.mode === 'plan' ? <>
        <p>Previous stage submission: {dateOnly(dialog.previous) || 'Unknown / not recorded'}</p>
        <label className="form-row">Start Date<input className="form-input" type="date" required min={dateOnly(dialog.previous) || undefined} value={dialog.startDate} onChange={e => setDialog({
              ...dialog,
              startDate: e.target.value
            })} /></label>
        <label className="form-row">Expected Completion Date<input className="form-input" type="date" required min={dialog.startDate || undefined} value={dialog.plannedCompletion} onChange={e => setDialog({
              ...dialog,
              plannedCompletion: e.target.value
            })} /></label>
        <p aria-live="polite">Planned duration: {duration !== null ? `${duration} days (${(duration / 7).toFixed(1)} weeks)` : 'Enter both dates'}</p>
        {dialog.row.baselineCompletion && <><p>Locked original baseline: {dateOnly(dialog.row.baselineCompletion)}</p><label className="form-row">Revision reason<input className="form-input" required value={dialog.reason} onChange={e => setDialog({
                ...dialog,
                reason: e.target.value
              })} /></label></>}
      </> : <>
        <label className="form-row">Actual Completion Date<input className="form-input" type="date" required min={dateOnly(dialog.row.startDate)} max={today()} value={dialog.actualCompletion} onChange={e => setDialog({
              ...dialog,
              actualCompletion: e.target.value
            })} /></label>
        <p aria-live="polite">Variance: {varianceLabel(dialog.actualCompletion, dialog.row.plannedCompletion)}</p>
      </>}
      {save.isError && <p role="alert">{save.error.message} Refresh the timeline if another user changed this stage.</p>}
      <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 12
        }}><button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : dialog.mode === 'plan' ? 'Save dates' : 'Submit completion'}</button><button type="button" className="approve-btn" disabled={save.isPending} onClick={() => setDialog(null)}>{dialog.mode === 'plan' ? 'Remind me later' : 'Cancel'}</button></div>
    </form></Modal>}
  </Panel>;
}
