import EntryDocuments from '../components/EntryDocuments.jsx';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi, projectsApi, request, toQuery } from '../lib/api.js';
import { spocApi } from '../lib/spocApi.js';
import { deliverablesApi, drawingsApi, revisionsApi } from '../lib/workApi.js';
import { rfiApi } from '../lib/functionsApi.js';
import {
  SUPER_ROLES,
  isPendingLogout,
  performLogout,
  takePendingLogout,
} from '../lib/session.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import { MAN_HOUR_NOTE } from '../components/SignOutButton.jsx';
import { meetingsApi } from '../lib/phase4bApi.js';
import SpocMeetings from '../components/meetings/SpocMeetings.jsx';

const SERVICES = [
  'SMEPF',
  'SMEP',
  'MEP',
  'STR',
  'PHE',
  'ELE',
  'HVAC',
  'FIRE',
  'BIM',
  'GBS',
];

const AREA_KEYS = [
  'Project Directory',
  'Meetings',
  'Meeting Scheduling & Coordination',
  'Drawings Sharing / Issuing',
  'RFI',
  'Architectural Updates',
  'Client Updates',
  'Revision Status',
  'Project Status',
  'Other',
];

const AREA_DESCRIPTIONS = {
  'Project Directory': 'Project directory preparation / updating / coordination',
  'Meetings': 'Meetings attended / participated in',
  'Meeting Scheduling & Coordination': 'Scheduling and coordinating project meetings',
  'Drawings Sharing / Issuing': 'Drawings shared / issued to Client / Architect / PMC / Team',
  'RFI': 'RFI raised / responded / followed up',
  'Architectural Updates': 'Updates received / followed up from Architect',
  'Client Updates': 'Client communication / updates / follow-up',
  'Revision Status': 'Revision follow-up and coordination; whether addressed or pending',
  'Project Status': 'Overall project status follow-up and coordination',
  'Other': 'Any other SPOC-related project work',
};

const REVISION_STATUSES = [
  'Addressed',
  'In Progress',
  'Pending',
  'Awaiting Client',
  'Awaiting Architect',
  'Awaiting Internal Team',
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return (
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    e.empId ||
    e.email ||
    '—'
  );
}

function allocProjectId(a) {
  const p = a?.project;
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p._id ?? p.id ?? null;
}

function allocProjectLabel(a) {
  const p = a?.project;
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}

function PendingLogoutCallout() {
  if (!isPendingLogout()) return null;
  return (
    <div className="login-error" role="alert" style={{ display: 'block' }}>
      {MAN_HOUR_NOTE} Save today&apos;s entry to complete sign-out.
    </div>
  );
}

function useCoordinationMetrics(myAllocs) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const revisions = useQuery({
    queryKey: ['work-revisions-open'],
    queryFn: () => request(`/api/work/revisions${toQuery({ status: 'Open' })}`),
  });
  const rfisQ = useQuery({
    queryKey: ['spoc-rfis-open'],
    queryFn: () => rfiApi.list({}),
  });
  const meetingsQ = useQuery({
    queryKey: ['meetings-week'],
    queryFn: () => meetingsApi.list({}),
  });
  const weekMeetings = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return (meetingsQ.data?.items ?? []).filter((m) => {
      if (m.status === 'Cancelled') return false;
      if (myIds.size > 0) {
        const pid = String(m.project?._id ?? m.project ?? '');
        if (!myIds.has(pid)) return false;
      }
      const d = m.date ? new Date(m.date) : null;
      return d && d >= start && d < end;
    });
  }, [meetingsQ.data, myIds]);

  const revItems = revisions.data?.items ?? [];
  const myRevisions = useMemo(() => {
    if (myIds.size === 0) return [];
    return revItems.filter((r) => {
      const pid =
        r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId ?? null;
      return pid != null && myIds.has(String(pid));
    });
  }, [revItems, myIds]);

  const overdue = useMemo(() => {
    const now = Date.now();
    return myRevisions.filter((r) => {
      const d = r?.due ?? r?.dueDate ?? r?.targetDate ?? null;
      return d != null && Number.isNaN(Date.parse(d)) === false && Date.parse(d) < now;
    });
  }, [myRevisions]);

  const openRfis = useMemo(() => {
    const items = rfisQ.data?.items ?? [];
    return items.filter((r) => {
      if (String(r.status ?? '').toLowerCase() === 'closed') return false;
      if (myIds.size === 0) return true;
      const pid = r?.project?._id ?? r?.project?.id ?? r?.project ?? null;
      return pid != null && myIds.has(String(pid));
    });
  }, [rfisQ.data, myIds]);

  return {
    weekMeetings,
    myRevisions,
    overdue,
    openRfis,
    meetingsLoading: meetingsQ.isLoading,
  };
}

