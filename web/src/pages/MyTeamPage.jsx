import { projectMembers } from '../lib/projectRoster.js';
import { CoordinationPanel } from '../components/ProjectUpdates.jsx';
import SpocMeetings from '../components/meetings/SpocMeetings.jsx';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  bootstrapApi,
  employeesApi,
  meApi,
  projectsApi,
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
import { billingApi, transmittalsApi } from '../lib/phase3Api.js';
import { meetingsApi } from '../lib/phase4bApi.js';
import { spocApi } from '../lib/spocApi.js';
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

const COORD_SERVICES = ['SMEPF', 'SMEP', 'MEP', 'STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'BIM', 'GBS', 'Peer Review'];

function StageRequestPanel({ projectId }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState(projectId ?? '');
  const [service, setService] = useState('');
  const [stage, setStage] = useState('');
  const [remark, setRemark] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const projQ = useQuery({ queryKey: ['projects-team-stage'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const projects = projQ.data?.items ?? [];
  const save = useMutation({
    mutationFn: (body) => billingApi.saveStage(body),
    onSuccess: () => {
      for(const key of ['billing-stages','project-stages','stage-approvals','billing-status-stages'])queryClient.invalidateQueries({queryKey:[key]});
      setProject(projectId ?? ''); setService(''); setStage(''); setRemark(''); setErr('');
      setMsg('Stage completion requested — sent to SPOC for final confirm.');
    },
    onError: (e) => { setErr(e.message); setMsg(''); },
  });
  return (
    <Panel title="Stage completed — request to SPOC" sub="For all PTLs. Goes to SPOC for final confirm, then DMH, directors and Admin billing.">
      <div className="field-grid">
        <div className="form-row">
          <label className="form-label">Project</label>
          <select className="filter-select" style={{ width: '100%' }} disabled={!!projectId} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select project</option>
            {projects.map((p) => <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Service</label>
          <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Select service</option>
            {COORD_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Stage</label>
          <select className="filter-select" style={{ width: '100%' }} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Select stage</option>
            {['CD', 'SD', 'DD', 'TD', 'GFC'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 8 }}>
        <label className="form-label">Remark (optional)</label>
        <input className="form-input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Completion note" />
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{msg}</p>}
      <button type="button" className="btn-primary" disabled={save.isPending || !project} style={{ marginTop: 8 }}
        onClick={() => save.mutate({ project, service: service || undefined, stage: stage || undefined, requestCompletion: true, ptlRemark: remark || undefined })}>
        {save.isPending ? 'Sending…' : 'Request completion'}
      </button>
    </Panel>
  );
}

function ProposeCoordinatorPanel() {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [services, setServices] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const projQ = useQuery({ queryKey: ['projects-team-coord'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const empQ = useQuery({ queryKey: ['employees-team-coord'], queryFn: () => employeesApi.list({}) });
  const projects = projQ.data?.items ?? [];
  const employees = empQ.data?.items ?? [];
  const coordinators = useMemo(() => {
    const list = employees.filter((e) =>
      /coordinator|spoc/i.test(`${e.designation ?? ''} ${e.department ?? ''}`),
    );
    return list.length > 0 ? list : employees;
  }, [employees]);
  function toggle(s) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  const save = useMutation({
    mutationFn: (body) => spocApi.proposeAllocation(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-allocations-mine'] });
      setProject(''); setCoordinator(''); setServices([]); setErr(''); setMsg('Coordinator proposed — DMH/Admin will approve.');
    },
    onError: (e) => { setErr(e.message); setMsg(''); },
  });
  return (
    <Panel title="Propose coordinator (PL)" sub="Team Leads add / select a coordinator for a project. Lands as Proposed for DMH/Admin approval.">
      <div className="field-grid">
        <div className="form-row">
          <label className="form-label">Project</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select project</option>
            {projects.map((p) => <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Coordinator</label>
          <select className="filter-select" style={{ width: '100%' }} value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
            <option value="">Select coordinator</option>
            {coordinators.map((e) => <option key={e._id ?? e.id} value={e._id ?? e.id}>{empName(e)}{e.designation ? ` · ${e.designation}` : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 8 }}>
        <label className="form-label">Services</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {COORD_SERVICES.map((s) => (
            <label key={s} className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={services.includes(s)} onChange={() => toggle(s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{msg}</p>}
      <button
        type="button"
        className="btn-primary"
        disabled={save.isPending || !project || !coordinator}
        style={{ marginTop: 8 }}
        onClick={() => save.mutate({ project, coordinator, services })}
      >
        {save.isPending ? 'Proposing…' : 'Propose coordinator'}
      </button>
    </Panel>
  );
}

export default function MyTeamPage({ bootstrap: bootstrapProp, projectId, projectWorkspace = false }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const role = bootstrap?.role?.key ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const superUser = isSuper(role);
  const canApprove = canApproveRole(role);
  const canDeliverAdd = canDeliverAddRole(role);
  const canRevCreate = canRevisionCreateRole(role);
  const canRecruitStatus = canRecruitStatusRole(role);

  const [revisionTab,setRevisionTab]=useState('log');
  const [tab, setTab] = useState(projectWorkspace ? 'overview' : 'assign');
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
    refetchInterval: 10000,
  });
  const teams = useMemo(() => {
    const d = teamsQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    const rows = d.items ?? d.teams ?? [];
    return projectId ? rows.filter(t => (t.projects ?? []).some(p => idOf(p) === String(projectId))) : rows;
  }, [teamsQ.data, projectId]);

  const selectedTeam = useMemo(() => {
    if (teams.length === 0) return null;
    if (selId) {
      const hit = teams.find((t) => String(t._id ?? t.id) === String(selId));
      if (hit) return hit;
    }
    return teams[0];
  }, [teams, selId]);
  const selectedId = selectedTeam ? String(selectedTeam._id ?? selectedTeam.id) : '';
  const teamProjects = (selectedTeam?.projects ?? []).filter(p => !projectId || idOf(p) === String(projectId));
  const teamProjectIds = useMemo(
    () => new Set(teamProjects.map((p) => String(p._id ?? p.id))),
    [teamProjects],
  );
  const members = selectedTeam?.members ?? [];

  const entriesQ = useQuery({
    queryKey: ['team-work-entries', selectedId, projectId],
    queryFn: () => workEntriesApi.list({ team: selectedId, project: projectId || undefined }),
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
    if (teamProjectIds.size === 0) return [];
    return allRevisions.filter((r) => teamProjectIds.has(idOf(r.project)));
  }, [allRevisions, teamProjectIds]);

  const delivQ = useQuery({ queryKey: ['deliverables'], queryFn: () => deliverablesApi.list({}) });
  const allDeliverables = delivQ.data?.items ?? [];
  const teamDeliverables = useMemo(() => {
    if (teamProjectIds.size === 0) return [];
    return allDeliverables.filter((d) => teamProjectIds.has(idOf(d.project)));
  }, [allDeliverables, teamProjectIds]);

  const drawingsQ = useQuery({ queryKey: ['drawings'], queryFn: () => drawingsApi.list({}) });
  const allDrawings = drawingsQ.data?.items ?? [];
  const teamDrawings = useMemo(() => {
    if (teamProjectIds.size === 0) return [];
    return allDrawings.filter((d) => teamProjectIds.has(idOf(d.project)));
  }, [allDrawings, teamProjectIds]);

  const recruitQ = useQuery({
    queryKey: ['recruitment-mine'],
    queryFn: () => recruitmentApi.list({ mine: true }),
  });
  const myRecruit = (recruitQ.data?.items ?? []).filter(r => !projectId || idOf(r.project) === String(projectId));

  const trQ = useQuery({ queryKey: ['transmittals-team'], queryFn: () => transmittalsApi.teamScope() });
  const teamTransmittals = useMemo(() => {
    const all = trQ.data?.items ?? [];
    if (teamProjectIds.size === 0) return [];
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
    if (teamProjectIds.size === 0) return [];
    return all.filter((r) => teamProjectIds.has(String(r.project?._id ?? r.project ?? '')));
  }, [rfisQ.data, teamProjectIds]);
  const meetingsQ = useQuery({ queryKey: ['meetings-team'], queryFn: () => meetingsApi.list({}) });
  const teamMeetings = useMemo(() => {
    const all = meetingsQ.data?.items ?? [];
    if (teamProjectIds.size === 0) return [];
    return all.filter((m) => teamProjectIds.has(String(m.project?._id ?? m.project ?? ''))).slice(0, 50);
  }, [meetingsQ.data, teamProjectIds]);
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

  const isTL = role === 'team_lead';
  useEffect(() => {
    if (isTL && !projectWorkspace) setTab('overview');
  }, [isTL, projectWorkspace]);
  const emailRows = teamRevisions.flatMap((r) => (r.emailLog ?? []).map((line, i) => ({
    key: `${String(r._id ?? '')}-${i}`,
    revision: r.drawing ?? r.details ?? '—',
    project: projLabel(r.project),
    line,
    when: r.createdAt,
  })));
  const workspaceTabs = isTL
    ? [
      { key: 'overview', label: 'Overview' },
      { key: 'team', label: 'Project & team' },
      { key: 'monitoring', label: 'Team work monitoring' },
      { key: 'assign', label: 'Assign work' },
      { key: 'awaiting', label: 'Awaiting response' },
      { key: 'deliverables', label: 'List of deliverables' },
      { key: 'revisions', label: 'Revision log' },
      { key: 'revision-entry', label: 'Revision entry' },
      { key: 'drawings', label: 'Drawing register' },
      { key: 'transmittal', label: 'Transmittal status' },
      { key: 'recruitment', label: 'Recruitment requests' },
    ]
    : [
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

  const tabs = isTL ? (projectWorkspace ? [...workspaceTabs.filter(t => t.key !== 'assign'), { key: 'meetings', label: 'Meetings' }, { key: 'completion', label: 'Stage completion' }] : [
      { key: 'overview', label: 'Overview' },
      { key: 'team', label: 'Project & team' },
      { key: 'monitoring', label: 'Team work monitoring' },
      { key: 'assign', label: 'Assign work' },
      { key: 'deliverables', label: 'Deliverables' },
      { key: 'awaiting', label: 'Awaiting response' },
      { key: 'revision', label: 'Revision' },
      { key: 'drawings', label: 'Drawing register' },
      { key: 'recruitment', label: 'Recruitment requests' },
    ]) : workspaceTabs;
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
        <div className="page-title">{projectWorkspace ? 'Project team workspace' : isTL ? 'My team' : 'My projects and team'}</div>
        <div className="page-sub">
          {selectedTeam ? `${(selectedTeam.lead && typeof selectedTeam.lead === 'object' ? [selectedTeam.lead.firstName, selectedTeam.lead.lastName].filter(Boolean).join(' ') : selectedTeam.lead) || 'Team Lead'} · ${selectedTeam.service ?? 'Structural'}` : (teamsQ.data?.items?.[0] ? `${(teamsQ.data.items[0].lead && typeof teamsQ.data.items[0].lead === 'object' ? [teamsQ.data.items[0].lead.firstName, teamsQ.data.items[0].lead.lastName].filter(Boolean).join(' ') : teamsQ.data.items[0].lead) || 'Team Lead'} · ${teamsQ.data.items[0].service ?? 'Structural'}` : (me ? `${empName(selfEmployee ?? me.employee ?? me)} · ${bootstrap?.role?.label ?? role}` : (teamsQ.isLoading ? 'Loading…' : `role ${role || '—'}`)))}
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
      <div className="kpi-grid cols-5">
        <KpiCard label="Active projects" value={activeProjects.length} accent="blueprint" />
        <KpiCard label="Team members" value={members.length} accent="forest" />
        <KpiCard label="Pending review" value={pendingEntries.length} accent="amber" />
        <KpiCard label="Awaiting response" value={openRfis.length} accent="rust" />
        <KpiCard label="Open revisions" value={openRevisionCount} accent="violet" />
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab==='revision'&&<Tabs tabs={[{key:'entry',label:'Revision entry'},{key:'log',label:'Revision log'}]} active={revisionTab} onChange={setRevisionTab}/>}
      <CoordinationPanel service={selectedTeam?.service}/>
      {tab === 'completion' && projectWorkspace && <StageRequestPanel projectId={projectId} />}
      {tab === 'meetings' && <SpocMeetings projectId={projectId} readOnly />}
      <>
          {tab === 'overview' && (
            <>
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
              {([...new Map(teams.flatMap(t=>(t.projects??[]).map(p=>[idOf(p),p]))).values()]).map(p=>{
                const unique=projectMembers(teams, p, true);
                return <Panel key={idOf(p)} title={p.name||p.code||'Project'} sub="Project team"><DataTable columns={[{key:'name',label:'Team member',render:memberName},{key:'service',label:'Service'},{key:'designation',label:'Designation',render:m=>memberEmp(m)?.designation||'—'},{key:'experience',label:'Experience',render:m=>expText(memberEmp(m))}]} rows={unique} emptyText="No confirmed members yet."/></Panel>;
              })}
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
              teamProjects={[...new Map(teams.flatMap(t => (t.projects ?? []).map(p => [idOf(p),p]))).values()]}
              teams={teams}
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
              {isTL && projectWorkspace && <DeliverableListPanel teamProjects={teamProjects} members={members} />}
              {(isTL && !projectWorkspace) && (
                <DeliverableAddPanel teamProjects={teamProjects} members={members} />
              )}
              {!isTL && (canDeliverAdd || role === 'team_lead') && (
                <DeliverableAddPanel teamProjects={teamProjects} members={members} />
              )}
              {(!isTL || !projectWorkspace) && <Panel title="My project deliverables" sub="Also visible on the Design Management deliverables tracker">
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
              </Panel>}
            </>
          )}

          {(tab === 'revisions'||(tab==='revision'&&revisionTab==='log')) && (
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
            </>
          )}

          {tab === 'drawings' && (
            <>
              {isTL&&<DrawingEntryPanel teamProjects={teamProjects} revisionValues={teamDrawings.map(d=>d.rev||d.revNo).filter(Boolean)}/>}
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
            </>
          )}

          {(tab === 'revision-entry'||(tab==='revision'&&revisionTab==='entry')) && (
            <>
              <RevisionEntryPanel teamProjects={teamProjects} members={members} canCreate={canRevCreate} />
              <Panel title="Email notifications sent" sub="One line per recipient, generated when a revision is submitted">
                <DataTable
                  columns={[
                    { key: 'revision', label: 'Revision', render: (r) => r.revision },
                    { key: 'project', label: 'Project', render: (r) => r.project },
                    { key: 'line', label: 'Notification', render: (r) => r.line },
                    { key: 'when', label: 'Logged', render: (r) => fmtDate(r.when) },
                  ]}
                  rows={emailRows}
                  emptyText="No revision emails yet."
                />
              </Panel>
            </>
          )}

          {tab === 'transmittal' && (
            <TransmittalStatusPanel
              teamProjects={teamProjects}
              teamDrawings={teamDrawings}
              teamTransmittals={teamTransmittals}
              transmittedDrawingIds={transmittedDrawingIds}
              ackedDrawingIds={ackedDrawingIds}
            />
          )}

          {tab === 'recruitment' && (
            <RecruitmentPanel rows={myRecruit} canSetStatus={canRecruitStatus} projectId={projectId} />
          )}
        </>

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

const TL_DELIVERABLE_STATUSES = ['Planned', 'In Progress', 'Submitted', 'Approved', 'Overdue'];
const TL_STAGES = ['CD', 'SD', 'DD', 'TD', 'GFC'];
const TL_SERVICES = ['SMEPF', 'SMEP', 'MEP', 'STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'BIM', 'GBS', 'Peer Review'];
const TL_ISSUED_TO = ['Client', 'Architect', 'PMC', 'Contractor', 'Authority', 'Other'];
const TL_METHODS = ['Portal', 'Email', 'Courier', 'Hand delivery', 'Transmittal'];

function dateInput(v) {
  return v ? String(v).slice(0, 10) : '';
}

function blankDeliverable() {
  return { _id: '', deliverable: '', stage: '', assignedTo: '', plannedDate: '', dueDate: '', status: 'Planned' };
}

function DeliverableListPanel({ teamProjects, members }) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const activeProject = projectId || String(teamProjects[0]?._id ?? teamProjects[0]?.id ?? '');
  const listQ = useQuery({
    queryKey: ['tl-deliverables', activeProject],
    queryFn: () => deliverablesApi.list({ project: activeProject }),
    enabled: !!activeProject,
  });
  useEffect(() => {
    const items = (listQ.data?.items ?? []).filter((d) => idOf(d.project) === activeProject);
    setRows(items.map((d) => ({
      _id: String(d._id ?? ''),
      deliverable: d.deliverable ?? '',
      stage: d.stage ?? '',
      assignedTo: idOf(d.assignedTo),
      plannedDate: dateInput(d.plannedDate),
      dueDate: dateInput(d.dueDate),
      status: d.status ?? 'Planned',
    })));
  }, [listQ.data, activeProject]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tl-deliverables'] });
    queryClient.invalidateQueries({ queryKey: ['deliverables'] });
  };
  const save = useMutation({
    mutationFn: async (list) => {
      const valid = list.filter((r) => r.deliverable.trim());
      if (valid.length !== list.length) throw new Error('Every row needs a deliverable name.');
      for (const r of valid) {
        const body = {
          project: activeProject,
          deliverable: r.deliverable.trim(),
          stage: r.stage || undefined,
          assignedTo: r.assignedTo || undefined,
          plannedDate: r.plannedDate || undefined,
          dueDate: r.dueDate || undefined,
          status: r.status || undefined,
        };
        if (r._id) await deliverablesApi.update(r._id, body);
        else await deliverablesApi.create(body);
      }
    },
    onSuccess: () => { setErr(''); setOk('List saved.'); refresh(); },
    onError: (e) => { setErr(e.message); setOk(''); },
  });
  const remove = useMutation({
    mutationFn: (id) => deliverablesApi.remove(id),
    onSuccess: () => { setErr(''); refresh(); },
    onError: (e) => setErr(e.message),
  });

  function patchRow(i, patch) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i) {
    const r = rows[i];
    if (r._id) remove.mutate(r._id);
    else setRows((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <Panel title="List of deliverables" sub="Editable list for the project — change any field in place, add or remove rows, then save">
      <div className="form-row" style={{ maxWidth: 360 }}>
        <label className="form-label">Project</label>
        <select className="filter-select" style={{ width: '100%' }} value={activeProject} onChange={(e) => setProjectId(e.target.value)}>
          {teamProjects.map((p) => (
            <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
          ))}
        </select>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Stage</th><th>Deliverable</th><th>Assigned to</th><th>Planned date</th><th>Due date</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7}>No deliverables for this project yet.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id || `new-${i}`}>
                <td>
                  <select className="filter-select" value={r.stage} onChange={(e) => patchRow(i, { stage: e.target.value })}>
                    <option value="">—</option>
                    {TL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><input className="form-input" value={r.deliverable} onChange={(e) => patchRow(i, { deliverable: e.target.value })} /></td>
                <td>
                  <select className="filter-select" value={r.assignedTo} onChange={(e) => patchRow(i, { assignedTo: e.target.value })}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={memberId(m)} value={memberId(m)}>{memberName(m)}</option>)}
                  </select>
                </td>
                <td><input type="date" className="form-input" value={r.plannedDate} onChange={(e) => patchRow(i, { plannedDate: e.target.value })} /></td>
                <td><input type="date" className="form-input" value={r.dueDate} onChange={(e) => patchRow(i, { dueDate: e.target.value })} /></td>
                <td>
                  <select className="filter-select" value={r.status} onChange={(e) => patchRow(i, { status: e.target.value })}>
                    {TL_DELIVERABLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button type="button" className="approve-btn" disabled={remove.isPending} onClick={() => removeRow(i)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>{err}</div>}
      {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 10 }}>{ok}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button type="button" className="approve-btn" onClick={() => setRows((prev) => [...prev, blankDeliverable()])}>+ Add deliverable</button>
        <button type="button" className="btn-primary" disabled={save.isPending || !activeProject} onClick={() => save.mutate(rows)}>
          {save.isPending ? 'Saving…' : 'Save list'}
        </button>
      </div>
    </Panel>
  );
}

function blankDrawing() {
  return { drawingNo: '', title: '', service: '', stage: '', rev: '', date: '', issuedTo: '', method: '' };
}

function DrawingEntryPanel({ teamProjects, revisionValues=[] }) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState([blankDrawing()]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const activeProject = projectId || String(teamProjects[0]?._id ?? teamProjects[0]?.id ?? '');
  const save = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => r.drawingNo.trim() && r.title.trim());
      if (valid.length === 0) throw new Error('Enter at least one drawing with a number and title.');
      for (const r of valid) {
        await drawingsApi.create({
          project: activeProject,
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
      return valid.length;
    },
    onSuccess: (n) => {
      setRows([blankDrawing()]);
      setErr('');
      setOk(`${n} drawing(s) added to the register.`);
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
    onError: (e) => { setErr(e.message); setOk(''); },
  });
  function patchRow(i, patch) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  return (
    <Panel title="Enter drawing details" sub="No file to upload? Type the drawing details straight into the register. Leave unused rows blank.">
      <div className="form-row" style={{ maxWidth: 360 }}>
        <label className="form-label">Project</label>
        <select className="filter-select" style={{ width: '100%' }} value={activeProject} onChange={(e) => setProjectId(e.target.value)}>
          {teamProjects.map((p) => (
            <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.name ?? p.code ?? '—'}</option>
          ))}
        </select>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Drawing no. *</th><th>Title *</th><th>Service</th><th>Stage</th><th>Rev</th><th>Date</th><th>Issued to</th><th>Method</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input className="form-input" value={r.drawingNo} placeholder="e.g. S-302" onChange={(e) => patchRow(i, { drawingNo: e.target.value })} /></td>
                <td><input className="form-input" value={r.title} onChange={(e) => patchRow(i, { title: e.target.value })} /></td>
                <td>
                  <select className="filter-select" value={r.service} onChange={(e) => patchRow(i, { service: e.target.value })}>
                    <option value="">—</option>
                    {TL_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select className="filter-select" value={r.stage} onChange={(e) => patchRow(i, { stage: e.target.value })}>
                    <option value="">—</option>
                    {TL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><select aria-label="Drawing revision" className="filter-select" value={r.rev} onChange={e=>patchRow(i,{rev:e.target.value})}>{[...new Set([r.rev,...revisionValues,...Array.from({length:100},(_,n)=>`R${String(n).padStart(2,'0')}`)])].map(v=><option key={v}>{v}</option>)}</select></td>
                <td><input type="date" className="form-input" value={r.date} onChange={(e) => patchRow(i, { date: e.target.value })} /></td>
                <td>
                  <select className="filter-select" value={r.issuedTo} onChange={(e) => patchRow(i, { issuedTo: e.target.value })}>
                    <option value="">—</option>
                    {TL_ISSUED_TO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select className="filter-select" value={r.method} onChange={(e) => patchRow(i, { method: e.target.value })}>
                    <option value="">—</option>
                    {TL_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button type="button" className="approve-btn" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} disabled={rows.length <= 1}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>{err}</div>}
      {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 10 }}>{ok}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button type="button" className="approve-btn" onClick={() => setRows((prev) => [...prev, blankDrawing()])}>+ Add row</button>
        <button type="button" className="btn-primary" disabled={save.isPending || !activeProject} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Add to register'}
        </button>
      </div>
    </Panel>
  );
}

function TransmittalStatusPanel({ teamProjects, teamDrawings, teamTransmittals, transmittedDrawingIds, ackedDrawingIds }) {
  const drawingIdOf = (d) => String(d._id ?? d.id ?? '');
  const awaiting = teamDrawings.filter((d) => !transmittedDrawingIds.has(drawingIdOf(d))).length;
  const inPrep = teamTransmittals.filter((x) => ['Pending', 'Prepared'].includes(x.status)).length;
  const sentAwaiting = teamTransmittals.filter((x) => x.status === 'Sent').length;
  const acked = teamTransmittals.filter((x) => x.status === 'Acknowledged').length;
  const projectRows = teamProjects.map((p) => {
    const pid = String(p._id ?? p.id ?? '');
    const drawings = teamDrawings.filter((d) => idOf(d.project) === pid);
    const gfc = drawings.filter((d) => String(d.stage ?? '').toUpperCase() === 'GFC');
    return {
      key: pid,
      name: p.name ?? p.code ?? '—',
      gfcTotal: gfc.length,
      gfcAcked: gfc.filter((d) => ackedDrawingIds.has(drawingIdOf(d))).length,
      inFlight: teamTransmittals.filter((x) => idOf(x.drawing?.project) === pid && ['Pending', 'Prepared', 'Sent'].includes(x.status)).length,
      awaitingTr: drawings.filter((d) => !transmittedDrawingIds.has(drawingIdOf(d))).length,
    };
  });
  const latest = [...teamTransmittals].sort((a, b) =>
    String(b.sentAt ?? b.createdAt ?? '').localeCompare(String(a.sentAt ?? a.createdAt ?? ''))).slice(0, 50);
  return (
    <>
      <div className="kpi-grid cols-5">
        <KpiCard label="Transmittal entries" value={teamTransmittals.length} accent="blueprint" />
        <KpiCard label="Drawings awaiting transmittal" value={awaiting} accent="amber" />
        <KpiCard label="In preparation" value={inPrep} accent="blueprint" />
        <KpiCard label="Sent, awaiting acknowledgement" value={sentAwaiting} accent="teal" />
        <KpiCard label="Acknowledged" value={acked} accent="forest" />
      </div>
      <Panel title="Transmittal progress by project" sub="Share of each project's GFC drawings that have been transmitted and acknowledged">
        {projectRows.length === 0 ? (
          <EmptyState text="No projects linked to this team." />
        ) : projectRows.map((r) => (
          <div key={r.key} style={{ fontSize: 13.5, marginBottom: 8 }}>
            <b>{r.name}</b> — {r.gfcAcked} of {r.gfcTotal} GFC drawings acknowledged · {r.inFlight} in preparation or sent · {r.awaitingTr} awaiting transmittal
          </div>
        ))}
      </Panel>
      <Panel title="Latest transmittal status" sub="Transmittals for the drawings my team has shared, with the latest status from Admin">
        <DataTable
          columns={[
            { key: 'trNo', label: 'TR no.', render: (x) => <span className="mono">{x.trNo ?? '—'}</span> },
            { key: 'project', label: 'Project', render: (x) => x.drawing?.project?.name ?? '—' },
            { key: 'drawing', label: 'Drawing', render: (x) => x.drawing?.drawingNo ?? '—' },
            { key: 'rev', label: 'Rev', render: (x) => x.rev ?? '—' },
            { key: 'issuedTo', label: 'Issued to', render: (x) => x.issuedTo ?? '—' },
            { key: 'status', label: 'Status', render: (x) => <StatusPill tone={toneFor(x.status)}>{x.status ?? '—'}</StatusPill> },
            { key: 'sent', label: 'Sent', render: (x) => fmtDate(x.sentAt) },
            { key: 'ack', label: 'Acknowledged', render: (x) => fmtDate(x.ackAt) },
            { key: 'handledBy', label: 'Handled by', render: (x) => x.handledBy ?? '—' },
            { key: 'remarks', label: 'Remarks', render: (x) => x.remarks ?? '—' },
          ]}
          rows={latest}
          emptyText="No transmittals for this team yet."
        />
      </Panel>
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

function AssignWorkPanel({members: selectedMembers,roleGroups: selectedGroups,teamProjects,myTasks,teams=[]}) {
  const queryClient=useQueryClient();
  const [section,setSection]=useState('deliverables');
  const [selMembers,setSelMembers]=useState([]);
  const [project,setProject]=useState(teamProjects.length === 1 ? idOf(teamProjects[0]) : '');
  const [stage,setStage]=useState('');
  const [deliverable,setDeliverable]=useState('');
  const [dueDate,setDueDate]=useState('');
  const [priority,setPriority]=useState('Medium');
  const [notes,setNotes]=useState('');
  const [err,setErr]=useState('');
  const members = teams.length ? projectMembers(teams, project) : selectedMembers;
  const roleGroups = teams.length ? [{ key: 'Project team', members }] : selectedGroups;
  const allIds = members.map(memberId).filter(Boolean);
  const create = useMutation({
    mutationFn: (body) => tasksApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setErr('');
      setSelMembers([]);
      setDeliverable('');
      setPriority('Medium');
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
    if (selMembers.some(id => !allIds.includes(id))) {
      setErr('The project team changed. Select its current members.');
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

  return <><Tabs tabs={[{key:'deliverables',label:'List of Deliverables'},{key:'task',label:'Assign Task'},{key:'mine',label:'Work Assigned by Me'}]} active={section} onChange={setSection}/>
    {section==='deliverables'&&<DeliverableListPanel teamProjects={teamProjects} members={members}/>}
    {section==='task'&&(      <Panel title="Assign work to a team member" sub="Creates a task that appears in that designer's “My work” view, grouped by stage">
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
              <select aria-label="Task project" className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => { if (e.target.value !== project) { setProject(e.target.value); setSelMembers([]); } }}>
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
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
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
)}
    {section==='mine'&&(      <Panel title="Tasks assigned by me" sub="Most recent first · appears live in each designer's own “My work” view">
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
)}
  </>;
}

function DeliverableAddPanel({ teamProjects, members }) {
  void members;
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [stage, setStage] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (body) => deliverablesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      setErr('');
      setDeliverable('');
      setStage('');
      setDueDate('');
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Panel title="Add a project deliverable" sub="Based on the Architect's Intent and specific project requirements — tracked through the Design Management workflow">
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
            stage: stage || undefined,
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
            <input className="form-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="Structural Design Basis Report" />
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="CD" />
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

function RevisionEntryPanel({ teamProjects, members=[], canCreate }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [stage, setStage] = useState('');
  const [drawing, setDrawing] = useState('');
  const [revNo, setRevNo] = useState('');
  const [details, setDetails] = useState('');
  const [resubmissionDue, setResubmissionDue] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const priority = 'Normal';
  const [err, setErr] = useState('');
  const [emailLog, setEmailLog] = useState(null);
  const [notifyEmployees, setNotifyEmployees] = useState([]);
  const empQ = useQuery({ queryKey: ['employees-revision-notify'], queryFn: () => employeesApi.list({}) });
  const notifyOptions = (empQ.data?.items ?? []).filter((e) => /director|design management/i.test(String(e.designation ?? '')));
  function toggleNotify(id) {
    setNotifyEmployees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const empLabel = (e) => `${[e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—'}${e.designation ? ` · ${e.designation}` : ''}`;
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
    <Panel title="Revision entry" sub="Log a revision as it happens. It is added to the Revision log and the designer's own dashboard, and email notifications go out to the concerned people automatically on submit.">
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
            assignedTo: assignedTo || undefined,
            resubmissionDue: resubmissionDue || undefined,
            details: details.trim(),
            priority,
            notifyEmployees,
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
            <label className="form-label">Stage *</label>
            <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Drawing / deliverable *</label>
            <input className="form-input" value={drawing} onChange={(e) => setDrawing(e.target.value)} placeholder="Select or type the item being revised" />
          </div>
          <div className="form-row">
            <label className="form-label">Revision no.</label>
            <input className="form-input" value={revNo} onChange={(e) => setRevNo(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Assigned to *</label>
            <select aria-label="Revision assigned to" className="filter-select" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">Select team member</option>{members.map(m=><option key={memberId(m)} value={memberId(m)}>{memberName(m)}</option>)}</select>
          </div>
          <div className="form-row">
            <label className="form-label">Raised by</label>
            <input className="form-input" value="Internal" readOnly />
          </div>
          <div className="form-row">
            <label className="form-label">Date raised</label>
            <input type="date" className="form-input" value={new Date().toISOString().slice(0,10)} readOnly />
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
          <label className="form-label">Also notify</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {notifyOptions.map((e) => (
              <label key={String(e._id ?? e.id)} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={notifyEmployees.includes(String(e._id ?? e.id))} onChange={() => toggleNotify(String(e._id ?? e.id))} />
                {empLabel(e)}
              </label>
            ))}
          </div>
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

function RecruitmentPanel({ rows, canSetStatus, projectId }) {
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
    mutationFn: (body) => recruitmentApi.create({ ...body, project: projectId }),
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
            <select className="filter-select" style={{ width: '100%' }} value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Select department</option>
              {['Structural', 'Electrical', 'Mechanical', 'Plumbing', 'Fire', 'QS', 'QA/QC', 'BIM', 'GBS', 'Peer Review', 'Coordination', 'Design Management', 'Admin', 'HR', 'Finance', 'Marketing'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
