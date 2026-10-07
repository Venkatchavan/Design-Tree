import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { projectsApi } from '../../lib/api.js';
import { UNAVAILABLE_REASONS, meetingsApi } from '../../lib/phase4bApi.js';
import {
  attendanceSummary,
  computeAlerts,
  displayStatus,
  displayTone,
  fmtDay,
  idOf,
  isDueSoonAction,
  isOpenAction,
  isOverdueAction,
  meetingMatchesActionFilter,
  meetingMatchesAttendanceFilter,
  momRecorded,
  overdueDays,
  responseSummary,
  serviceCode,
} from '../../lib/meetingsLogic.js';
import { empName, projLabel, ScheduleMeetingModal } from '../MeetingsCommon.jsx';
import DataTable from '../DataTable.jsx';
import EmptyState from '../EmptyState.jsx';
import KpiCard from '../KpiCard.jsx';
import Panel from '../Panel.jsx';
import StatusPill from '../StatusPill.jsx';
import Tabs from '../Tabs.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MEETING_TYPES = ['Client / DRM', 'DesignTree / Arictech', 'PMC', 'Other'];
const SERVICE_FILTERS = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination', 'SMEPF'];
const CHART_COLORS = ['#2a78d6', '#0EA394', '#D6A011', '#E2690F', '#E23B45', '#7C4DEB', '#0FA25E'];

function barOptions(onLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
      x: { ticks: { font: { size: 11 } } },
    },
    onClick: (_e, els, chart) => {
      if (!onLabel || !els?.length) return;
      const idx = els[0].index;
      const label = chart?.data?.labels?.[idx];
      if (label) onLabel(label);
    },
  };
}

function barData(labels, values) {
  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
      },
    ],
  };
}

function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 13, zIndex: 80 }}>
      {msg}
    </div>
  );
}