function CoordinationKpis({ myAllocs }) {
  const { weekMeetings, myRevisions, overdue, openRfis, meetingsLoading } = useCoordinationMetrics(myAllocs);
  return (
    <div className="kpi-grid cols-4">
      <KpiCard label="My projects" value={myAllocs.length} accent="blueprint" />
      <KpiCard label="Open alerts" value={overdue.length + openRfis.length} accent="rust" />
      <KpiCard label="Meetings this week" value={meetingsLoading ? '…' : weekMeetings.length} accent="teal" />
      <KpiCard label="Pending my action" value={myRevisions.length + openRfis.length} accent="amber" />
    </div>
  );
}

function OverviewTab({ myAllocs, activeProjects, activeLoading }) {
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? allocProjectId(myAllocs[0]) ?? null;

  const detail = useQuery({
    queryKey: ['project', effectiveId],
    queryFn: () => projectsApi.get(effectiveId),
    enabled: !!effectiveId,
  });
  const { weekMeetings, myRevisions, openRfis } = useCoordinationMetrics(myAllocs);

  const proj = detail.data?.item ?? detail.data?.project ?? detail.data ?? {};
  const team = proj?.team ?? proj?.members ?? proj?.assignedTeam ?? null;
  const teamText = Array.isArray(team)
    ? team.map((m) => (typeof m === 'string' ? m : (m?.name ?? empName(m)))).join(', ')
    : (team?.name ?? team ?? null);

  return (
    <>
      <Panel title="My projects">
        <DataTable
          columns={[
            { key: 'name', label: 'Project', render: (r) => r.name ?? r.code ?? '—' },
            { key: 'branch', label: 'Branch', render: (r) => r.branch ?? '—' },
            { key: 'currentStage', label: 'Stage', render: (r) => r.currentStage ?? r.stage ?? '—' },
            { key: 'completion', label: 'Progress', render: (r) => (r.completion != null ? `${r.completion}%` : r.progress ?? '—') },
            { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
          ]}
          rows={myAllocs.length > 0 ? myAllocs.map((a) => {
            const projItem = activeProjects.find((p) => String(p._id ?? p.id ?? '') === String(allocProjectId(a) ?? '')) ?? activeProjects.find((p) => p.name === allocProjectLabel(a)) ?? {};
            return { ...projItem, name: projItem.name ?? projItem.code ?? allocProjectLabel(a) ?? '—' };
          }) : activeProjects}
          emptyText="No active projects."
        />
      </Panel>

      <Panel title={('Project overview — ' + (allocProjectLabel(myAllocs[0]) || 'Business park - Tower A'))}>
        <div className="field-grid">
          <Field label="Client" value={proj?.clientName || proj?.client || '—'} />
          <Field label="Current stage" value={proj?.currentStage || proj?.stage || '—'} />
          <Field label="Progress" value={(proj?.completion != null ? String(proj.completion) + '%' : proj?.progress || '—')} />
          <Field label="Project status" value={proj?.status || '—'} />
          <Field label="Branch" value={proj?.branch || activeProjects[0]?.branch || '—'} />
        </div>
        <div className="section-label" style={{ marginTop: 12 }}>Project team</div>
        <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {teamText ? (
            String(teamText).split(',').map((t) => {
              const trimmed = String(t).trim();
              const [name, service] = trimmed.split('·').map((s) => s.trim());
              return (
                <div key={trimmed} style={{ fontSize: 14 }}>
                  <b>{name || trimmed}</b>
                  {service ? <span style={{ color: 'var(--ink-muted)' }}> · {service}</span> : ''}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No team data available.</div>
          )}
        </div>
      </Panel>

      <Panel title="Alerts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {openRfis.length > 0 && openRfis.map((r, i) => (
            <div key={i}>
              <div className="section-label">Pending response</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Open</div>
              <div style={{ fontSize: 14 }}>{r.type || r.description || 'RFI pending'}</div>
            </div>
          ))}
          {myRevisions.length > 0 && (
            <div>
              <div className="section-label">Delayed activity</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Internal</div>
              <div style={{ fontSize: 14 }}>{myRevisions[0]?.title || 'Revision pending'}</div>
            </div>
          )}
          {weekMeetings.length > 0 && (
            <div>
              <div className="section-label">Submission due</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>In 3 days</div>
              <div style={{ fontSize: 14 }}>{weekMeetings[0]?.title || 'Meeting due'}</div>
            </div>
          )}
          {openRfis.length === 0 && myRevisions.length === 0 && weekMeetings.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No alerts.</div>
          )}
        </div>
      </Panel>
    </>
  );
}

