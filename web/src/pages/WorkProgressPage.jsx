import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bootstrapApi, teamsApi, workEntriesApi } from '../lib/api.js';
import { holidaysApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import KpiCard from '../components/KpiCard.jsx';

function toneFor(status) {
  const s = String(status ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'open') return 'amber';
  if (s === 'submitted') return 'teal';
  if (s === 'logged') return 'forest';
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
function empKey(e) {
  const emp = e?.employee;
  if (!emp) return `row-${e?._id ?? Math.random()}`;
  if (typeof emp === 'object') return String(emp._id ?? emp.id ?? empName(emp));
  return String(emp);
}
function deptOf(e) {
  const emp = e?.employee;
  if (emp && typeof emp === 'object') return emp.department ?? emp.service ?? '—';
  return e?.department ?? '—';
}
function projLabel(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.name ?? p.code ?? '—';
}
function projKey(p) {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return String(p._id ?? p.id ?? p.name ?? '—');
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function workText(e) {
  return e?.notes ?? e?.taskActivity ?? e?.deliverable ?? e?.drawing ?? '—';
}
function fmtDayLong(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const wd = d.toLocaleString('en-GB', { weekday: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${wd}, ${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}
function fmtShortHoliday(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${mon}-${String(d.getFullYear()).slice(2)}`;
}
function useBootstrapProp(prop) {
  const q = useQuery({ queryKey: ['bootstrap'], queryFn: bootstrapApi, enabled: !prop });
  return prop ?? q.data ?? null;
}

export default function WorkProgressPage({ bootstrap: bootstrapProp }) {
  const bootstrap = useBootstrapProp(bootstrapProp);
  const isDirector = new Set(['founding_director', 'working_director', 'executive_director']).has(bootstrap?.role?.key ?? '');
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState('wise');
  const [fDept, setFDept] = useState('');
  const [fProject, setFProject] = useState('');
  const [fStage, setFStage] = useState('');

  const entriesQ = useQuery({
    queryKey: ['work-entries-day', date],
    queryFn: () => workEntriesApi.list({ from: date, to: date }),
  });
  const entries = entriesQ.data?.items ?? [];

  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const teams = useMemo(() => {
    const d = teamsQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.items ?? d.teams ?? [];
  }, [teamsQ.data]);

  const totalHours = entries.reduce((s, e) => s + Number(e.hours ?? 0), 0);
  const empIds = useMemo(() => new Set(entries.map(empKey)), [entries]);
  const departments = useMemo(() => {
    const s = new Set();
    for (const e of entries) s.add(deptOf(e));
    return [...s].filter((d) => d && d !== '—');
  }, [entries]);

  const byDept = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const d = deptOf(e);
      const cur = m.get(d) ?? { department: d, count: 0, hours: 0 };
      cur.count += 1;
      cur.hours += Number(e.hours ?? 0);
      m.set(d, cur);
    }
    return [...m.values()];
  }, [entries]);

  const byProjectStage = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const k = `${projKey(e.project)}|||${e.stage ?? '—'}`;
      const cur = m.get(k) ?? {
        key: k,
        project: projLabel(e.project),
        stage: e.stage ?? '—',
        count: 0,
        hours: 0,
      };
      cur.count += 1;
      cur.hours += Number(e.hours ?? 0);
      m.set(k, cur);
    }
    return [...m.values()];
  }, [entries]);

  const extraDays = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const k = `${empKey(e)}|||${String(e.date ?? '').slice(0, 10)}`;
      const cur = m.get(k) ?? {
        key: k,
        employee: empName(e.employee),
        department: deptOf(e),
        date: String(e.date ?? '').slice(0, 10) || '—',
        hours: 0,
        notes: [],
        byProject: new Map(),
      };
      cur.hours += Number(e.hours ?? 0);
      if (e.notes) cur.notes.push(e.notes);
      const pk = projKey(e.project);
      const ph = cur.byProject.get(pk) ?? { label: projLabel(e.project), hours: 0 };
      ph.hours += Number(e.hours ?? 0);
      cur.byProject.set(pk, ph);
      m.set(k, cur);
    }
    return [...m.values()]
      .filter((d) => d.hours > 8)
      .map((d) => ({
        ...d,
        project: [...d.byProject.values()].sort((a, b) => b.hours - a.hours)[0]?.label ?? '—',
      }));
  }, [entries]);

  const sundayEntries = useMemo(
    () => entries.filter((e) => e.date && new Date(e.date).getDay() === 0),
    [entries],
  );

  const year = String(date).slice(0, 4);
  const directorYearQ = useQuery({
    queryKey: ['work-entries-year', year, date],
    queryFn: () => workEntriesApi.list({ from: `${year}-01-01`, to: date }),
    enabled: isDirector,
  });
  const directorSundayRows = (directorYearQ.data?.items ?? []).filter(
    (e) => e.date && new Date(e.date).getDay() === 0,
  );

  const deptOptions = useMemo(() => {
    const s = new Set();
    for (const e of entries) {
      const d = deptOf(e);
      if (d && d !== '—') s.add(d);
    }
    return [...s].sort();
  }, [entries]);
  const projectOptions = useMemo(() => {
    const m = new Map();
    for (const e of entries) m.set(projKey(e.project), projLabel(e.project));
    return [...m.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);
  const stageOptions = useMemo(() => {
    const s = new Set();
    for (const e of entries) {
      const st = e.stage ?? '—';
      if (st && st !== '—') s.add(st);
    }
    return [...s].sort();
  }, [entries]);
  const wiseFiltered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!fDept || deptOf(e) === fDept) &&
          (!fProject || projKey(e.project) === fProject) &&
          (!fStage || (e.stage ?? '—') === fStage),
      ),
    [entries, fDept, fProject, fStage],
  );

  const loggedEmpNames = useMemo(() => {
    const s = new Set();
    for (const e of entries) s.add(empName(e.employee).toLowerCase());
    return s;
  }, [entries]);

  const noEntryToday = useMemo(() => {
    const out = [];
    for (const t of teams) {
      for (const m of t.members ?? []) {
        const emp = typeof m.employee === 'object' && m.employee ? m.employee : null;
        const name = emp ? empName(emp) : String(m.employee ?? '—');
        if (!loggedEmpNames.has(String(name).toLowerCase())) {
          out.push({ team: t.name ?? '—', member: name });
          if (out.length >= 50) return out;
        }
      }
    }
    return out;
  }, [teams, loggedEmpNames]);

  return (
    <>
      <div className="page-head">
        <div className="page-title">Work progress</div>
        <div className="page-sub">Day-wise logged work — live from the work-entries API.</div>
      </div>
      <div className="form-row" style={{ maxWidth: 240 }}>
        <label className="form-label">Date</label>
        <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total hours" value={totalHours.toFixed(1)} accent="blueprint" />
        <KpiCard label="Employees logged in" value={empIds.size} accent="forest" />
        <KpiCard label="Departments covered" value={departments.length} accent="amber" />
        <KpiCard label="No entry today" value={noEntryToday.length} accent="rust" />
      </div>

      <Tabs
        tabs={[
          { key: 'wise', label: 'Department / Project / Stage-wise' },
          { key: 'extra', label: 'Extra Hours' },
          { key: 'sunday', label: 'Sunday Work' },
          { key: 'holiday', label: 'Other Holiday Work' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'wise' && (
        isDirector ? (
          <Panel title="Work logged today" sub="Filter by department, project or stage — any combination">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <select className="filter-select" value={fDept} onChange={(e) => setFDept(e.target.value)}>
                <option value="">All departments</option>
                {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="filter-select" value={fProject} onChange={(e) => setFProject(e.target.value)}>
                <option value="">All projects</option>
                {projectOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select className="filter-select" value={fStage} onChange={(e) => setFStage(e.target.value)}>
                <option value="">All stages</option>
                {stageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {entriesQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : entriesQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {entriesQ.error.message}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                  { key: 'department', label: 'Department', render: (e) => deptOf(e) },
                  { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                  { key: 'stage', label: 'Stage', render: (e) => e.stage ?? '—' },
                  { key: 'work', label: 'Work logged today', render: (e) => workText(e) },
                  { key: 'hours', label: 'Hours', render: (e) => (e.hours == null ? '—' : Number(e.hours).toFixed(1)) },
                ]}
                rows={wiseFiltered}
                emptyText="No work logged for this date."
              />
            )}
          </Panel>
        ) : (
        <>
          <Panel title={`By department — ${date}`}>
            {entriesQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : entriesQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {entriesQ.error.message}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'department', label: 'Department' },
                  { key: 'count', label: 'Work logged today' },
                  { key: 'hours', label: 'Hours', render: (r) => Number(r.hours).toFixed(1) },
                  {
                    key: 'status',
                    label: 'Status (derived)',
                    render: (r) => (
                      <StatusPill tone={toneFor(r.hours > 0 ? 'Logged' : 'Pending')}>
                        {r.hours > 0 ? `Logged (${r.count})` : 'No entry'}
                      </StatusPill>
                    ),
                  },
                ]}
                rows={byDept}
                emptyText="No work logged for this date."
              />
            )}
          </Panel>
          <Panel title="By project × stage">
            <DataTable
              columns={[
                { key: 'project', label: 'Project' },
                { key: 'stage', label: 'Stage' },
                { key: 'count', label: 'Entries' },
                { key: 'hours', label: 'Hours', render: (r) => Number(r.hours).toFixed(1) },
              ]}
              rows={byProjectStage}
              emptyText="No work logged for this date."
            />
          </Panel>
          <Panel title="No entry today (team members without entries — simple check)">
            {noEntryToday.length === 0 ? (
              <EmptyState text="Everyone in the team list has an entry, or the team list is empty." />
            ) : (
              <DataTable
                columns={[{ key: 'member', label: 'Member' }, { key: 'team', label: 'Team' }]}
                rows={noEntryToday}
                emptyText="Everyone has an entry today."
              />
            )}
          </Panel>
        </>
        ))}

      {tab === 'extra' && (
        isDirector ? (
          <Panel title="Extra hours worked" sub="Employees logging beyond 8 hours today">
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee' },
                { key: 'department', label: 'Department' },
                { key: 'project', label: 'Project' },
                { key: 'hours', label: 'Hours', render: (d) => Number(d.hours).toFixed(1) },
              ]}
              rows={extraDays}
              emptyText="No extra-hours days."
            />
          </Panel>
        ) : (
        <Panel title={`Extra hours — employee-day sums over 8h (${date})`}>
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'date', label: 'Date' },
              { key: 'hours', label: 'Hours', render: (d) => Number(d.hours).toFixed(1) },
              { key: 'reason', label: 'Reason (notes)', render: (d) => (d.notes ?? []).join(' · ') || '—' },
            ]}
            rows={extraDays}
            emptyText="No extra-hours days."
          />
        </Panel>
        )
      )}

      {tab === 'sunday' && (
        isDirector ? (
          <Panel title="Sunday work record">
            {directorYearQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : directorYearQ.isError ? (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {directorYearQ.error.message}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
                  { key: 'department', label: 'Department', render: (e) => deptOf(e) },
                  { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
                  { key: 'date', label: 'Date', render: (e) => fmtDayLong(e.date) },
                  { key: 'hours', label: 'Hours', render: (e) => (e.hours == null ? '—' : Number(e.hours).toFixed(1)) },
                  { key: 'reason', label: 'Reason', render: (e) => workText(e) },
                ]}
                rows={directorSundayRows}
                emptyText="No Sunday work in this period."
              />
            )}
          </Panel>
        ) : (
        <Panel title="Sunday work (entries whose date is a Sunday)">
          <DataTable
            columns={[
              { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
              { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
              { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
              { key: 'hours', label: 'Hours' },
              { key: 'date', label: 'Date', render: (e) => String(e.date ?? '').slice(0, 10) },
            ]}
            rows={sundayEntries}
            emptyText="No Sunday work in this filter."
          />
        </Panel>
        )
      )}

      {tab === 'holiday' && (
        isDirector ? <DirectorHolidayWork date={date} /> : <HolidayWork date={date} />
      )}
    </>
  );
}

function DirectorHolidayWork({ date }) {
  const year = String(date).slice(0, 4);
  const holidaysQ = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list({ year }),
  });
  const yearQ = useQuery({
    queryKey: ['work-entries-year', year, date],
    queryFn: () => workEntriesApi.list({ from: `${year}-01-01`, to: date }),
  });
  const holidays = holidaysQ.data?.items ?? [];
  const holidayNames = new Map(
    holidays.map((h) => [String(h.date ?? '').slice(0, 10), h.name ?? '']),
  );
  const rows = (yearQ.data?.items ?? []).filter((e) =>
    holidayNames.has(String(e.date ?? '').slice(0, 10)),
  );
  return (
    <Panel title="Other holiday work record">
      {holidaysQ.isLoading || yearQ.isLoading ? (
        <EmptyState text="Loading…" />
      ) : holidaysQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {holidaysQ.error.message}
        </div>
      ) : yearQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {yearQ.error.message}
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
            { key: 'department', label: 'Department', render: (e) => deptOf(e) },
            { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
            {
              key: 'date',
              label: 'Date',
              render: (e) => {
                const iso = String(e.date ?? '').slice(0, 10);
                const name = holidayNames.get(iso);
                return `${fmtShortHoliday(e.date)}${name ? ` (${name})` : ''}`;
              },
            },
            { key: 'hours', label: 'Hours', render: (e) => (e.hours == null ? '—' : Number(e.hours).toFixed(1)) },
            { key: 'reason', label: 'Reason', render: (e) => workText(e) },
          ]}
          rows={rows}
          emptyText="No work logged on holidays in this period."
        />
      )}
    </Panel>
  );
}

function HolidayWork({ date }) {
  const year = String(date).slice(0, 4);
  const holidaysQ = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list({ year }),
  });
  const yearQ = useQuery({
    queryKey: ['work-entries-year', year, date],
    queryFn: () => workEntriesApi.list({ from: `${year}-01-01`, to: date }),
  });
  const holidays = holidaysQ.data?.items ?? [];
  const holidaySet = new Set(
    holidays.map((h) => String(h.date ?? '').slice(0, 10)),
  );
  const rows = (yearQ.data?.items ?? []).filter((e) =>
    holidaySet.has(String(e.date ?? '').slice(0, 10)),
  );
  return (
    <>
      <Panel title={`Holiday calendar — ${year}`}>
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (h) => String(h.date ?? '').slice(0, 10) },
            { key: 'name', label: 'Holiday' },
          ]}
          rows={holidays}
          emptyText="No holidays in the calendar yet. HR adds them in HR → Holiday calendar."
        />
      </Panel>
      <Panel title="Work on other holidays">
        <DataTable
          columns={[
            { key: 'wu', label: 'WU / Ref', render: (e) => wuDisplay(e) },
            { key: 'employee', label: 'Employee', render: (e) => empName(e.employee) },
            { key: 'project', label: 'Project', render: (e) => projLabel(e.project) },
            { key: 'hours', label: 'Hours' },
            { key: 'date', label: 'Date', render: (e) => String(e.date ?? '').slice(0, 10) },
          ]}
          rows={rows}
          emptyText="No work logged on holidays in this period."
        />
      </Panel>
    </>
  );
}