// ---------------- Dashboard ----------------
function DashboardTab({ meetings, onOpen, onFilterType, onFilterService, onOpenActions, onOpenAbsence }) {
  const alerts = useMemo(() => computeAlerts(meetings), [meetings]);
  const total = meetings.length;
  const scheduled = meetings.filter((m) => m.category === 'Scheduled').length;
  const sudden = meetings.filter((m) => m.category === 'Sudden').length;
  const upcoming = meetings.filter((m) => ['Upcoming', 'Rescheduled'].includes(displayStatus(m))).length;
  const completed = meetings.filter((m) => String(m.status) === 'Held').length;
  const cancelledResched = meetings.filter((m) => ['Cancelled', 'Rescheduled'].includes(String(m.status))).length;
  const pendingMom = meetings.filter((m) => String(m.status) === 'Held' && !momRecorded(m)).length;
  const allActions = meetings.flatMap((m) => (m.actions ?? []).map((a) => ({ ...a, meetingId: m._id ?? m.id })));
  const pendingActions = allActions.filter((a) => String(a.status) !== 'Completed').length;
  const overdueActions = allActions.filter((a) => isOverdueAction(a)).length;
  const absences = meetings.reduce((n, m) => n + (m.attendance ?? []).filter((a) => !a.present).length, 0);
  const absenceNoReason = meetings.reduce((n, m) => n + (m.attendance ?? []).filter((a) => !a.present && !a.reason).length, 0);

  const upcomingList = meetings
    .filter((m) => ['Upcoming', 'Rescheduled'].includes(displayStatus(m)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const recentList = meetings
    .filter((m) => !['Upcoming', 'Rescheduled'].includes(displayStatus(m)))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const byType = MEETING_TYPES.map((t) => meetings.filter((m) => m.type === t).length);
  const byService = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination'].map(
    (s) => meetings.filter((m) => (m.services ?? []).some((x) => String(x).toLowerCase() === s.toLowerCase())).length,
  );
  const smepfCount = meetings.filter((m) => {
    const p = m.project;
    if (!p || typeof p !== 'object') return false;
    const scope = (p.scope ?? []).map((s) => String(s.service ?? s).toLowerCase());
    return ['structural', 'mechanical', 'electrical', 'plumbing', 'fire'].every((s) => scope.includes(s));
  }).length;

  return (
    <>
      <div className="kpi-grid cols-5">
        <KpiCard label="Total meetings" value={total} accent="blueprint" onClick={() => onFilterType('__clear')} />
        <KpiCard label="Scheduled" value={scheduled} accent="teal" onClick={() => onFilterType('__scheduled')} />
        <KpiCard label="Sudden / ad-hoc" value={sudden} accent="amber" onClick={() => onFilterType('__sudden')} />
        <KpiCard label="Upcoming" value={upcoming} accent="teal" onClick={() => onFilterType('__upcoming')} />
        <KpiCard label="Completed" value={completed} accent="forest" onClick={() => onFilterType('__completed')} />
        <KpiCard label="Cancelled / rescheduled" value={cancelledResched} accent="neutral" onClick={() => onFilterType('__cancelresched')} />
        <KpiCard label="Pending MOM" value={pendingMom} accent={pendingMom > 0 ? 'amber' : 'neutral'} onClick={() => onFilterType('__mompending')} />
        <KpiCard label="Pending action items" value={pendingActions} accent="violet" onClick={onOpenActions} />
        <KpiCard label="Overdue action items" value={overdueActions} accent={overdueActions > 0 ? 'rust' : 'neutral'} onClick={onOpenActions} />
        <KpiCard label="Absences recorded" value={absences} accent={absenceNoReason > 0 ? 'amber' : 'neutral'} onClick={onOpenAbsence} />
      </div>

      <Panel title="Upcoming meetings">
        {upcomingList.length === 0 ? <EmptyState text="No upcoming meetings. Schedule one with + Schedule Meeting." /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtDay(r.date) },
              { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
              { key: 'cat', label: 'Category', render: (r) => (r.category === 'Sudden' ? 'Ad-hoc' : 'Scheduled') },
              { key: 'time', label: 'Start', render: (r) => r.startTime ?? '—' },
              { key: 'svc', label: 'Services', render: (r) => (r.services ?? []).map(serviceCode).join(', ') || '—' },
              { key: 'status', label: 'Status', render: (r) => { const s = displayStatus(r); return <StatusPill tone={displayTone(s)}>{s}</StatusPill>; } },
            ]}
            rows={upcomingList}
            emptyText="No upcoming meetings."
            onRowClick={(r) => onOpen(r._id ?? r.id)}
          />
        )}
      </Panel>

      <Panel title="Recent meetings">
        {recentList.length === 0 ? <EmptyState text="No recent meetings yet." /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtDay(r.date) },
              { key: 'title', label: 'Title', render: (r) => r.title ?? '—' },
              { key: 'project', label: 'Project', render: (r) => projLabel(r.project) },
              { key: 'status', label: 'Status', render: (r) => { const s = displayStatus(r); return <StatusPill tone={displayTone(s)}>{s}</StatusPill>; } },
            ]}
            rows={recentList}
            emptyText="No recent meetings yet."
            onRowClick={(r) => onOpen(r._id ?? r.id)}
          />
        )}
      </Panel>

      <Panel title="Alerts & reminders">
        {alerts.length === 0 ? <EmptyState text="No alerts. Everything is on track." /> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.slice(0, 30).map((a, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: a.level === 'overdue' ? 'var(--rust)' : a.level === 'attention' ? 'var(--amber)' : 'var(--teal)' }} />
                <button type="button" onClick={() => a.meetingId && onOpen(a.meetingId)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', font: 'inherit', cursor: a.meetingId ? 'pointer' : 'default' }}>
                  {a.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="two-col">
        <Panel title="By meeting type">
          <div className="chart-wrap"><Bar data={barData(MEETING_TYPES, byType)} options={barOptions(onFilterType)} /></div>
        </Panel>
        <Panel title="By service">
          <div className="chart-wrap"><Bar data={barData(['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination', 'SMEPF'], [...byService, smepfCount])} options={barOptions(onFilterService)} /></div>
        </Panel>
      </div>
    </>
  );
}

// ---------------- All meetings ----------------
const EMPTY_FILTERS = { project: '', category: '', type: '', service: '', responsible: '', from: '', to: '', status: '', attendance: '', actions: '' };

function AllMeetingsTab({ meetings, projects, preset, onOpen }) {
  const [f, setF] = useState(EMPTY_FILTERS);
  // Applies dashboard KPI / chart clicks as All-meetings filters.
  useEffect(() => {
    if (!preset) return;
    if (preset === '__clear') setF(EMPTY_FILTERS);
    else if (preset === '__scheduled') setF({ ...EMPTY_FILTERS, category: 'Scheduled' });
    else if (preset === '__sudden') setF({ ...EMPTY_FILTERS, category: 'Sudden' });
    else if (preset === '__upcoming') setF({ ...EMPTY_FILTERS, status: 'Upcoming' });
    else if (preset === '__completed') setF({ ...EMPTY_FILTERS, status: 'Completed' });
    else if (preset === '__cancelresched') setF({ ...EMPTY_FILTERS, status: 'Cancelled or rescheduled' });
    else if (preset === '__mompending') setF({ ...EMPTY_FILTERS, status: 'Completed · MOM pending' });
    else if (MEETING_TYPES.includes(preset)) setF({ ...EMPTY_FILTERS, type: preset });
    else setF({ ...EMPTY_FILTERS, service: preset });
  }, [preset]);

  const responsibles = useMemo(() => [...new Set(meetings.map((m) => m.responsible).filter(Boolean))], [meetings]);
  const filtered = meetings.filter((m) => {
    if (f.project && idOf(m.project) !== f.project) return false;
    if (f.category && (f.category === 'Sudden' ? m.category !== 'Sudden' : m.category !== 'Scheduled')) return false;
    if (f.type && m.type !== f.type) return false;
    if (f.service) {
      if (f.service === 'SMEPF') {
        const p = m.project;
        const scope = p && typeof p === 'object' ? (p.scope ?? []).map((s) => String(s.service ?? s).toLowerCase()) : [];
        if (!['structural', 'mechanical', 'electrical', 'plumbing', 'fire'].every((s) => scope.includes(s))) return false;
      } else if (!(m.services ?? []).some((x) => String(x).toLowerCase() === f.service.toLowerCase())) return false;
    }
    if (f.responsible && m.responsible !== f.responsible) return false;
    if (f.from && new Date(m.date) < new Date(f.from)) return false;
    if (f.to && new Date(m.date) > new Date(f.to)) return false;
    const ds = displayStatus(m);
    const raw = String(m.status ?? '');
    if (f.status === 'Cancelled or rescheduled') {
      if (!(ds === 'Cancelled' || ds === 'Rescheduled' || raw === 'Cancelled' || raw === 'Rescheduled')) return false;
    } else if (f.status === 'Scheduled') {
      if (raw !== 'Scheduled') return false;
    } else if (f.status && ds !== f.status) {
      return false;
    }
    if (f.attendance && !meetingMatchesAttendanceFilter(m, f.attendance)) return false;
    if (f.actions && !meetingMatchesActionFilter(m, f.actions)) return false;
    return true;
  });

  const anyFilter = Object.values(f).some(Boolean);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Panel title={`All meetings — ${filtered.length} of ${meetings.length} meetings`}>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={f.project} onChange={(e) => set('project', e.target.value)}><option value="">All</option>{projects.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}</select></div>
        <div className="form-row"><label className="form-label">Category</label><select className="filter-select" style={{ width: '100%' }} value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">All</option><option>Scheduled</option><option value="Sudden">Sudden / Ad-Hoc</option></select></div>
        <div className="form-row"><label className="form-label">Meeting type</label><select className="filter-select" style={{ width: '100%' }} value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">All</option>{MEETING_TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
        <div className="form-row"><label className="form-label">Service</label><select className="filter-select" style={{ width: '100%' }} value={f.service} onChange={(e) => set('service', e.target.value)}><option value="">All</option>{SERVICE_FILTERS.map((s) => (<option key={s}>{s}</option>))}</select></div>
        <div className="form-row"><label className="form-label">SPOC / coordinator</label><select className="filter-select" style={{ width: '100%' }} value={f.responsible} onChange={(e) => set('responsible', e.target.value)}><option value="">All</option>{responsibles.map((r) => (<option key={r}>{r}</option>))}</select></div>
        <div className="form-row"><label className="form-label">From</label><input className="form-input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></div>
        <div className="form-row"><label className="form-label">To</label><input className="form-input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>
        <div className="form-row"><label className="form-label">Meeting status</label><select className="filter-select" style={{ width: '100%' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">All</option><option>Upcoming</option><option>Scheduled</option><option>Completed</option><option>Completed · MOM pending</option><option>Rescheduled</option><option>Cancelled</option><option>Cancelled or rescheduled</option></select></div>
        <div className="form-row"><label className="form-label">Attendance</label><select className="filter-select" style={{ width: '100%' }} value={f.attendance} onChange={(e) => set('attendance', e.target.value)}><option value="">All</option><option>All attended</option><option>Some absent</option><option>Not marked</option></select></div>
        <div className="form-row"><label className="form-label">Action items</label><select className="filter-select" style={{ width: '100%' }} value={f.actions} onChange={(e) => set('actions', e.target.value)}><option value="">All</option><option>Has pending</option><option>Has overdue</option><option>All completed</option><option>No action items</option></select></div>
      </div>
      {anyFilter && <button type="button" className="approve-btn" onClick={() => setF(EMPTY_FILTERS)}>Clear filters</button>}
      <div style={{ marginTop: 10 }}>
        {filtered.length === 0 ? <EmptyState text={meetings.length === 0 ? 'No meetings yet. Schedule one with + Schedule Meeting.' : 'No meetings match these filters.'} /> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => `${fmtDay(r.date)}${r.startTime ? ` ${r.startTime}` : ''}` },
              { key: 'mom', label: 'MOM no.', render: (r) => r.momNo ?? '—' },
              { key: 'meet', label: 'Meeting / project', render: (r) => <><div style={{ fontWeight: 600 }}>{r.title ?? '—'}</div><div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{projLabel(r.project)}</div></> },
              { key: 'cat', label: 'Category', render: (r) => (r.category === 'Sudden' ? 'Ad-hoc' : 'Scheduled') },
              { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
              { key: 'svc', label: 'Services', render: (r) => (r.services ?? []).map(serviceCode).join(', ') || '—' },
              { key: 'resp', label: 'Responsible', render: (r) => r.responsible ?? '—' },
              { key: 'resp2', label: 'Responses', render: (r) => responseSummary(r).label },
              { key: 'att', label: 'Attendance', render: (r) => attendanceSummary(r).label },
              {
                key: 'act', label: 'Actions', render: (r) => {
                  const open = (r.actions ?? []).filter((a) => String(a.status) !== 'Completed').length;
                  const over = (r.actions ?? []).filter((a) => isOverdueAction(a)).length;
                  if ((r.actions ?? []).length === 0) return '—';
                  return over > 0 ? `${open} open · ${over} overdue` : `${open} open`;
                },
              },
              { key: 'status', label: 'Status', render: (r) => { const s = displayStatus(r); return <StatusPill tone={displayTone(s)}>{s}</StatusPill>; } },
            ]}
            rows={filtered}
            emptyText="No meetings."
            onRowClick={(r) => onOpen(r._id ?? r.id)}
          />
        )}
      </div>
    </Panel>
  );
}

