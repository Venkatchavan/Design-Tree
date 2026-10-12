import { useEffect, useMemo, useState } from 'react';
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

const PTL_SERVICES = ['SMEPF', 'SMEP', 'MEP', 'STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'BIM', 'GBS'];

const CONTACT_FIELDS = ['name', 'designation', 'company', 'phone', 'email'];
const CONTACT_LABELS = {
  name: 'Name',
  designation: 'Designation',
  company: 'Company',
  phone: 'Phone',
  email: 'Email',
};

function blankContact() {
  return { name: '', designation: '', company: '', phone: '', email: '' };
}

function compactContact(c) {
  const out = {};
  for (const k of CONTACT_FIELDS) {
    const v = (c?.[k] ?? '').trim();
    if (v) out[k] = v;
  }
  return out;
}

function contactInputs(value, setValue, prefix) {
  return (
    <div className="field-grid">
      {CONTACT_FIELDS.map((k) => (
        <div className="form-row" key={k}>
          <label className="form-label" htmlFor={`${prefix}-${k}`}>
            {CONTACT_LABELS[k]}
          </label>
          <input
            id={`${prefix}-${k}`}
            className="form-input"
            value={value[k] ?? ''}
            onChange={(e) => setValue({ ...value, [k]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

// SPOC-owned PMC / Peer Review contacts. Saved to the canonical project
// contacts, so the project-detail Contacts panel picks them up automatically.
function SpocContactsEditor() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [pmc, setPmc] = useState(blankContact());
  const [peer, setPeer] = useState(blankContact());
  const [loadedFor, setLoadedFor] = useState('');

  const projQ = useQuery({
    queryKey: ['projects', 'active-spoc-contacts'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const projects = projQ.data?.items ?? [];
  const effectiveId = projectId || projects[0]?._id || projects[0]?.id || '';

  const detailQ = useQuery({
    queryKey: ['project', effectiveId],
    queryFn: () => projectsApi.get(effectiveId),
    enabled: !!effectiveId,
    retry: false,
  });

  useEffect(() => {
    if (!detailQ.data || loadedFor === effectiveId) return;
    const p = detailQ.data?.project ?? detailQ.data ?? {};
    setPmc({ ...blankContact(), ...(p.contacts?.pmc ?? {}) });
    setPeer({ ...blankContact(), ...(p.contacts?.peerReview ?? {}) });
    setLoadedFor(effectiveId);
  }, [detailQ.data, effectiveId, loadedFor]);

  const save = useMutation({
    mutationFn: () =>
      projectsApi.saveSpocContacts(effectiveId, {
        pmc: compactContact(pmc),
        peerReview: compactContact(peer),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setLoadedFor('');
    },
  });

  return (
    <Panel
      title="PMC & Peer Review contacts (SPOC owned)"
      sub="Admin staff do not enter these — they appear on the project detail Contacts panel once saved here."
    >
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label className="form-label">Project</label>
        <select
          className="filter-select"
          style={{ width: '100%' }}
          value={effectiveId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setLoadedFor('');
          }}
        >
          {projects.map((p) => (
            <option key={p._id ?? p.id} value={p._id ?? p.id}>
              {p.name ?? p.code ?? '—'}
            </option>
          ))}
        </select>
      </div>
      {detailQ.isLoading ? (
        <EmptyState text="Loading contacts…" />
      ) : detailQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {detailQ.error.message}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="section-label" style={{ marginTop: 12 }}>
            PMC contact
          </div>
          {contactInputs(pmc, setPmc, 'spoc-pmc')}
          <div className="section-label" style={{ marginTop: 12 }}>
            Peer Review contact
          </div>
          {contactInputs(peer, setPeer, 'spoc-peer')}
          {save.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {save.error.message}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending || !effectiveId} style={{ marginTop: 12 }}>
            {save.isPending ? 'Saving…' : 'Save contacts'}
          </button>
        </form>
      )}
    </Panel>
  );
}

// SPOC-owned principal team leads (+ optional related director/head).
// Saved to the canonical project, so the admin dashboard column and the
// project-detail team panel reflect them. Multiple people per service.
function SpocTeamLeadsEditor() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState([{ service: '', name: '' }]);
  const [related, setRelated] = useState({
    projectDirector: '',
    projectDirectorDesignation: '',
    projectHead: '',
    projectHeadDesignation: '',
  });
  const [loadedFor, setLoadedFor] = useState('');

  const projQ = useQuery({
    queryKey: ['projects', 'active-spoc-leads'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const projects = projQ.data?.items ?? [];
  const effectiveId = projectId || projects[0]?._id || projects[0]?.id || '';
  const empQ = useQuery({
    queryKey: ['employees-dir'],
    queryFn: () => employeesApi.list({}),
  });
  const employees = empQ.data?.items ?? [];

  const detailQ = useQuery({
    queryKey: ['project', effectiveId],
    queryFn: () => projectsApi.get(effectiveId),
    enabled: !!effectiveId,
    retry: false,
  });

  useEffect(() => {
    if (!detailQ.data || loadedFor === effectiveId) return;
    const p = detailQ.data?.project ?? detailQ.data ?? {};
    const list = (p.principalTeamLeads ?? []).flatMap((t) => {
      const names = (t.names ?? []).filter(Boolean);
      const extra = { role: t.role ?? '', nominatedBy: t.nominatedBy ?? '', approvalStatus: t.approvalStatus ?? '' };
      if (names.length > 0) return names.map((n) => ({ service: t.service ?? '', name: n, ...extra }));
      return [{ service: t.service ?? '', name: t.name ?? '', ...extra }];
    });
    setRows(list.length > 0 ? list : [{ service: '', name: '' }]);
    setRelated({
      projectDirector: p.related?.projectDirector ?? '',
      projectDirectorDesignation: p.related?.projectDirectorDesignation ?? '',
      projectHead: p.related?.projectHead ?? '',
      projectHeadDesignation: p.related?.projectHeadDesignation ?? '',
    });
    setLoadedFor(effectiveId);
  }, [detailQ.data, effectiveId, loadedFor]);

  const save = useMutation({
    mutationFn: () =>
      projectsApi.saveTeamLeads(effectiveId, {
        principalTeamLeads: rows
          .map((r) => ({
            service: (r.service ?? '').trim(),
            name: (r.name ?? '').trim(),
            ...(r.role?.trim() ? { role: r.role.trim() } : {}),
            ...(r.nominatedBy?.trim() ? { nominatedBy: r.nominatedBy.trim() } : {}),
            ...(r.approvalStatus ? { approvalStatus: r.approvalStatus } : {}),
          }))
          .filter((r) => r.service || r.name),
        related,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setLoadedFor('');
    },
  });

  function patchRow(i, patch) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <Panel
      title="Project team leads (SPOC owned)"
      sub="Entered here by the SPOC — shown read-only on the admin dashboard and project detail. Add multiple people under each service."
    >
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label className="form-label">Project</label>
        <select
          className="filter-select"
          style={{ width: '100%' }}
          value={effectiveId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setLoadedFor('');
          }}
        >
          {projects.map((p) => (
            <option key={p._id ?? p.id} value={p._id ?? p.id}>
              {p.name ?? p.code ?? '—'}
            </option>
          ))}
        </select>
      </div>
      {detailQ.isLoading ? (
        <EmptyState text="Loading team…" />
      ) : detailQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {detailQ.error.message}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div style={{ marginTop: 12 }}>
            {rows.map((r, i) => (
              <div className="field-grid" key={i}>
                <div className="form-row">
                  <label className="form-label">Service</label>
                  <select
                    className="filter-select"
                    style={{ width: '100%' }}
                    value={r.service}
                    onChange={(e) => patchRow(i, { service: e.target.value })}
                  >
                    <option value="">Select service</option>
                    {PTL_SERVICES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Name</label>
                  <select
                    className="filter-select"
                    style={{ width: '100%' }}
                    value={r.name}
                    onChange={(e) => patchRow(i, { name: e.target.value })}
                  >
                    <option value="">Select person</option>
                    {employees.map((e) => {
                      const n = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.empId || e.email;
                      return <option key={e._id ?? e.id} value={n}>{n}{e.designation ? ` · ${e.designation}` : ''}</option>;
                    })}
                  </select>
                </div>
                <div className="form-row" style={{ alignItems: 'end' }}>
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    disabled={rows.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="approve-btn"
              style={{ marginTop: 8 }}
              onClick={() => setRows((prev) => [...prev, { service: '', name: '' }])}
            >
              Add person
            </button>
          </div>
          <div className="section-label" style={{ marginTop: 12 }}>
            Related (optional override)
          </div>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project Director</label>
              <input
                className="form-input"
                value={related.projectDirector}
                onChange={(e) => setRelated({ ...related, projectDirector: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Director designation</label>
              <input
                className="form-input"
                value={related.projectDirectorDesignation}
                onChange={(e) => setRelated({ ...related, projectDirectorDesignation: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Project Head</label>
              <input
                className="form-input"
                value={related.projectHead}
                onChange={(e) => setRelated({ ...related, projectHead: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Head designation</label>
              <input
                className="form-input"
                value={related.projectHeadDesignation}
                onChange={(e) => setRelated({ ...related, projectHeadDesignation: e.target.value })}
              />
            </div>
          </div>
          {save.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {save.error.message}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending || !effectiveId} style={{ marginTop: 12 }}>
            {save.isPending ? 'Saving…' : 'Save team'}
          </button>
        </form>
      )}
    </Panel>
  );
}

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

function OverviewTab({ myAllocs, activeProjects, activeLoading }) {
  const myIds = useMemo(
    () => new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String)),
    [myAllocs],
  );
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? allocProjectId(myAllocs[0]) ?? null;

  const detail = useQuery({
    queryKey: ['project', effectiveId],
    queryFn: () => projectsApi.get(effectiveId),
    enabled: !!effectiveId,
  });
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

  const openAlerts = overdue.length + openRfis.length;
  const pendingAction = myRevisions.length + openRfis.length;

  const proj = detail.data?.item ?? detail.data?.project ?? detail.data ?? {};
  const team = proj?.team ?? proj?.members ?? proj?.assignedTeam ?? null;
  const teamText = Array.isArray(team)
    ? team.map((m) => (typeof m === 'string' ? m : (m?.name ?? empName(m)))).join(', ')
    : (team?.name ?? team ?? null);

  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="My projects" value={myAllocs.length} accent="blueprint" />
        <KpiCard label="Open alerts" value={openAlerts} accent="rust" />
        <KpiCard label="Meetings this week" value={meetingsQ.isLoading ? '…' : weekMeetings.length} accent="teal" />
        <KpiCard label="Pending my action" value={pendingAction} accent="amber" />
      </div>
      <Panel title="Meetings this week">
        {meetingsQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'title', label: 'Meeting' },
              { key: 'project', label: 'Project', render: (m) => m.project?.name ?? '—' },
              { key: 'date', label: 'Date', render: (m) => (m.date ? String(m.date).slice(0, 10) : '—') },
              { key: 'time', label: 'Time', render: (m) => [m.startTime, m.endTime].filter(Boolean).join('–') || '—' },
              { key: 'status', label: 'Status', render: (m) => <StatusPill status={m.status}>{m.status}</StatusPill> },
            ]}
            rows={weekMeetings}
            emptyText="No meetings scheduled for your projects this week. Schedule one in the Meetings tab."
          />
        )}
      </Panel>

      {myAllocs.length === 0 ? (
        <Panel title="My projects">
          <EmptyState text="No allocations yet. Allocation is recorded in the Team allocation tab." />
          <div className="section-label">All active projects</div>
          {activeLoading ? (
            <EmptyState text="Loading…" />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Project', render: (r) => r.name ?? '—' },
                { key: 'code', label: 'Code' },
                { key: 'branch', label: 'Branch' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill>,
                },
              ]}
              rows={activeProjects}
              emptyText="No active projects."
            />
          )}
        </Panel>
      ) : (
        <>
          <Panel title="My projects">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {myAllocs.map((a, i) => {
                const pid = allocProjectId(a);
                const active = String(pid) === String(effectiveId);
                return (
                  <button
                    key={pid ?? i}
                    type="button"
                    className={`tab-btn${active ? ' active' : ''}`}
                    onClick={() => setSelectedId(pid)}
                  >
                    {allocProjectLabel(a)}
                  </button>
                );
              })}
            </div>
            {detail.isLoading ? (
              <EmptyState text="Loading…" />
            ) : detail.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {detail.error.message}
              </div>
            ) : (
              <div className="field-grid">
                <Field label="Client" value={proj?.clientName ?? proj?.client} />
                <Field label="Stage" value={proj?.currentStage ?? proj?.stage} />
                <Field
                  label="Progress"
                  value={proj?.completion != null ? `${proj.completion}%` : proj?.progress}
                />
                <Field label="Team" value={teamText} />
                <Field label="Status" value={proj?.status} />
                <Field label="Branch" value={proj?.branch} />
              </div>
            )}
          </Panel>
          <Panel title="Alerts">
            {revisions.isLoading ? (
              <EmptyState text="Loading…" />
            ) : revisions.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {revisions.error.message}
              </div>
            ) : myRevisions.length === 0 ? (
              <EmptyState text="No open revisions on your projects." />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Revision', render: (r) => r.title ?? r.refNo ?? r._id ?? '—' },
                  { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => <StatusPill tone={statusTone(r.revisionStatus ?? r.status)}>{r.revisionStatus ?? r.status ?? '—'}</StatusPill>,
                  },
                  { key: 'due', label: 'Due', render: (r) => r.due ?? r.dueDate ?? '—' },
                ]}
                rows={myRevisions}
                emptyText="No open revisions on your projects."
              />
            )}
            {overdue.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-danger, #a33)' }}>
                {overdue.length} overdue revision(s) need attention.
              </p>
            )}
          </Panel>
        </>
      )}
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

function BillingRequestPanel() {
  const queryClient = useQueryClient();
  const [remark, setRemark] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const stagesQ = useQuery({
    queryKey: ['billing-stages-spoc'],
    queryFn: () => request('/api/billing/stages'),
  });
  const pending = (stagesQ.data?.items ?? []).filter((r) => r.confirmationStatus === 'PTL Requested');

  const confirm = useMutation({
    mutationFn: (row) => request('/api/billing/stages', {
      method: 'POST',
      body: JSON.stringify({
        project: typeof row.project === 'object' ? (row.project._id ?? row.project.id) : row.project,
        service: row.service || undefined,
        stage: row.stage || undefined,
        confirmCompletion: true,
        spocRemark: remark || undefined,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-stages-spoc'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stages'] });
      setErr(''); setOk('Confirmed — DMH, directors and Admin billing notified.');
    },
    onError: (e) => { setErr(e.message); setOk(''); },
  });

  return (
    <Panel
      title="SPOC final confirm — PTL requests (2FA)"
      sub="PTL requests land here. SPOC confirms → reflects to DMH, all directors, then Admin billing."
    >
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label className="form-label">Confirm remark (optional)</label>
        <input className="form-input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Final confirm note" />
      </div>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{ok}</p>}
      {stagesQ.isLoading ? (
        <EmptyState text="Loading PTL requests…" />
      ) : pending.length === 0 ? (
        <EmptyState text="No PTL completion requests awaiting SPOC confirm." />
      ) : (
        <DataTable
          columns={[
            { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
            { key: 'service', label: 'Service' },
            { key: 'stage', label: 'Stage' },
            { key: 'ptlRemark', label: 'PTL remark', render: (r) => r.ptlRemark ?? '—' },
            {
              key: 'confirm', label: '', render: (r) => (
                <button type="button" className="btn-primary" disabled={confirm.isPending} onClick={() => confirm.mutate(r)}>
                  {confirm.isPending ? 'Confirming…' : 'Final confirm'}
                </button>
              ),
            },
          ]}
          rows={pending}
          emptyText="No PTL completion requests awaiting SPOC confirm."
        />
      )}
    </Panel>
  );
}

function InhouseTeamPanel() {
  const allocQ = useQuery({ queryKey: ['spoc-allocations-mine'], queryFn: spocApi.allocationsMine });
  const projQ = useQuery({ queryKey: ['projects', 'active-inhouse'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const empQ = useQuery({ queryKey: ['employees-inhouse'], queryFn: () => employeesApi.list({}) });
  const myAllocs = allocQ.data?.items ?? [];
  const myIds = new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String));
  const projects = (projQ.data?.items ?? []).filter((p) => myIds.size === 0 || myIds.has(String(p._id ?? p.id ?? '')));
  const employees = empQ.data?.items ?? [];
  const desigOf = (name) => {
    const e = employees.find((x) => `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim() === String(name ?? '').trim());
    return e?.designation ?? '—';
  };
  const coordOf = (pid) => {
    const a = myAllocs.find((x) => String(allocProjectId(x) ?? '') === String(pid));
    const c = a?.coordinator;
    if (!c) return '—';
    if (typeof c === 'string') {
      const e = employees.find((x) => String(x._id ?? x.id ?? '') === c);
      return e ? empName(e) : '—';
    }
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.empId || '—';
  };
  const groups = projects.map((p) => {
    const pid = String(p._id ?? p.id ?? '');
    const leads = (p.principalTeamLeads ?? []).flatMap((t) => {
      const names = (t.names ?? []).filter(Boolean);
      const list = names.length > 0 ? names : [t.name ?? ''];
      return list.filter(Boolean).map((n) => ({ service: t.service ?? '—', name: n }));
    });
    return { project: p, rows: leads, coord: coordOf(pid) };
  }).filter((g) => g.rows.length > 0);
  return (
    <Panel title="In-house project team — all services" sub="Service-wise, with role and coordinator details. Live from team allocation.">
      {projQ.isLoading ? <EmptyState text="Loading…" /> : groups.length === 0 ? (
        <EmptyState text="No team allocations yet. Record the approved allocation below." />
      ) : (
        groups.map((g) => (
          <div key={String(g.project._id ?? g.project.id)} style={{ marginBottom: 16 }}>
            <div className="section-label">{g.project.name ?? g.project.code ?? '—'}</div>
            <DataTable
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'name', label: 'Team member' },
                { key: 'role', label: 'Role / responsibility', render: (r) => desigOf(r.name) },
                { key: 'coord', label: 'Coordinator / SPOC', render: () => g.coord },
              ]}
              rows={g.rows}
              emptyText="No team members for this project yet."
            />
          </div>
        ))
      )}
    </Panel>
  );
}

function TeamMemberAllocationForm() {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [nominatedBy, setNominatedBy] = useState('');
  const [member, setMember] = useState('');
  const [status, setStatus] = useState('Approved');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const projQ = useQuery({ queryKey: ['projects', 'active-team-alloc'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const empQ = useQuery({ queryKey: ['employees-team-alloc'], queryFn: () => employeesApi.list({}) });
  const projects = projQ.data?.items ?? [];
  const employees = empQ.data?.items ?? [];
  const directors = useMemo(() => {
    const list = employees.filter((e) => /director|design management head/i.test(e.designation ?? ''));
    return list.length > 0 ? list : employees;
  }, [employees]);
  const save = useMutation({
    mutationFn: async (body) => {
      const detail = await projectsApi.get(body.project);
      const p = detail?.project ?? detail ?? {};
      const current = (p.principalTeamLeads ?? []).flatMap((t) => {
        const names = (t.names ?? []).filter(Boolean);
        if (names.length > 0) return names.map((n) => ({ service: t.service ?? '', name: n, role: t.role, nominatedBy: t.nominatedBy, approvalStatus: t.approvalStatus }));
        return [{ service: t.service ?? '', name: t.name ?? '', role: t.role, nominatedBy: t.nominatedBy, approvalStatus: t.approvalStatus }];
      });
      const idx = current.findIndex((r) => r.service === body.service && r.name === body.member);
      const row = { service: body.service, name: body.member, nominatedBy: body.nominatedBy, approvalStatus: body.status };
      if (idx >= 0) current[idx] = { ...current[idx], ...row };
      else current.push(row);
      return projectsApi.saveTeamLeads(body.project, { principalTeamLeads: current });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project] });
      setProject(''); setService(''); setNominatedBy(''); setMember(''); setStatus('Approved');
      setErr(''); setOk('Team allocation recorded.');
    },
    onError: (e) => { setErr(e.message); setOk(''); },
  });
  function submit(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (!project) { setErr('Project is required.'); return; }
    if (!service) { setErr('Service is required.'); return; }
    if (!member) { setErr('Team member is required.'); return; }
    save.mutate({ project, service, nominatedBy: nominatedBy || undefined, member, status });
  }
  return (
    <Panel title="Team allocation" sub="As nominated by the respective department Directors — record the approved allocation here once confirmed.">
      <form onSubmit={submit}>
        <div className="field-grid">
          <div className="form-row">
            <label className="form-label">Project</label>
            <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project</option>
              {projects.map((p) => <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Service</label>
            <select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Select service</option>
              {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
                return <option key={x._id ?? x.id} value={n}>{n}{x.designation ? ` · ${x.designation}` : ''}</option>;
              })}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Approval status</label>
            <select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Approved">Approved</option>
              <option value="Proposed">Proposed</option>
            </select>
          </div>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {ok && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{ok}</p>}
        <button type="submit" className="btn-primary" disabled={save.isPending} style={{ marginTop: 8 }}>
          {save.isPending ? 'Saving…' : 'Record allocation'}
        </button>
      </form>
    </Panel>
  );
}

function ProjectContactsPanel() {
  const allocQ = useQuery({ queryKey: ['spoc-allocations-mine'], queryFn: spocApi.allocationsMine });
  const projQ = useQuery({ queryKey: ['projects', 'active-contacts'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const myAllocs = allocQ.data?.items ?? [];
  const myIds = new Set(myAllocs.map(allocProjectId).filter(Boolean).map(String));
  const projects = (projQ.data?.items ?? []).filter((p) => myIds.size === 0 || myIds.has(String(p._id ?? p.id ?? '')));
  const rows = [];
  for (const p of projects) {
    const c = p.contacts ?? {};
    const push = (name, org, role, contact, resp) => {
      if (!name && !org && !contact) return;
      rows.push({ project: p.name ?? p.code ?? '—', name: name || '—', org: org || '—', role, contact: contact || '—', resp });
    };
    push(c.client?.name, c.client?.company, c.client?.designation || 'Client', c.client?.phone || c.client?.email, 'Client approvals and sign-off');
    push(c.architect?.name, c.architect?.company, c.architect?.designation || 'Design architect', c.architect?.phone || c.architect?.email, 'Base drawings, design coordination');
    push(c.pmc?.name, c.pmc?.company, c.pmc?.designation || 'PMC', c.pmc?.phone || c.pmc?.email, 'PMC coordination');
    push(c.peerReview?.name, c.peerReview?.company, c.peerReview?.designation || 'Peer Review', c.peerReview?.phone || c.peerReview?.email, 'Peer review coordination');
    for (const t of p.principalTeamLeads ?? []) {
      const names = (t.names ?? []).filter(Boolean);
      const list = names.length > 0 ? names : [t.name ?? ''];
      for (const n of list) {
        if (!n) continue;
        push(n, `Datum (${t.service ?? ''})`, 'Principal team lead', '', `${t.service ?? ''} queries and submissions`);
      }
    }
    const a = myAllocs.find((x) => String(allocProjectId(x) ?? '') === String(p._id ?? p.id ?? ''));
    const coord = a?.coordinator;
    const cn = !coord ? '' : typeof coord === 'string' ? '' : [coord.firstName, coord.lastName].filter(Boolean).join(' ');
    if (cn) push(cn, 'Datum (Coordinator)', 'SPOC', '', 'Overall coordination, single point of contact');
  }
  return (
    <Panel title="Project contacts & coordination">
      {projQ.isLoading ? <EmptyState text="Loading…" /> : (
        <DataTable
          columns={[
            { key: 'project', label: 'Project' },
            { key: 'name', label: 'Name' },
            { key: 'org', label: 'Organisation' },
            { key: 'role', label: 'Role' },
            { key: 'contact', label: 'Contact' },
            { key: 'resp', label: 'Coordination responsibility' },
          ]}
          rows={rows}
          emptyText="No project contacts yet."
        />
      )}
    </Panel>
  );
}

function DirectoryTab() {
  const queryClient = useQueryClient();
  const [err, setErr] = useState('');
  const [project, setProject] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [services, setServices] = useState([]);

  const empQ = useQuery({
    queryKey: ['employees-dir'],
    queryFn: () => employeesApi.list({}),
  });
  const projQ = useQuery({
    queryKey: ['projects', 'active-dir'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });

  const employees = empQ.data?.items ?? [];
  const projects = projQ.data?.items ?? [];
  const coordinators = useMemo(() => {
    const list = employees.filter((e) =>
      /coordinator|spoc/i.test(`${e.designation ?? ''} ${e.department ?? ''}`),
    );
    return list.length > 0 ? list : employees;
  }, [employees]);

  const byDept = useMemo(() => {
    const m = new Map();
    for (const e of employees) {
      const k = e.department || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [employees]);

  function toggleService(s) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  const save = useMutation({
    mutationFn: (body) => spocApi.recordAllocation(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spoc-allocations-mine'] });
      setProject('');
      setCoordinator('');
      setServices([]);
      setErr('');
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
    if (!coordinator) {
      setErr('Coordinator is required.');
      return;
    }
    if (services.length === 0) {
      setErr('Select at least one service.');
      return;
    }
    save.mutate({ project, coordinator, services });
  }

  return (
    <>
      <InhouseTeamPanel />
      <Panel title="Record allocation">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p._id ?? p.id} value={p._id ?? p.id}>
                    {p.name ?? p.code ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Coordinator</label>
              <select className="filter-select" style={{ width: '100%' }} value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
                <option value="">Select coordinator</option>
                {coordinators.map((e) => (
                  <option key={e._id ?? e.id} value={e._id ?? e.id}>
                    {empName(e)}{e.designation ? ` · ${e.designation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label className="form-label">Services</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {SERVICES.map((s) => (
                <label key={s} className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={services.includes(s)} onChange={() => toggleService(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending} style={{ marginTop: 8 }}>
            {save.isPending ? 'Saving…' : 'Record allocation'}
          </button>
        </form>
      </Panel>
      <TeamMemberAllocationForm />
      <BillingRequestPanel />
      <SpocContactsEditor />
      <SpocTeamLeadsEditor />
      <ProjectContactsPanel />
      <Panel title="In-house team browser">
        {empQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : empQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {empQ.error.message}
          </div>
        ) : byDept.length === 0 ? (
          <EmptyState text="No employees found." />
        ) : (
          byDept.map(([dept, list]) => (
            <div key={dept} style={{ marginBottom: 16 }}>
              <div className="section-label">
                {dept} ({list.length})
              </div>
              <DataTable
                columns={[
                  { key: 'name', label: 'Employee', render: empName },
                  { key: 'empId', label: 'Emp ID', render: (r) => r.empId ?? '—' },
                  { key: 'designation', label: 'Designation' },
                  { key: 'branch', label: 'Branch' },
                ]}
                rows={list}
                emptyText="No employees in this department."
              />
            </div>
          ))
        )}
      </Panel>
    </>
  );
}

function blankAreas() {
  return AREA_KEYS.map((key) => ({ key, update: '', hours: '' }));
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
    () => areas.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0),
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
    save.mutate({
      date,
      project,
      service,
      areas: areas.map((a) => ({
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
                  <td>{a.key}<div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{AREA_DESCRIPTIONS[a.key] ?? ''}</div></td>
                  <td>
                    <input
                      className="form-input"
                      value={a.update}
                      onChange={(e) => setArea(i, { update: e.target.value })}
                      placeholder="Update"
                      aria-label={`${a.key} update`}
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
  const [tab, setTab] = useState('overview');
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
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'meetings', label: 'Meetings' },
          { key: 'deldraw', label: 'Deliverables & Drawings' },
          { key: 'revisions', label: 'Revision log' },
          { key: 'pending', label: 'Pending & Follow-up' },
          { key: 'coordrfi', label: 'Coordination & RFI' },
          { key: 'directory', label: 'Team allocation' },
          { key: 'daily', label: 'Work progress' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && (
        <OverviewTab myAllocs={myAllocs} activeProjects={activeProjects} activeLoading={activeQ.isLoading} />
      )}
      {tab === 'meetings' && <CoordinationMeetingsTab />}
      {tab === 'deldraw' && <DelDrawTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'revisions' && <RevisionLogTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'pending' && <PendingTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'coordrfi' && <CoordRfiTab myAllocs={myAllocs} activeProjects={activeProjects} />}
      {tab === 'directory' && <DirectoryTab />}
      {tab === 'daily' && <DailyEntryTab myAllocs={myAllocs} activeProjects={activeProjects} />}
    </>
  );
}
