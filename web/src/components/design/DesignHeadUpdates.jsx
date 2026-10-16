import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, request, workEntriesApi } from '../../lib/api.js';
import { deliverablesApi, revisionsApi } from '../../lib/workApi.js';
import { rfiApi, visitsApi } from '../../lib/functionsApi.js';
import { allowanceApi } from '../../lib/phase4bApi.js';
import Panel from '../Panel.jsx';
import KpiCard from '../KpiCard.jsx';
import DataTable from '../DataTable.jsx';
import StatusPill from '../StatusPill.jsx';
import EmptyState from '../EmptyState.jsx';

const ON_TRACK_STATUSES = ['in progress', 'submitted', 'approved'];
const CLOSED_PERIOD_DAYS = 30;

const arr = (v) => (Array.isArray(v) ? v : (v?.items ?? []));
const normStatus = (v) => String(v ?? '').toLowerCase();

function fmtAssocDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function delivStatusLabel(s) {
  const t = String(s ?? '');
  if (t === 'Planned') return 'Not Started';
  if (t === 'Submitted') return 'Submitted awaiting Technical Director';
  return t || '—';
}

function rfiSourceOf(r) {
  const role = String(r.raisedBy?.role ?? '').toLowerCase();
  if (role === 'client') return 'Client';
  if (role === 'architect') return 'Architect';
  return r.team ?? 'Internal';
}

function rfiDisplayStatus(r) {
  return normStatus(r.status) === 'responded' ? 'Responded' : 'Pending';
}

export function DesignKpiRow() {
  const delsQ = useQuery({ queryKey: ['dmh-deliverables'], queryFn: () => deliverablesApi.list({}) });
  const rfisQ = useQuery({ queryKey: ['dmh-rfis'], queryFn: () => rfiApi.list({}) });
  const revsQ = useQuery({ queryKey: ['dmh-revisions'], queryFn: () => revisionsApi.list({}) });

  const delRows = useMemo(() => arr(delsQ.data), [delsQ.data]);
  const rfiRows = useMemo(() => arr(rfisQ.data), [rfisQ.data]);
  const revRows = useMemo(() => arr(revsQ.data), [revsQ.data]);

  const onTrack = delRows.filter((d) => ON_TRACK_STATUSES.includes(normStatus(d.status)));
  const openRfis = rfiRows.filter((r) => normStatus(r.status) === 'open');
  const submitted = delRows.filter((d) => normStatus(d.status) === 'submitted');
  const pendingTd = submitted.length + openRfis.length;

  const periodStart = new Date(new Date().toISOString().slice(0, 10));
  periodStart.setDate(periodStart.getDate() - CLOSED_PERIOD_DAYS);
  const inPeriod = (v) => {
    if (!v) return false;
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d >= periodStart;
  };
  const closedPeriod =
    rfiRows.filter((r) => normStatus(r.status) === 'closed' && inPeriod(r.updatedAt)).length +
    revRows.filter((r) => normStatus(r.status) === 'cleared' && inPeriod(r.clearedAt ?? r.updatedAt)).length +
    delRows.filter((d) => normStatus(d.status) === 'approved' && inPeriod(d.updatedAt)).length;

  const loadError = delsQ.error?.message ?? rfisQ.error?.message ?? revsQ.error?.message;

  return (
    <>
      <div className="kpi-grid cols-5">
        <KpiCard label="Deliverables tracked" value={delRows.length} accent="blueprint" />
        <KpiCard label="On track / submitted" value={onTrack.length} accent="forest" />
        <KpiCard label="RFIs / queries open" value={openRfis.length} accent="amber" />
        <KpiCard label="Pending Technical Director action" value={pendingTd} accent="rust" />
        <KpiCard label="Closed this period" value={closedPeriod} accent="teal" />
      </div>
      {loadError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{loadError}</div>
      )}
    </>
  );
}