// ---------------- Action items ----------------
function ActionItemsTab({ meetings, onOpen, notify }) {
  const [status, setStatus] = useState('Open');
  const [project, setProject] = useState('');
  const queryClient = useQueryClient();

  const rows = useMemo(() => {
    const out = [];
    for (const m of meetings) {
      for (const a of m.actions ?? []) {
        out.push({
          ...a,
          _rowId: `${m._id ?? m.id}:${a._id ?? a.id}`,
          meetingId: m._id ?? m.id,
          meetingMomNo: m.momNo,
          meetingTitle: m.title,
          project: m.project,
          normStatus: String(a.status) === 'Open' ? 'Pending' : a.status,
        });
      }
    }
    return out.sort((a, b) => String(a.due ?? '') < String(b.due ?? '') ? -1 : 1);
  }, [meetings]);

  const projects = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const id = idOf(r.project);
      if (id && !map.has(id)) map.set(id, projLabel(r.project));
    }
    return [...map.entries()];
  }, [rows]);

  const filtered = rows.filter((a) => {
    if (status === 'Open' && !['Pending', 'In Progress'].includes(a.normStatus)) return false;
    if (status === 'Overdue' && !isOverdueAction(a)) return false;
    if (['Pending', 'In Progress', 'Completed'].includes(status) && a.normStatus !== status) return false;
    if (project && idOf(a.project) !== project) return false;
    return true;
  });

  const flip = useMutation({
    mutationFn: ({ meetingId, actionId, st }) => meetingsApi.actionStatus(meetingId, actionId, { status: st }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      notify(`Status set to ${v.st}.`);
    },
    onError: (e) => notify(e.message),
  });

  return (
    <Panel title={`Action items — ${filtered.length} of ${rows.length}`}>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Status</label><select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}><option>Open</option><option>Overdue</option><option>Pending</option><option>In Progress</option><option>Completed</option><option value="">All</option></select></div>
        <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{projects.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}</select></div>
      </div>
      {filtered.length === 0 ? <EmptyState text={rows.length === 0 ? 'No action items yet. Add them after a meeting is held.' : 'No action items in this view.'} /> : (
        <DataTable
          columns={[
            { key: 'text', label: 'Action / task', render: (a) => a.text ?? '—' },
            { key: 'owner', label: 'Responsible', render: (a) => empName(a.owner) },
            { key: 'svc', label: 'Service', render: (a) => (a.service ? serviceCode(a.service) : '—') },
            {
              key: 'pri', label: 'Priority', render: (a) => {
                const p = a.priority ?? 'Medium';
                return <StatusPill tone={p === 'High' ? 'rust' : p === 'Low' ? 'neutral' : 'amber'}>{p}</StatusPill>;
              },
            },
            {
              key: 'due', label: 'Target', render: (a) => {
                const over = isOverdueAction(a);
                return <span style={{ color: over ? 'var(--rust-dark)' : isDueSoonAction(a) ? 'var(--amber-dark)' : undefined }}>{fmtDay(a.due)}{over ? ` · ${overdueDays(a)}d overdue` : ''}</span>;
              },
            },
            {
              key: 'status', label: 'Status', render: (a) => (
                <select className="filter-select" value={a.normStatus} onChange={(e) => flip.mutate({ meetingId: a.meetingId, actionId: a._id ?? a.id, st: e.target.value })}>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              ),
            },
            { key: 'done', label: 'Completed', render: (a) => (a.completedAt ? fmtDay(a.completedAt) : '—') },
            { key: 'rem', label: 'Remarks', render: (a) => <><div>{a.remarks ?? '—'}</div>{a.note ? <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Update: {a.note}</div> : null}</> },
            { key: 'from', label: 'From meeting', render: (a) => <button type="button" className="approve-btn" onClick={(e) => { e.stopPropagation(); onOpen(a.meetingId); }}>{a.meetingMomNo ?? a.meetingTitle ?? 'Open'}</button> },
          ]}
          rows={filtered}
          emptyText="No action items."
        />
      )}
    </Panel>
  );
}

// ---------------- Absence log ----------------
const ABS_17 = ['Date', 'Time', 'MOM no.', 'Project', 'Project code', 'Meeting category', 'Meeting type', 'Mode', 'Location / link', 'Conducted by', 'Responsible', 'Services discussed', 'Agenda', 'Absent member', 'Designation', 'Service', 'Reason for absence'];

