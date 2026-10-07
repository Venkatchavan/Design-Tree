import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  bootstrapApi,
  employeesApi,
  meApi,
  teamsApi,
  workEntriesApi,
} from '../lib/api.js';
import {
  deliverablesApi,
  drawingsApi,
  recruitmentApi,
  revisionsApi,
  tasksApi,
  teamsMineApi,
} from '../lib/workApi.js';
import { transmittalsApi } from '../lib/phase3Api.js';
import { SUPER_ROLES } from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import KpiCard from '../components/KpiCard.jsx';

const TL_CHAIN = new Set(['team_lead', 'assoc_technical_director', 'technical_director']);
const REV_CREATE_ROLES = new Set([
  'team_lead',
  'assoc_technical_director',
  'technical_director',
  'qaqc',
  'qa_qc',
  'peer_reviewer',
]);

function isSuper(role) {
  return SUPER_ROLES.includes(role);
}
function canApproveRole(role) {
  return TL_CHAIN.has(role) || isSuper(role);
}
function canDeliverAddRole(role) {
  return role === 'assoc_technical_director' || isSuper(role);
}
function canRevisionCreateRole(role) {
  return REV_CREATE_ROLES.has(role) || isSuper(role);
}
function canRecruitStatusRole(role) {
  return role === 'hr' || isSuper(role);
}

function toneFor(status) {
  const s = String(status ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'open') return 'amber';
  if (s === 'resubmitted') return 'teal';
  if (s === 'cleared') return 'forest';
  if (s === 'submitted') return 'teal';
  if (s === 'inprogress' || s === 'in-progress') return 'blueprint';
  return statusTone(status);
}

function wuDisplay(e) {
  return e?.wuNo ?? e?.refNo ?? '—';
}
function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
}
function memberEmp(m) {
  if (!m) return null;
  return typeof m.employee === 'object' && m.employee ? m.employee : null;
}
function memberName(m) {
  const e = memberEmp(m);
  if (e) return empName(e);
  return String(m?.employee ?? '—');
}
function memberId(m) {
  const e = memberEmp(m);
  return String(e?._id ?? e?.id ?? m?.employee ?? '');
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}
function idOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}

function useBootstrapProp(prop) {
  const q = useQuery({ queryKey: ['bootstrap'], queryFn: bootstrapApi, enabled: !prop });
  return prop ?? q.data ?? null;
}