function OtherProjectsTab({ myAllocs, activeProjects, activeLoading }) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const others = useMemo(() => {
    if (myIds.size === 0) return activeProjects;
    return activeProjects.filter((p) => !myIds.has(String(p._id ?? p.id ?? '')));
  }, [activeProjects, myIds]);

  const allocsQ = useQuery({ queryKey: ['spoc-allocations-all'], queryFn: () => request('/api/spoc/allocations') });
  const delsQ = useQuery({ queryKey: ['other-dels'], queryFn: () => deliverablesApi.list({}) });
  const meetsQ = useQuery({ queryKey: ['other-meets'], queryFn: () => meetingsApi.list({}) });
  const rfisQ = useQuery({ queryKey: ['other-rfis'], queryFn: () => rfiApi.list({}) });
  const revsQ = useQuery({ queryKey: ['other-revs'], queryFn: () => request('/api/work/revisions') });
  const entriesQ = useQuery({ queryKey: ['other-entries'], queryFn: () => spocApi.entriesList({}) });

  const allocs = allocsQ.data?.items ?? [];
  const spocFor = (pid) => {
    const a = allocs.find((x) => String(allocProjectId(x) ?? '') === String(pid) && String(x.status ?? '') === 'Approved')
      ?? allocs.find((x) => String(allocProjectId(x) ?? '') === String(pid));
    const c = a?.coordinator;
    if (!c) return '—';
    if (typeof c === 'string') return c;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.empId || '—';
  };
  const byProject = (items, getPid) => {
    const m = new Map();
    for (const r of items) {
      const pid = String(getPid(r) ?? '');
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid).push(r);
    }
    return m;
  };
  const delsBy = byProject(delsQ.data?.items ?? [], (r) => r?.project?._id ?? r?.project?.id ?? r?.project);
  const meetsBy = byProject(meetsQ.data?.items ?? [], (m) => m?.project?._id ?? m?.project);
  const rfisBy = byProject(rfisQ.data?.items ?? [], (r) => r?.project?._id ?? r?.project?.id ?? r?.project);
  const revsBy = byProject(revsQ.data?.items ?? [], (r) => r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId);
  const entriesBy = byProject(entriesQ.data?.items ?? [], (e) => e?.project?._id ?? e?.project?.id ?? e?.project);

  if (activeLoading) {
    return (
      <Panel title="Other projects (view only)">
        <EmptyState text="Loading…" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Other projects (view only)"
      sub="Limited, view-only status for projects allotted to other SPOCs — enough to stand in for a meeting, without detailed project or task-level information."
    >
      {others.length === 0 ? (
        <EmptyState text="No other active projects." />
      ) : (
        others.map((p) => {
          const pid = String(p._id ?? p.id ?? '');
          const dels = [...(delsBy.get(pid) ?? [])].sort((a, b) =>
            String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? ''))).slice(0, 2);
          const meets = [...(meetsBy.get(pid) ?? [])].filter((m) => m.status !== 'Cancelled').sort((a, b) =>
            String(a.date ?? '').localeCompare(String(b.date ?? ''))).slice(0, 2);
          const openRfis = (rfisBy.get(pid) ?? []).filter((r) => String(r.status ?? '').toLowerCase() !== 'closed');
          const openRevs = (revsBy.get(pid) ?? []).filter((r) => !['cleared', 'closed'].includes(String(r.status ?? r.revisionStatus ?? '').toLowerCase()));
          const overdue = openRevs.filter((r) => {
            const d = r?.due ?? r?.dueDate ?? null;
            return d && !Number.isNaN(Date.parse(d)) && Date.parse(d) < Date.now();
          });
          const latestEntries = [...(entriesBy.get(pid) ?? [])].sort((a, b) =>
            String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))).slice(0, 2);
          return (
            <div key={pid} style={{ marginBottom: 16, borderTop: '1px solid var(--line, #eee)', paddingTop: 12 }}>
              <div className="section-label">{p.name ?? p.code ?? '—'}</div>
              <div className="field-grid">
                <Field label="Allotted SPOC" value={allocsQ.isLoading ? '…' : spocFor(pid)} />
                <Field label="Current stage" value={p.currentStage ?? '—'} />
                <Field label="Overall status" value={p.status ?? '—'} />
                <Field
                  label="Recent submissions"
                  value={dels.length > 0 ? dels.map((d) => d.title ?? d.deliverable ?? d.name ?? '—').join(' · ') : 'None yet'}
                />
                <Field
                  label="Upcoming meetings"
                  value={meets.length > 0 ? meets.map((m) => `${m.title ?? 'Meeting'}${m.date ? `, ${String(m.date).slice(0, 10)}` : ''}`).join(' · ') : 'None scheduled'}
                />
                <Field
                  label="Key pending items"
                  value={[...openRfis.map((r) => r.type ?? 'RFI'), ...openRevs.map((r) => r.title ?? r.revNo ?? 'Revision')].slice(0, 3).join(' · ') || 'None'}
                />
                <Field
                  label="Major outstanding issues"
                  value={overdue.length > 0 ? `${overdue.length} overdue` : 'None'}
                />
                <Field
                  label="Key follow-ups and actions"
                  value={latestEntries.length > 0 ? latestEntries.map((e) => (e.areas ?? []).map((a) => a.update).filter(Boolean).join('; ') || e.service || 'Update').join(' · ') : 'None currently'}
                />
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}

const TEAM_SERVICES = [
  { key: 'Structural', role: 'Principal team lead — structural design and detailing' },
  { key: 'Electrical', role: 'Principal team lead — electrical layout and panel schedules' },
  { key: 'Mechanical', role: 'Principal team lead — HVAC layout and coordination' },
  { key: 'Plumbing', role: 'Principal team lead — drainage and plumbing layout' },
  { key: 'Fire', role: 'Principal team lead — fire protection sign-off' },
  { key: 'QS', role: 'Principal team lead — BOQ and area settlements' },
  { key: 'QA/QC', role: 'Site visits and inspection' },
  { key: 'BIM', role: 'Federated model and clash detection' },
];

const APPROVAL_OPTIONS = [
  { value: 'Approved', label: 'Approved' },
  { value: 'Proposed', label: 'Pending' },
];

const CONTACT_RESPONSIBILITY = {
  client: 'Client approvals and sign-off',
  architect: 'Base drawings, design coordination',
  coordinator: 'Overall coordination, single point of contact',
};

const COMPANY_NAME = 'Datum';

function projectIdOf(p) {
  return String(p?._id ?? p?.id ?? '');
}

function orgLabel(sub) {
  return sub ? `${COMPANY_NAME} (${sub})` : COMPANY_NAME;
}

function approvalLabel(value) {
  return APPROVAL_OPTIONS.find((o) => o.value === value)?.label ?? (value || '—');
}

function teamEntries(project) {
  return (project?.principalTeamLeads ?? []).flatMap((t) => {
    const names = (t.names ?? []).filter(Boolean);
    const list = names.length > 0 ? names : [t.name ?? ''];
    const base = {
      service: t.service ?? '',
      employee: t.employee ? String(t.employee._id ?? t.employee) : undefined,
      role: t.role ?? '',
      nominatedBy: t.nominatedBy ?? '',
      approvalStatus: t.approvalStatus ?? '',
    };
    return list.filter(Boolean).map((name) => ({ ...base, name }));
  });
}

function toTeamPayload(entries) {
  return entries
    .map((r) => ({
      service: (r.service ?? '').trim(),
      name: (r.name ?? '').trim(),
      ...(r.employee ? {employee:r.employee} : {}),
      ...(r.role?.trim() ? { role: r.role.trim() } : {}),
      ...(r.nominatedBy?.trim() ? { nominatedBy: r.nominatedBy.trim() } : {}),
      ...(r.approvalStatus ? { approvalStatus: r.approvalStatus } : {}),
    }))
    .filter((r) => r.service || r.name);
}

function employeeByName(employees, name) {
  return employees.find((e) => empName(e) === name) ?? null;
}

function employeeOf(ref, employees) {
  if (!ref) return null;
  const id = typeof ref === 'string' ? ref : String(ref._id ?? ref.id ?? '');
  const emp = employees.find((e) => String(e._id ?? e.id ?? '') === id);
  if (emp) return emp;
  return typeof ref === 'string' ? null : ref;
}

function coordinatorFor(projectId, myAllocs, employees) {
  const alloc = myAllocs.find((a) => allocProjectId(a) === projectId);
  return employeeOf(alloc?.coordinator, employees);
}

function serviceRows(project) {
  const entries = teamEntries(project);
  const rows = [];
  for (const s of TEAM_SERVICES) {
    const members = entries.filter((e) => e.service === s.key);
    if (members.length === 0) {
      rows.push({ key: `${s.key}-open`, service: s.key, name: '', role: s.role });
    } else {
      members.forEach((m, i) => rows.push({ key: `${s.key}-${i}`, service: s.key, name: m.name, role: m.role || s.role }));
    }
  }
  const known = new Set(TEAM_SERVICES.map((s) => s.key));
  entries
    .filter((e) => !known.has(e.service))
    .forEach((m, i) => rows.push({ key: `other-${i}`, service: m.service || '—', name: m.name, role: m.role }));
  return rows;
}

function InhouseTeamPanel({ projects, myAllocs, employees, loading }) {
  return (
    <Panel title="In-house project team — all services" sub="Service-wise, with role and coordinator details. Live from team allocation.">
      {loading ? (
        <EmptyState text="Loading…" />
      ) : projects.length === 0 ? (
        <EmptyState text="No active projects." />
      ) : (
        projects.map((p) => {
          const coord = coordinatorFor(projectIdOf(p), myAllocs, employees);
          return (
            <div key={projectIdOf(p)} style={{ marginBottom: 16 }}>
              <div className="section-label">{p.name ?? p.code ?? '—'}</div>
              <DataTable
                columns={[
                  { key: 'service', label: 'Service' },
                  { key: 'name', label: 'Team member', render: (r) => r.name || 'Not allocated' },
                  { key: 'role', label: 'Role / responsibility', render: (r) => r.role || '—' },
                  { key: 'coord', label: 'Coordinator / SPOC', render: () => (coord ? empName(coord) : '—') },
                ]}
                rows={serviceRows(p)}
                emptyText="No services."
              />
            </div>
          );
        })
      )}
    </Panel>
  );
}

export function TeamAllocationPanel({ projects, employees }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [role, setRole] = useState('');
  const [nominatedBy, setNominatedBy] = useState('');
  const [member, setMember] = useState('');
  const [status, setStatus] = useState('Approved');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const directors = useMemo(() => {
    const list = employees.filter((e) => /director|design management head/i.test(e.designation ?? ''));
    return list.length > 0 ? list : employees;
  }, [employees]);
  const withTeam = projects.filter((p) => teamEntries(p).length > 0);

  const save = useMutation({
    mutationFn: async (body) => {
      const detail = await projectsApi.get(body.project);
      const p = detail?.project ?? detail ?? {};
      const current = teamEntries(p);
      const selected = employees.find(e=>String(e._id ?? e.id)===body.member);
      const name = empName(selected);
      const idx = current.findIndex((r) => r.service === body.service && r.employee === body.member);
      const row = {
        service: body.service,
        name,
        employee:body.member,
        role: body.role,
        nominatedBy: body.nominatedBy,
        approvalStatus: body.status,
      };
      if (idx >= 0) current[idx] = { ...current[idx], ...row };
      else current.push(row);
      return projectsApi.saveTeamLeads(body.project, { principalTeamLeads: toTeamPayload(current) });
    },
    onSuccess: (_data, body) => {
      for (const key of ['projects','teams','my-teams','teams-allocation-projects']) queryClient.invalidateQueries({queryKey:[key]});
      queryClient.invalidateQueries({ queryKey: ['project-team', body.project] });
      queryClient.invalidateQueries({ queryKey: ['project', body.project] });
      setProject('');
      setService('');
      setRole('');
      setNominatedBy('');
      setMember('');
      setStatus('Approved');
      setErr('');
      setOk('Team allocation recorded.');
    },
    onError: (e) => {
      setErr(e.message);
      setOk('');
    },
  });

  function pickService(value) {
    setService(value);
    setRole(TEAM_SERVICES.find((s) => s.key === value)?.role ?? '');
  }

  function submit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!project) {
      setErr('Project is required.');
      return;
    }
    if (!service) {
      setErr('Service is required.');
      return;
    }
    if (!member) {
      setErr('Team member is required.');
      return;
    }
    save.mutate({ project, service, role: role.trim(), nominatedBy: nominatedBy || undefined, member, status });
  }

  return (
    <Panel title="Team allocation" sub="As nominated by the respective department Directors — record the approved allocation here once confirmed.">
      <div className="section-label" style={{ marginTop: 12 }}>Record allocation</div>
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project</option>
              {projects.map((p) => <option key={projectIdOf(p)} value={projectIdOf(p)}>{p.name ?? p.code ?? '—'}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Service</label>
            <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => pickService(e.target.value)}>
              <option value="">Select service</option>
              {TEAM_SERVICES.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Role / responsibility</label>
            <input className="form-input" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Nominated by (Director)</label>
            <select className="filter-select" style={{ width: '100%' }} value={nominatedBy} onChange={(e) => setNominatedBy(e.target.value)}>
              <option value="">Select director</option>
              {directors.map((d) => {
                const n = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || d.empId;
                return <option key={d._id ?? d.id} value={n}>{n}{d.designation ? `, ${d.designation}` : ''}</option>;
              })}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Team member</label>
            <select className="filter-select" style={{ width: '100%' }} value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Select member</option>
              {employees.map((x) => {
                const n = `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim() || x.empId;
                return <option key={x._id ?? x.id} value={x._id ?? x.id}>{n}{x.designation ? ` · ${x.designation}` : ''}</option>;
              })}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Approval status</label>
            <select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              {APPROVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{ok}</p>}
        <button type="submit" className="btn-primary" disabled={save.isPending} style={{ marginTop: 8 }}>
          {save.isPending ? 'Saving…' : 'Record allocation'}
        </button>
      </form>
      {withTeam.length === 0 ? (
        <EmptyState text="No team allocations recorded yet." />
      ) : (
        withTeam.map((p) => (
          <div key={projectIdOf(p)} style={{ marginBottom: 16 }}>
            <div className="section-label">{p.name ?? p.code ?? '—'}</div>
            <DataTable
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'nominatedBy', label: 'Nominated by', render: (r) => r.nominatedBy || '—' },
                { key: 'name', label: 'Team member' },
                { key: 'approvalStatus', label: 'Approval status', render: (r) => <StatusPill status={approvalLabel(r.approvalStatus)} /> },
              ]}
              rows={teamEntries(p)}
              emptyText="No team allocations."
            />
          </div>
        ))
      )}

    </Panel>
  );
}

function contactRows(project, myAllocs, employees) {
  const c = project.contacts ?? {};
  const rows = [];
  const push = (name, org, role, contact, resp) => {
    if (!name) return;
    rows.push({ name, org: org || '—', role: role || '—', contact: contact || '—', resp: resp || '—' });
  };
  push(c.client?.name, c.client?.company, c.client?.designation || 'Client', c.client?.email, CONTACT_RESPONSIBILITY.client);
  push(c.architect?.name, c.architect?.company, c.architect?.designation || 'Design architect', c.architect?.email, CONTACT_RESPONSIBILITY.architect);
  for (const t of teamEntries(project)) {
    const emp = employeeByName(employees, t.name);
    push(t.name, orgLabel(t.service), 'Principal team lead', emp?.email, `${t.service} queries and submissions`);
  }
  const coord = coordinatorFor(projectIdOf(project), myAllocs, employees);
  if (coord) push(empName(coord), orgLabel('Coordinator'), 'SPOC', coord.email, CONTACT_RESPONSIBILITY.coordinator);
  return rows;
}

function ProjectContactsPanel({ projects, myAllocs, employees, loading }) {
  return (
    <Panel title="Project contacts & coordination">
      {loading ? (
        <EmptyState text="Loading…" />
      ) : projects.length === 0 ? (
        <EmptyState text="No project contacts yet." />
      ) : (
        projects.map((p) => (
          <div key={projectIdOf(p)} style={{ marginBottom: 16 }}>
            <div className="section-label">{p.name ?? p.code ?? '—'}</div>
            <DataTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'org', label: 'Organisation' },
                { key: 'role', label: 'Role' },
                { key: 'contact', label: 'Contact' },
                { key: 'resp', label: 'Coordination responsibility' },
              ]}
              rows={contactRows(p, myAllocs, employees)}
              emptyText="No project contacts yet."
            />
          </div>
        ))
      )}
    </Panel>
  );
}

export function DirectoryTab({ myAllocs, activeProjects, activeLoading, canEdit = false }) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const projects = useMemo(
    () => (myIds.size === 0 ? activeProjects : activeProjects.filter((p) => myIds.has(projectIdOf(p)))),
    [activeProjects, myIds],
  );
  const empQ = useQuery({
    queryKey: ['employees-coord-dir'],
    queryFn: () => employeesApi.list({}),
  });
  const employees = empQ.data?.items ?? [];

  return (
    <>
      {canEdit && <TeamAllocationPanel projects={projects} employees={employees} />}
      <InhouseTeamPanel projects={projects} myAllocs={myAllocs} employees={employees} loading={activeLoading} />
      <ProjectContactsPanel projects={projects} myAllocs={myAllocs} employees={employees} loading={activeLoading} />
    </>
  );
}

function blankAreas() {
  return AREA_KEYS.map((key) => ({ key, selected: false, update: '', hours: '' }));
}

function DailyEntryTab({ myAllocs, activeProjects }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [areas, setAreas] = useState(blankAreas);
  const [err, setErr] = useState('');

  const projectOptions = myAllocs.length > 0
    ? myAllocs.map((a) => ({ id: allocProjectId(a), label: allocProjectLabel(a) })).filter((o) => o.id)
    : (activeProjects ?? []).map((p) => ({ id: p._id ?? p.id, label: p.name ?? p.code ?? '—' }));

  const listQ = useQuery({
    queryKey: ['spoc-entries', { mine: true, date }],
    queryFn: () => spocApi.entriesList({ mine: true, date }),
  });
  const allQ = useQuery({
    queryKey: ['spoc-entries', { mine: true }],
    queryFn: () => spocApi.entriesList({ mine: true }),
  });
  const dayItems = listQ.data?.items ?? [];
  const recentItems = useMemo(
    () => [...(allQ.data?.items ?? [])].sort((a, b) =>
      String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? '')),
    ),
    [allQ.data],
  );
  const dayTotal = useMemo(
    () => dayItems.reduce((s, r) => s + (Number(r.totalHours) || 0), 0),
    [dayItems],
  );

  const total = useMemo(
    () => areas.reduce((sum, a) => sum + (a.selected ? parseFloat(a.hours) || 0 : 0), 0),
    [areas],
  );

  function setArea(i, patch) {
    setAreas((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  function handleClear() {
    setAreas(blankAreas());
    setService('');
    setErr('');
  }

  const save = useMutation({
    mutationFn: (body) => spocApi.entriesCreate(body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-entries'] });
      handleClear();
      if (takePendingLogout()) {
        await performLogout(queryClient);
        navigate('/');
      }
    },
    onError: (e) => setErr(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!project) {
      setErr('Project is required.');
      return;
    }
    if (!service) {
      setErr('Service is required.');
      return;
    }
    const selectedAreas = areas.filter((area) => area.selected);
    if (selectedAreas.length === 0) {
      setErr('Select at least one work area.');
      return;
    }
    save.mutate({
      date,
      project,
      service,
      areas: selectedAreas.map((a) => ({
        key: a.key,
        update: a.update || undefined,
        hours: a.hours === '' ? undefined : Number(a.hours),
      })),
    });
  }

  return (
    <>
      <PendingLogoutCallout />
      <Panel title="SPOC daily work update / man-hour entry" sub="Pick the project and service, tick the work areas you handled today, and record a short update with the man-hours spent.">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Project name</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projectOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Service</label>
              <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Select service</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="section-label">SPOC work performed</div>
          <table className="data">
            <thead>
              <tr>
                <th>Work area</th>
                <th>Daily update / remarks</th>
                <th style={{ width: 110 }}>Man-hours</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a, i) => (
                <tr key={a.key}>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={a.selected}
                        onChange={(e) => setArea(i, {
                          selected: e.target.checked,
                          update: e.target.checked ? a.update : '',
                          hours: e.target.checked ? a.hours : '',
                        })}
                        aria-label={`Select ${a.key} work area`}
                      />
                      <span>
                        {a.key}
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                          {AREA_DESCRIPTIONS[a.key] ?? ''}
                        </span>
                      </span>
                    </label>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      value={a.update}
                      onChange={(e) => setArea(i, { update: e.target.value })}
                      placeholder="Update"
                      aria-label={`${a.key} update`}
                      disabled={!a.selected}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={a.hours}
                      onChange={(e) => setArea(i, { hours: e.target.value })}
                      aria-label={`${a.key} hours`}
                      disabled={!a.selected}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13.5, marginTop: 12 }}>
            Total man-hours for the project / service: <b className="mono">{total}</b> hrs · {MAN_HOUR_NOTE}
          </p>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save entry'}
            </button>
            <button type="button" className="approve-btn" onClick={handleClear}>
              Clear
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 8 }}>
            Worked on another project or service today? Save this entry, then fill the form again — each project / service is saved as its own entry.
          </p>
        </form>
      </Panel>
      <Panel title="My daily entries" sub={`Most recent first${dayTotal ? ` · ${dayTotal} hrs on ${date}` : ''}`}>
        {allQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : allQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {allQ.error.message}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => String(r.date ?? r.createdAt ?? '').slice(0, 10) },
              { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project?.code ?? '—' },
              { key: 'service', label: 'Service' },
              { key: 'totalHours', label: 'Hours', render: (r) => r.totalHours ?? '—' },
              { key: 'documents', label: 'Documents', render: r => <EntryDocuments entry={r} spoc /> },
            ]}
            rows={recentItems}
            emptyText="No entries saved yet."
          />
        )}
      </Panel>
    </>
  );
}

function CoordinationMeetingsTab() {
  return <SpocMeetings />;
}

function useMyProjectIds(myAllocs, activeProjects) {
  return useMemo(() => {
    const ids = myAllocs.map(allocProjectId).filter(Boolean).map(String);
    if (ids.length > 0) return [...new Set(ids)];
    return (activeProjects ?? []).map((p) => String(p._id ?? p.id ?? '')).filter(Boolean);
  }, [myAllocs, activeProjects]);
}

function DelDrawTab({ myAllocs, activeProjects }) {
  const ids = useMyProjectIds(myAllocs, activeProjects);
  const delsQ = useQuery({ queryKey: ['spoc-dels', ids.join(',')], queryFn: () => deliverablesApi.list({}), enabled: ids.length > 0 });
  const drgsQ = useQuery({ queryKey: ['spoc-drgs', ids.join(',')], queryFn: () => drawingsApi.list({}), enabled: ids.length > 0 });
  const inMine = (r) => {
    const pid = String(r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId ?? '');
    return ids.includes(pid);
  };
  const dels = (delsQ.data?.items ?? []).filter(inMine);
  const drgs = (drgsQ.data?.items ?? []).filter(inMine);
  return (
    <>
      <Panel title="Deliverables (entry top)">
        <DataTable columns={[
          { key: 'title', label: 'Deliverable', render: (r) => r.title ?? r.deliverable ?? r.name ?? '—' },
          { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
          { key: 'stage', label: 'Stage' },
          { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill status={r.status}>{r.status}</StatusPill> : '—' },
        ]} rows={dels} emptyText="No deliverables for your projects yet." />
      </Panel>
      <Panel title="Drawings (log bottom)">
        <DataTable columns={[
          { key: 'drawingNo', label: 'Drawing no' },
          { key: 'title', label: 'Title' },
          { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
          { key: 'service', label: 'Service' },
          { key: 'stage', label: 'Stage' },
        ]} rows={drgs} emptyText="No drawings for your projects yet." />
      </Panel>
    </>
  );
}

function RevisionLogTab({ myAllocs, activeProjects }) {
  const ids = useMyProjectIds(myAllocs, activeProjects);
  const revQ = useQuery({ queryKey: ['spoc-revs', ids.join(',')], queryFn: () => revisionsApi.list({}), enabled: ids.length > 0 });
  const rows = (revQ.data?.items ?? []).filter((r) => {
    const pid = String(r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId ?? '');
    return ids.includes(pid);
  });
  return (
    <Panel title="Revision log">
      <DataTable columns={[
        { key: 'title', label: 'Revision', render: (r) => r.title ?? r.revNo ?? r._id ?? '—' },
        { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
        { key: 'due', label: 'Due', render: (r) => r.due ?? r.dueDate ?? '—' },
      ]} rows={rows} emptyText="No revisions for your projects yet." />
    </Panel>
  );
}

function PendingTab({ myAllocs, activeProjects }) {
  const ids = useMyProjectIds(myAllocs, activeProjects);
  const rfisQ = useQuery({ queryKey: ['spoc-rfis-pending'], queryFn: () => rfiApi.list({}), enabled: ids.length > 0 });
  const revQ = useQuery({ queryKey: ['spoc-revs-pending'], queryFn: () => revisionsApi.list({}), enabled: ids.length > 0 });
  const inMine = (r) => ids.includes(String(r?.project?._id ?? r?.project?.id ?? r?.project ?? r?.projectId ?? ''));
  const rfis = (rfisQ.data?.items ?? []).filter((r) => inMine(r) && String(r.status ?? '').toLowerCase() !== 'closed');
  const revs = (revQ.data?.items ?? []).filter((r) => inMine(r) && String(r.status ?? '').toLowerCase() !== 'cleared');
  return (
    <>
      <Panel title="Pending RFIs (entry top)">
        <DataTable columns={[
          { key: 'type', label: 'Type' },
          { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status ?? '—'}</StatusPill> },
        ]} rows={rfis} emptyText="No pending RFIs." />
      </Panel>
      <Panel title="Follow-up revisions (log bottom)">
        <DataTable columns={[
          { key: 'title', label: 'Revision', render: (r) => r.title ?? r.revNo ?? '—' },
          { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
          { key: 'status', label: 'Status' },
        ]} rows={revs} emptyText="No pending revisions." />
      </Panel>
    </>
  );
}

function CoordRfiTab({ myAllocs, activeProjects }) {
  const ids = useMyProjectIds(myAllocs, activeProjects);
  const entriesQ = useQuery({ queryKey: ['spoc-coord-entries'], queryFn: () => spocApi.entriesList({ mine: true }) });
  const rfisQ = useQuery({ queryKey: ['spoc-coord-rfis'], queryFn: () => rfiApi.list({}) });
  const entries = entriesQ.data?.items ?? [];
  const rfis = (rfisQ.data?.items ?? []).filter((r) => ids.includes(String(r?.project?._id ?? r?.project?.id ?? r?.project ?? '')));
  return (
    <>
      <Panel title="Coordination log (entry top)">
        <DataTable columns={[
          { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? '—' },
          { key: 'service', label: 'Service' },
          { key: 'totalHours', label: 'Hours' },
        ]} rows={entries} emptyText="No coordination entries yet." />
      </Panel>
      <Panel title="RFI log (bottom)">
        <DataTable columns={[
          { key: 'type', label: 'Type' },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status' },
        ]} rows={rfis} emptyText="No RFIs for your projects." />
      </Panel>
    </>
  );
}

export default function MyCoordinationPage({ bootstrap, user }) {
  const [tab, setTab] = useState('daily');
  const roleKey = bootstrap?.role?.key;
  const isSuper = SUPER_ROLES.includes(roleKey);
  const userName = user?.name ?? user?.email ?? '';
  const roleLabel = bootstrap?.role?.label ?? roleKey ?? '';

  const allocQ = useQuery({
    queryKey: ['spoc-allocations-mine'],
    queryFn: spocApi.allocationsMine,
  });
  const activeQ = useQuery({
    queryKey: ['projects', 'active-coord'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const myAllocs = allocQ.data?.items ?? [];
  const activeProjects = activeQ.data?.items ?? [];

  return (
    <>
      <div className="page-head">
        <div className="page-title">My Coordination</div>
        <div className="page-sub">
          {allocQ.isLoading ? 'Loading…' : `${myAllocs.length} allocated project(s)`}
        </div>
        {userName && (
          <div className="page-sub" style={{ marginTop: 4 }}>
            {userName}{roleLabel ? ` · ${roleLabel}` : ''} · single point of contact to client, architect, and internal teams
          </div>
        )}
        <div className="page-sub" style={{ marginTop: 2 }}>
          Your coordination work, project updates and meetings are visible on the Design Management dashboard.
        </div>
      </div>
      {isSuper && (
        <Panel title="Role note">
          <EmptyState text={`Previewing the coordinator workspace as ${bootstrap?.role?.label ?? roleKey}.`} />
        </Panel>
      )}
      {allocQ.isError && (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {allocQ.error.message}
        </div>
      )}
      <CoordinationKpis myAllocs={myAllocs} />
      <Tabs
        tabs={[
          { key: 'daily', label: 'Daily work update' },
          { key: 'other', label: 'Other projects' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'daily' && <DailyEntryTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'other' && <OtherProjectsTab myAllocs={myAllocs} activeProjects={activeProjects} activeLoading={activeQ.isLoading} />}
    </>
  );
}
