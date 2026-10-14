import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, projectsApi, workEntriesApi } from '../lib/api.js';
import { billingApi } from '../lib/phase3Api.js';
import { revisionsApi } from '../lib/workApi.js';

const PULSE_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'manhours', label: 'Man-Hours & Cost' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'delays', label: 'Delays & Changes' },
  { key: 'people', label: 'People & Reference' },
];

const DAY = 86400000;

const idOf = (v) => {
  if (v && typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v ?? '');
};

const inr = (v) => `₹${Math.round(Number(v ?? 0)).toLocaleString('en-IN')}`;

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtShort = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-GB', { month: 'short' })} ’${String(d.getFullYear()).slice(2)}`;
};

const daysBetween = (a, b) => {
  const t1 = Date.parse(a);
  const t2 = Date.parse(b);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.round((t2 - t1) / DAY);
};

const empDisplay = (e) => {
  if (!e || typeof e !== 'object') return '—';
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
};

const normRaisedBy = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('client')) return 'Client';
  if (s.startsWith('architect')) return 'Architect';
  return s ? String(v).trim() : '—';
};

const isExternalReason = (reason) =>
  /client|architect|consultant|authority|site|external|information pending/i.test(String(reason ?? ''));

const SERVICE_DEPT = {
  structural: 'Structural', structure: 'Structural', str: 'Structural',
  electrical: 'Electrical', ele: 'Electrical',
  mechanical: 'Mechanical', hvac: 'Mechanical', mep: 'Mechanical',
  plumbing: 'Plumbing', phe: 'Plumbing',
  fire: 'Fire',
  qs: 'QS', 'qs/boq': 'QS',
  'qa/qc': 'QA/QC', qaqc: 'QA/QC',
  bim: 'BIM', gbs: 'GBS',
  'peer review': 'Peer Review', peer: 'Peer Review',
};
const deptOfService = (s) => SERVICE_DEPT[String(s ?? '').trim().toLowerCase()] ?? String(s ?? '').trim() ?? 'Unassigned';

const REASON_CODES = [
  { title: 'Normal Design Work', color: '#2a78d6', codes: ['Planned Design', 'Planned Drafting', 'Planned BIM', 'Planned QA/QC'] },
  { title: 'Revision', color: '#1baf7a', codes: ['Client Revision', 'Architect Revision', 'Internal Revision', 'QA/QC Revision', 'Peer Review Revision', 'Site Revision'] },
  { title: 'Delay', color: '#eda100', codes: ['Internal Delay', 'Client Delay', 'Architect Delay', 'Consultant Delay', 'Approval Delay', 'Information Pending'] },
  { title: 'Rework', color: '#eb6834', codes: ['Design Error', 'Coordination Error', 'Documentation Error', 'QA/QC Observation', 'Peer Review Observation'] },
  { title: 'Change', color: '#4a3aa7', codes: ['Scope Change', 'Client Requirement Change', 'Architect Requirement Change', 'Authority Requirement', 'Site Requirement'] },
];

function SectionHead({ num, title, cap }) {
  return (
    <div className="section-head">
      <h2><span className="section-num">{num} </span>{title}</h2>
      {cap && <div className="cap">{cap}</div>}
    </div>
  );
}

function Tile({ label, value, sub, tone }) {
  return (
    <div className="kpi-tile">
      <div className="lbl">{label}</div>
      <div className="val tabular">{value}</div>
      {sub != null && <div className={`sub${tone ? ` ${tone}` : ''}`}>{sub}</div>}
    </div>
  );
}