export default function MyTeamPage({ bootstrap: bootstrapProp }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const role = bootstrap?.role?.key ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const superUser = isSuper(role);
  const canApprove = canApproveRole(role);
  const canDeliverAdd = canDeliverAddRole(role);
  const canRevCreate = canRevisionCreateRole(role);
  const canRecruitStatus = canRecruitStatusRole(role);

  const [tab, setTab] = useState('overview');
  const [selId, setSelId] = useState('');
  const [allocOpen, setAllocOpen] = useState(false);
  const [decideEntry, setDecideEntry] = useState(null);
  const [drawingOpen, setDrawingOpen] = useState(false);

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const me = meQ.data?.user ?? meQ.data ?? null;
  const meId = String(me?._id ?? me?.id ?? '');

  const teamsQ = useQuery({
    queryKey: ['my-teams', { role, super: superUser }],
    queryFn: () => (superUser ? teamsApi.list() : teamsMineApi.list()),
  });
  const teams = useMemo(() => {
    const d = teamsQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.items ?? d.teams ?? [];
  }, [teamsQ.data]);

  const selectedTeam = useMemo(() => {
    if (teams.length === 0) return null;
    if (selId) {
      const hit = teams.find((t) => String(t._id ?? t.id) === String(selId));
      if (hit) return hit;
    }
    return teams[0];
  }, [teams, selId]);
  const selectedId = selectedTeam ? String(selectedTeam._id ?? selectedTeam.id) : '';
  const teamProjects = selectedTeam?.projects ?? [];
  const teamProjectIds = useMemo(
    () => new Set(teamProjects.map((p) => String(p._id ?? p.id))),
    [teamProjects],
  );
  const members = selectedTeam?.members ?? [];

  const entriesQ = useQuery({
    queryKey: ['team-work-entries', selectedId],
    queryFn: () => workEntriesApi.list({ team: selectedId }),
    enabled: !!selectedId,
  });
  const entries = entriesQ.data?.items ?? [];

  const tasksQ = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.list({}) });
  const allTasks = tasksQ.data?.items ?? [];
  const myAssignedTasks = useMemo(
    () =>
      allTasks.filter((t) => {
        const cb = t.createdBy;
        const cbId = typeof cb === 'object' && cb ? String(cb._id ?? cb.id ?? '') : String(cb ?? '');
        return cbId && meId && cbId === meId;
      }),
    [allTasks, meId],
  );

  const revQ = useQuery({ queryKey: ['revisions'], queryFn: () => revisionsApi.list({}) });
  const allRevisions = revQ.data?.items ?? [];
  const teamRevisions = useMemo(() => {
    if (teamProjectIds.size === 0) return allRevisions;
    return allRevisions.filter((r) => teamProjectIds.has(idOf(r.project)));
  }, [allRevisions, teamProjectIds]);

  const delivQ = useQuery({ queryKey: ['deliverables'], queryFn: () => deliverablesApi.list({}) });
  const allDeliverables = delivQ.data?.items ?? [];
  const teamDeliverables = useMemo(() => {
    if (teamProjectIds.size === 0) return allDeliverables;
    return allDeliverables.filter((d) => teamProjectIds.has(idOf(d.project)));
  }, [allDeliverables, teamProjectIds]);

  const drawingsQ = useQuery({ queryKey: ['drawings'], queryFn: () => drawingsApi.list({}) });
  const allDrawings = drawingsQ.data?.items ?? [];
  const teamDrawings = useMemo(() => {
    if (teamProjectIds.size === 0) return allDrawings;
    return allDrawings.filter((d) => teamProjectIds.has(idOf(d.project)));
  }, [allDrawings, teamProjectIds]);

  const recruitQ = useQuery({
    queryKey: ['recruitment-mine'],
    queryFn: () => recruitmentApi.list({ mine: true }),
  });
  const myRecruit = recruitQ.data?.items ?? [];

  const trQ = useQuery({ queryKey: ['transmittals-team'], queryFn: () => transmittalsApi.teamScope() });
  const teamTransmittals = useMemo(() => {
    const all = trQ.data?.items ?? [];
    if (teamProjectIds.size === 0) return all;
    return all.filter((t) => {
      const p = t.drawing?.project;
      return teamProjectIds.has(String(p?._id ?? p ?? ''));
    });
  }, [trQ.data, teamProjectIds]);
  const transmittedDrawingIds = useMemo(
    () => new Set(teamTransmittals.map((t) => String(t.drawing?._id ?? t.drawing ?? ''))),
    [teamTransmittals],
  );
  const awaitingDrawings = useMemo(
    () => teamDrawings.filter((d) => d.stage === 'GFC' && !transmittedDrawingIds.has(String(d._id ?? d.id ?? ''))),
    [teamDrawings, transmittedDrawingIds],
  );
  const trProgress = useMemo(() => {
    const byProject = new Map();
    for (const t of teamTransmittals) {
      const p = t.drawing?.project;
      const key = String(p?._id ?? p ?? '—');
      const name = p?.name ?? '—';
      if (!byProject.has(key)) byProject.set(key, { project: name, acknowledged: 0, active: 0, total: 0 });
      const row = byProject.get(key);
      row.total += 1;
      if (t.status === 'Acknowledged') row.acknowledged += 1;
      else row.active += 1;
    }
    return [...byProject.values()];
  }, [teamTransmittals]);

  const delivLogQ = useQuery({
    queryKey: ['deliverables-log', selectedId],
    queryFn: () =>
      deliverablesApi.log(
        teamProjects[0] ? { project: teamProjects[0]._id ?? teamProjects[0].id } : {},
      ),
    enabled: teamProjects.length > 0,
  });
  const delivLog = delivLogQ.data?.items ?? delivLogQ.data?.log ?? [];

  const weekHours = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const map = new Map();
    for (const e of entries) {
      const d = e.date ? new Date(e.date) : null;
      if (d && !Number.isNaN(d.getTime()) && d < cutoff) continue;
      const emp = e.employee;
      const key = typeof emp === 'object' && emp ? String(emp._id ?? emp.id ?? empName(emp)) : String(emp ?? '—');
      const label = typeof emp === 'object' && emp ? empName(emp) : String(emp ?? '—');
      const cur = map.get(key) ?? { name: label, hours: 0, count: 0 };
      cur.hours += Number(e.hours ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [entries]);

  const pendingEntries = useMemo(
    () => entries.filter((e) => String(e.status ?? '').toLowerCase() === 'pending'),
    [entries],
  );
  const openRevisions = useMemo(
    () => teamRevisions.filter((r) => String(r.status ?? '').toLowerCase() === 'open'),
    [teamRevisions],
  );

  const decide = useMutation({
    mutationFn: ({ id, status, remark }) => workEntriesApi.decide(id, { status, remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setDecideEntry(null);
    },
  });

  const taskStatus = useMutation({
    mutationFn: ({ id, status }) => tasksApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-mine'] });
    },
  });

  const revStatus = useMutation({
    mutationFn: ({ id, status }) => revisionsApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisions'] });
      queryClient.invalidateQueries({ queryKey: ['revisions-mine'] });
    },
  });

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'project-team', label: 'Project & team' },
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'assign', label: 'Assign work' },
    ...(canDeliverAdd ? [{ key: 'deliverables-add', label: 'Deliverables (add)' }] : []),
    { key: 'awaiting', label: 'Awaiting response' },
    { key: 'deliverables', label: 'List of deliverables' },
    { key: 'revisions', label: 'Revision log' },
    { key: 'revision-entry', label: 'Revision entry' },
    { key: 'drawings', label: 'Drawing register' },
    { key: 'transmittal', label: 'Transmittal status' },
    { key: 'recruitment', label: 'Recruitment' },
  ];

  return (
    <>
      <div className="page-head">
        <div className="page-title">My team</div>
        <div className="page-sub">
          {teamsQ.isLoading ? 'Loading…' : `${teams.length} team(s) · role ${role || '—'}`}
        </div>
      </div>
      {teamsQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {teamsQ.error.message}
        </div>
      )}
      {teams.length > 1 && (
        <div className="form-row" style={{ maxWidth: 360 }}>
          <label className="form-label">Team</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={selectedId}
            onChange={(e) => setSelId(e.target.value)}
          >
            {teams.map((t) => (
              <option key={String(t._id ?? t.id)} value={String(t._id ?? t.id)}>
                {t.name ?? '—'}
              </option>
            ))}
          </select>
        </div>
      )}
      {!selectedTeam ? (
        <EmptyState text={teamsQ.isLoading ? 'Loading…' : 'No team assigned yet.'} />
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'overview' && (
            <>
              <div className="kpi-grid">
                <KpiCard label="Projects" value={teamProjects.length} accent="blueprint" />
                <KpiCard label="Members" value={members.length} accent="forest" />
                <KpiCard label="Team entries" value={entries.length} accent="amber" />
                <KpiCard label="Pending approval" value={pendingEntries.length} accent="rust" />
              </div>
              <Panel title="My projects">
                {teamProjects.length === 0 ? (
                  <EmptyState text="No projects linked to this team." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Project', render: (p) => p.name ?? '—' },
                      { key: 'code', label: 'Code' },
                      { key: 'branch', label: 'Branch' },
                      { key: 'currentStage', label: 'Stage', render: (p) => p.currentStage ?? p.stage ?? '—' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (p) => <StatusPill tone={toneFor(p.status)}>{p.status ?? '—'}</StatusPill>,
                      },
                    ]}
                    rows={teamProjects}
                    emptyText="No projects linked to this team."
                  />
                )}
              </Panel>
              <Panel title="Recent team activity">
                {entriesQ.isLoading ? (
                  <EmptyState text="Loading…" />
                ) : entriesQ.isError ? (
                  <div className="login-error" role="alert" style={{ display: 'block' }}>
                    {entriesQ.error.message}
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                      { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                      { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                      { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
                      { key: 'hours', label: 'Hours' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
                      },
                    ]}
                    rows={entries.slice(0, 20)}
                    emptyText="No team activity yet."
                  />
                )}
              </Panel>
            </>
          )}

          {tab === 'project-team' && (
            <Panel title={`Members — ${selectedTeam.name ?? ''}`}>
              {members.length === 0 ? (
                <EmptyState text="No members in this team yet." />
              ) : (
                <div className="teams-grid">
                  {members.map((m, i) => {
                    const e = memberEmp(m);
                    return (
                      <div className="team-card" key={memberId(m) || i}>
                        <div className="team-card-head">
                          <span className="team-card-name">{memberName(m)}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
                          {[e?.designation, e?.empId].filter(Boolean).join(' · ') || '—'}
                        </div>
                        <div className="deliv-label">
                          Allocation: {m.allocation ?? '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button type="button" className="approve-btn" onClick={() => setAllocOpen(true)}>
                  Edit allocations
                </button>
                <button
                  type="button"
                  className="approve-btn"
                  onClick={() => navigate(`/teams/${selectedId}`)}
                >
                  Manage roster in Teams →
                </button>
              </div>
            </Panel>
          )}

          {tab === 'monitoring' && (
            <>
              <Panel title="Member week-hours (last 7 days, from team entries)">
                {weekHours.length === 0 ? (
                  <EmptyState text="No hours logged in the last 7 days." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Member' },
                      { key: 'hours', label: 'Hours', render: (r) => Number(r.hours ?? 0).toFixed(1) },
                      { key: 'count', label: 'Entries' },
                    ]}
                    rows={weekHours}
                    emptyText="No hours logged in the last 7 days."
                  />
                )}
              </Panel>
              <Panel title="Team work items">
                <DataTable
                  columns={[
                    { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                    { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                    { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                    { key: 'stage', label: 'Stage', render: (e) => e.stage ?? '—' },
                    { key: 'hours', label: 'Hours' },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
                    },
                  ]}
                  rows={entries}
                  emptyText="No work items for this team."
                />
              </Panel>
              <Panel title="Weekly approval">
                {!canApprove ? (
                  <EmptyState text="Approval actions are available to team leads and directors." />
                ) : pendingEntries.length === 0 ? (
                  <EmptyState text="No entries pending approval." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                      { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                      { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                      { key: 'hours', label: 'Hours' },
                      { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
                      {
                        key: 'actions',
                        label: 'Decision',
                        render: (e) => (
                          <span style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="approve-btn"
                              onClick={() => setDecideEntry(e)}
                            >
                              Take action
                            </button>
                          </span>
                        ),
                      },
                    ]}
                    rows={pendingEntries}
                    emptyText="No entries pending approval."
                  />
                )}
              </Panel>
            </>
          )}

          {tab === 'assign' && (
            <AssignWorkPanel
              members={members}
              teamProjects={teamProjects}
              myTasks={myAssignedTasks}
              canApprove={canApprove}
              taskStatus={taskStatus}
            />
          )}

          {tab === 'deliverables-add' && (
            <DeliverableAddPanel teamProjects={teamProjects} members={members} />
          )}

          {tab === 'awaiting' && (
            <Panel title="Awaiting response (derived)">
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 12 }}>
                Derived client-side: Pending work entries for my team + Open revisions for team
                projects. Not a server queue.
              </p>
              <div className="section-label">Pending entries ({pendingEntries.length})</div>
              <DataTable
                columns={[
                  { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
                  { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                  { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
                  },
                ]}
                rows={pendingEntries}
                emptyText="No pending entries."
              />
              <div className="section-label" style={{ marginTop: 16 }}>
                Open revisions ({openRevisions.length})
              </div>
              <DataTable
                columns={[
                  { key: 'drawing', label: 'Drawing', render: (r) => r.drawing ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                  { key: 'revNo', label: 'Rev', render: (r) => r.revNo ?? '—' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill>,
                  },
                ]}
                rows={openRevisions}
                emptyText="No open revisions."
              />
            </Panel>
          )}

          {tab === 'deliverables' && (
            <>
              <DeliverableCrudPanel rows={teamDeliverables} />
              <Panel title="Deliverables log">
                {delivLog.length === 0 ? (
                  <EmptyState text="No deliverables log yet." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'deliverable', label: 'Deliverable', render: (r) => r.deliverable ?? r.title ?? '—' },
                      { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                      { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                      { key: 'status', label: 'Status', render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill> },
                    ]}
                    rows={delivLog}
                    emptyText="No deliverables log yet."
                  />
                )}
              </Panel>
            </>
          )}

          {tab === 'revisions' && (
            <Panel title="Revision log">
              {!canApprove && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 12 }}>
                  Status actions are available to team leads and directors.
                </p>
              )}
              {revQ.isLoading ? (
                <EmptyState text="Loading…" />
              ) : (
                <DataTable
                  columns={[
                    { key: 'drawing', label: 'Drawing', render: (r) => r.drawing ?? '—' },
                    { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                    { key: 'revNo', label: 'Rev', render: (r) => r.revNo ?? '—' },
                    { key: 'details', label: 'Details', render: (r) => r.details ?? '—' },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill>,
                    },
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (r) =>
                        canApprove ? (
                          <span style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="approve-btn"
                              disabled={revStatus.isPending}
                              onClick={() => revStatus.mutate({ id: r._id, status: 'Resubmitted' })}
                            >
                              Resubmit
                            </button>
                            <button
                              type="button"
                              className="approve-btn"
                              disabled={revStatus.isPending}
                              onClick={() => revStatus.mutate({ id: r._id, status: 'Cleared' })}
                            >
                              Clear
                            </button>
                          </span>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                  rows={teamRevisions}
                  emptyText="No revisions yet."
                />
              )}
            </Panel>
          )}

          {tab === 'revision-entry' && (
            <RevisionEntryPanel teamProjects={teamProjects} canCreate={canRevCreate} />
          )}

          {tab === 'drawings' && (
            <Panel title="Drawing register">
              <div style={{ marginBottom: 12 }}>
                <button type="button" className="btn-primary" onClick={() => setDrawingOpen(true)}>
                  Add drawing
                </button>
              </div>
              <DataTable
                columns={[
                  { key: 'drawingNo', label: 'Drawing no', render: (d) => d.drawingNo ?? d.drawing ?? '—' },
                  { key: 'title', label: 'Title', render: (d) => d.title ?? '—' },
                  { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
                  { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                  { key: 'rev', label: 'Rev', render: (d) => d.rev ?? '—' },
                ]}
                rows={teamDrawings}
                emptyText="No drawings yet."
              />
              {drawingOpen && (
                <DrawingModal teamProjects={teamProjects} onClose={() => setDrawingOpen(false)} />
              )}
            </Panel>
          )}

          {tab === 'transmittal' && (
            <>
              <Panel title="Transmittal progress by project">
                {trQ.isLoading ? (
                  <EmptyState text="Loading…" />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'project', label: 'Project' },
                      { key: 'acknowledged', label: 'Acknowledged' },
                      { key: 'active', label: 'Sent / in preparation' },
                      { key: 'awaiting', label: 'Awaiting transmittal', render: (r) => awaitingDrawings.filter((d) => (d.project?.name ?? projLabel(d.project)) === r.project).length },
                      { key: 'total', label: 'Transmittals' },
                    ]}
                    rows={trProgress}
                    emptyText="No transmittals for your projects yet."
                  />
                )}
              </Panel>
              <Panel title="Latest transmittal status">
                <DataTable
                  columns={[
                    { key: 'trNo', label: 'TR no.', render: (r) => <span className="mono">{r.trNo}</span> },
                    { key: 'drawing', label: 'Drawing', render: (r) => r.drawing?.drawingNo ?? '—' },
                    { key: 'project', label: 'Project', render: (r) => r.drawing?.project?.name ?? projLabel(r.drawing?.project) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                    { key: 'sentAt', label: 'Sent', render: (r) => (r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—') },
                    { key: 'ackAt', label: 'Acknowledged', render: (r) => (r.ackAt ? new Date(r.ackAt).toLocaleDateString() : '—') },
                  ]}
                  rows={teamTransmittals.slice(0, 25)}
                  emptyText="No transmittals for your projects yet. Statuses refresh as Admin updates them (read-only)."
                />
              </Panel>
            </>
          )}

          {tab === 'recruitment' && (
            <RecruitmentPanel rows={myRecruit} canSetStatus={canRecruitStatus} />
          )}
        </>
      )}

      {allocOpen && selectedTeam && (
        <AllocationModal team={selectedTeam} onClose={() => setAllocOpen(false)} />
      )}
      {decideEntry && (
        <DecideModal
          entry={decideEntry}
          onClose={() => setDecideEntry(null)}
          decide={decide}
        />
      )}
    </>
  );
}

function AllocationModal({ team, onClose }) {
  const queryClient = useQueryClient();
  const teamId = String(team._id ?? team.id);
  const [rows, setRows] = useState(
    (team.members ?? []).map((m) => ({
      employee: memberId(m),
      allocation: m.allocation ?? '',
    })),
  );
  const [empSearch, setEmpSearch] = useState('');
  const empQ = useQuery({
    queryKey: ['employees-search', empSearch],
    queryFn: () => employeesApi.list({ search: empSearch }),
    enabled: empSearch.trim().length > 0,
  });
  const save = useMutation({
    mutationFn: (members) => teamsApi.updateMembers(teamId, members),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });
  return (
    <Modal title="Edit allocations" wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            rows.map((r) => ({
              employee: r.employee,
              allocation: r.allocation === '' ? undefined : Number(r.allocation),
            })),
          );
        }}
      >
        {rows.length === 0 && <EmptyState text="No members in this team." />}
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              className="form-input"
              value={r.employee}
              placeholder="Employee id"
              onChange={(e) =>
                setRows((ms) => ms.map((x, j) => (j === i ? { ...x, employee: e.target.value } : x)))
              }
            />
            <input
              className="form-input"
              style={{ maxWidth: 120 }}
              type="number"
              placeholder="Alloc %"
              value={r.allocation}
              onChange={(e) =>
                setRows((ms) => ms.map((x, j) => (j === i ? { ...x, allocation: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="approve-btn"
              onClick={() => setRows((ms) => ms.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="form-label">Add member — search employees</label>
          <input
            className="form-input"
            placeholder="Type a name to search"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
          />
          {(empQ.data?.items ?? []).length > 0 && (
            <div className="search-results">
              {empQ.data.items.map((emp) => (
                <div
                  key={emp._id ?? emp.id}
                  className="search-result-row"
                  onClick={() => {
                    const id = String(emp._id ?? emp.id);
                    setRows((ms) =>
                      ms.some((m) => m.employee === id) ? ms : [...ms, { employee: id, allocation: '' }],
                    );
                    setEmpSearch('');
                  }}
                >
                  {empName(emp)} · {emp.designation ?? ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {save.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {save.error.message}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save members'}
        </button>
      </form>
    </Modal>
  );
}

function DecideModal({ entry, onClose, decide }) {
  const [status, setStatus] = useState('Approved');
  const [remark, setRemark] = useState('');
  return (
    <Modal title={`Take action — ${wuDisplay(entry)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          decide.mutate({ id: entry._id, status, remark: remark || undefined });
        }}
      >
        <div className="form-row">
          <label className="form-label">Decision *</label>
          <select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Approved">Approve</option>
            <option value="Rejected">Take action (reject / needs work)</option>
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Remark</label>
          <textarea className="form-input" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
        {decide.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {decide.error.message}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={decide.isPending}>
          {decide.isPending ? 'Saving…' : 'Submit decision'}
        </button>
      </form>
    </Modal>
  );
}

function AssignWorkPanel({ members, teamProjects, myTasks, canApprove, taskStatus }) {
  const queryClient = useQueryClient();
  const [selMembers, setSelMembers] = useState([]);
  const [project, setProject] = useState('');
  const [stage, setStage] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [drawRows, setDrawRows] = useState([{ drawingNo: '', title: '' }]);
  const [drawErr, setDrawErr] = useState('');

  const allIds = members.map(memberId).filter(Boolean);
  const create = useMutation({
    mutationFn: (body) => tasksApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setErr('');
      setSelMembers([]);
      setDeliverable('');
      setNotes('');
    },
    onError: (e) => setErr(e.message),
  });

  function toggleMember(id) {
    setSelMembers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function handleCreate(e) {
    e.preventDefault();
    setErr('');
    if (selMembers.length === 0) {
      setErr('Select at least one member.');
      return;
    }
    if (!project) {
      setErr('Select a project.');
      return;
    }
    if (!deliverable.trim()) {
      setErr('Deliverable / task text is required.');
      return;
    }
    create.mutate({
      members: selMembers,
      project,
      stage: stage || undefined,
      deliverable: deliverable.trim(),
      dueDate: dueDate || undefined,
      priority: priority || undefined,
      notes: notes || undefined,
    });
  }

  async function handleDrawings(e) {
    e.preventDefault();
    setDrawErr('');
    const rows = drawRows.filter((r) => r.drawingNo.trim() || r.title.trim());
    if (rows.length === 0) {
      setDrawErr('Enter at least one drawing row.');
      return;
    }
    if (!project) {
      setDrawErr('Select a project first (drawings are filed against it).');
      return;
    }
    try {
      for (const r of rows) {
        if (!r.drawingNo.trim() || !r.title.trim()) throw new Error('Each drawing row needs a number and a title.');
        await drawingsApi.create({ project, drawingNo: r.drawingNo.trim(), title: r.title.trim() });
      }
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
      setDrawRows([{ drawingNo: '', title: '' }]);
    } catch (ex) {
      setDrawErr(ex.message);
    }
  }

  return (
    <>
      <Panel title="Assign work">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <label className="form-label">Members *</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" className="approve-btn" onClick={() => setSelMembers(allIds)}>
                Select all
              </button>
              <button type="button" className="approve-btn" onClick={() => setSelMembers([])}>
                None
              </button>
            </div>
            {members.length === 0 ? (
              <EmptyState text="No team members to assign." />
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {members.map((m) => {
                  const id = memberId(m);
                  return (
                    <label key={id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={selMembers.includes(id)}
                        onChange={() => toggleMember(id)}
                      />
                      {memberName(m)}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project * (team projects)</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {teamProjects.map((p) => (
                  <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                    {p.name} ({p.code ?? ''})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Stage</label>
              <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Due date</label>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Priority</label>
              <select className="filter-select" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Deliverable / task *</label>
            <input className="form-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Assigning…' : 'Assign task'}
          </button>
        </form>
      </Panel>
      <Panel title="Drawing key-in (one create per row)">
        <form onSubmit={handleDrawings}>
          {drawRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="form-input"
                placeholder="Drawing no"
                value={r.drawingNo}
                onChange={(e) => setDrawRows((rs) => rs.map((x, j) => (j === i ? { ...x, drawingNo: e.target.value } : x)))}
              />
              <input
                className="form-input"
                placeholder="Title"
                value={r.title}
                onChange={(e) => setDrawRows((rs) => rs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <button
                type="button"
                className="approve-btn"
                onClick={() => setDrawRows((rs) => rs.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className="approve-btn" onClick={() => setDrawRows((rs) => [...rs, { drawingNo: '', title: '' }])}>
              Add row
            </button>
          </div>
          {drawErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{drawErr}</div>}
          <button type="submit" className="btn-primary">Create drawings</button>
        </form>
      </Panel>
      <Panel title="Tasks assigned by me (client-side filter: createdBy === my id)">
        {myTasks.length === 0 ? (
          <EmptyState text="No tasks assigned by you yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'deliverable', label: 'Task', render: (t) => t.deliverable ?? t.notes ?? '—' },
              { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
              {
                key: 'members',
                label: 'Members',
                render: (t) => (t.members ?? []).map(empName).join(', ') || '—',
              },
              {
                key: 'status',
                label: 'Status',
                render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill>,
              },
              {
                key: 'actions',
                label: 'Approve',
                render: (t) =>
                  canApprove ? (
                    <button
                      type="button"
                      className="approve-btn"
                      disabled={taskStatus.isPending}
                      onClick={() => taskStatus.mutate({ id: t._id, status: 'Approved' })}
                    >
                      Approve
                    </button>
                  ) : (
                    '—'
                  ),
              },
            ]}
            rows={myTasks}
            emptyText="No tasks assigned by you yet."
          />
        )}
      </Panel>
    </>
  );
}

function DeliverableAddPanel({ teamProjects, members }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [specify, setSpecify] = useState('');
  const [stage, setStage] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (body) => deliverablesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      setErr('');
      setDeliverable('');
      setSpecify('');
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Panel title="Add deliverable (assoc technical director only)">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr('');
          if (!project) {
            setErr('Select a project.');
            return;
          }
          if (!deliverable.trim()) {
            setErr('Deliverable name is required.');
            return;
          }
          create.mutate({
            project,
            deliverable: deliverable.trim(),
            specify: specify || undefined,
            stage: stage || undefined,
            assignedTo: assignedTo || undefined,
            plannedDate: plannedDate || undefined,
            dueDate: dueDate || undefined,
          });
        }}
      >
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project *</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project</option>
              {teamProjects.map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                  {p.name} ({p.code ?? ''})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Deliverable *</label>
            <input className="form-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Specify</label>
            <input className="form-input" value={specify} onChange={(e) => setSpecify(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Assigned to</label>
            <select className="filter-select" style={{ width: '100%' }} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={memberId(m)} value={memberId(m)}>
                  {memberName(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Planned date</label>
            <input type="date" className="form-input" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Due date</label>
            <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {create.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{create.error.message}</div>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add deliverable'}
        </button>
      </form>
    </Panel>
  );
}

function DeliverableCrudPanel({ rows }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const update = useMutation({
    mutationFn: ({ id, body }) => deliverablesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      setEditing(null);
    },
  });
  return (
    <Panel title={`List of deliverables (${rows.length})`}>
      <DataTable
        columns={[
          { key: 'deliverable', label: 'Deliverable', render: (d) => d.deliverable ?? '—' },
          { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
          { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
          { key: 'plannedDate', label: 'Planned', render: (d) => fmtDate(d.plannedDate) },
          { key: 'dueDate', label: 'Due', render: (d) => fmtDate(d.dueDate) },
          {
            key: 'status',
            label: 'Status',
            render: (d) => <StatusPill tone={toneFor(d.status)}>{d.status ?? '—'}</StatusPill>,
          },
          {
            key: 'actions',
            label: 'Edit',
            render: (d) => (
              <button
                type="button"
                className="approve-btn"
                onClick={() => {
                  setEditing(d);
                  setEditStatus(d.status ?? '');
                }}
              >
                Edit
              </button>
            ),
          },
        ]}
        rows={rows}
        emptyText="No deliverables yet."
      />
      {editing && (
        <Modal title="Edit deliverable" onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ id: editing._id, body: { status: editStatus || undefined } });
            }}
          >
            <div className="form-row">
              <label className="form-label">Status</label>
              <input className="form-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} />
            </div>
            {update.isError && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{update.error.message}</div>
            )}
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </form>
        </Modal>
      )}
    </Panel>
  );
}

function RevisionEntryPanel({ teamProjects, canCreate }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [stage, setStage] = useState('');
  const [drawing, setDrawing] = useState('');
  const [revNo, setRevNo] = useState('');
  const [details, setDetails] = useState('');
  const [resubmissionDue, setResubmissionDue] = useState('');
  const [notify, setNotify] = useState(false);
  const [err, setErr] = useState('');
  const [emailLog, setEmailLog] = useState(null);
  const create = useMutation({
    mutationFn: (body) => revisionsApi.create(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revisions'] });
      setErr('');
      setEmailLog(data?.item?.emailLog ?? data?.emailLog ?? []);
    },
    onError: (e) => setErr(e.message),
  });
  if (!canCreate) {
    return (
      <Panel title="Revision entry">
        <EmptyState text="Revision entry is available to team leads, QA/QC, peer reviewers and directors." />
      </Panel>
    );
  }
  return (
    <Panel title="Revision entry">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr('');
          setEmailLog(null);
          if (!project) {
            setErr('Select a project.');
            return;
          }
          if (!details.trim()) {
            setErr('Details are required.');
            return;
          }
          create.mutate({
            project,
            stage: stage || undefined,
            drawing: drawing || undefined,
            revNo: revNo || undefined,
            resubmissionDue: resubmissionDue || undefined,
            details: details.trim(),
            notify,
          });
        }}
      >
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project *</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project</option>
              {teamProjects.map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                  {p.name} ({p.code ?? ''})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Drawing</label>
            <input className="form-input" value={drawing} onChange={(e) => setDrawing(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Rev no</label>
            <input className="form-input" value={revNo} onChange={(e) => setRevNo(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Resubmission due</label>
            <input type="date" className="form-input" value={resubmissionDue} onChange={(e) => setResubmissionDue(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Details *</label>
          <textarea className="form-input" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify by email
          </label>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Log revision'}
        </button>
      </form>
      {emailLog && (
        <div style={{ marginTop: 16 }}>
          <div className="section-label">Email log (queued, not sent)</div>
          {emailLog.length === 0 ? (
            <EmptyState text="No email lines returned — queued, not sent." />
          ) : (
            <ul style={{ fontSize: 13, paddingLeft: 18 }}>
              {emailLog.map((line, i) => (
                <li key={i}>
                  {typeof line === 'string' ? line : JSON.stringify(line)} — queued, not sent
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function DrawingModal({ teamProjects, onClose }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState(teamProjects[0] ? String(teamProjects[0]._id ?? teamProjects[0].id) : '');
  const [drawingNo, setDrawingNo] = useState('');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState('');
  const [rev, setRev] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (body) => drawingsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Modal title="Add drawing" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr('');
          if (!project) {
            setErr('Select a project.');
            return;
          }
          if (!drawingNo.trim() || !title.trim()) {
            setErr('Drawing number and title are required.');
            return;
          }
          create.mutate({
            project,
            drawingNo: drawingNo.trim(),
            title: title.trim(),
            stage: stage || undefined,
            rev: rev || undefined,
          });
        }}
      >
        <div className="form-row">
          <label className="form-label">Project *</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select project</option>
            {teamProjects.map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.name} ({p.code ?? ''})
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Drawing no *</label>
          <input className="form-input" value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Title *</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Stage</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Rev</label>
            <input className="form-input" value={rev} onChange={(e) => setRev(e.target.value)} />
          </div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add drawing'}
        </button>
      </form>
    </Modal>
  );
}

function RecruitmentPanel({ rows, canSetStatus }) {
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [branch, setBranch] = useState('');
  const [justification, setJustification] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (body) => recruitmentApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-mine'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment'] });
      setErr('');
      setPosition('');
      setJustification('');
    },
    onError: (e) => setErr(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => recruitmentApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-mine'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment'] });
    },
  });

  function submit(status) {
    setErr('');
    if (!department.trim()) {
      setErr('Department is required.');
      return;
    }
    if (!position.trim()) {
      setErr('Position is required.');
      return;
    }
    create.mutate({
      department: department.trim(),
      position: position.trim(),
      headcount: Number(headcount) || 1,
      qualification: qualification || undefined,
      experience: experience || undefined,
      branch: branch || undefined,
      justification: justification || undefined,
      status,
    });
  }

  return (
    <>
      <Panel title="Recruitment request">
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Department *</label>
            <input className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Position *</label>
            <input className="form-input" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Headcount</label>
            <input type="number" min="1" className="form-input" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Qualification</label>
            <input className="form-input" value={qualification} onChange={(e) => setQualification(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Experience</label>
            <input className="form-input" value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Branch</label>
            <input className="form-input" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Justification</label>
          <textarea className="form-input" value={justification} onChange={(e) => setJustification(e.target.value)} />
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="approve-btn" disabled={create.isPending} onClick={() => submit('Draft')}>
            Save as draft
          </button>
          <button type="button" className="btn-primary" disabled={create.isPending} onClick={() => submit('Submitted')}>
            {create.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </Panel>
      <Panel title="My requests">
        <DataTable
          columns={[
            { key: 'department', label: 'Department', render: (r) => r.department ?? '—' },
            { key: 'position', label: 'Position', render: (r) => r.position ?? '—' },
            { key: 'headcount', label: 'Count', render: (r) => r.headcount ?? '—' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill>,
            },
            {
              key: 'actions',
              label: 'Status',
              render: (r) =>
                canSetStatus ? (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="approve-btn"
                      onClick={() => setStatus.mutate({ id: r._id, status: 'Approved' })}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="approve-btn"
                      onClick={() => setStatus.mutate({ id: r._id, status: 'Rejected' })}
                    >
                      Reject
                    </button>
                  </span>
                ) : (
                  '—'
                ),
            },
          ]}
          rows={rows}
          emptyText="No recruitment requests yet."
        />
        {!canSetStatus && (
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8 }}>
            Status changes are restricted to HR.
          </p>
        )}
      </Panel>
    </>
  );
}