export function TeamClientUpdates() {
  const projectsQ = useQuery({ queryKey: ['dmh-projects'], queryFn: () => projectsApi.list({}) });
  const delsQ = useQuery({ queryKey: ['dmh-deliverables'], queryFn: () => deliverablesApi.list({}) });
  const rfisQ = useQuery({ queryKey: ['dmh-rfis'], queryFn: () => rfiApi.list({}) });
  const meetsQ = useQuery({ queryKey: ['dmh-meetings'], queryFn: () => request('/api/meetings'), retry: false });
  const visitsQ = useQuery({ queryKey: ['dmh-visits'], queryFn: () => visitsApi.list({}), retry: false });
  const cabsQ = useQuery({ queryKey: ['dmh-cabs'], queryFn: () => allowanceApi.list({}), retry: false });
  const workQ = useQuery({ queryKey: ['dmh-work'], queryFn: () => workEntriesApi.list({}), retry: false });

  const projectRows = useMemo(() => arr(projectsQ.data), [projectsQ.data]);
  const delRows = useMemo(() => arr(delsQ.data), [delsQ.data]);
  const rfiRows = useMemo(() => arr(rfisQ.data), [rfisQ.data]);
  const meetRows = useMemo(() => arr(meetsQ.data), [meetsQ.data]);
  const visitRows = useMemo(() => arr(visitsQ.data), [visitsQ.data]);
  const cabRows = useMemo(
    () => arr(cabsQ.data).filter((r) => String(r.reqType ?? '') === 'Cab'),
    [cabsQ.data],
  );
  const workRows = useMemo(() => arr(workQ.data), [workQ.data]);

  const qsWorkRows = useMemo(() => {
    const qsIds = new Set();
    for (const p of projectRows) {
      if ((p.scope ?? []).some((s) => ['qs', 'quantity', 'estimation'].some((k) => String(s.service ?? '').toLowerCase().includes(k)))) {
        qsIds.add(String(p._id));
      }
    }
    return workRows
      .filter((e) => qsIds.has(String(e.project?._id ?? e.project ?? '')))
      .sort((a, b) => String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? '')))
      .slice(0, 20);
  }, [workRows, projectRows]);

  const recentVisits = useMemo(
    () => [...visitRows]
      .sort((a, b) => String(b.visitDate ?? b.date ?? b.createdAt ?? '').localeCompare(String(a.visitDate ?? a.date ?? a.createdAt ?? '')))
      .slice(0, 6),
    [visitRows],
  );

  const awaitingRows = useMemo(
    () => rfiRows.filter((r) => ['open', 'responded'].includes(normStatus(r.status))),
    [rfiRows],
  );

  const nextMeetingByProject = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const m = new Map();
    for (const mtg of meetRows) {
      if (String(mtg.status ?? '') === 'Cancelled') continue;
      const d = mtg.date ? String(mtg.date).slice(0, 10) : '';
      if (!d || d < todayKey) continue;
      const pid = String(mtg.project?._id ?? mtg.project ?? '');
      const cur = m.get(pid);
      if (!cur || d < cur.date) m.set(pid, { title: mtg.title ?? 'Meeting', date: d });
    }
    return m;
  }, [meetRows]);

  return (
    <>
      <Panel title="SPOC (Coordinator) activity" sub="Cab bookings and coordination alerts from the SPOC allocated to Design Management">
        {cabsQ.isLoading ? <EmptyState text="Loading…" /> : cabsQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{cabsQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtAssocDate(r.date) },
              { key: 'purpose', label: 'Meeting / purpose', render: (r) => r.purpose ?? r.description ?? '—' },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'route', label: 'Pickup → Drop', render: (r) => [r.pickup || r.route, r.drop].filter(Boolean).join(' → ') || '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
            ]}
            rows={cabRows}
            emptyText="No SPOC bookings yet."
          />
        )}
      </Panel>

      <Panel title="PTL updates" sub="Deliverables assigned across projects">
        <DataTable
          columns={[
            { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
            { key: 'deliverable', label: 'Deliverable', render: (r) => r.deliverable ?? '—' },
            { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={delivStatusLabel(r.status)}>{delivStatusLabel(r.status)}</StatusPill> },
          ]}
          rows={delRows}
          emptyText="No deliverables yet."
        />
      </Panel>

      <Panel title="QS updates" sub="Recent work log entries">
        {workQ.isLoading ? <EmptyState text="Loading…" /> : workQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{workQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtAssocDate(r.date) },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'workType', label: 'Work type', render: (r) => r.taskActivity ?? r.category ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status ?? 'Logged'}>{r.status ?? 'Logged'}</StatusPill> },
            ]}
            rows={qsWorkRows}
            emptyText="No QS entries yet."
          />
        )}
      </Panel>

      <Panel title="QA/QC updates" sub="Recent site visits">
        {visitsQ.isLoading ? <EmptyState text="Loading…" /> : visitsQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{visitsQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'visitId', label: 'Visit', render: (r) => r.visitId ?? String(r._id ?? r.id ?? '').slice(-6) },
              { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
              { key: 'visitType', label: 'Type', render: (r) => r.visitType ?? '—' },
              { key: 'date', label: 'Date', render: (r) => fmtAssocDate(r.visitDate ?? r.date ?? r.createdAt) },
            ]}
            rows={recentVisits}
            emptyText="No site visits yet."
          />
        )}
      </Panel>

      <Panel title="Client & Architect updates" sub="Items awaiting or recently given a response">
        <DataTable
          columns={[
            { key: 'source', label: 'From', render: (r) => rfiSourceOf(r) },
            { key: 'item', label: 'Item', render: (r) => r.description ?? '—' },
            { key: 'since', label: 'Since', render: (r) => fmtAssocDate(r.createdAt) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={rfiDisplayStatus(r)}>{rfiDisplayStatus(r)}</StatusPill> },
          ]}
          rows={awaitingRows}
          emptyText="Nothing awaiting response."
        />
      </Panel>

      <Panel title="Projects & meetings" sub="Every project the SPOC coordinates, with upcoming meetings">
        <DataTable
          columns={[
            { key: 'project', label: 'Project', render: (r) => r.name ?? '—' },
            { key: 'branch', label: 'Branch', render: (r) => r.branch ?? '—' },
            { key: 'stage', label: 'Stage', render: (r) => r.currentStage ?? '—' },
            { key: 'progress', label: 'Progress', render: (r) => (r.completion != null ? `${r.completion}%` : '—') },
            {
              key: 'next',
              label: 'Next meeting',
              render: (r) => {
                const n = nextMeetingByProject.get(String(r._id));
                return n ? `${n.title} (${fmtAssocDate(n.date)})` : '—';
              },
            },
          ]}
          rows={projectRows}
          emptyText="No projects yet."
        />
      </Panel>
    </>
  );
}
