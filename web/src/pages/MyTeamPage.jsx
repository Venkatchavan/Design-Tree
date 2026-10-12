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
import { rfiApi } from '../lib/functionsApi.js';
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
function drawingAckStatus(d, acked, transmitted) {
  const id = String(d._id ?? d.id ?? '');
  if (acked.has(id)) return 'Acknowledged';
  if (transmitted.has(id)) return 'Received';
  return 'Pending acknowledgement';
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
function daysSince(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return Math.max(0, Math.ceil((Date.now() - d.getTime()) / 86400000));
}
function rfiSourceOf(r) {
  const role = String(r.raisedBy?.role ?? '').toLowerCase();
  if (role === 'client') return 'Client';
  if (role === 'architect') return 'Architect';
  return 'Internal';
}
function rfiDisplayStatus(r) {
  return String(r.status ?? '').toLowerCase() === 'responded' ? 'Responded' : 'Pending';
}
function revisionEmployee(r) {
  const a = r.assignedTo;
  if (a && typeof a === 'object') {
    const name = empName(a);
    const desig = a.designation ?? '';
    return desig ? `${name} (${desig})` : name;
  }
  return '—';
}
function revisionSourceOf(name) {
  const t = String(name ?? '');
  if (/architect/i.test(t)) return 'Architect';
  if (/client/i.test(t)) return 'Client';
  return 'Internal';
}
function revisionDisplayStatus(r) {
  return String(r.status ?? '') === 'Cleared' ? 'Cleared' : 'Awaiting employee update';
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

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const me = meQ.data?.user ?? meQ.data ?? null;
  const meId = String(me?._id ?? me?.id ?? '');
  const myEmpId = me?.employee ? String(typeof me.employee === 'object' ? (me.employee._id ?? me.employee.id ?? '') : me.employee) : '';
  const empQ = useQuery({
    queryKey: ['employee-self', myEmpId],
    queryFn: () => employeesApi.get(myEmpId),
    enabled: !!myEmpId,
    retry: false,
  });
  const selfEmployee = empQ.data?.employee ?? null;

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
  const ackedDrawingIds = useMemo(
    () => new Set(teamTransmittals.filter((t) => String(t.status ?? '') === 'Acknowledged').map((t) => String(t.drawing?._id ?? t.drawing ?? ''))),
    [teamTransmittals],
  );

  const rfisQ = useQuery({ queryKey: ['rfis-team'], queryFn: () => rfiApi.list({}) });
  const teamRfis = useMemo(() => {
    const all = rfisQ.data?.items ?? [];
    if (teamProjectIds.size === 0) return all;
    return all.filter((r) => teamProjectIds.has(String(r.project?._id ?? r.project ?? '')));
  }, [rfisQ.data, teamProjectIds]);
  const openRfis = useMemo(
    () => teamRfis.filter((r) => ['open', 'responded'].includes(String(r.status ?? '').toLowerCase())),
    [teamRfis],
  );
  const awaitingRfis = openRfis;

  const delivLogQ = useQuery({
    queryKey: ['deliverables-log', selectedId],
    queryFn: () =>
      deliverablesApi.log(
        teamProjects[0] ? { project: teamProjects[0]._id ?? teamProjects[0].id } : {},
      ),
    enabled: teamProjects.length > 0,
  });
  const delivLog = delivLogQ.data?.items ?? delivLogQ.data?.log ?? [];

  const weekRange = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - day);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const f = (d) => `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-GB', { month: 'short' })}-${d.getFullYear()}`;
    return { mon, sun, label: `Week of ${f(mon)} – ${f(sun)}` };
  }, []);

  const weekHours = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const d = e.date ? new Date(e.date) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d < weekRange.mon || d > weekRange.sun) continue;
      const emp = e.employee;
      const key = typeof emp === 'object' && emp ? String(emp._id ?? emp.id ?? empName(emp)) : String(emp ?? '—');
      const label = typeof emp === 'object' && emp ? empName(emp) : String(emp ?? '—');
      const roleLabel = typeof emp === 'object' && emp ? (emp.designation ?? emp.role ?? '—') : '—';
      const cur = map.get(key) ?? { id: key, name: label, role: roleLabel, hours: 0, count: 0 };
      cur.hours += Number(e.hours ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.hours - a.hours);
  }, [entries, weekRange]);

  const weekHoursTotal = weekHours.reduce((s, r) => s + r.hours, 0);

  // Roster grouped by seniority for the team + assign views.
  const roleGroups = useMemo(() => {
    const groups = { Senior: [], Junior: [], Drafter: [], Other: [] };
    for (const m of members) {
      const e = memberEmp(m);
      const desig = String(e?.designation ?? '');
      if (/senior/i.test(desig)) groups.Senior.push(m);
      else if (/junior/i.test(desig)) groups.Junior.push(m);
      else if (/draft/i.test(desig)) groups.Drafter.push(m);
      else groups.Other.push(m);
    }
    return [
      { key: 'Senior designers', members: groups.Senior },
      { key: 'Junior designers', members: groups.Junior },
      { key: 'Drafters', members: groups.Drafter },
      ...(groups.Other.length > 0 ? [{ key: 'Other roles', members: groups.Other }] : []),
    ].filter((g) => g.members.length > 0);
  }, [members]);

  function expText(e) {
    const exp = e?.experience;
    if (exp == null || exp === '') return '';
    const t = String(exp).trim();
    return /yr|year/i.test(t) ? `${t} exp.` : `${t} yrs exp.`;
  }

  // Hours per project+stage this week for the efficiency panel.
  const efficiencyRows = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const d = e.date ? new Date(e.date) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d < weekRange.mon || d > weekRange.sun) continue;
      const p = e.project;
      const pname = typeof p === 'object' && p ? (p.name ?? '—') : String(p ?? '');
      const key = `${pname}||${e.stage ?? '—'}`;
      const cur = map.get(key) ?? { project: pname, stage: e.stage ?? '—', hours: 0 };
      cur.hours += Number(e.hours ?? 0);
      map.set(key, cur);
    }
    const internal = { project: 'Internal / non-billable', stage: '—', hours: 0 };
    const rows = [...map.values()].map((r) => ({ ...r, hours: Math.round(r.hours) }));
    if (internal.hours > 0) rows.push(internal);
    return rows;
  }, [entries, weekRange]);

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

  const bulkApprove = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) {
        await workEntriesApi.decide(id, { status: 'Approved' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-work-entries'] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
    },
  });

  const revStatus = useMutation({
    mutationFn: ({ id, status }) => revisionsApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisions'] });
      queryClient.invalidateQueries({ queryKey: ['revisions-mine'] });
    },
  });

  const [showAllWeekly, setShowAllWeekly] = useState(false);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'team', label: 'Project & team' },
    { key: 'monitoring', label: 'Team work monitoring' },
    { key: 'assign', label: 'Assign work' },
    { key: 'deliverables', label: 'Deliverables' },
    { key: 'awaiting', label: 'Awaiting response' },
    { key: 'revisions', label: 'Revision log' },
    { key: 'drawings', label: 'Drawing register' },
    { key: 'recruitment', label: 'Recruitment requests' },
  ];

  const activeProjects = useMemo(
    () => teamProjects.filter((p) => String(p.status ?? '') !== 'Completed'),
    [teamProjects],
  );
  const openRevisionCount = openRevisions.length;

  function projectFlag(p) {
    if (String(p.status ?? '').toLowerCase().includes('delay')) return 'Behind schedule';
    const n = teamRevisions.filter((r) => idOf(r.project) === String(p._id ?? p.id) && String(r.status ?? '').toLowerCase() === 'open').length;
    return n > 0 ? `${n} open flag${n === 1 ? '' : 's'}` : 'None';
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">My projects and team</div>
        <div className="page-sub">
          {me ? `${empName(selfEmployee ?? me.employee ?? me)} · ${bootstrap?.role?.label ?? role}` : (teamsQ.isLoading ? 'Loading…' : `role ${role || '—'}`)}
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
              <div className="kpi-grid cols-5">
                <KpiCard label="Active projects" value={activeProjects.length} accent="blueprint" />
                <KpiCard label="Team members" value={members.length} accent="forest" />
                <KpiCard label="Pending review" value={pendingEntries.length} accent="amber" />
                <KpiCard label="Awaiting response" value={openRfis.length} accent="rust" />
                <KpiCard label="Open revisions" value={openRevisionCount} accent="violet" />
              </div>
              <Panel title="My projects">
                {teamProjects.length === 0 ? (
                  <EmptyState text="No projects linked to this team." />
                ) : (
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Project', render: (p) => p.name ?? '—' },
                      { key: 'branch', label: 'Branch', render: (p) => p.branch ?? '—' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (p) => <StatusPill tone={toneFor(p.status)}>{p.status ?? '—'}</StatusPill>,
                      },
                      { key: 'completion', label: 'Completion', render: (p) => p.completion != null ? `${p.completion}%` : '—' },
                      { key: 'flag', label: 'Flag', render: (p) => projectFlag(p) },
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
                      { key: 'wu', label: 'WU no.', render: (e) => wuDisplay(e) },
                      { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                      { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                      { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
                      { key: 'progress', label: '%', render: (e) => e.progressPct != null ? `${e.progressPct}%` : '—' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
                      },
                    ]}
                    rows={[...entries].sort((a, b) => String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))).slice(0, 10)}
                    emptyText="No team activity yet."
                  />
                )}
              </Panel>
            </>
          )}

          {tab === 'team' && (
            <>
              <Panel title={`My team — ${members.length} people`}>
                {members.length === 0 ? (
                  <EmptyState text="No members in this team yet." />
                ) : (
                  roleGroups.map((g) => (
                    <div key={g.key} style={{ marginBottom: 14 }}>
                      <div className="section-label">{g.key} ({g.members.length})</div>
                      <ul style={{ fontSize: 13.5, paddingLeft: 18, margin: '6px 0' }}>
                        {g.members.map((m, i) => {
                          const e = memberEmp(m);
                          const exp = expText(e);
                          return (
                            <li key={memberId(m) || i}>
                              {memberName(m)}{exp ? ` · ${exp}` : ''}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
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
              <Panel title="Team efficiency this week" sub="Hours spent in each stage of project design">
                <DataTable
                  columns={[
                    { key: 'project', label: 'Project' },
                    { key: 'stage', label: 'Stage' },
                    { key: 'hours', label: 'Hours logged' },
                  ]}
                  rows={efficiencyRows}
                  emptyText="No hours logged this week."
                />
              </Panel>
            </>
          )}

          {tab === 'monitoring' && (
            <>
              <Panel title="Team work items" sub="Every current work update across my team — take action on anything pending">
                <DataTable
                  columns={[
                    { key: 'wu', label: 'WU no.', render: (e) => wuDisplay(e) },
                    { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                    { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                    { key: 'stage', label: 'Stage', render: (e) => e.stage ?? '—' },
                    { key: 'deliverable', label: 'Deliverable', render: (e) => e.deliverable ?? e.taskActivity ?? '—' },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (e) => <StatusPill tone={toneFor(e.status)}>{e.status ?? '—'}</StatusPill>,
                    },
                    {
                      key: 'actions',
                      label: '',
                      render: (e) => String(e.status ?? '').toLowerCase() === 'pending' ? (
                        <button type="button" className="approve-btn" onClick={() => setDecideEntry(e)}>
                          Take action
                        </button>
                      ) : '—',
                    },
                  ]}
                  rows={entries}
                  emptyText="No work items for this team."
                />
              </Panel>
              <Panel title="Weekly approval" sub={`${weekRange.label} · ${Math.round(weekHoursTotal)} hours · ${showAllWeekly ? weekHours.length : Math.min(5, weekHours.length)} of ${weekHours.length} shown`}>
                {!canApprove ? (
                  <EmptyState text="Approval actions are available to team leads and directors." />
                ) : weekHours.length === 0 ? (
                  <EmptyState text="No hours logged this week." />
                ) : (
                  <>
                    <DataTable
                      columns={[
                        { key: 'name', label: 'Employee' },
                        { key: 'role', label: 'Role' },
                        { key: 'hours', label: 'Hours', render: (r) => Number(r.hours ?? 0).toFixed(0) },
                        {
                          key: 'status',
                          label: 'Status',
                          render: (r) => {
                            const pending = entries.filter((e) => {
                              const emp = e.employee;
                              const key = typeof emp === 'object' && emp ? String(emp._id ?? emp.id ?? '') : String(emp ?? '');
                              return key === r.id && String(e.status ?? '').toLowerCase() === 'pending';
                            });
                            return pending.length > 0 ? <StatusPill tone="amber">Pending</StatusPill> : <StatusPill tone="forest">Approved</StatusPill>;
                          },
                        },
                        {
                          key: 'approve',
                          label: '',
                          render: (r) => {
                            const ids = entries.filter((e) => {
                              const emp = e.employee;
                              const key = typeof emp === 'object' && emp ? String(emp._id ?? emp.id ?? '') : String(emp ?? '');
                              return key === r.id && String(e.status ?? '').toLowerCase() === 'pending';
                            }).map((e) => e._id);
                            return ids.length > 0 ? (
                              <button
                                type="button"
                                className="approve-btn"
                                disabled={bulkApprove.isPending}
                                onClick={() => bulkApprove.mutate(ids)}
                              >
                                Approve
                              </button>
                            ) : '—';
                          },
                        },
                      ]}
                      rows={showAllWeekly ? weekHours : weekHours.slice(0, 5)}
                      emptyText="No hours logged this week."
                    />
                    {weekHours.length > 5 && (
                      <button type="button" className="approve-btn" style={{ marginTop: 10 }} onClick={() => setShowAllWeekly((v) => !v)}>
                        {showAllWeekly ? 'Show less' : `Show all ${weekHours.length}`}
                      </button>
                    )}
                    {bulkApprove.isError && (
                      <div className="login-error" role="alert" style={{ display: 'block' }}>{bulkApprove.error.message}</div>
                    )}
                  </>
                )}
              </Panel>
            </>
          )}

          {tab === 'assign' && (
            <AssignWorkPanel
              members={members}
              roleGroups={roleGroups}
              teamProjects={teamProjects}
              myTasks={myAssignedTasks}
              deliverables={teamDeliverables}
              delivLog={delivLog}
            />
          )}

          {tab === 'awaiting' && (
            <Panel title="Awaiting response" sub="Logged by design engineers and drafters against their own work — work blocked on someone outside my team, the longer these sit the stronger the billing case">
              {rfisQ.isLoading ? <EmptyState text="Loading…" /> : rfisQ.isError ? (
                <div className="login-error" role="alert" style={{ display: 'block' }}>{rfisQ.error.message}</div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'employee', label: 'Employee', render: (r) => r.raisedBy?.name ?? r.raisedBy?.email ?? '—' },
                    { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                    { key: 'item', label: 'Item', render: (r) => r.description ?? '—' },
                    { key: 'waitingOn', label: 'Waiting on', render: (r) => r.assignedTo ?? rfiSourceOf(r) },
                    { key: 'since', label: 'Since', render: (r) => fmtDate(r.createdAt) },
                    { key: 'days', label: 'Days waiting', render: (r) => daysSince(r.createdAt) },
                    { key: 'status', label: 'Status', render: (r) => <StatusPill tone={toneFor(rfiDisplayStatus(r))}>{rfiDisplayStatus(r)}</StatusPill> },
                  ]}
                  rows={awaitingRfis}
                  emptyText="Nothing awaiting response."
                />
              )}
            </Panel>
          )}

          {tab === 'deliverables' && (
            <>
              {(canDeliverAdd || role === 'team_lead') && (
                <DeliverableAddPanel teamProjects={teamProjects} members={members} />
              )}
              <Panel title="My project deliverables" sub="Also visible on the Design Management deliverables tracker">
                <DataTable
                  columns={[
                    { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
                    { key: 'deliverable', label: 'Deliverable', render: (d) => d.deliverable ?? d.specify ?? '—' },
                    { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                    { key: 'status', label: 'Status', render: (d) => <StatusPill tone={toneFor(d.status)}>{d.status ?? '—'}</StatusPill> },
                    { key: 'dueDate', label: 'Due date', render: (d) => fmtDate(d.dueDate) },
                  ]}
                  rows={teamDeliverables}
                  emptyText="No deliverables yet."
                />
              </Panel>
            </>
          )}

          {tab === 'revisions' && (
            <>
              <Panel title="Revision log" sub="Structural revisions across my projects, from raised to cleared — includes revisions requested by client or architect and logged by the SPOC">
                {!canApprove && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 12 }}>
                    Status actions are available to team leads and directors.
                  </p>
                )}
                {revQ.isLoading ? (
                  <EmptyState text="Loading…" />
                ) : revQ.isError ? (
                  <div className="login-error" role="alert" style={{ display: 'block' }}>{revQ.error.message}</div>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
                      { key: 'stage', label: 'Stage', render: (r) => r.stage ?? '—' },
                      { key: 'item', label: 'Item', render: (r) => r.details ?? r.drawing ?? '—' },
                      { key: 'employee', label: 'Employee', render: (r) => revisionEmployee(r) },
                      { key: 'raisedBy', label: 'Raised by', render: (r) => revisionSourceOf(r.raisedBy) },
                      { key: 'raised', label: 'Raised', render: (r) => fmtDate(r.dateRaised ?? r.createdAt) },
                      { key: 'resubmitted', label: 'Resubmitted', render: (r) => fmtDate(r.resubmittedAt) },
                      { key: 'cleared', label: 'Cleared', render: (r) => fmtDate(r.clearedAt) },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (r) => <StatusPill tone={toneFor(revisionDisplayStatus(r))}>{revisionDisplayStatus(r)}</StatusPill>,
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
              {canRevCreate && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 13.5, cursor: 'pointer' }}>Log revision</summary>
                  <div style={{ marginTop: 10 }}>
                    <RevisionEntryPanel teamProjects={teamProjects} canCreate={canRevCreate} />
                  </div>
                </details>
              )}
            </>
          )}

          {tab === 'drawings' && (
            <Panel title="Structural drawing register" sub="Uploaded by design engineers and drafters, across my projects">
              <DataTable
                columns={[
                  { key: 'project', label: 'Project', render: (d) => projLabel(d.project) },
                  { key: 'service', label: 'Service', render: (d) => d.service ?? '—' },
                  { key: 'stage', label: 'Stage', render: (d) => d.stage ?? '—' },
                  { key: 'drawingNo', label: 'Drawing no.', render: (d) => d.drawingNo ?? d.drawing ?? '—' },
                  { key: 'rev', label: 'Rev', render: (d) => d.rev ?? d.revNo ?? '—' },
                  { key: 'date', label: 'Date', render: (d) => fmtDate(d.date ?? d.createdAt) },
                  { key: 'issuedTo', label: 'To', render: (d) => d.issuedTo ?? '—' },
                  { key: 'method', label: 'Method', render: (d) => d.method ?? '—' },
                  { key: 'status', label: 'Status', render: (d) => <StatusPill tone={toneFor(drawingAckStatus(d, ackedDrawingIds, transmittedDrawingIds))}>{drawingAckStatus(d, ackedDrawingIds, transmittedDrawingIds)}</StatusPill> },
                ]}
                rows={teamDrawings}
                emptyText="No drawings yet."
              />
            </Panel>
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

function AssignWorkPanel({ members, roleGroups, teamProjects, myTasks, deliverables, delivLog }) {
  const queryClient = useQueryClient();
  const [selMembers, setSelMembers] = useState([]);
  const [project, setProject] = useState('');
  const [stage, setStage] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [drawProject, setDrawProject] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [drawRows, setDrawRows] = useState([{ drawingNo: '', title: '', service: '', stage: '', rev: 'R00', date: '', issuedTo: '', method: '' }]);
  const [drawErr, setDrawErr] = useState('');
  const [delivRows, setDelivRows] = useState(null);
  const [delivErr, setDelivErr] = useState('');

  function editableDelivRows() {
    if (delivRows) return delivRows;
    return deliverables
      .filter((d) => !drawProject || idOf(d.project) === drawProject)
      .map((d) => ({
        _id: String(d._id),
        stage: d.stage ?? '',
        deliverable: d.deliverable ?? '',
        assignedTo: d.assignedTo?._id ?? d.assignedTo ?? '',
        assignedName: typeof d.assignedTo === 'object' && d.assignedTo ? empName(d.assignedTo) : '',
        plannedDate: String(d.plannedDate ?? '').slice(0, 10),
        dueDate: String(d.dueDate ?? '').slice(0, 10),
        status: d.status ?? 'Not started',
      }));
  }

  function setDelivRow(id, patch) {
    setDelivRows((prev) => {
      const base = prev ?? editableDelivRows();
      return base.map((r) => (String(r._id ?? r._key) === String(id) ? { ...r, ...patch } : r));
    });
  }

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

  function setDrawRow(i, patch) {
    setDrawRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function handleDrawingList(e) {
    e.preventDefault();
    setDrawErr('');
    const rows = drawRows.filter((r) => r.drawingNo.trim() || r.title.trim());
    if (rows.length === 0) {
      setDrawErr('Enter at least one drawing row.');
      return;
    }
    if (!drawProject) {
      setDrawErr('Select a project first (drawings are filed against it).');
      return;
    }
    try {
      for (const r of rows) {
        if (!r.drawingNo.trim() || !r.title.trim()) throw new Error('Each drawing row needs a number and a title.');
        await drawingsApi.create({
          project: drawProject,
          drawingNo: r.drawingNo.trim(),
          title: r.title.trim(),
          service: r.service || undefined,
          stage: r.stage || undefined,
          rev: r.rev || undefined,
          date: r.date || undefined,
          issuedTo: r.issuedTo || undefined,
          method: r.method || undefined,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
      setDrawRows([{ drawingNo: '', title: '', service: '', stage: '', rev: 'R00', date: '', issuedTo: '', method: '' }]);
    } catch (ex) {
      setDrawErr(ex.message);
    }
  }

  const saveDelivList = useMutation({
    mutationFn: async (rows) => {
      for (const r of rows) {
        if (r._id) {
          await deliverablesApi.update(r._id, {
            stage: r.stage || undefined,
            deliverable: r.deliverable || undefined,
            assignedTo: r.assignedTo || undefined,
            plannedDate: r.plannedDate || undefined,
            dueDate: r.dueDate || undefined,
            status: r.status || undefined,
          });
        } else {
          if (!r.deliverable.trim()) continue;
          await deliverablesApi.create({
            project: drawProject || project || undefined,
            stage: r.stage || undefined,
            deliverable: r.deliverable.trim(),
            assignedTo: r.assignedTo || undefined,
            plannedDate: r.plannedDate || undefined,
            dueDate: r.dueDate || undefined,
            status: r.status || undefined,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      queryClient.invalidateQueries({ queryKey: ['deliverables-log'] });
      setDelivRows(null);
      setDelivErr('');
    },
    onError: (e) => setDelivErr(e.message),
  });

  function addDelivRow() {
    setDelivRows((prev) => {
      const base = prev ?? editableDelivRows();
      return [...base, { _key: `new-${Date.now()}`, stage: '', deliverable: '', assignedTo: '', assignedName: '', plannedDate: '', dueDate: '', status: 'Not started' }];
    });
  }

  function removeDelivRow(id) {
    setDelivRows((prev) => {
      const base = prev ?? editableDelivRows();
      // Only unsaved rows can be removed (no delete API for saved rows).
      return base.filter((r) => !(r._key && String(r._key) === String(id)));
    });
  }

  function pickDelivProject(v) {
    setDrawProject(v);
    setDelivRows(null);
  }

  return (
    <>
      <Panel title="Assign work to a team member" sub="Creates a task that appears in that designer's “My work” view, grouped by stage">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <label className="form-label">Team member(s)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" className="approve-btn" onClick={() => setSelMembers(allIds)}>
                Select all / none
              </button>
              <button type="button" className="approve-btn" onClick={() => setSelMembers([])}>
                None
              </button>
            </div>
            {members.length === 0 ? (
              <EmptyState text="No team members to assign." />
            ) : (
              roleGroups.map((g) => (
                <div key={g.key} style={{ marginBottom: 8 }}>
                  <div className="section-label">{g.key}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {g.members.map((m) => {
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
                </div>
              ))
            )}
            {selMembers.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>No team members selected</p>}
          </div>
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
              <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Preliminary concept" />
            </div>
            <div className="form-row">
              <label className="form-label">Due date</label>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Priority</label>
              <select className="filter-select" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Deliverable / task *</label>
            <input className="form-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="Bore hole location and specifications" />
          </div>
          <div className="form-row">
            <label className="form-label">Notes for the designer</label>
            <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context, reference drawings, or specific instructions" />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Assigning…' : 'Assign task'}
          </button>
        </form>
      </Panel>
      <Panel title="Upload a list of drawings" sub="Bulk-add multiple drawings to the register at once, instead of one at a time">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (uploadFile) {
            setDrawErr('Spreadsheet import is not supported here — type the rows below.');
            return;
          }
          handleDrawingList(e);
        }}>
          <div className="form-row" style={{ maxWidth: 360 }}>
            <label className="form-label">Project *</label>
            <select className="filter-select" style={{ width: '100%' }} value={drawProject} onChange={(e) => setDrawProject(e.target.value)}>
              <option value="">Select project</option>
              {teamProjects.map((p) => (
                <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                  {p.name} ({p.code ?? ''})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">Drawing list file</label><input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} /></div>
          {drawErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{drawErr}</div>}
          <button type="submit" className="btn-primary">Upload list</button>
        </form>
      </Panel>
      <Panel title="Enter drawing details" sub="No file to upload? Type the drawing details straight into the register. Leave unused rows blank.">
        <DataTable
          columns={[
            { key: 'drawingNo', label: 'Drawing no. *', render: (r) => <input className="form-input" placeholder="e.g. S-302" value={r.drawingNo} onChange={(e) => setDrawRow(r._i, { drawingNo: e.target.value })} /> },
            { key: 'title', label: 'Title', render: (r) => <input className="form-input" placeholder="Drawing title" value={r.title} onChange={(e) => setDrawRow(r._i, { title: e.target.value })} /> },
            { key: 'service', label: 'Service', render: (r) => <input className="form-input" value={r.service} onChange={(e) => setDrawRow(r._i, { service: e.target.value })} /> },
            { key: 'stage', label: 'Stage', render: (r) => <input className="form-input" placeholder="Preliminary concept" value={r.stage} onChange={(e) => setDrawRow(r._i, { stage: e.target.value })} /> },
            { key: 'rev', label: 'Rev', render: (r) => <input className="form-input" value={r.rev} onChange={(e) => setDrawRow(r._i, { rev: e.target.value })} /> },
            { key: 'date', label: 'Date', render: (r) => <input className="form-input" type="date" value={r.date} onChange={(e) => setDrawRow(r._i, { date: e.target.value })} /> },
            { key: 'issuedTo', label: 'Issued to', render: (r) => <input className="form-input" value={r.issuedTo} onChange={(e) => setDrawRow(r._i, { issuedTo: e.target.value })} /> },
            { key: 'method', label: 'Method', render: (r) => <input className="form-input" value={r.method} onChange={(e) => setDrawRow(r._i, { method: e.target.value })} /> },
            { key: 'remove', label: '', render: (r) => <button type="button" className="approve-btn" onClick={() => setDrawRows((rs) => rs.filter((_, j) => j !== r._i))}>Remove</button> },
          ]}
          rows={drawRows.map((r, i) => ({ ...r, _i: i }))}
          emptyText="No rows."
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="approve-btn" onClick={() => setDrawRows((rs) => [...rs, { drawingNo: '', title: '', service: '', stage: '', rev: 'R00', date: '', issuedTo: '', method: '' }])}>
            + Add row
          </button>
          <button type="button" className="btn-primary" onClick={handleDrawingList}>
            Add to register
          </button>
        </div>
        {drawErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{drawErr}</div>}
      </Panel>
      <Panel title="List of deliverables" sub="Editable list for the project — change any field in place, add or remove rows, then save">
        <div className="form-row" style={{ maxWidth: 360, marginBottom: 10 }}>
          <label className="form-label">Project</label>
          <select className="filter-select" style={{ width: '100%' }} value={drawProject} onChange={(e) => pickDelivProject(e.target.value)}>
            <option value="">Select project</option>
            {teamProjects.map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.name} ({p.code ?? ''})
              </option>
            ))}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'stage', label: 'Stage', render: (r) => <input className="form-input" value={r.stage} onChange={(e) => setDelivRow(r._id ?? r._key, { stage: e.target.value })} /> },
            { key: 'deliverable', label: 'Deliverable', render: (r) => <input className="form-input" value={r.deliverable} onChange={(e) => setDelivRow(r._id ?? r._key, { deliverable: e.target.value })} /> },
            { key: 'assignedTo', label: 'Assigned to', render: (r) => <input className="form-input" value={r.assignedTo ?? ''} placeholder={r.assignedName ?? ''} onChange={(e) => setDelivRow(r._id ?? r._key, { assignedTo: e.target.value })} /> },
            { key: 'plannedDate', label: 'Planned date', render: (r) => <input className="form-input" type="date" value={String(r.plannedDate ?? '').slice(0, 10)} onChange={(e) => setDelivRow(r._id ?? r._key, { plannedDate: e.target.value })} /> },
            { key: 'dueDate', label: 'Due date', render: (r) => <input className="form-input" type="date" value={String(r.dueDate ?? '').slice(0, 10)} onChange={(e) => setDelivRow(r._id ?? r._key, { dueDate: e.target.value })} /> },
            { key: 'status', label: 'Status', render: (r) => <input className="form-input" value={r.status} onChange={(e) => setDelivRow(r._id ?? r._key, { status: e.target.value })} /> },
            { key: 'remove', label: '', render: (r) => (r._key ? <button type="button" className="approve-btn" onClick={() => removeDelivRow(r._key)}>Remove</button> : '—') },
          ]}
          rows={delivRows ?? editableDelivRows()}
          emptyText="No deliverables."
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="approve-btn" onClick={addDelivRow}>
            + Add deliverable
          </button>
          <button type="button" className="btn-primary" disabled={saveDelivList.isPending} onClick={() => saveDelivList.mutate(delivRows ?? editableDelivRows())}>
            {saveDelivList.isPending ? 'Saving…' : 'Save list'}
          </button>
        </div>
        {delivErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{delivErr}</div>}
        {saveDelivList.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{saveDelivList.error.message}</div>}
      </Panel>
      <Panel title="Deliverables log" sub="Every deliverable added, changed or removed from the list above, newest first">
        {delivLog.length === 0 ? (
          <EmptyState text="No deliverable changes logged yet. Edit the list above and press “Save list”." />
        ) : (
          <DataTable
            columns={[
              { key: 'when', label: 'When', render: (r) => fmtDate(r.at ?? r.createdAt) },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'action', label: 'Action' },
              { key: 'stage', label: 'Stage' },
              { key: 'deliverable', label: 'Deliverable' },
              { key: 'details', label: 'Details', render: (r) => r.details ?? r.remarks ?? '—' },
              { key: 'by', label: 'By', render: (r) => (r.by && typeof r.by === 'object' ? empName(r.by) : (r.by ? String(r.by).slice(-6) : '—')) },
            ]}
            rows={delivLog}
            emptyText="No deliverable changes logged yet. Edit the list above and press “Save list”."
          />
        )}
      </Panel>
      <Panel title="Tasks assigned by me" sub="Most recent first · appears live in each designer’s own “My work” view">
        {myTasks.length === 0 ? (
          <EmptyState text="No tasks assigned by you yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'assignees', label: 'Assigned to', render: (t) => (t.members ?? []).map((m) => empName(typeof m === 'object' ? (m.employee ?? m) : m)).join(', ') || '—' },
              { key: 'project', label: 'Project', render: (t) => projLabel(t.project) },
              { key: 'stage', label: 'Stage', render: (t) => t.stage ?? '—' },
              { key: 'deliverable', label: 'Deliverable', render: (t) => t.deliverable ?? t.notes ?? '—' },
              { key: 'due', label: 'Due', render: (t) => fmtDate(t.dueDate) },
              { key: 'priority', label: 'Priority', render: (t) => t.priority ?? '—' },
              { key: 'status', label: 'Status', render: (t) => <StatusPill tone={toneFor(t.status)}>{t.status ?? '—'}</StatusPill> },
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

function RecruitmentPanel({ rows, canSetStatus }) {
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [fresherExperienced, setFresherExperienced] = useState('Fresher');
  const [experience, setExperience] = useState('');
  const [timeline, setTimeline] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [skills, setSkills] = useState('');
  const [tools, setTools] = useState('');
  const [jd, setJd] = useState('');
  const [workload, setWorkload] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (body) => recruitmentApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-mine'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment'] });
      setErr('');
      setDepartment('');
      setPosition('');
      setHeadcount('1');
      setExperience('');
      setTimeline('');
      setQualifications('');
      setSkills('');
      setTools('');
      setJd('');
      setWorkload('');
      setReason('');
      setRemarks('');
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
      setErr('Department / Team is required.');
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
      fresherExperienced: fresherExperienced || undefined,
      experience: experience || undefined,
      timeline: timeline || undefined,
      qualifications: qualifications || undefined,
      skills: skills || undefined,
      tools: tools || undefined,
      jd: jd || undefined,
      workload: workload || undefined,
      reason: reason || undefined,
      remarks: remarks || undefined,
      status,
    });
  }

  return (
    <>
      <Panel title="New recruitment request" sub="Raise a request for the Recruitment / HR team when your team needs a new hire">
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Department / Team *</label>
            <input className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Structural" />
          </div>
          <div className="form-row">
            <label className="form-label">Position / Designation *</label>
            <input className="form-input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Junior Designer" />
          </div>
          <div className="form-row">
            <label className="form-label">No. of employees required</label>
            <input type="number" min="1" className="form-input" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Fresher / Experienced</label>
            <select className="filter-select" style={{ width: '100%' }} value={fresherExperienced} onChange={(e) => setFresherExperienced(e.target.value)}>
              <option>Fresher</option>
              <option>Experienced</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Required experience</label>
            <input className="form-input" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 2–4 years" />
          </div>
          <div className="form-row">
            <label className="form-label">Preferred joining timeline</label>
            <input className="form-input" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. Within 4 weeks" />
          </div>
          <div className="form-row">
            <label className="form-label">Required qualifications</label>
            <input className="form-input" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="e.g. B.E./B.Tech Civil" />
          </div>
          <div className="form-row">
            <label className="form-label">Technical skills</label>
            <input className="form-input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. RCC design, STAAD.Pro" />
          </div>
          <div className="form-row">
            <label className="form-label">Required software / tools knowledge</label>
            <input className="form-input" value={tools} onChange={(e) => setTools(e.target.value)} placeholder="e.g. AutoCAD, ETABS, Revit" />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Job description (JD)</label>
          <textarea className="form-input" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Key responsibilities for this role" />
        </div>
        <div className="form-row">
          <label className="form-label">Project / workload requirement</label>
          <input className="form-input" value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="Which project(s) or workload this hire supports" />
        </div>
        <div className="form-row">
          <label className="form-label">Reason for requirement</label>
          <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Backfill, new project, workload increase" />
        </div>
        <div className="form-row">
          <label className="form-label">Additional remarks</label>
          <textarea className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-primary" disabled={create.isPending} onClick={() => submit('Submitted')}>
            {create.isPending ? 'Submitting…' : 'Submit request'}
          </button>
          <button type="button" className="approve-btn" disabled={create.isPending} onClick={() => submit('Draft')}>
            Save as draft
          </button>
        </div>
      </Panel>
      <Panel title="My recruitment requests" sub="Track progress through to joining">
        <DataTable
          columns={[
            { key: 'id', label: 'ID', render: (r) => String(r._id ?? r.id ?? '').slice(-6) || '—' },
            { key: 'position', label: 'Position', render: (r) => r.position ?? '—' },
            { key: 'department', label: 'Dept.', render: (r) => r.department ?? '—' },
            { key: 'headcount', label: 'Headcount', render: (r) => r.headcount ?? '—' },
            { key: 'submitted', label: 'Submitted', render: (r) => fmtDate(r.createdAt) },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status ?? '—'}</StatusPill>,
            },
            { key: 'update', label: 'Latest update', render: (r) => fmtDate(r.updatedAt) },
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