function AbsenceLogTab({ onOpen, notify }) {
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [member, setMember] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const projQ = useQuery({ queryKey: ['projects', 'mtg-absence'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const projectOptions = projQ.data?.items ?? [];

  const q = useQuery({
    queryKey: ['absence-log', { project, service, member, type, from, to }],
    queryFn: () => meetingsApi.absenceLog({ project: project || undefined, service: service || undefined, member: member || undefined, type: type || undefined, from: from || undefined, to: to || undefined }),
  });
  const items = q.data?.items ?? [];

  const byMember = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      const e = r.employee && typeof r.employee === 'object' ? r.employee : {};
      const id = String(e._id ?? e.id ?? e.empId ?? empName(e));
      const cur = map.get(id) ?? { id, name: empName(e), service: r.service ?? e.department ?? '', count: 0, projects: new Set() };
      cur.count += 1;
      const p = r.project && typeof r.project === 'object' ? (r.project.name ?? r.project.code ?? '') : '';
      if (p) cur.projects.add(p);
      map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [items]);

  const byService = useMemo(() => {
    const order = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination'];
    return order.map((s) => items.filter((r) => String(r.service ?? '').toLowerCase() === s.toLowerCase()).length);
  }, [items]);

  const memberOptions = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      const e = r.employee && typeof r.employee === 'object' ? r.employee : null;
      if (!e?._id && !e?.id) continue;
      const id = String(e._id ?? e.id);
      if (!map.has(id)) map.set(id, empName(e));
    }
    return [...map.entries()];
  }, [items]);

  function copyExcel() {
    const rows = items.map((r) => {
      const m = r.meeting ?? {};
      const p = r.project && typeof r.project === 'object' ? r.project : {};
      const e = r.employee && typeof r.employee === 'object' ? r.employee : {};
      const d = r.date ? new Date(r.date) : null;
      return [
        d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : '',
        m.startTime ?? '',
        m.momNo ?? '',
        p.name ?? '',
        p.code ?? '',
        m.category ?? '',
        m.type ?? '',
        m.mode ?? '',
        m.mode === 'Online' ? (m.link ?? '') : (m.location ?? ''),
        m.conductedBy ?? '',
        m.responsible ?? '',
        (m.services ?? []).join(', '),
        (m.agenda ?? '').replace(/\s+/g, ' '),
        empName(e),
        e.designation ?? '',
        r.service ?? '',
        r.reason?.trim() ? r.reason : 'Not given',
      ].join('\t');
    });
    const text = `${ABS_17.join('\t')}\n${rows.join('\n')}`;
    const done = () => notify(`Copied ${items.length} absence record${items.length === 1 ? '' : 's'} for Excel.`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch { notify('Copy blocked — table selected, press Ctrl+C.'); }
    document.body.removeChild(ta);
  }

  return (
    <>
      <Panel title="Absence log filters">
        <div className="field-grid">
          <div className="form-row"><label className="form-label">Project</label><select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}><option value="">All</option>{projectOptions.map((p) => (<option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.code ? `${p.code} - ` : ''}{p.name}</option>))}</select></div>
          <div className="form-row"><label className="form-label">Service</label><select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}><option value="">All</option><option>Structural</option><option>Mechanical</option><option>Electrical</option><option>Plumbing</option><option>Fire</option><option>MEP Coordination</option></select></div>
          <div className="form-row"><label className="form-label">Team member</label><select className="filter-select" style={{ width: '100%' }} value={member} onChange={(e) => setMember(e.target.value)}><option value="">All</option>{memberOptions.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}</select></div>
          <div className="form-row"><label className="form-label">Meeting type</label><select className="filter-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option>{MEETING_TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
          <div className="form-row"><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="form-row"><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Panel>
      <div className="two-col">
        <Panel title={`Absences by team member — ${items.length} absences in view`}>
          {byMember.length === 0 ? <EmptyState text="No absence entries." /> : (
            <DataTable
              columns={[
                { key: 'name', label: 'Team member', render: (r) => r.name },
                { key: 'svc', label: 'Service', render: (r) => (r.service ? serviceCode(r.service) : '—') },
                { key: 'count', label: 'Absences', render: (r) => <b style={{ color: r.count > 1 ? 'var(--amber-dark)' : undefined }}>{r.count}</b> },
                { key: 'proj', label: 'Projects', render: (r) => [...r.projects].join(', ') || '—' },
              ]}
              rows={byMember}
              emptyText="No absence entries."
              onRowClick={(r) => setMember(r.id)}
            />
          )}
        </Panel>
        <Panel title="By service">
          <div className="chart-wrap"><Bar data={barData(['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire', 'MEP Coordination'], byService)} options={barOptions((label) => setService(label))} /></div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Absences come from the attendance marked on each held meeting.</p>
        </Panel>
      </div>
      <Panel title={`${items.length} absence record${items.length === 1 ? '' : 's'}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="approve-btn" onClick={copyExcel} disabled={items.length === 0}>Copy log for Excel</button>
        </div>
        {q.isLoading ? <EmptyState text="Loading…" /> : q.isError ? <div className="login-error" style={{ display: 'block' }}>{q.error.message}</div>
          : items.length === 0 ? <EmptyState text="No absence entries. Absences appear here once attendance is marked on a held meeting." /> : (
            <DataTable
              columns={[
                { key: 'date', label: 'Date', render: (r) => `${fmtDay(r.date)}` },
                { key: 'mom', label: 'MOM no.', render: (r) => r.meeting?.momNo ?? '—' },
                { key: 'proj', label: 'Project', render: (r) => (r.project && typeof r.project === 'object' ? (r.project.name ?? '—') : '—') },
                { key: 'member', label: 'Absent member', render: (r) => empName(r.employee) },
                { key: 'svc', label: 'Service', render: (r) => (r.service ? serviceCode(r.service) : '—') },
                { key: 'reason', label: 'Reason for absence', render: (r) => (r.reason?.trim() ? r.reason : <span style={{ color: 'var(--rust-dark)' }}>Not given</span>) },
                { key: 'meet', label: 'Meeting', render: (r) => `${r.meeting?.type ?? ''} · ${r.meeting?.category === 'Sudden' ? 'Ad-hoc' : 'Scheduled'}` },
                { key: 'mode', label: 'Mode / location', render: (r) => (r.meeting?.mode === 'Online' ? 'Online' : `Offline: ${r.meeting?.location ?? '—'}`) },
                { key: 'resp', label: 'Responsible', render: (r) => r.meeting?.responsible ?? '—' },
                { key: 'agenda', label: 'Agenda', render: (r) => (r.meeting?.agenda ?? '').slice(0, 90) || '—' },
              ]}
              rows={items}
              emptyText="No absence entries."
              onRowClick={(r) => r.meeting?._id && onOpen(r.meeting._id)}
            />
          )}
        <p style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Select a row to open the full meeting. Missing reasons are flagged so the SPOC can follow up.</p>
      </Panel>
    </>
  );
}

// ---------------- Project history ----------------
function ProjectHistoryTab({ meetings, onOpen }) {
  const projQ = useQuery({ queryKey: ['projects', 'mtg-hist'], queryFn: () => projectsApi.list({ status: 'Active' }) });
  const projects = projQ.data?.items ?? [];
  const [projectId, setProjectId] = useState('');
  const teamQ = useQuery({ queryKey: ['project-team', projectId], queryFn: () => meetingsApi.projectTeam(projectId), enabled: !!projectId });
  const team = teamQ.data ?? null;

  const rows = (projectId ? meetings.filter((m) => idOf(m.project) === projectId) : []).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <Panel title="Project history">
      <div className="form-row" style={{ maxWidth: 360 }}>
        <label className="form-label">Project</label>
        <select className="filter-select" style={{ width: '100%' }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Select project</option>
          {projects.map((p) => (<option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>{p.code ? `${p.code} - ` : ''}{p.name}</option>))}
        </select>
      </div>
      {!projectId ? <EmptyState text="Select a project to see its complete meeting history." /> : (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {team?.project?.clientName ? `${team.project.clientName} · ` : ''}Scope {(team?.committedServices ?? []).map(serviceCode).join(', ') || '—'} · Responsible: {team?.responsible?.label ?? '—'}
          </p>
          {rows.length === 0 ? <EmptyState text="No meetings for this project yet." /> : (
            <DataTable
              columns={[
                { key: 'date', label: 'Date', render: (r) => fmtDay(r.date) },
                { key: 'cat', label: 'Category', render: (r) => (r.category === 'Sudden' ? 'Ad-hoc' : 'Scheduled') },
                { key: 'type', label: 'Type', render: (r) => r.type ?? '—' },
                { key: 'svc', label: 'Service', render: (r) => (r.services ?? []).map(serviceCode).join(', ') || '—' },
                { key: 'part', label: 'Participants', render: (r) => (r.invites ?? []).map((v) => empName(v.employee)).join(', ') || (r.participants ?? []).map((p) => p.name).join(', ') || '—' },
                { key: 'att', label: 'Attendance', render: (r) => attendanceSummary(r).label },
                { key: 'disc', label: 'Key discussions', render: (r) => ((r.mom?.discussion ?? '').slice(0, 90) || r.agenda?.slice(0, 90) || '—') },
                { key: 'mom', label: 'MOM', render: (r) => (momRecorded(r) ? <StatusPill tone="forest">Recorded</StatusPill> : String(r.status) === 'Held' ? <StatusPill tone="amber">Pending</StatusPill> : '—') },
                {
                  key: 'act', label: 'Action items', render: (r) => {
                    const done = (r.actions ?? []).filter((a) => String(a.status) === 'Completed').length;
                    return (r.actions ?? []).length === 0 ? '—' : `${done}/${r.actions.length} done`;
                  },
                },
                { key: 'status', label: 'Status', render: (r) => { const s = displayStatus(r); return <StatusPill tone={displayTone(s)}>{s}</StatusPill>; } },
              ]}
              rows={rows}
              emptyText="No meetings for this project yet."
              onRowClick={(r) => onOpen(r._id ?? r.id)}
            />
          )}
          <p style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Scheduled and ad-hoc meetings appear together in date order. Select a row for details.</p>
        </>
      )}
    </Panel>
  );
}

// ---------------- Shell ----------------
export default function SpocMeetings() {
  const [tab, setTab] = useState('dashboard');
  const [detailId, setDetailId] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSudden, setShowSudden] = useState(false);
  const [toast, setToast] = useState('');
  const [preset, setPreset] = useState(null);

  const listQ = useQuery({ queryKey: ['meetings'], queryFn: () => meetingsApi.list({}) });
  const meetings = listQ.data?.items ?? [];
  const overdueCount = useMemo(() => {
    let n = 0;
    for (const m of meetings) for (const a of m.actions ?? []) if (isOverdueAction(a)) n += 1;
    return n;
  }, [meetings]);

  const projects = useMemo(() => {
    const map = new Map();
    for (const m of meetings) {
      const id = idOf(m.project);
      if (id && !map.has(id)) map.set(id, projLabel(m.project));
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [meetings]);

  function gotoAll(p) {
    setPreset(p);
    setTab('all');
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Meetings</div>
        <div className="page-sub">SPOC workspace — schedule, track responses, attendance, MOM and actions.</div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="approve-btn" onClick={() => setShowSudden(true)}>+ Add Sudden Meeting</button>
        <button type="button" className="btn-primary" onClick={() => setShowSchedule(true)}>+ Schedule Meeting</button>
      </div>
      {listQ.isError && <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>}
      <Tabs
        tabs={[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'all', label: 'All meetings' },
          { key: 'actions', label: `Action items${overdueCount > 0 ? ` (${overdueCount} overdue)` : ''}` },
          { key: 'absence', label: 'Absence log' },
          { key: 'history', label: 'Project history' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {listQ.isLoading ? <Panel title="Meetings"><EmptyState text="Loading…" /></Panel> : (
        <>
          {tab === 'dashboard' && (
            <DashboardTab
              meetings={meetings}
              onOpen={setDetailId}
              onFilterType={(p) => gotoAll(p)}
              onFilterService={(p) => gotoAll(p)}
              onOpenActions={() => setTab('actions')}
              onOpenAbsence={() => setTab('absence')}
            />
          )}
          {tab === 'all' && <AllMeetingsTab meetings={meetings} projects={projects} preset={preset} onOpen={setDetailId} />}
          {tab === 'actions' && <ActionItemsTab meetings={meetings} onOpen={setDetailId} notify={setToast} />}
          {tab === 'absence' && <AbsenceLogTab onOpen={setDetailId} notify={setToast} />}
          {tab === 'history' && <ProjectHistoryTab meetings={meetings} onOpen={setDetailId} />}
        </>
      )}
      {showSchedule && (
        <ScheduleMeetingModal
          onClose={() => setShowSchedule(false)}
          onCreated={(msg, id) => { setShowSchedule(false); setToast(msg); if (id) setDetailId(id); }}
        />
      )}
      {showSudden && (
        <ScheduleMeetingModal
          sudden
          onClose={() => setShowSudden(false)}
          onCreated={(msg, id) => { setShowSudden(false); setToast(msg); if (id) setDetailId(id); }}
        />
      )}
      {detailId && <MeetingDetailPanel meetingId={detailId} onClose={() => setDetailId(null)} notify={setToast} />}
      <Toast msg={toast} onDone={() => setToast('')} />
    </>
  );
}

// ---------------- Detail panel (slide-over) ----------------
function Tracker({ meeting }) {
  const held = String(meeting?.status ?? '').toLowerCase() === 'held';
  const attendanceDone = (meeting?.attendance ?? []).length > 0;
  const momDone = momRecorded(meeting);
  const actions = meeting?.actions ?? [];
  const steps = [
    { label: 'Planned', done: true },
    { label: 'Conducted', done: held },
    { label: 'Attendance', done: attendanceDone },
    { label: 'MOM', done: momDone },
    { label: 'Action items', done: actions.length > 0 },
    { label: 'Tracked', done: actions.length > 0 && actions.every((a) => String(a.status) === 'Completed') },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, border: '1px solid var(--border)', background: s.done ? 'var(--forest-bg)' : undefined, color: s.done ? 'var(--forest-dark)' : 'var(--ink-muted)' }}>
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function MeetingDetailPanel({ meetingId, onClose, notify }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery({ queryKey: ['meeting', meetingId], queryFn: () => meetingsApi.get(meetingId), enabled: !!meetingId });
  const meeting = detailQ.data?.item ?? null;
  const [resDate, setResDate] = useState('');
  const [resStart, setResStart] = useState('');
  const [showResched, setShowResched] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function invalidate(msg) {
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
    queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['absence-log'] });
    if (msg && notify) notify(msg);
  }

  const heldM = useMutation({
    mutationFn: () => meetingsApi.held(meetingId),
    onSuccess: () => invalidate('Marked as held. Now mark attendance and record the MOM.'),
    onError: (e) => setErr(e.message),
  });
  const reschedM = useMutation({
    mutationFn: (body) => meetingsApi.reschedule(meetingId, body),
    onSuccess: () => { invalidate('Meeting rescheduled.'); setShowResched(false); },
    onError: (e) => setErr(e.message),
  });
  const cancelM = useMutation({
    mutationFn: (reason) => meetingsApi.cancel(meetingId, reason ? { reason } : undefined),
    onSuccess: () => { invalidate('Meeting cancelled.'); setShowCancel(false); },
    onError: (e) => setErr(e.message),
  });

  if (!meetingId) return null;

  const held = meeting && String(meeting.status).toLowerCase() === 'held';
  const closed = meeting && (String(meeting.status).toLowerCase() === 'held' || String(meeting.status).toLowerCase() === 'cancelled');
  const ds = meeting ? displayStatus(meeting) : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,25,35,.45)' }} />
      <div
        role="dialog"
        aria-label="Meeting details"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100%)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '18px 20px 40px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{meeting?.momNo ?? ''}{meeting?.project ? ` · ${meeting.project.code ?? ''}` : ''}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{meeting?.title ?? 'Loading…'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{meeting?.project?.name ?? ''}</div>
          </div>
          <button type="button" className="approve-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {detailQ.isLoading ? <EmptyState text="Loading…" /> : detailQ.isError ? <div className="login-error" style={{ display: 'block' }}>{detailQ.error.message}</div>
          : !meeting ? <EmptyState text="Meeting not found." /> : (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                {meeting.category === 'Sudden' ? 'Ad-hoc' : 'Scheduled'} · {meeting.type ?? ''} · {meeting.date ? fmtDay(meeting.date) : ''}{meeting.startTime ? `, ${meeting.startTime}` : ''}{meeting.endTime ? `–${meeting.endTime}` : ''} · <StatusPill tone={displayTone(ds)}>{ds}</StatusPill>
              </p>
              {meeting.originalDate && <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Moved from {fmtDay(meeting.originalDate)}</p>}
              <Tracker meeting={meeting} />
              {!closed && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
                  <button type="button" className="approve-btn" disabled={heldM.isPending} onClick={() => heldM.mutate()}>Mark meeting held</button>
                  <button type="button" className="approve-btn" onClick={() => setShowResched((v) => !v)}>Reschedule</button>
                  <button type="button" className="approve-btn" onClick={() => setShowCancel((v) => !v)}>Cancel meeting</button>
                </div>
              )}
              {showResched && !closed && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div className="field-grid">
                    <div className="form-row"><label className="form-label">New date</label><input className="form-input" type="date" value={resDate} onChange={(e) => setResDate(e.target.value)} /></div>
                    <div className="form-row"><label className="form-label">Time</label><input className="form-input" type="time" value={resStart} onChange={(e) => setResStart(e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-primary" disabled={!resDate || reschedM.isPending} onClick={() => reschedM.mutate({ date: resDate, startTime: resStart || undefined })}>Confirm reschedule</button>
                    <button type="button" className="approve-btn" onClick={() => setShowResched(false)}>Keep date</button>
                  </div>
                </div>
              )}
              {showCancel && !closed && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div className="form-row"><label className="form-label">Reason for cancelling</label><input className="form-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-primary" disabled={cancelM.isPending} onClick={() => cancelM.mutate(cancelReason.trim() || undefined)}>Confirm cancel</button>
                    <button type="button" className="approve-btn" onClick={() => setShowCancel(false)}>Keep meeting</button>
                  </div>
                </div>
              )}
              {String(meeting.status).toLowerCase() === 'cancelled' && meeting.cancelReason && (
                <p style={{ fontSize: 13, color: 'var(--rust-dark)' }}>Cancelled: {meeting.cancelReason}</p>
              )}

              <Panel title="Meeting details">
                <div className="field-grid">
                  <div><div className="form-label">Mode</div><div style={{ fontSize: 13 }}>{meeting.mode ?? '—'}</div></div>
                  <div><div className="form-label">{meeting.mode === 'Online' ? 'Link' : 'Location'}</div><div style={{ fontSize: 13 }}>{meeting.mode === 'Online' ? (meeting.link ? <><a href={meeting.link} target="_blank" rel="noreferrer">Open link</a> <button type="button" className="approve-btn" onClick={() => navigator.clipboard?.writeText(meeting.link)}>Copy link</button></> : '—') : (meeting.location ?? '—')}</div></div>
                  <div><div className="form-label">Conducted by</div><div style={{ fontSize: 13 }}>{meeting.conductedBy ?? '—'}</div></div>
                  <div><div className="form-label">Responsible</div><div style={{ fontSize: 13 }}>{meeting.responsible ?? '—'}{meeting.responsibleRole ? ` (${meeting.responsibleRole})` : ''}</div></div>
                  <div><div className="form-label">Services discussed</div><div style={{ fontSize: 13 }}>{(meeting.services ?? []).map(serviceCode).join(', ') || '—'}</div></div>
                  <div><div className="form-label">External participants</div><div style={{ fontSize: 13 }}>{meeting.externalParticipants ?? '—'}</div></div>
                </div>
                {meeting.category === 'Sudden' && meeting.reason && <><div className="form-label">Reason for sudden meeting</div><p style={{ fontSize: 13 }}>{meeting.reason}</p></>}
                {meeting.agenda && <><div className="form-label">Agenda / purpose</div><p style={{ fontSize: 13 }}>{meeting.agenda}</p></>}
                {(meeting.refDocs ?? []).length > 0 && <><div className="form-label">Reference documents</div><ul style={{ fontSize: 13, paddingLeft: 18 }}>{meeting.refDocs.map((d, i) => (<li key={i}>{String(d).split('/').pop()}</li>))}</ul></>}
              </Panel>

              <AvailabilitySection meeting={meeting} />
              <AttendanceSection meeting={meeting} held={held} onSaved={() => invalidate('Attendance saved.')} notify={notify} />
              <MomSection meeting={meeting} held={held} onSaved={() => invalidate('MOM saved.')} notify={notify} />
              <PanelActions meeting={meeting} held={held} onSaved={(m) => invalidate(m)} notify={notify} />
              {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
            </>
          )}
      </div>
    </div>
  );
}

function AvailabilitySection({ meeting }) {
  if (String(meeting?.category ?? '') !== 'Scheduled') return null;
  const invites = meeting?.invites ?? [];
  const rs = responseSummary(meeting);
  return (
    <Panel title={`Availability responses — ${rs.available ?? 0} available · ${rs.notAvailable ?? 0} not available · ${rs.awaiting ?? 0} awaiting`}>
      {invites.length === 0 ? <EmptyState text="No invitations sent." /> : invites.map((v, i) => {
        const e = v?.employee && typeof v.employee === 'object' ? v.employee : {};
        return (
          <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{empName(v.employee)}</b>
              {v.response === 'Available' ? <StatusPill tone="forest">Available</StatusPill>
                : v.response === 'Not Available' ? <StatusPill tone="rust">Not available</StatusPill>
                : <StatusPill tone="neutral">Awaiting response</StatusPill>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{e.designation ?? ''}{e.department ? ` · ${e.department}` : ''}</div>
            {v.response === 'Not Available' && v.reason && <div style={{ fontSize: 12.5 }}>Reason: {v.reason}{v.note ? ` — ${v.note}` : ''}</div>}
          </div>
        );
      })}
      <p style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Invitations sent {meeting?.invites?.[0]?.invitedAt ? fmtDay(meeting.invites[0].invitedAt) : '—'}. Employees respond from their Meeting Dashboard.</p>
    </Panel>
  );
}

function AttendanceSection({ meeting, held, onSaved, notify }) {
  const queryClient = useQueryClient();
  const invites = meeting?.invites ?? [];
  const existing = meeting?.attendance ?? [];
  const [rows, setRows] = useState(null);
  const [extraName, setExtraName] = useState('');
  const [extraOrg, setExtraOrg] = useState('');
  const [err, setErr] = useState('');

  const effective = rows ?? (existing.length > 0 ? existing.map((a) => ({ employee: idOf(a.employee), present: !!a.present, reason: a.reason ?? '' })) : invites.map((v) => ({ employee: idOf(v.employee), present: true, reason: '' })));
  const attended = effective.filter((r) => r.present).length;

  const save = useMutation({
    mutationFn: (body) => meetingsApi.attendance(meeting._id ?? meeting.id, body),
    onSuccess: () => {
      setRows(null);
      setErr('');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
      queryClient.invalidateQueries({ queryKey: ['absence-log'] });
      onSaved();
    },
    onError: (e) => setErr(e.message),
  });

  const addExtra = useMutation({
    mutationFn: (body) => meetingsApi.attendance(meeting._id ?? meeting.id, body),
    onSuccess: () => {
      setExtraName('');
      setExtraOrg('');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
      if (notify) notify('Participant added.');
    },
    onError: (e) => setErr(e.message),
  });

  function setRow(i, patch) {
    setRows(effective.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  if (!held) {
    return (
      <Panel title="Attendance">
        <EmptyState text="Available once the meeting is marked held." />
      </Panel>
    );
  }

  return (
    <Panel title={`Attendance — ${attended}/${effective.length} attended`}>
      {effective.length === 0 ? <EmptyState text="No invitees to mark." /> : effective.map((r, i) => {
        const inv = invites.find((v) => idOf(v.employee) === String(r.employee));
        return (
          <div key={String(r.employee ?? i)} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: 13 }}>{empName(inv?.employee) !== '—' ? empName(inv?.employee) : r.employee}</b>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={r.present ? 'btn-primary' : 'approve-btn'} onClick={() => setRow(i, { present: true })}>Attended</button>
                <button type="button" className={!r.present ? 'btn-primary' : 'approve-btn'} onClick={() => setRow(i, { present: false })}>Not attended</button>
              </span>
            </div>
            {!r.present && (
              <input
                className="form-input"
                style={{ marginTop: 6 }}
                value={r.reason ?? ''}
                onChange={(e) => setRow(i, { reason: e.target.value })}
                placeholder="Reason for absence"
                aria-label="Reason for absence"
              />
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ flex: 2, minWidth: 140 }} value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="Name, organisation" aria-label="Add participant who attended" />
        <input className="form-input" style={{ flex: 1, minWidth: 110 }} value={extraOrg} onChange={(e) => setExtraOrg(e.target.value)} placeholder="Organisation" aria-label="Organisation" />
        <button
          type="button"
          className="approve-btn"
          onClick={() => {
            if (!extraName.trim() && !extraOrg.trim()) return;
            const body = {
              additionalParticipants: [...(meeting.additionalParticipants ?? []), { name: extraName.trim(), organisation: extraOrg.trim() }],
            };
            if (effective.length > 0) body.attendance = effective;
            addExtra.mutate(body);
          }}
        >
          Add
        </button>
      </div>
      {(meeting.additionalParticipants ?? []).length > 0 && (
        <p style={{ fontSize: 12.5 }}>Additional participants: {meeting.additionalParticipants.map((p) => `${p.name ?? ''}${p.organisation ? ` (${p.organisation})` : ''}`).join(', ')}</p>
      )}
      {err && <div className="login-error" style={{ display: 'block' }}>{err}</div>}
      <button type="button" className="btn-primary" style={{ marginTop: 8 }} disabled={save.isPending || effective.length === 0} onClick={() => save.mutate({ attendance: effective })}>
        {save.isPending ? 'Saving…' : 'Save attendance'}
      </button>
    </Panel>
  );
}

function MomSection({ meeting, held, onSaved, notify }) {
  const queryClient = useQueryClient();
  const mom = meeting?.mom && typeof meeting.mom === 'object' ? meeting.mom : {};
  const [discussion, setDiscussion] = useState(mom.discussion ?? '');
  const [decisions, setDecisions] = useState(mom.decisions ?? '');
  const [followUp, setFollowUp] = useState(mom.followUp ?? '');
  const [nextMeeting, setNextMeeting] = useState(mom.nextMeeting ? String(mom.nextMeeting).slice(0, 10) : '');
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setDiscussion(mom.discussion ?? '');
    setDecisions(mom.decisions ?? '');
    setFollowUp(mom.followUp ?? '');
    setNextMeeting(mom.nextMeeting ? String(mom.nextMeeting).slice(0, 10) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?._id]);

  const save = useMutation({
    mutationFn: (body) => meetingsApi.mom(meeting._id ?? meeting.id, body),
    onSuccess: async () => {
      if (files.length > 0) {
        try {
          await meetingsApi.momDoc(meeting._id ?? meeting.id, files);
          setFiles([]);
        } catch (e) {
          setErr(e.message);
          return;
        }
      }
      setErr('');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
      onSaved();
    },
    onError: (e) => setErr(e.message),
  });

  if (!held) {
    return (
      <Panel title="Minutes of meeting">
        <EmptyState text="Record the MOM after the meeting is held." />
      </Panel>
    );
  }

  return (
    <Panel title={`Minutes of meeting${momRecorded(meeting) ? ' — Recorded' : ''}`}>
      <div className="form-row"><label className="form-label">Key discussion points</label><textarea className="form-input" value={discussion} onChange={(e) => setDiscussion(e.target.value)} /></div>
      <div className="form-row"><label className="form-label">Decisions taken</label><textarea className="form-input" value={decisions} onChange={(e) => setDecisions(e.target.value)} /></div>
      <div className="form-row"><label className="form-label">Follow-up requirements</label><textarea className="form-input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Next / follow-up meeting</label><input className="form-input" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} /></div>
        <div className="form-row"><label className="form-label">Upload MOM document</label><input type="file" onChange={(e) => setFiles([...(e.target.files ?? [])])} accept=".pdf,.doc,.docx,.xls,.xlsx" />{meeting?.momDoc && <div style={{ fontSize: 11.5 }}>Attached: {meeting.momDoc}</div>}</div>
      </div>
      {meeting?.momDoc && <p style={{ fontSize: 12.5 }}><a href={meetingsApi.momDownloadUrl(meeting._id ?? meeting.id)} download>Download MOM</a></p>}
      {err && <div className="login-error" style={{ display: 'block' }}>{err}</div>}
      <button
        type="button"
        className="btn-primary"
        disabled={save.isPending}
        onClick={() => save.mutate({ discussion: discussion || undefined, decisions: decisions || undefined, followUp: followUp || undefined, nextMeeting: nextMeeting || undefined })}
      >
        {save.isPending ? 'Saving…' : 'Save MOM'}
      </button>
    </Panel>
  );
}

function PanelActions({ meeting, held, onSaved, notify }) {
  const queryClient = useQueryClient();
  const actions = meeting?.actions ?? [];
  const done = actions.filter((a) => String(a.status) === 'Completed').length;
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [service, setService] = useState('Structural');
  const [priority, setPriority] = useState('Medium');
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');

  const candidates = useMemo(() => {
    const map = new Map();
    for (const v of meeting?.invites ?? []) {
      const id = idOf(v.employee);
      if (id && !map.has(id)) map.set(id, { id, label: empName(v.employee), service: v.employee?.department ?? '' });
    }
    for (const v of meeting?.participants ?? []) {
      const id = idOf(v.employee);
      if (id && !map.has(id)) map.set(id, { id, label: v.name ?? empName(v.employee), service: '' });
    }
    return [...map.values()];
  }, [meeting]);

  useEffect(() => {
    const found = candidates.find((c) => c.id === owner);
    if (found?.service) setService(found.service);
  }, [owner, candidates]);

  function invalidate(msg) {
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
    queryClient.invalidateQueries({ queryKey: ['meeting', meeting._id ?? meeting.id] });
    if (msg) onSaved(msg);
  }

  const add = useMutation({
    mutationFn: (body) => meetingsApi.addAction(meeting._id ?? meeting.id, body),
    onSuccess: (_d, vars) => {
      const name = candidates.find((c) => c.id === vars.owner)?.label ?? 'owner';
      setText('');
      setOwner('');
      setRemarks('');
      setErr('');
      invalidate(`Action item assigned to ${name}.`);
    },
    onError: (e) => setErr(e.message),
  });

  const flip = useMutation({
    mutationFn: ({ actionId, status }) => meetingsApi.actionStatus(meeting._id ?? meeting.id, actionId, { status }),
    onSuccess: (_d, v) => invalidate(`Status set to ${v.status}.`),
    onError: (e) => setErr(e.message),
  });

  return (
    <Panel title={`Action items — ${done}/${actions.length} completed`}>
      {actions.length === 0 ? <EmptyState text="No action items yet." /> : (
        <DataTable
          columns={[
            { key: 'text', label: 'Task', render: (a) => <><div>{a.text}</div>{a.remarks ? <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{a.remarks}</div> : null}{a.note ? <div style={{ fontSize: 11.5 }}>Update: {a.note}</div> : null}</> },
            { key: 'owner', label: 'Owner', render: (a) => empName(a.owner) },
            { key: 'svc', label: 'Service', render: (a) => (a.service ? serviceCode(a.service) : '—') },
            { key: 'pri', label: 'Priority', render: (a) => <StatusPill tone={a.priority === 'High' ? 'rust' : a.priority === 'Low' ? 'neutral' : 'amber'}>{a.priority ?? 'Medium'}</StatusPill> },
            { key: 'due', label: 'Target', render: (a) => <span style={{ color: isOverdueAction(a) ? 'var(--rust-dark)' : undefined }}>{fmtDay(a.due)}{isOverdueAction(a) ? ` · ${overdueDays(a)}d overdue` : ''}</span> },
            {
              key: 'st', label: 'Status', render: (a) => (
                <select className="filter-select" value={String(a.status) === 'Open' ? 'Pending' : a.status} onChange={(e) => flip.mutate({ actionId: a._id ?? a.id, status: e.target.value })}>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              ),
            },
          ]}
          rows={actions}
          emptyText="No action items yet."
        />
      )}
      {held && (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>Add action item</div>
          <div className="form-row"><label className="form-label">Action / task</label><input className="form-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Issue revised shaft section" /></div>
          <div className="field-grid">
            <div className="form-row"><label className="form-label">Responsible person</label><select className="filter-select" style={{ width: '100%' }} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Select</option>{candidates.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}</select></div>
            <div className="form-row"><label className="form-label">Service</label><select className="filter-select" style={{ width: '100%' }} value={service} onChange={(e) => setService(e.target.value)}><option>Structural</option><option>Mechanical</option><option>Electrical</option><option>Plumbing</option><option>Fire</option><option>MEP Coordination</option><option>SMEPF</option></select></div>
            <div className="form-row"><label className="form-label">Priority</label><select className="filter-select" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)}><option>High</option><option>Medium</option><option>Low</option></select></div>
            <div className="form-row"><label className="form-label">Target date</label><input className="form-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <div className="form-row"><label className="form-label">Remarks</label><input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          {err && <div className="login-error" style={{ display: 'block' }}>{err}</div>}
          <button type="button" className="btn-primary" disabled={add.isPending || !text.trim()} onClick={() => add.mutate({ text: text.trim(), owner: owner || undefined, service: service || undefined, priority, due: due || undefined, remarks: remarks || undefined })}>Add action item</button>
        </>
      )}
    </Panel>
  );
}

export { UNAVAILABLE_REASONS, isOpenAction };