export default function ProjectPulse({ filter = '' }) {
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState('overview');
  const [expanded, setExpanded] = useState(null);

  const projectsQ = useQuery({ queryKey: ['pulse-projects'], queryFn: () => projectsApi.list({}) });
  const projectList = useMemo(() => {
    const items = projectsQ.data?.items ?? projectsQ.data ?? [];
    return Array.isArray(items) ? items : [];
  }, [projectsQ.data]);

  const selectedId = useMemo(() => {
    if (projectId && projectList.some((p) => String(p._id ?? p.id) === projectId)) return projectId;
    const f = String(filter ?? '').trim().toLowerCase();
    if (f) {
      const hit = projectList.find((p) => String(p.name ?? '').toLowerCase().includes(f));
      if (hit) return String(hit._id ?? hit.id);
    }
    const first = projectList[0];
    return first ? String(first._id ?? first.id) : '';
  }, [projectId, projectList, filter]);

  const detailQ = useQuery({
    queryKey: ['pulse-project', selectedId],
    queryFn: () => projectsApi.get(selectedId),
    enabled: !!selectedId,
    retry: false,
  });
  const stagesQ = useQuery({
    queryKey: ['pulse-stages', selectedId],
    queryFn: () => billingApi.stages({ project: selectedId }),
    enabled: !!selectedId,
    retry: false,
  });
  const revisionsQ = useQuery({
    queryKey: ['pulse-revisions', selectedId],
    queryFn: () => revisionsApi.list({ project: selectedId }),
    enabled: !!selectedId,
    retry: false,
  });
  const entriesQ = useQuery({
    queryKey: ['pulse-entries', selectedId],
    queryFn: () => workEntriesApi.list({ project: selectedId }),
    enabled: !!selectedId,
    retry: false,
  });
  const employeesQ = useQuery({ queryKey: ['pulse-employees'], queryFn: () => employeesApi.list({}) });
  const revenueQ = useQuery({ queryKey: ['pulse-revenue'], queryFn: billingApi.revenueByProject });

  const project = detailQ.data?.project ?? {};
  const pid = selectedId;

  const empById = useMemo(() => {
    const m = new Map();
    const items = employeesQ.data?.items ?? employeesQ.data ?? [];
    for (const e of Array.isArray(items) ? items : []) m.set(String(e._id ?? e.id), e);
    return m;
  }, [employeesQ.data]);

  const entries = useMemo(() => {
    const items = entriesQ.data?.items ?? entriesQ.data ?? [];
    return (Array.isArray(items) ? items : []).filter((e) => idOf(e.project) === pid);
  }, [entriesQ.data, pid]);

  const stageRows = useMemo(() => {
    const items = stagesQ.data?.items ?? [];
    return (Array.isArray(items) ? items : []).filter((s) => idOf(s.project) === pid);
  }, [stagesQ.data, pid]);

  const revisions = useMemo(() => {
    const items = revisionsQ.data?.items ?? [];
    return (Array.isArray(items) ? items : []).filter((r) => idOf(r.project) === pid);
  }, [revisionsQ.data, pid]);

  const revenueRow = useMemo(() => {
    const items = revenueQ.data?.items ?? [];
    return (Array.isArray(items) ? items : []).find((r) => String(r.id) === pid);
  }, [revenueQ.data, pid]);

  const costOf = (e) => Number(e.hours ?? 0) * Number(empById.get(idOf(e.employee))?.hourlyRate ?? 0);

  const totals = useMemo(() => {
    let regH = 0; let revH = 0; let rewH = 0; let regC = 0; let revC = 0; let rewC = 0;
    for (const e of entries) {
      const h = Number(e.hours ?? 0);
      const c = costOf(e);
      if (e.type === 'Revision') { revH += h; revC += c; }
      else if (e.type === 'Rework') { rewH += h; rewC += c; }
      else { regH += h; regC += c; }
    }
    return {
      regH, revH, rewH, totH: regH + revH + rewH,
      regC, revC, rewC, totC: regC + revC + rewC,
      avgRate: regH + revH + rewH > 0 ? (regC + revC + rewC) / (regH + revH + rewH) : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, empById]);

  // Revision-type hours attributed to Client / Architect change classes.
  const changeAgg = useMemo(() => {
    const byDrawing = new Map();
    for (const r of revisions) {
      const d = String(r.drawing ?? '').trim();
      if (!d) continue;
      if (!byDrawing.has(d)) byDrawing.set(d, []);
      byDrawing.get(d).push(r);
    }
    const cls = { Client: { req: 0, hrs: 0 }, Architect: { req: 0, hrs: 0 } };
    for (const r of revisions) {
      const c = normRaisedBy(r.raisedBy);
      if (cls[c]) cls[c].req += 1;
    }
    const stageClass = new Map();
    for (const r of revisions) {
      const st = r.stage ?? '—';
      const c = normRaisedBy(r.raisedBy);
      if (!cls[c]) continue;
      const g = stageClass.get(st) ?? { Client: 0, Architect: 0 };
      g[c] += 1;
      stageClass.set(st, g);
    }
    const pickClass = (entry) => {
      const d = String(entry.drawing ?? '').trim();
      if (d && byDrawing.has(d)) {
        const list = byDrawing.get(d);
        const c0 = normRaisedBy(list[0]?.raisedBy);
        if (cls[c0]) return c0;
      }
      const g = stageClass.get(entry.stage ?? '—');
      if (g) return g.Client >= g.Architect ? 'Client' : 'Architect';
      return cls.Client.req >= cls.Architect.req ? 'Client' : 'Architect';
    };
    for (const e of entries) {
      if (e.type !== 'Revision') continue;
      cls[pickClass(e)].hrs += Number(e.hours ?? 0);
    }
    return cls;
  }, [entries, revisions]);

  // Delay log derived from StageStatus delay days + reason classification.
  const delayInfo = useMemo(() => {
    const rows = stageRows
      .filter((s) => Number(s.delayDays ?? 0) > 0)
      .map((s) => ({
        date: s.updatedAt ?? s.createdAt,
        stage: s.stage ?? '—',
        dept: deptOfService(s.service),
        service: s.service ?? '—',
        external: isExternalReason(s.reason),
        reason: s.reason || 'Delay recorded without a reason',
        days: Number(s.delayDays ?? 0),
      }))
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
    const stageRate = new Map();
    const stageRework = new Map();
    const stageRevision = new Map();
    for (const e of entries) {
      const st = e.stage ?? '—';
      const eid = idOf(e.employee);
      const rate = Number(empById.get(eid)?.hourlyRate ?? 0);
      if (e.type === 'Rework') stageRework.set(st, (stageRework.get(st) ?? 0) + Number(e.hours ?? 0));
      if (e.type === 'Revision') stageRevision.set(st, (stageRevision.get(st) ?? 0) + Number(e.hours ?? 0));
      const g = stageRate.get(st) ?? { sum: 0, n: 0 };
      g.sum += rate; g.n += 1;
      stageRate.set(st, g);
    }
    const withCost = rows.map((r) => {
      const pool = r.external ? (stageRevision.get(r.stage) ?? 0) : (stageRework.get(r.stage) ?? 0);
      const peers = rows.filter((x) => x.stage === r.stage && x.external === r.external).length || 1;
      const hrs = Math.round((pool / peers) * 10) / 10;
      const g = stageRate.get(r.stage);
      const rate = g && g.n > 0 ? g.sum / g.n : totals.avgRate;
      return { ...r, hrs, cost: Math.round(hrs * rate) };
    });
    const sum = (list, k) => list.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    const internal = withCost.filter((r) => !r.external);
    const external = withCost.filter((r) => r.external);
    return {
      rows: withCost,
      internal: { days: sum(internal, 'days'), hrs: sum(internal, 'hrs'), cost: sum(internal, 'cost'), events: internal.length },
      external: { days: sum(external, 'days'), hrs: sum(external, 'hrs'), cost: sum(external, 'cost'), events: external.length },
      totalDays: sum(withCost, 'days'),
      slipDays: withCost.reduce((m, r) => Math.max(m, r.days), 0),
    };
  }, [stageRows, entries, empById, totals.avgRate]);

  const reasonDays = useMemo(() => {
    const m = new Map();
    for (const r of delayInfo.rows) m.set(r.reason, (m.get(r.reason) ?? 0) + r.days);
    return [...m.entries()].map(([reason, days]) => ({ reason, days })).sort((a, b) => b.days - a.days);
  }, [delayInfo.rows]);

  // Stage performance: grouped StageStatus rows + entry-only stages.
  const stagePerf = useMemo(() => {
    const groups = new Map();
    for (const s of stageRows) {
      const k = s.stage ?? '—';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    const entryStages = new Map();
    for (const e of entries) {
      const k = e.stage ?? '—';
      if (!entryStages.has(k)) entryStages.set(k, { min: null, max: null });
      const g = entryStages.get(k);
      if (e.date) {
        if (!g.min || e.date < g.min) g.min = e.date;
        if (!g.max || e.date > g.max) g.max = e.date;
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    for (const [stage, list] of groups) {
      const starts = list.map((s) => s.createdAt).filter(Boolean);
      const plannedEnds = list.map((s) => s.plannedCompletion).filter(Boolean);
      const plannedStart = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
      const plannedEnd = plannedEnds.length ? plannedEnds.reduce((a, b) => (a > b ? a : b)) : null;
      const completed = list.filter((s) => String(s.currentStatus ?? '').toLowerCase() === 'completed');
      const actualEnd = completed.length
        ? completed.map((s) => s.updatedAt ?? s.plannedCompletion).filter(Boolean).reduce((a, b) => (a > b ? a : b))
        : today;
      const lower = list.map((s) => String(s.currentStatus ?? '').toLowerCase());
      const status = lower.every((v) => v === 'completed')
        ? 'Completed'
        : lower.some((v) => ['in progress', 'inprogress', 'ongoing', 'revision', 'on hold', 'onhold'].includes(v))
          ? 'In progress'
          : 'Not started';
      const delay = list.reduce((m, s) => Math.max(m, Number(s.delayDays ?? 0)), 0);
      const reason = (list.find((s) => s.reason)?.reason) ?? (status === 'In progress' ? 'In progress' : status === 'Completed' ? '—' : 'Not started');
      const order = ['Billed', 'Ready for billing', 'Pending'];
      const billing = list.map((s) => s.billingReadiness).filter(Boolean).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? '—';
      const services = [...new Set(list.map((s) => s.service).filter(Boolean))];
      out.push({ stage, services, plannedStart, plannedEnd, actualStart: plannedStart, actualEnd, status, delay, reason, billing });
    }
    for (const [stage, g] of entryStages) {
      if (groups.has(stage)) continue;
      out.push({
        stage, services: [], plannedStart: null, plannedEnd: null,
        actualStart: g.min, actualEnd: g.max ?? today,
        status: 'In progress', delay: 0, reason: 'Logged effort, no stage tracker', billing: '—',
      });
    }
    out.sort((a, b) => String(a.actualStart ?? a.plannedStart ?? '').localeCompare(String(b.actualStart ?? b.plannedStart ?? '')));
    return out;
  }, [stageRows, entries]);

  const gantt = useMemo(() => {
    const points = [];
    for (const s of stagePerf) {
      if (s.plannedStart) points.push(s.plannedStart);
      if (s.plannedEnd) points.push(s.plannedEnd);
      if (s.actualStart) points.push(s.actualStart);
      if (s.actualEnd) points.push(s.actualEnd);
    }
    if (!points.length) return null;
    const min = points.reduce((a, b) => (a < b ? a : b)).slice(0, 10);
    const maxRaw = points.reduce((a, b) => (a > b ? a : b)).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const max = maxRaw < today ? today : maxRaw;
    const span = Math.max(1, daysBetween(min, max) ?? 1);
    const pos = (d) => {
      if (!d) return null;
      const v = daysBetween(min, String(d).slice(0, 10));
      if (v == null) return null;
      return Math.min(100, Math.max(0, (v / span) * 100));
    };
    const months = [];
    const cursor = new Date(`${min}T00:00:00`);
    cursor.setDate(1);
    const endD = new Date(`${max}T00:00:00`);
    while (cursor <= endD) {
      const iso = cursor.toISOString().slice(0, 10);
      months.push({ iso, label: `${cursor.toLocaleString('en-GB', { month: 'short' })} ’${String(cursor.getFullYear()).slice(2)}` });
      cursor.setMonth(cursor.getMonth() + 1);
      if (months.length > 24) break;
    }
    return { min, max, today, span, pos, months };
  }, [stagePerf]);

  const deptAgg = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const emp = empById.get(idOf(e.employee));
      const dept = emp?.department ?? 'Unassigned';
      const h = Number(e.hours ?? 0);
      const c = costOf(e);
      const g = m.get(dept) ?? { dept, hrs: 0, cost: 0, rework: 0, revH: 0 };
      g.hrs += h; g.cost += c;
      if (e.type === 'Rework') g.rework += h;
      if (e.type === 'Revision') g.revH += h;
      m.set(dept, g);
    }
    const revByStage = new Map();
    for (const r of revisions) {
      const st = r.stage ?? '—';
      revByStage.set(st, (revByStage.get(st) ?? 0) + 1);
    }
    const stageDept = new Map();
    for (const e of entries) {
      const st = e.stage ?? '—';
      const emp = empById.get(idOf(e.employee));
      const dept = emp?.department ?? 'Unassigned';
      const g = stageDept.get(st) ?? new Map();
      g.set(dept, (g.get(dept) ?? 0) + Number(e.hours ?? 0));
      stageDept.set(st, g);
    }
    const deptRevisions = new Map();
    const deptDelays = new Map();
    for (const [st, n] of revByStage) {
      const g = stageDept.get(st);
      if (!g) continue;
      const top = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0];
      deptRevisions.set(top, (deptRevisions.get(top) ?? 0) + n);
    }
    for (const s of stageRows) {
      const d = deptOfService(s.service);
      deptDelays.set(d, (deptDelays.get(d) ?? 0) + Number(s.delayDays ?? 0));
    }
    return [...m.values()]
      .map((g) => ({
        ...g,
        hrs: Math.round(g.hrs * 10) / 10,
        cost: Math.round(g.cost),
        rework: Math.round(g.rework * 10) / 10,
        revisions: deptRevisions.get(g.dept) ?? 0,
        delayDays: deptDelays.get(g.dept) ?? 0,
      }))
      .sort((a, b) => b.hrs - a.hrs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, empById, revisions, stageRows]);

  const empAgg = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const eid = idOf(e.employee);
      const h = Number(e.hours ?? 0);
      const c = costOf(e);
      const g = m.get(eid) ?? { emp: empById.get(eid), reg: 0, rev: 0, rew: 0, cost: 0 };
      if (e.type === 'Revision') g.rev += h;
      else if (e.type === 'Rework') g.rew += h;
      else g.reg += h;
      g.cost += c;
      m.set(eid, g);
    }
    return [...m.values()]
      .map((g) => ({
        ...g,
        total: Math.round((g.reg + g.rev + g.rew) * 10) / 10,
        cost: Math.round(g.cost),
        share: totals.totC > 0 ? (g.cost / totals.totC) * 100 : 0,
        rate: (g.reg + g.rev + g.rew) > 0 ? g.cost / (g.reg + g.rev + g.rew) : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, empById, totals.totC]);

  const revAnalysis = useMemo(() => {
    const byDrawing = new Map();
    for (const r of revisions) {
      const d = String(r.drawing ?? '').trim();
      if (!byDrawing.has(d)) byDrawing.set(d, []);
      byDrawing.get(d).push(r);
    }
    const direct = new Map();
    const pool = new Map();
    for (const e of entries) {
      if (e.type !== 'Revision') continue;
      const d = String(e.drawing ?? '').trim();
      const h = Number(e.hours ?? 0);
      if (d && byDrawing.has(d)) {
        const list = byDrawing.get(d);
        const each = h / list.length;
        for (const r of list) direct.set(r, (direct.get(r) ?? 0) + each);
      } else {
        const st = e.stage ?? '—';
        pool.set(st, (pool.get(st) ?? 0) + h);
      }
    }
    const rows = revisions.map((r) => {
      let hrs = direct.get(r) ?? 0;
      if (hrs === 0) {
        const st = r.stage ?? '—';
        const peers = revisions.filter((x) => (x.stage ?? '—') === st && !(direct.get(x) > 0));
        const share = (pool.get(st) ?? 0) / (peers.length || 1);
        if (peers.includes(r)) hrs = share;
      }
      return {
        rev: r,
        date: r.dateRaised ?? r.createdAt,
        stage: r.stage ?? '—',
        drawing: r.drawing || '—',
        reason: `${normRaisedBy(r.raisedBy) === '—' ? '' : `${normRaisedBy(r.raisedBy)} · `}${r.details ?? '—'}`,
        hrs: Math.round(hrs * 10) / 10,
      };
    }).sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
    const revHrsByStage = new Map();
    for (const e of entries) {
      if (e.type !== 'Revision') continue;
      const st = e.stage ?? '—';
      revHrsByStage.set(st, (revHrsByStage.get(st) ?? 0) + Number(e.hours ?? 0));
    }
    return {
      rows,
      byStage: [...revHrsByStage.entries()].map(([stage, hrs]) => ({ stage, hrs: Math.round(hrs * 10) / 10 })).sort((a, b) => b.hrs - a.hrs),
      totHrs: Math.round(totals.revH * 10) / 10,
      cost: Math.round(totals.revC),
    };
  }, [entries, revisions, totals.revH, totals.revC]);

  const quotedFee = Number(revenueRow?.contract ?? project.quotedFee ?? 0);
  const marginNow = quotedFee - totals.totC;
  const marginPct = quotedFee > 0 ? (marginNow / quotedFee) * 100 : 0;

  const contacts = project.contacts ?? {};
  const loc = project.location ?? {};
  const slip = delayInfo.slipDays;
  const isDelayed = slip > 0;
  const plannedCompletion = project.expectedCompletion;
  const currentExpected = plannedCompletion && slip > 0
    ? new Date(Date.parse(plannedCompletion) + slip * DAY).toISOString()
    : plannedCompletion;
  const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const loading = detailQ.isLoading || stagesQ.isLoading || revisionsQ.isLoading || entriesQ.isLoading;
  const loadError = detailQ.error ?? stagesQ.error ?? revisionsQ.error ?? entriesQ.error;

  const toggle = (k) => setExpanded((prev) => (prev === k ? null : k));

  if (projectsQ.isLoading) return <div id="view-designtreepulse"><p className="note">Loading projects…</p></div>;
  if (projectList.length === 0) return <div id="view-designtreepulse"><p className="note">No projects found.</p></div>;

  return (
    <div id="view-designtreepulse">
      <div className="topbar">
        <div className="wordmark">
          <span className="logo-mark">DT</span>
          <h1>DesignTree Pulse</h1>
          <span className="tagline">Project Cost &amp; Design Completion Performance</span>
        </div>
        <span className="asof">Data as of {asOf}</span>
      </div>

      <div className="project-bar">
        <div className="project-bar-top">
          <select
            id="dtp-project-select"
            value={selectedId}
            onChange={(e) => { setProjectId(e.target.value); setExpanded(null); }}
          >
            {projectList.map((p) => (
              <option key={String(p._id ?? p.id)} value={String(p._id ?? p.id)}>
                {p.jobNumber ? `${p.jobNumber} — ` : ''}{p.name}
              </option>
            ))}
          </select>
          <span className="status-pill">
            <span className="dot" style={{ background: isDelayed ? 'var(--status-critical)' : project.status === 'Completed' ? 'var(--status-good)' : 'var(--status-warning)' }} />
            {project.status === 'Completed' ? 'Completed' : isDelayed ? 'Delayed' : (project.status ?? '—')}
          </span>
        </div>
        <div className="meta-grid">
          <div className="meta-item"><div className="k">Client</div><div className="v">{contacts.client?.company || contacts.client?.name || project.clientName || '—'}</div></div>
          <div className="meta-item"><div className="k">Architect</div><div className="v">{contacts.architect?.company || contacts.architect?.name || '—'}</div></div>
          <div className="meta-item"><div className="k">Location</div><div className="v">{[loc.city, loc.state].filter(Boolean).join(', ') || loc.label || '—'}</div></div>
          <div className="meta-item"><div className="k">Project Type</div><div className="v">{project.projectType || '—'}</div></div>
          <div className="meta-item"><div className="k">Start Date</div><div className="v">{fmtDate(project.startDate)}</div></div>
          <div className="meta-item"><div className="k">Planned Completion</div><div className="v">{fmtDate(plannedCompletion)}</div></div>
          <div className="meta-item"><div className="k">Current Expected</div><div className="v">{fmtDate(currentExpected)}</div></div>
          <div className="meta-item"><div className="k">Actual Completion</div><div className="v">{project.actualCompletion ? fmtDate(project.actualCompletion) : 'In progress'}</div></div>
        </div>
      </div>

      {loading ? (
        <p className="note">Loading project performance…</p>
      ) : loadError ? (
        <p className="note">Could not load project data: {loadError.message}</p>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {PULSE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className="dtp-tab-btn"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="dtp-panel">
              <section>
                <SectionHead num="1" title="Management Summary" cap="A one-glance health check on cost, schedule and the effort categories driving variance — aggregated from employee work records, the delay log and the revision log below." />
                <div className="kpi-grid">
                  <Tile label="Planned Cost" value="—" sub="No cost baseline tracked" />
                  <Tile label="Actual Cost" value={inr(totals.totC)} />
                  <Tile label="Cost Variance" value="—" sub="Needs a planned baseline" />
                  <Tile label="Planned Hours" value="—" sub="No hours baseline tracked" />
                  <Tile label="Actual Hours" value={`${Math.round(totals.totH).toLocaleString('en-IN')} hrs`} sub="" />
                  <Tile label="Additional Hours" value={`+${Math.round((totals.revH + totals.rewH)).toLocaleString('en-IN')} hrs`} sub="Revision + rework" tone="up" />
                  <Tile label="Total Revisions" value={revisions.length} />
                  <Tile label="Total Rework Hours" value={`${Math.round(totals.rewH).toLocaleString('en-IN')} hrs`} />
                  <Tile label="Client Waiting Days" value={`${delayInfo.external.days} days`} />
                  <Tile label="Internal Delay Days" value={`${delayInfo.internal.days} days`} />
                  <Tile label="External Delay Days" value={`${delayInfo.external.days} days`} />
                  <Tile label="Additional Days (net)" value={`+${slip} days`} sub="vs. planned completion" tone={slip > 0 ? 'up' : undefined} />
                </div>
                <p className="note">Planned cost / hours show — until a baseline is tracked; every other figure is live. <a className="btn-link" href="/work-progress">View daily log →</a></p>
              </section>

              <section>
                <SectionHead num="2" title="Project Cost Summary" cap="Employee Cost = hours × that employee’s configured hourly rate. Project Labour Cost sums every employee’s cost — no manual entry, and no single blended rate." />
                <div className="kpi-grid">
                  <Tile label="Planned Man-Hours" value="—" sub="" />
                  <Tile label="Actual Man-Hours" value={`${Math.round(totals.totH).toLocaleString('en-IN')} hrs`} sub="" />
                  <Tile label="Remaining Man-Hours" value="—" sub="Needs a planned baseline" />
                  <Tile label="Planned Labour Cost" value="—" sub="" />
                  <Tile label="Actual Labour Cost" value={inr(totals.totC)} />
                  <Tile label="Cost Variance %" value="—" sub="Needs a planned baseline" />
                  <Tile label="Total Rework Hours" value={`${Math.round(totals.rewH).toLocaleString('en-IN')} hrs`} />
                  <Tile label="Total Revision Hours" value={`${Math.round(totals.revH).toLocaleString('en-IN')} hrs`} />
                  <Tile label="Total Delay Days" value={`${delayInfo.totalDays} days`} />
                </div>
                <p className="note"><a className="btn-link" href="/work-progress">View daily log →</a></p>
              </section>

              <section>
                <SectionHead title="Quoted Fee & Margin" cap="Planned-vs-actual cost shows how the budget held up; this is the number that actually decides whether the project is profitable — what’s left of the quoted fee once real labour cost is netted out." />
                <div className="kpi-grid">
                  <Tile label="Quoted Fee" value={inr(quotedFee)} />
                  <Tile label="Margin at Quote Time" value="—" sub="Needs a planned cost baseline" />
                  <Tile label="Margin Remaining Now" value={inr(marginNow)} sub={quotedFee > 0 ? `${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}% of quote` : ''} tone={marginNow < 0 ? 'up' : 'down'} />
                </div>
                <div className="card margin-track-wrap">
                  <div className="margin-legend">
                    <span className="li"><span className="sw" style={{ background: 'var(--accent-1)' }} />Actual cost</span>
                    <span className="li"><span className="sw" style={{ background: 'var(--text-primary)', width: 2 }} />Quoted fee</span>
                  </div>
                  {quotedFee > 0 ? (
                    <div className="margin-track">
                      <div className="margin-actual" style={{ width: `${Math.min(100, (totals.totC / quotedFee) * 100)}%`, background: marginNow < 0 ? 'var(--accent-8)' : 'var(--accent-1)' }} />
                      <div className="margin-quotemark" style={{ left: '100%' }} />
                    </div>
                  ) : (
                    <p className="note">No quoted fee set for this project.</p>
                  )}
                  <p className="note">{inr(marginNow)} of margin remaining on this project — {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}% of the {inr(quotedFee)} quoted fee.</p>
                </div>
              </section>

              <section>
                <SectionHead num="11" title="Project Completion Variance" cap="How the expected finish date has moved since kickoff." />
                <div className="card">
                  {plannedCompletion ? (
                    <div className="ctimeline">
                      <div className="line" />
                      <span className="pt" style={{ left: '8%', background: 'var(--accent-1)' }} />
                      <span className="pt-label" style={{ left: '8%' }}>Planned</span>
                      <span className="pt-date" style={{ left: '8%' }}>{fmtDate(plannedCompletion)}</span>
                      <span className="pt" style={{ left: '88%', background: isDelayed ? 'var(--accent-8)' : 'var(--accent-1)' }} />
                      <span className="pt-label" style={{ left: '88%' }}>Revised / Current Expected</span>
                      <span className="pt-date" style={{ left: '88%' }}>{fmtDate(currentExpected)}</span>
                    </div>
                  ) : (
                    <p className="note">No planned completion date set for this project.</p>
                  )}
                  <div className="kpi-grid">
                    <Tile label="Planned Duration" value={plannedCompletion && project.startDate ? `${daysBetween(project.startDate, plannedCompletion) ?? '—'} days` : '—'} />
                    <Tile label="Elapsed So Far" value={project.startDate ? `${daysBetween(project.startDate, new Date().toISOString()) ?? '—'} days` : '—'} />
                    <Tile label="Additional Days" value={`+${slip} days`} tone={slip > 0 ? 'up' : undefined} />
                    <Tile label="Change-Driven Delay Days" value={`${delayInfo.external.days} days`} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'manhours' && (
            <div className="dtp-panel">
              <section>
                <SectionHead num="3" title="Planned vs. Actual Man-Hours by Department" cap="Outline marks the planned budget; the solid bar is actual hours logged — a bar that overruns its outline is over budget." />
                <div className="card">
                  <div className="bbar-legend">
                    <span className="li"><span className="sw planned" />Planned</span>
                    <span className="li"><span className="sw actual" />Actual</span>
                  </div>
                  {deptAgg.length === 0 && <p className="note">No hours logged on this project yet.</p>}
                  {deptAgg.map((d) => {
                    const max = Math.max(1, ...deptAgg.map((x) => x.hrs));
                    return (
                      <div className="bbar-row" key={d.dept}>
                        <span className="bbar-label">{d.dept}</span>
                        <span className="bbar-track">
                          <span className="bbar-actual" style={{ width: `${(d.hrs / max) * 100}%` }} />
                        </span>
                        <span className="bbar-meta tabular"><b>{Math.round(d.hrs)} hrs</b> actual · planned —</span>
                      </div>
                    );
                  })}
                  <p className="note">Department hour budgets are not tracked yet, so no planned outlines or variances can be shown — actuals are live from work entries.</p>
                </div>
              </section>

              <section>
                <SectionHead num="12" title="Department-Wise Cost & Delay" cap="Click a department to drill down into the employees behind its numbers." />
                <div className="table-wrap">
                  <table className="wide">
                    <thead>
                      <tr><th>Department</th><th className="num">Planned Hrs</th><th className="num">Actual Hrs</th><th className="num">Cost</th><th className="num">Rework Hrs</th><th className="num">Revisions</th><th className="num">Delay Days</th></tr>
                    </thead>
                    <tbody>
                      {deptAgg.map((d) => {
                        const key = `dept-${d.dept}`;
                        const open = expanded === key;
                        const people = empAgg.filter((p) => (p.emp?.department ?? 'Unassigned') === d.dept);
                        return (
                          <Fragment key={key}>
                            <tr className="clickable" aria-expanded={open} onClick={() => toggle(key)}>
                              <td><span className="chev">▸</span>{d.dept}</td>
                              <td className="num">—</td>
                              <td className="num tabular">{d.hrs}</td>
                              <td className="num tabular">{inr(d.cost)}</td>
                              <td className="num tabular">{d.rework}</td>
                              <td className="num tabular">{d.revisions}</td>
                              <td className="num tabular">{d.delayDays}</td>
                            </tr>
                            {open && (
                              <tr key={`${key}-detail`} className="detail-row">
                                <td colSpan={7}>
                                  <div className="subtable">
                                    <table>
                                      <thead><tr><th>Employee</th><th className="num">Hours</th><th className="num">Cost</th></tr></thead>
                                      <tbody>
                                        {people.map((p) => (
                                          <tr key={idOf(p.emp?._id ?? p.emp)}>
                                            <td>{empDisplay(p.emp)} · {p.emp?.designation ?? '—'}</td>
                                            <td className="num tabular">{p.total}</td>
                                            <td className="num tabular">{inr(p.cost)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="note">Cost is never entered manually — it is always Hours × each employee’s configured rate, summed up from Department → Employee.</p>
              </section>

              <section>
                <SectionHead num="10" title="Cost Impact of Delays" cap={`Planned labour cost of — grew to ${inr(totals.totC)} — broken down below by the category of additional effort that caused it.`} />
                <div className="kpi-grid">
                  <Tile label="Internal Rework" value={inr(totals.rewC)} sub={`${Math.round(totals.rewH)} hrs`} />
                  <Tile label="Client Changes" value={inr(changeAgg.Client.hrs * totals.avgRate)} sub={`${Math.round(changeAgg.Client.hrs)} hrs`} />
                  <Tile label="Architect Changes" value={inr(changeAgg.Architect.hrs * totals.avgRate)} sub={`${Math.round(changeAgg.Architect.hrs)} hrs`} />
                  <Tile label="Coordination" value={inr(Math.max(0, totals.revC - (changeAgg.Client.hrs + changeAgg.Architect.hrs) * totals.avgRate))} sub="Other revision effort" />
                  <Tile label="QA/QC Rework" value={inr((deptAgg.find((d) => d.dept === 'QA/QC')?.rework ?? 0) * totals.avgRate)} sub={`${deptAgg.find((d) => d.dept === 'QA/QC')?.rework ?? 0} hrs`} />
                  <Tile label="Total Additional Cost" value={inr(totals.revC + totals.rewC)} sub="Revision + rework" />
                  <Tile label="Total Actual Labour Cost" value={inr(totals.totC)} />
                </div>
              </section>
            </div>
          )}

          {tab === 'timeline' && (
            <div className="dtp-panel">
              <section>
                <SectionHead num="4" title="Design Process / Stage-Wise Performance" cap="Every tracked stage, planned against actual." />
                <div className="card">
                  <div className="bbar-legend">
                    <span className="li"><span className="sw planned" />Planned window</span>
                    <span className="li"><span className="sw actual" />Actual — on time</span>
                    <span className="li"><span className="sw" style={{ background: 'var(--accent-2)' }} />Actual — delayed</span>
                    <span className="li"><span className="sw" style={{ background: 'var(--accent-4)' }} />In progress</span>
                    <span className="li"><span className="sw" style={{ background: 'var(--accent-8)', width: 2 }} />Today</span>
                  </div>
                  {!gantt && <p className="note">No stage windows tracked for this project yet.</p>}
                  {gantt && (
                    <div className="gantt-wrap">
                      <div className="gantt-inner">
                        <div className="gantt-scale">
                          {gantt.months.map((m) => (
                            <span key={m.iso} style={{ left: `${gantt.pos(m.iso) ?? 0}%` }}>{m.label}</span>
                          ))}
                        </div>
                        <div className="gantt">
                          {stagePerf.map((s) => {
                            const p0 = gantt.pos(s.plannedStart);
                            const p1 = gantt.pos(s.plannedEnd);
                            const a0 = gantt.pos(s.actualStart);
                            const a1 = gantt.pos(s.actualEnd ?? gantt.today);
                            const cls = s.status === 'Completed' ? (s.delay > 0 ? 'late' : 'ontime') : 'progress';
                            return (
                              <div className="gantt-row" key={s.stage}>
                                <div className="gantt-rowlabel">
                                  <div className="abbr">{s.stage}</div>
                                  <div className="full">{s.services.join(', ') || '—'}</div>
                                </div>
                                <div className="gantt-track">
                                  {p0 != null && p1 != null && (
                                    <div className="gantt-planned" style={{ left: `${p0}%`, width: `${Math.max(1, p1 - p0)}%` }} />
                                  )}
                                  {a0 != null && a1 != null ? (
                                    <div className={`gantt-actual ${cls}`} style={{ left: `${a0}%`, width: `${Math.max(1.5, a1 - a0)}%` }} />
                                  ) : (
                                    <span className="gantt-notstarted" style={{ left: '2%' }}>not started</span>
                                  )}
                                  <div className="gantt-today" style={{ left: `${gantt.pos(gantt.today) ?? 100}%` }} />
                                </div>
                                <div className="gantt-delta tabular">
                                  {s.status === 'In progress' ? 'in progress' : s.delay > 0 ? `+${s.delay}d` : s.status === 'Completed' ? 'on time' : 'pending'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="note">Scroll horizontally to see the full timeline.</p>
                </div>
              </section>

              <section>
                <SectionHead title="Stage Detail" cap="Hours, cost, revisions and rework logged against each stage of the workflow." />
                <div className="table-wrap">
                  <table className="wide">
                    <thead>
                      <tr><th>Stage</th><th>Planned Window</th><th>Actual Window</th><th className="num">Delay</th><th>Delay Reason</th><th>Billing Status</th></tr>
                    </thead>
                    <tbody>
                      {stagePerf.map((s) => (
                        <tr key={s.stage}>
                          <td><b>{s.stage}</b><br /><span className="note">{s.services.join(', ') || '—'}</span></td>
                          <td className="tabular">{s.plannedStart || s.plannedEnd ? `${fmtShort(s.plannedStart)} – ${fmtShort(s.plannedEnd)}` : '—'}</td>
                          <td className="tabular">{s.actualStart || s.actualEnd ? `${fmtShort(s.actualStart)} – ${s.status === 'In progress' ? 'ongoing' : fmtShort(s.actualEnd)}` : '—'}</td>
                          <td className="num tabular">{s.delay > 0 ? `+${s.delay}d` : s.status === 'In progress' ? '—' : '—'}</td>
                          <td>{s.reason}</td>
                          <td>{s.billing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'delays' && (
            <div className="dtp-panel">
              <section>
                <SectionHead num="9" title="Internal vs. External Delay" cap="The full slip is never just “delayed” — every day is attributed to a documented internal or external cause." />
                <div className="two-col">
                  <div className="compare-card">
                    <div className="head"><span className="swatch" style={{ background: 'var(--accent-1)' }} /><h3>Internal Delay</h3></div>
                    <div className="rows">
                      <div className="lbl">Total Days</div><div className="v tabular">{delayInfo.internal.days}d</div>
                      <div className="lbl">Total Hours</div><div className="v tabular">{delayInfo.internal.hrs} hrs</div>
                      <div className="lbl">Cost Impact</div><div className="v tabular">{inr(delayInfo.internal.cost)}</div>
                      <div className="lbl">Events</div><div className="v tabular">{delayInfo.internal.events}</div>
                    </div>
                  </div>
                  <div className="compare-card">
                    <div className="head"><span className="swatch" style={{ background: 'var(--accent-2)' }} /><h3>External Delay</h3></div>
                    <div className="rows">
                      <div className="lbl">Total Days</div><div className="v tabular">{delayInfo.external.days}d</div>
                      <div className="lbl">Total Hours</div><div className="v tabular">{delayInfo.external.hrs} hrs</div>
                      <div className="lbl">Cost Impact</div><div className="v tabular">{inr(delayInfo.external.cost)}</div>
                      <div className="lbl">Events</div><div className="v tabular">{delayInfo.external.events}</div>
                    </div>
                  </div>
                </div>
                {(delayInfo.internal.days + delayInfo.external.days) > 0 && (
                  <>
                    <div className="stackbar">
                      <div style={{ width: `${(delayInfo.internal.days / (delayInfo.internal.days + delayInfo.external.days)) * 100}%`, background: 'var(--accent-1)' }} />
                      <div style={{ width: `${(delayInfo.external.days / (delayInfo.internal.days + delayInfo.external.days)) * 100}%`, background: 'var(--accent-2)' }} />
                    </div>
                    <div className="stackbar-legend">
                      <span>Internal: {delayInfo.internal.days} days ({Math.round((delayInfo.internal.days / (delayInfo.internal.days + delayInfo.external.days)) * 100)}%)</span>
                      <span>External: {delayInfo.external.days} days ({Math.round((delayInfo.external.days / (delayInfo.internal.days + delayInfo.external.days)) * 100)}%)</span>
                    </div>
                  </>
                )}
                <p className="note">Delay hours are the rework (internal) and revision (external) hours logged against the delayed stages; cost is hours × the rates of the people who logged them.</p>
              </section>

              <section>
                <SectionHead num="5" title="Delay Analysis Log" cap="Every delay is tied to a project → stage → date → reason → hours → cost. Click a row for the full record." />
                <div className="table-wrap">
                  <table className="wide">
                    <thead>
                      <tr><th>Date</th><th>Stage</th><th>Dept.</th><th>Type</th><th>Reason</th><th className="num">Days</th><th className="num">Hours</th><th className="num">Cost Impact</th></tr>
                    </thead>
                    <tbody>
                      {delayInfo.rows.map((r, i) => {
                        const key = `delay-${i}`;
                        const open = expanded === key;
                        return (
                          <Fragment key={key}>
                            <tr className="clickable" aria-expanded={open} onClick={() => toggle(key)}>
                              <td className="tabular">{fmtShort(r.date)}</td>
                              <td>{r.stage}</td>
                              <td>{r.dept}</td>
                              <td><span className={`badge ${r.external ? 'external' : 'internal'}`}><span className="dot" />{r.external ? 'External' : 'Internal'}</span></td>
                              <td>{r.reason}</td>
                              <td className="num tabular">{r.days}</td>
                              <td className="num tabular">{r.hrs}</td>
                              <td className="num tabular">{inr(r.cost)}</td>
                            </tr>
                            {open && (
                              <tr key={`${key}-detail`} className="detail-row">
                                <td colSpan={8}>
                                  <div className="detail-grid">
                                    <div><div className="k">Service</div><div className="v">{r.service}</div></div>
                                    <div><div className="k">Type</div><div className="v">{r.external ? 'External' : 'Internal'}</div></div>
                                    <div><div className="k">Reason</div><div className="v">{r.reason}</div></div>
                                    <div><div className="k">Days</div><div className="v tabular">{r.days}</div></div>
                                    <div><div className="k">Hours</div><div className="v tabular">{r.hrs}</div></div>
                                    <div><div className="k">Cost impact</div><div className="v tabular">{inr(r.cost)}</div></div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {delayInfo.rows.length === 0 && <p className="note">No delayed stages on this project.</p>}
              </section>

              <section>
                <SectionHead title="Delay Days by Reason" cap="Ranked from the log above — the longest bars are where a recurring process fix would pay off most." />
                <div className="card">
                  {reasonDays.length === 0 && <p className="note">No delays logged.</p>}
                  {reasonDays.map((r) => {
                    const max = Math.max(1, ...reasonDays.map((x) => x.days));
                    return (
                      <div className="rbar-row" key={r.reason}>
                        <span className="rbar-label">{r.reason}</span>
                        <span className="rbar-track"><span className="rbar-fill" style={{ width: `${(r.days / max) * 100}%` }} /></span>
                        <span className="rbar-val tabular">{r.days}d</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <SectionHead num="6" title="Revision & Rework Analysis" cap="Revision Cost = Revision Hours × the average hourly rate of the department that did the work." />
                <div className="table-wrap">
                  <table className="wide">
                    <thead>
                      <tr><th>Date</th><th>Stage</th><th>Drawing</th><th>Reason</th><th className="num">Hours</th></tr>
                    </thead>
                    <tbody>
                      {revAnalysis.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="tabular">{fmtShort(r.date)}</td>
                          <td>{r.stage}</td>
                          <td className="mono">{r.drawing}</td>
                          <td>{r.reason}</td>
                          <td className="num tabular">{r.hrs || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {revAnalysis.rows.length === 0 && <p className="note">No revisions logged on this project.</p>}
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="section-head"><h2>Revision Hours by Stage</h2></div>
                  {revAnalysis.byStage.map((s) => {
                    const max = Math.max(1, ...revAnalysis.byStage.map((x) => x.hrs));
                    return (
                      <div className="rbar-row" key={s.stage}>
                        <span className="rbar-label">{s.stage}</span>
                        <span className="rbar-track"><span className="rbar-fill" style={{ width: `${(s.hrs / max) * 100}%` }} /></span>
                        <span className="rbar-val tabular">{s.hrs}h</span>
                      </div>
                    );
                  })}
                  <div className="kpi-grid" style={{ marginTop: 12 }}>
                    <Tile label="Total Revisions" value={revisions.length} />
                    <Tile label="Revision Hours" value={`${revAnalysis.totHrs} hrs`} />
                    <Tile label="Revision Cost" value={inr(revAnalysis.cost)} />
                  </div>
                </div>
              </section>

              <section>
                <SectionHead num="8" title="Continuous Input / Change Impact" cap="Architect- and client-driven change requests, shown apart from normal design effort so the additional cost is never mistaken for underperformance." />
                <div className="two-col">
                  <div className="compare-card">
                    <div className="head"><span className="swatch" style={{ background: 'var(--accent-7)' }} /><h3>Architect Changes</h3></div>
                    <div className="rows">
                      <div className="lbl">Requests</div><div className="v tabular">{changeAgg.Architect.req}</div>
                      <div className="lbl">Additional Hours</div><div className="v tabular">{Math.round(changeAgg.Architect.hrs)} hrs</div>
                      <div className="lbl">Additional Cost</div><div className="v tabular">{inr(changeAgg.Architect.hrs * totals.avgRate)}</div>
                      <div className="lbl">Additional Days</div><div className="v tabular">—</div>
                    </div>
                  </div>
                  <div className="compare-card">
                    <div className="head"><span className="swatch" style={{ background: 'var(--accent-2)' }} /><h3>Client Changes</h3></div>
                    <div className="rows">
                      <div className="lbl">Requests</div><div className="v tabular">{changeAgg.Client.req}</div>
                      <div className="lbl">Additional Hours</div><div className="v tabular">{Math.round(changeAgg.Client.hrs)} hrs</div>
                      <div className="lbl">Additional Cost</div><div className="v tabular">{inr(changeAgg.Client.hrs * totals.avgRate)}</div>
                      <div className="lbl">Additional Days</div><div className="v tabular">—</div>
                    </div>
                  </div>
                </div>
                <p className="note">Hours are revision-type work entries attributed to each class by drawing match, then by stage; days per change request are not tracked.</p>
              </section>
            </div>
          )}

          {tab === 'people' && (
            <div className="dtp-panel">
              <section>
                <SectionHead num="13" title="Employee / Role-Wise Project Cost" cap={`Every person’s cost is Hours Worked × their own configured hourly rate — computed automatically, never entered by the employee. “Share of Team” shows how the ${inr(totals.totC)} project labour cost is allotted across the ${empAgg.length} people who worked on it.`} />
                <div className="card">
                  <div className="section-head"><h2>Cost Allocation by Team Member</h2></div>
                  {empAgg.map((p) => (
                    <div className="rbar-row" key={idOf(p.emp?._id ?? p.emp)}>
                      <span className="rbar-label">{empDisplay(p.emp)}</span>
                      <span className="rbar-track"><span className="rbar-fill" style={{ width: `${totals.totC > 0 ? (p.cost / totals.totC) * 100 : 0}%` }} /></span>
                      <span className="rbar-val tabular">{inr(p.cost)}</span>
                    </div>
                  ))}
                  {empAgg.length === 0 && <p className="note">No hours logged on this project yet.</p>}
                </div>
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="wide">
                    <thead>
                      <tr><th>Employee</th><th>Role</th><th>Department</th><th className="num">Regular Hrs</th><th className="num">Revision Hrs</th><th className="num">Rework Hrs</th><th className="num">Total Hrs</th><th className="num">Labour Cost</th><th className="num">Share of Team</th></tr>
                    </thead>
                    <tbody>
                      {empAgg.map((p) => (
                        <tr key={idOf(p.emp?._id ?? p.emp)}>
                          <td><b>{empDisplay(p.emp)}</b></td>
                          <td>{p.emp?.designation ?? '—'}</td>
                          <td>{p.emp?.department ?? 'Unassigned'}</td>
                          <td className="num tabular">{Math.round(p.reg * 10) / 10}</td>
                          <td className="num tabular">{Math.round(p.rev * 10) / 10}</td>
                          <td className="num tabular">{Math.round(p.rew * 10) / 10}</td>
                          <td className="num tabular">{p.total}</td>
                          <td className="num tabular">{inr(p.cost)}<br /><span className="note">{p.total} hrs × {inr(p.rate)}/hr</span></td>
                          <td className="num">
                            <span className="share-cell">
                              <span className="share-track"><span className="share-fill" style={{ width: `${Math.min(100, p.share)}%` }} /></span>
                              <span className="share-pct tabular">{p.share.toFixed(1)}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <SectionHead num="15" title="Reason-Code Reference" cap="Every additional hour and every delay is logged against one of these firm-wide codes, so management can separate planned effort from additional effort at a glance." />
                <div className="reason-grid">
                  {REASON_CODES.map((g) => (
                    <div className="reason-card" key={g.title}>
                      <div className="bar" style={{ background: g.color }} />
                      <div className="inner">
                        <h4>{g.title}</h4>
                        <div className="chip-list">
                          {g.codes.map((c) => <span className="chip" key={c}>{c}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
