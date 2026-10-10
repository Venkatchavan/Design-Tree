import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { employeesApi, meApi, request, teamsApi, usersApi, workEntriesApi } from '../lib/api.js';
import { branchOptionItems, useBranchOptions } from '../lib/branches.js';
import { leaveApi, travelApi, holidaysApi } from '../lib/phase4bApi.js';
import { docsApi, fileUrl } from '../lib/docsApi.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import KpiCard from '../components/KpiCard.jsx';

const LOGIN_ROLES = new Set(['founding_director', 'hr', 'admin_billing', 'superuser']);

const EMP_STATUSES = ['Active', 'On Leave', 'Exited'];

const EMP_BLANK = {
  salutation: '', firstName: '', middleName: '', lastName: '', shortName: '',
  fatherName: '', motherName: '', dob: '', sex: '', maritalStatus: '', spouseName: '',
  designation: '', qualification: '', department: '', reportingManager: '',
  branch: '', division: '', salaryStructure: '', email: '', phone: '', mobile: '',
  stdCode: '', dateOfJoining: '', salaryFrom: '', leavingDate: '', leavingReason: '',
  pan: '', wardCircle: '', director: '', aadhar: '', remarks: '', rejoinee: false,
  previousEmpId: '', experience: '', status: 'Active', empId: '',
  zeroPT: false, esiApplicable: false, esiNumber: '', esiDispensary: '',
  pfApplicable: false, pfNumber: '', pfFileNumber: '', pfUan: '', pfRestrictPF: false, pfZeroPension: false,
  bankAccount: '', bankName: '', bankIfsc: '',
  addrLine1: '', addrLine2: '', addrCity: '', addrState: '', addrZip: '',
  loginEmail: '', loginPassword: '', loginRole: '',
};

function empFullName(e) {
  return [e.salutation, e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
}

function dateOnly(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// Flatten an employee document into the EmployeeForm field shape for editing.
function empToForm(emp = {}) {
  return {
    ...EMP_BLANK,
    _id: emp._id ?? emp.id ?? '',
    salutation: emp.salutation ?? '',
    firstName: emp.firstName ?? '',
    middleName: emp.middleName ?? '',
    lastName: emp.lastName ?? '',
    shortName: emp.shortName ?? '',
    fatherName: emp.fatherName ?? '',
    motherName: emp.motherName ?? '',
    dob: dateOnly(emp.dob),
    sex: emp.sex ?? '',
    maritalStatus: emp.maritalStatus ?? '',
    spouseName: emp.spouseName ?? '',
    designation: emp.designation ?? '',
    qualification: emp.qualification ?? '',
    department: emp.department ?? '',
    reportingManager: emp.reportingManager ?? '',
    branch: emp.branch ?? '',
    division: emp.division ?? '',
    salaryStructure: emp.salaryStructure ?? '',
    email: emp.email ?? '',
    phone: emp.phone ?? '',
    mobile: emp.mobile ?? '',
    stdCode: emp.stdCode ?? '',
    dateOfJoining: dateOnly(emp.dateOfJoining),
    salaryFrom: dateOnly(emp.salaryFrom),
    leavingDate: dateOnly(emp.leavingDate),
    leavingReason: emp.leavingReason ?? '',
    pan: emp.pan ?? '',
    wardCircle: emp.wardCircle ?? '',
    director: emp.director ?? '',
    aadhar: emp.aadhar ?? '',
    remarks: emp.remarks ?? '',
    rejoinee: !!emp.rejoinee,
    previousEmpId: emp.previousEmpId ?? '',
    experience: emp.experience ?? '',
    status: emp.status ?? 'Active',
    empId: emp.empId ?? '',
    zeroPT: !!emp.zeroPT,
    esiApplicable: !!emp.esi?.applicable,
    esiNumber: emp.esi?.number ?? '',
    esiDispensary: emp.esi?.dispensary ?? '',
    pfApplicable: !!emp.pf?.applicable,
    pfNumber: emp.pf?.number ?? '',
    pfFileNumber: emp.pf?.fileNumber ?? '',
    pfUan: emp.pf?.uan ?? '',
    pfRestrictPF: !!emp.pf?.restrictPF,
    pfZeroPension: !!emp.pf?.zeroPension,
    bankAccount: emp.bank?.account ?? '',
    bankName: emp.bank?.name ?? '',
    bankIfsc: emp.bank?.ifsc ?? '',
    addrLine1: emp.address?.line1 ?? '',
    addrLine2: emp.address?.line2 ?? '',
    addrCity: emp.address?.city ?? '',
    addrState: emp.address?.state ?? '',
    addrZip: emp.address?.zip ?? '',
    loginEmail: '',
    loginPassword: '',
    loginRole: '',
  };
}

function OverviewTab() {
  const dir = useQuery({ queryKey: ['employees-dir'], queryFn: () => employeesApi.list({}) });
  const items = dir.data?.items ?? [];
  const total = dir.data?.total ?? items.length;

  const byStatus = useMemo(() => {
    const c = { active: 0, leave: 0, exited: 0 };
    for (const e of items) {
      const s = String(e.status ?? 'active').toLowerCase();
      if (['active', 'working', 'present'].includes(s)) c.active += 1;
      else if (['leave', 'on-leave', 'onleave'].includes(s)) c.leave += 1;
      else if (['exited', 'relieved', 'resigned', 'terminated', 'inactive'].includes(s)) c.exited += 1;
      else c.active += 1;
    }
    return c;
  }, [items]);

  const byBranch = useMemo(() => {
    const m = new Map();
    for (const e of items) {
      const k = e.branch || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [items]);

  const byDept = useMemo(() => {
    const m = new Map();
    for (const e of items) {
      const k = e.department || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [items]);

  if (dir.isError) {
    return <div className="login-error" role="alert" style={{ display: 'block' }}>{dir.error.message}</div>;
  }

  return (
    <>
      <div className="kpi-grid cols-5">
        <KpiCard label="Total headcount" value={total} accent="blueprint" />
        <KpiCard label="Active" value={byStatus.active} accent="forest" />
        <KpiCard label="On leave" value={byStatus.leave} accent="amber" />
        <KpiCard label="Exited" value={byStatus.exited} accent="rust" />
      </div>
      <div className="two-col">
        <Panel title="By branch">
          {byBranch.length === 0 ? (
            <EmptyState text={dir.isLoading ? 'Loading…' : 'No branch breakdown yet.'} />
          ) : (
            <table className="data">
              <thead><tr><th>Branch</th><th>Headcount</th></tr></thead>
              <tbody>
                {byBranch.map(([b, n]) => (<tr key={b}><td>{b}</td><td className="mono">{n}</td></tr>))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="By department / service">
          {byDept.length === 0 ? (
            <EmptyState text={dir.isLoading ? 'Loading…' : 'No department breakdown yet.'} />
          ) : (
            <table className="data">
              <thead><tr><th>Department</th><th>Headcount</th></tr></thead>
              <tbody>
                {byDept.map(([d, n]) => (<tr key={d}><td>{d}</td><td className="mono">{n}</td></tr>))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      <AttendancePanel />
      <TravelPanel />
    </>
  );
}

function AttendancePanel() {
  const q = useQuery({ queryKey: ['hr-leaves'], queryFn: () => leaveApi.list({}) });
  const today = new Date().toISOString().slice(0, 10);
  const onLeave = (q.data?.items ?? []).filter((r) => {
    if (r.status !== 'Approved') return false;
    const from = String(r.from ?? '').slice(0, 10);
    const to = String(r.to ?? '').slice(0, 10);
    return from <= today && today <= to;
  });
  return (
    <Panel title="Attendance today">
      {q.isLoading ? (
        <EmptyState text="Loading…" />
      ) : (
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
            { key: 'branch', label: 'Branch', render: (r) => r.employee?.branch ?? '—' },
            { key: 'service', label: 'Service', render: (r) => r.employee?.department ?? '—' },
            { key: 'status', label: "Today's status", render: () => <StatusPill status="On leave">On leave</StatusPill> },
          ]}
          rows={onLeave}
          emptyText="Nobody on approved leave today."
        />
      )}
    </Panel>
  );
}

function TravelPanel() {
  const q = useQuery({ queryKey: ['hr-travels'], queryFn: () => travelApi.list({}) });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (q.data?.items ?? []).filter(
    (r) => r.status === 'Approved' && String(r.returnDate ?? r.departureDate ?? '') >= today,
  );
  return (
    <Panel title="Upcoming travel">
      {q.isLoading ? (
        <EmptyState text="Loading…" />
      ) : (
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
            { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? '—'} → ${r.toCity ?? '—'}` },
            { key: 'dates', label: 'Dates', render: (r) => `${r.departureDate ? String(r.departureDate).slice(0, 10) : '—'} → ${r.returnDate ? String(r.returnDate).slice(0, 10) : '—'}` },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
          ]}
          rows={upcoming}
          emptyText="No upcoming approved travel."
        />
      )}
    </Panel>
  );
}

const DIRECTOR_ROLES = new Set(['founding_director', 'working_director', 'executive_director']);

function DirectorOverviewTab() {
  const dir = useQuery({ queryKey: ['employees-dir'], queryFn: () => employeesApi.list({}) });
  const leaves = useQuery({ queryKey: ['hr-leaves'], queryFn: () => leaveApi.list({}) });
  const travels = useQuery({ queryKey: ['hr-travels'], queryFn: () => travelApi.list({}) });
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const items = dir.data?.items ?? [];
  const total = dir.data?.total ?? items.length;
  const onLeave = (leaves.data?.items ?? []).filter((r) => {
    if (r.status !== 'Approved') return false;
    const from = String(r.from ?? '').slice(0, 10);
    const to = String(r.to ?? '').slice(0, 10);
    return from <= today && today <= to;
  });
  const present = Math.max(0, total - onLeave.length);
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const travelWeek = (travels.data?.items ?? []).filter((r) => {
    if (r.status !== 'Approved') return false;
    const dep = String(r.departureDate ?? '').slice(0, 10);
    return dep >= today && dep <= weekEnd;
  });
  if (dir.isError) {
    return <div className="login-error" role="alert" style={{ display: 'block' }}>{dir.error.message}</div>;
  }
  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Total employees" value={total} accent="blueprint" />
        <KpiCard label="Present today" value={present} accent="forest" />
        <KpiCard label="On leave today" value={onLeave.length} accent="amber" />
        <KpiCard label="Travel this week" value={travelWeek.length} accent="violet" />
      </div>
      <Panel title="Attendance today" sub={`${present} of ${total} present (${pct}%)`}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          <span>On leave <b className="mono">{onLeave.length}</b></span>
        </div>
        {leaves.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'branch', label: 'Branch', render: (r) => r.employee?.branch ?? '—' },
              { key: 'service', label: 'Service', render: (r) => r.employee?.department ?? '—' },
              { key: 'status', label: "Today's status", render: () => <StatusPill status="On leave">On leave</StatusPill> },
            ]}
            rows={onLeave}
            emptyText="Nobody on approved leave today."
          />
        )}
      </Panel>
      <Panel title="Upcoming travel">
        {travels.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <DataTable
            columns={[
              { key: 'dates', label: 'Dates', render: (r) => `${r.departureDate ? String(r.departureDate).slice(0, 10) : '—'} → ${r.returnDate ? String(r.returnDate).slice(0, 10) : '—'}` },
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'purpose', label: 'Purpose', render: (r) => [r.purpose, r.project?.name ?? r.project].filter(Boolean).join(' — ') || '—' },
            ]}
            rows={(travels.data?.items ?? []).filter(
              (r) => r.status === 'Approved' && String(r.returnDate ?? r.departureDate ?? '') >= today,
            )}
            emptyText="No upcoming approved travel."
          />
        )}
      </Panel>
    </>
  );
}

function DirectorLoginHoursTab() {
  const q = useQuery({ queryKey: ['hr-work-entries'], queryFn: () => workEntriesApi.list({}) });
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of q.data?.items ?? []) {
      const pid = String(e.project?._id ?? e.project ?? '');
      const key = `${pid}|${e.stage ?? '—'}`;
      let g = m.get(key);
      if (!g) {
        g = { key, project: e.project?.name ?? e.project ?? '—', stage: e.stage ?? '—', empIds: new Set(), total: 0 };
        m.set(key, g);
      }
      g.empIds.add(String(e.employee?._id ?? e.employee ?? ''));
      g.total += Number(e.hours ?? 0);
    }
    return [...m.values()].map((g) => ({
      key: g.key,
      project: g.project,
      stage: g.stage,
      employees: g.empIds.size,
      total: g.total,
      avg: g.empIds.size > 0 ? g.total / g.empIds.size : 0,
    }));
  }, [q.data]);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const projectCount = new Set(groups.map((g) => g.project)).size;
  const avgPerStage = groups.length > 0 ? grandTotal / groups.length : 0;
  const f1 = (n) => Number(n ?? 0).toFixed(1);
  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Total hours logged today" value={f1(grandTotal)} accent="blueprint" />
        <KpiCard label="Projects with activity" value={projectCount} accent="forest" />
        <KpiCard label="Stages in progress" value={groups.length} accent="teal" />
        <KpiCard label="Avg. hours / stage" value={f1(avgPerStage)} accent="violet" />
      </div>
      <Panel title="Login hours by project and stage" sub="Total hours logged across all employees, grouped by project and design stage — feeds Finance's cost & performance tracking.">
        {q.isLoading ? (
          <EmptyState text="Loading…" />
        ) : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project' },
              { key: 'stage', label: 'Stage' },
              { key: 'employees', label: 'Employees logged in' },
              { key: 'total', label: 'Total hours', render: (r) => f1(r.total) },
              { key: 'avg', label: 'Avg. hours / employee', render: (r) => f1(r.avg) },
            ]}
            rows={groups}
            emptyText="No work entries logged yet."
          />
        )}
      </Panel>
    </>
  );
}

function quarterBounds(todayStr) {
  const [y, m] = todayStr.split('-').map(Number);
  const qStartMonth = Math.floor((m - 1) / 3) * 3;
  const pad = (n) => String(n).padStart(2, '0');
  return { startYm: `${y}-${pad(qStartMonth + 1)}`, endYm: `${y}-${pad(qStartMonth + 3)}` };
}

function spendOf(r) {
  const actual = Number(r.actualExpense ?? 0);
  if (actual > 0) return actual;
  return Number(r.estExpense ?? 0);
}

function fmtSpend(v) {
  const n = Number(v ?? 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtTripDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

function tripStatus(r, today) {
  const ret = String(r.returnDate ?? '').slice(0, 10);
  const dep = String(r.departureDate ?? '').slice(0, 10);
  if (ret && ret < today) return 'Completed';
  if (dep && dep > today) return 'Upcoming';
  return 'In progress';
}

function purposeBucket(purpose) {
  const p = String(purpose ?? '').toLowerCase();
  if (p.includes('site')) return 'Site visits';
  if (p.includes('client') || p.includes('meeting')) return 'Client meetings';
  return 'Internal / training';
}

function DirectorTravelLogTab() {
  const q = useQuery({ queryKey: ['hr-travels'], queryFn: () => travelApi.list({}) });
  const today = new Date().toISOString().slice(0, 10);
  const { startYm: qStartYm, endYm: qEndYm } = quarterBounds(today);
  const items = q.data?.items ?? [];
  const quarterTrips = items.filter((r) => {
    const ym = String(r.departureDate ?? '').slice(0, 7);
    return ym >= qStartYm && ym <= qEndYm;
  });
  const upcoming = items.filter((r) => r.status === 'Approved' && String(r.returnDate ?? r.departureDate ?? '') >= today);
  const spendQtr = quarterTrips.reduce((s, r) => s + spendOf(r), 0);
  const avgCost = quarterTrips.length > 0 ? spendQtr / quarterTrips.length : 0;
  const purposeCounts = (() => {
    const c = { 'Site visits': 0, 'Client meetings': 0, 'Internal / training': 0 };
    for (const r of quarterTrips) c[purposeBucket(r.purpose)] += 1;
    return c;
  })();
  const topTravelers = (() => {
    const m = new Map();
    for (const r of quarterTrips) {
      const id = String(r.employee?._id ?? r.employee ?? '');
      let g = m.get(id);
      if (!g) {
        g = {
          id,
          name: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—',
          branch: r.employee?.branch ?? '—',
          trips: 0,
          spend: 0,
        };
        m.set(id, g);
      }
      g.trips += 1;
      g.spend += spendOf(r);
    }
    return [...m.values()].sort((a, b) => b.trips - a.trips || b.spend - a.spend).slice(0, 5);
  })();
  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Trips this quarter" value={quarterTrips.length} accent="blueprint" />
        <KpiCard label="Upcoming" value={upcoming.length} accent="teal" />
        <KpiCard label="Travel spend (qtr)" value={fmtSpend(spendQtr)} accent="copper" />
        <KpiCard label="Avg. cost / trip" value={fmtSpend(avgCost)} accent="violet" />
      </div>
      <Panel title="Travel log">
        {q.isLoading ? (
          <EmptyState text="Loading…" />
        ) : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
              { key: 'purpose', label: 'Purpose', render: (r) => r.purpose ?? '—' },
              { key: 'location', label: 'Location', render: (r) => [r.project?.name ?? r.project, r.toCity].filter(Boolean).join(', ') || '—' },
              { key: 'departureDate', label: 'Travel date', render: (r) => fmtTripDate(r.departureDate) },
              { key: 'returnDate', label: 'Return date', render: (r) => fmtTripDate(r.returnDate) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={tripStatus(r, today)}>{tripStatus(r, today)}</StatusPill> },
            ]}
            rows={items}
            emptyText="No travel requests yet."
          />
        )}
      </Panel>
      <div className="two-col">
        <Panel title="By purpose, this quarter">
          {q.isLoading ? (
            <EmptyState text="Loading…" />
          ) : (
            <table className="data">
              <tbody>
                {Object.entries(purposeCounts).map(([k, n]) => (<tr key={k}><td>{k}</td><td className="mono">{n}</td></tr>))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Top travelers, this quarter">
          {q.isLoading ? (
            <EmptyState text="Loading…" />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'branch', label: 'Branch' },
                { key: 'trips', label: 'Trips' },
                { key: 'spend', label: 'Total spend', render: (r) => fmtSpend(r.spend) },
              ]}
              rows={topTravelers}
              emptyText="No trips this quarter."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

const HOLIDAY_TYPES = ['Public holiday', 'Restricted holiday'];

function DirectorHolidaysTab() {
  const year = new Date().getFullYear();
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: '', name: '', type: 'Public holiday' });
  const q = useQuery({ queryKey: ['hr-holidays', year], queryFn: () => holidaysApi.list({ year }) });
  const items = q.data?.items ?? [];
  const holidayDates = (() => {
    const s = new Set();
    for (const h of items) {
      if (h.date) s.add(String(h.date).slice(0, 10));
    }
    return s;
  })();
  const createMut = useMutation({
    mutationFn: (body) => holidaysApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-holidays', year] });
      setForm({ date: '', name: '', type: 'Public holiday' });
    },
  });
  const removeMut = useMutation({
    mutationFn: (id) => holidaysApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-holidays', year] }),
  });
  const months = useMemo(() => {
    const out = [];
    for (let m = 0; m < 12; m++) {
      const firstWeekday = new Date(year, m, 1).getDay();
      const days = new Date(year, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < firstWeekday; i++) cells.push(null);
      for (let d = 1; d <= days; d++) cells.push(d);
      out.push({ m, cells });
    }
    return out;
  }, [year]);
  const monthName = (m) => new Date(year, m, 1).toLocaleString('en-GB', { month: 'long' });
  const isoOf = (m, d) => `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const err = createMut.error?.message ?? removeMut.error?.message;
  return (
    <>
      <Panel title="Add a holiday" sub="Appears on every employee's calendar and is excluded from working-day counts.">
        <form
          className="field-grid"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ date: form.date, name: form.name.trim(), type: form.type });
          }}
        >
          <div className="form-row"><label className="form-label">Date</label><input required type="date" className="form-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Holiday name</label><input required className="form-input" placeholder="e.g. Republic Day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Type</label><select className="filter-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{HOLIDAY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <button type="submit" className="btn-primary" disabled={createMut.isPending}>{createMut.isPending ? 'Adding…' : 'Add holiday'}</button>
        </form>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      </Panel>
      <Panel title="Holiday calendar" sub={`${year}`}>
        {q.isLoading ? (
          <EmptyState text="Loading…" />
        ) : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
        ) : (
          <div className="cal-year">
            {months.map(({ m, cells }) => (
              <div key={m} className="cal-month">
                <div className="cal-month-name">{monthName(m)}</div>
                <div className="cal-grid">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
                  {cells.map((d, i) => d == null ? (
                    <span key={i} className="cal-day empty" />
                  ) : (
                    <span key={i} className={`cal-day${holidayDates.has(isoOf(m, d)) ? ' holiday' : ''}`}>{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Holidays this year">
        {q.isLoading ? (
          <EmptyState text="Loading…" />
        ) : items.length === 0 ? (
          <EmptyState text="No holidays published for this year." />
        ) : (
          <table className="data">
            <tbody>
              {items.map((h) => (
                <tr key={h._id ?? h.id}>
                  <td>{h.date ? new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} — {h.name}</td>
                  <td>{h.type ?? 'Public holiday'}</td>
                  <td><button type="button" className="approve-btn" disabled={removeMut.isPending} onClick={() => removeMut.mutate(h._id ?? h.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function EmployeeForm({ bootstrap, initial, onDone, heading, hideImport }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState(initial ?? { ...EMP_BLANK });
  const [err, setErr] = useState('');
  const canLogin = LOGIN_ROLES.has(bootstrap?.role?.key);
  const isCreate = !f._id;
  const branchOptionsQ = useBranchOptions();
  const branchOptions = branchOptionItems(branchOptionsQ.data);
  // Legacy values predate the branch master — keep displaying them, but any
  // change must pick from the master (unchanged values are not re-sent).
  const branchChoices =
    f.branch && !branchOptions.includes(f.branch)
      ? [f.branch, ...branchOptions]
      : branchOptions;

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => {
      if (!body._id) return employeesApi.create(body);
      const { _id, ...payload } = body;
      return employeesApi.update(_id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-dir'] });
      onDone();
    },
    onError: (e) => {
      const details = e?.data?.errors;
      const extra =
        Array.isArray(details) && details.length > 0
          ? ` (${details
              .slice(0, 3)
              .map((d) => `${(d.path ?? []).join('.') || 'field'}: ${d.message}`)
              .join('; ')})`
          : '';
      setErr(`${e.message}${extra}`);
    },
  });

  function handleSaralFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(
      (buf) => {
        try {
          const wb = XLSX.read(buf, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const first = rows[0] ?? {};
          const lower = {};
          for (const [k, v] of Object.entries(first)) lower[String(k).toLowerCase().trim()] = v;
          const pick = (...keys) => {
            for (const k of keys) if (lower[k] !== undefined && lower[k] !== '') return String(lower[k]);
            return '';
          };
          setF((p) => ({
            ...p,
            firstName: pick('firstname', 'first name') || p.firstName,
            lastName: pick('lastname', 'last name') || p.lastName,
            empId: pick('empid', 'emp id', 'employee id') || p.empId,
            designation: pick('designation') || p.designation,
            department: pick('department') || p.department,
            branch: pick('branch') || p.branch,
            email: pick('email') || p.email,
            phone: pick('phone') || p.phone,
            mobile: pick('mobile') || p.mobile,
            pan: pick('pan') || p.pan,
            aadhar: pick('aadhar', 'aadhaar') || p.aadhar,
            dateOfJoining: pick('dateofjoining', 'date of joining', 'doj') || p.dateOfJoining,
          }));
          setErr('');
        } catch {
          setErr('Could not parse the Saral file. Use .xlsx/.csv with named columns.');
        }
      },
      () => setErr('Could not read the Saral file.'),
    );
    e.target.value = '';
  }

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (isCreate && !String(f.firstName ?? '').trim()) {
      setErr('First name is required.');
      return;
    }
    if ((f.loginEmail || f.loginPassword) && !canLogin) {
      setErr('You are not permitted to create logins.');
      return;
    }
    // Mandatory-4 on create (permission-gated): firstName + attached login
    // email/password/role. Update keeps everything optional.
    if (isCreate && canLogin && (!String(f.loginEmail ?? '').trim() || !f.loginPassword || !f.loginRole)) {
      setErr('Login email, password and role are required.');
      return;
    }
    const body = {
      ...(f._id ? { _id: f._id } : {}),
      empId: f.empId || undefined,
      salutation: f.salutation || undefined,
      firstName: f.firstName || undefined,
      middleName: f.middleName || undefined,
      lastName: f.lastName || undefined,
      shortName: f.shortName || undefined,
      fatherName: f.fatherName || undefined,
      motherName: f.motherName || undefined,
      dob: f.dob || undefined,
      sex: f.sex || undefined,
      maritalStatus: f.maritalStatus || undefined,
      spouseName: f.spouseName || undefined,
      designation: f.designation || undefined,
      qualification: f.qualification || undefined,
      department: f.department || undefined,
      reportingManager: f.reportingManager || undefined,
      // Unchanged legacy branches predate the master — don't re-send them.
      branch: (f.branch ?? '') === (initial?.branch ?? '') ? undefined : (f.branch || undefined),
      division: f.division || undefined,
      salaryStructure: f.salaryStructure || undefined,
      bank: { account: f.bankAccount || undefined, name: f.bankName || undefined, ifsc: f.bankIfsc || undefined },
      address: { line1: f.addrLine1 || undefined, line2: f.addrLine2 || undefined, city: f.addrCity || undefined, state: f.addrState || undefined, zip: f.addrZip || undefined },
      email: f.email || undefined,
      phone: f.phone || undefined,
      mobile: f.mobile || undefined,
      stdCode: f.stdCode || undefined,
      dateOfJoining: f.dateOfJoining || undefined,
      salaryFrom: f.salaryFrom || undefined,
      leavingDate: f.leavingDate || undefined,
      leavingReason: f.leavingReason || undefined,
      esi: { applicable: !!f.esiApplicable, number: f.esiNumber || undefined, dispensary: f.esiDispensary || undefined },
      pf: { applicable: !!f.pfApplicable, number: f.pfNumber || undefined, fileNumber: f.pfFileNumber || undefined, uan: f.pfUan || undefined, restrictPF: !!f.pfRestrictPF, zeroPension: !!f.pfZeroPension },
      zeroPT: !!f.zeroPT,
      pan: f.pan || undefined,
      wardCircle: f.wardCircle || undefined,
      director: f.director || undefined,
      aadhar: f.aadhar || undefined,
      remarks: f.remarks || undefined,
      rejoinee: f.rejoinee || undefined,
      previousEmpId: f.previousEmpId || undefined,
      experience: f.experience || undefined,
      status: f.status || undefined,
    };
    // Login stays attached to this same form (create only — updates never
    // provision logins, so everything stays optional there).
    if (isCreate && canLogin && (f.loginEmail || f.loginPassword || f.loginRole)) {
      body.login = { email: f.loginEmail || undefined, password: f.loginPassword || undefined, role: f.loginRole || undefined };
    }
    save.mutate(body);
  }

  const I = (k, props = {}) => (
    <input className="form-input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...props} />
  );

  return (
    <form onSubmit={handleSubmit}>
      <h4 style={{ fontSize: 13, margin: '6px 0 12px' }}>{heading}</h4>
      {!hideImport && (
        <>
          <div className="section-label">Saral import (fills this form, client-side only)</div>
          <div className="form-row">
            <input type="file" accept=".xlsx,.csv" onChange={handleSaralFile} aria-label="Saral import file" />
          </div>
        </>
      )}
      <div className="section-label">Identity</div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Emp ID (blank = auto)</label>{I('empId')}</div>
        <div className="form-row"><label className="form-label">Salutation</label>{I('salutation')}</div>
        <div className="form-row"><label className="form-label">First name {isCreate ? '*' : ''}</label>{I('firstName', { required: isCreate })}</div>
        <div className="form-row"><label className="form-label">Middle name</label>{I('middleName')}</div>
        <div className="form-row"><label className="form-label">Last name</label>{I('lastName')}</div>
        <div className="form-row"><label className="form-label">Short name</label>{I('shortName')}</div>
        <div className="form-row"><label className="form-label">Father name</label>{I('fatherName')}</div>
        <div className="form-row"><label className="form-label">Mother name</label>{I('motherName')}</div>
        <div className="form-row"><label className="form-label">DOB</label>{I('dob', { type: 'date' })}</div>
        <div className="form-row"><label className="form-label">Sex</label>{I('sex')}</div>
        <div className="form-row"><label className="form-label">Marital status</label>{I('maritalStatus')}</div>
        <div className="form-row"><label className="form-label">Spouse name</label>{I('spouseName')}</div>
      </div>
      <div className="section-label">Employment</div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Designation</label>{I('designation')}</div>
        <div className="form-row"><label className="form-label">Qualification</label>{I('qualification')}</div>
        <div className="form-row"><label className="form-label">Department</label>{I('department')}</div>
        <div className="form-row"><label className="form-label">Reporting manager</label>{I('reportingManager')}</div>
        <div className="form-row"><label className="form-label">Branch</label>
          <select className="form-input" value={f.branch ?? ''} onChange={(e) => set('branch', e.target.value)}>
            <option value="">—</option>
            {branchChoices.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="form-row"><label className="form-label">Division</label>{I('division')}</div>
        <div className="form-row"><label className="form-label">Salary structure</label>{I('salaryStructure')}</div>
        <div className="form-row"><label className="form-label">Date of joining</label>{I('dateOfJoining', { type: 'date' })}</div>
        <div className="form-row"><label className="form-label">Salary from</label>{I('salaryFrom', { type: 'date' })}</div>
        <div className="form-row"><label className="form-label">Leaving date</label>{I('leavingDate', { type: 'date' })}</div>
        <div className="form-row"><label className="form-label">Leaving reason</label>{I('leavingReason')}</div>
        <div className="form-row"><label className="form-label">Status</label><select className="form-input" value={f.status ?? 'Active'} onChange={(e) => set('status', e.target.value)}>{EMP_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}</select></div>
        <div className="form-row"><label className="form-label">Experience</label>{I('experience')}</div>
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.rejoinee} onChange={(e) => set('rejoinee', e.target.checked)} /> Rejoinee</label></div>
        <div className="form-row"><label className="form-label">Previous emp ID</label>{I('previousEmpId')}</div>
      </div>
      <div className="section-label">Contact & address</div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Email</label>{I('email', { type: 'email' })}</div>
        <div className="form-row"><label className="form-label">Phone</label>{I('phone')}</div>
        <div className="form-row"><label className="form-label">Mobile</label>{I('mobile')}</div>
        <div className="form-row"><label className="form-label">STD code</label>{I('stdCode')}</div>
        <div className="form-row"><label className="form-label">Address line 1</label>{I('addrLine1')}</div>
        <div className="form-row"><label className="form-label">Address line 2</label>{I('addrLine2')}</div>
        <div className="form-row"><label className="form-label">City</label>{I('addrCity')}</div>
        <div className="form-row"><label className="form-label">State</label>{I('addrState')}</div>
        <div className="form-row"><label className="form-label">ZIP</label>{I('addrZip')}</div>
      </div>
      <div className="section-label">Bank</div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label">Account</label>{I('bankAccount')}</div>
        <div className="form-row"><label className="form-label">Bank name</label>{I('bankName')}</div>
        <div className="form-row"><label className="form-label">IFSC</label>{I('bankIfsc')}</div>
      </div>
      <div className="section-label">Statutory (ESI / PF / PT)</div>
      <div className="field-grid">
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.esiApplicable} onChange={(e) => set('esiApplicable', e.target.checked)} /> ESI applicable</label></div>
        <div className="form-row"><label className="form-label">ESI number</label>{I('esiNumber')}</div>
        <div className="form-row"><label className="form-label">ESI dispensary</label>{I('esiDispensary')}</div>
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.pfApplicable} onChange={(e) => set('pfApplicable', e.target.checked)} /> PF applicable</label></div>
        <div className="form-row"><label className="form-label">PF number</label>{I('pfNumber')}</div>
        <div className="form-row"><label className="form-label">PF file number</label>{I('pfFileNumber')}</div>
        <div className="form-row"><label className="form-label">UAN</label>{I('pfUan')}</div>
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.pfRestrictPF} onChange={(e) => set('pfRestrictPF', e.target.checked)} /> Restrict PF</label></div>
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.pfZeroPension} onChange={(e) => set('pfZeroPension', e.target.checked)} /> Zero pension</label></div>
        <div className="form-row"><label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!f.zeroPT} onChange={(e) => set('zeroPT', e.target.checked)} /> Zero PT</label></div>
        <div className="form-row"><label className="form-label">PAN</label>{I('pan')}</div>
        <div className="form-row"><label className="form-label">Ward / circle</label>{I('wardCircle')}</div>
        <div className="form-row"><label className="form-label">Director</label>{I('director')}</div>
        <div className="form-row"><label className="form-label">Aadhar</label>{I('aadhar')}</div>
      </div>
      <div className="form-row"><label className="form-label">Remarks</label><textarea className="form-input" value={f.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} /></div>

      {canLogin && (
        <>
          <div className="section-label">Login (restricted)</div>
          <div className="field-grid">
            <div className="form-row"><label className="form-label">Login email {isCreate ? '*' : ''}</label>{I('loginEmail', { type: 'email', required: isCreate })}</div>
            <div className="form-row"><label className="form-label">Password {isCreate ? '*' : ''}</label>{I('loginPassword', { type: 'password', required: isCreate, minLength: 8 })}</div>
            <div className="form-row">
              <label className="form-label">Role {isCreate ? '*' : ''}</label>
              <select className="filter-select" style={{ width: '100%' }} value={f.loginRole ?? ''} onChange={(e) => set('loginRole', e.target.value)} required={isCreate}>
                <option value="">Select role</option>
                {(bootstrap?.roles ?? []).map((r) => (
                  <option key={r.key ?? r.value ?? r} value={r.key ?? r.value ?? r}>
                    {r.label ?? r.key ?? r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <button type="submit" className="btn-primary" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save employee'}
      </button>
    </form>
  );
}

function ManageTab({ bootstrap }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState(null);
  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().slice(0, 10));
  const [leavingReason, setLeavingReason] = useState('');
  const [toggleErr, setToggleErr] = useState('');

  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const me = meQ.data?.user ?? null;

  const dir = useQuery({
    queryKey: ['employees', { search, branch, department, status }],
    queryFn: () => employeesApi.list({ search, branch, department, status }),
  });
  const filters = useQuery({ queryKey: ['employees-filters'], queryFn: employeesApi.filters });
  const profile = useQuery({
    queryKey: ['employee', profileId],
    queryFn: () => employeesApi.get(profileId),
    enabled: !!profileId,
  });

  const items = dir.data?.items ?? [];

  // Coupled activate/deactivate: employee status + linked login isActive
  // move together so an exited employee cannot still sign in.
  const toggle = useMutation({
    mutationFn: async ({ emp, loginId, activate, leavingDate: ld, leavingReason: lr }) => {
      const updated = await employeesApi.update(emp._id ?? emp.id, {
        status: activate ? 'Active' : 'Exited',
        ...(activate ? {} : { leavingDate: ld || undefined, leavingReason: lr || undefined }),
      });
      if (loginId) {
        try {
          await usersApi.update(loginId, { isActive: activate });
        } catch (loginErr) {
          const err = new Error(
            activate
              ? `Employee activated, but re-enabling the login failed: ${loginErr.message}`
              : `Employee marked exited, but disabling the login failed: ${loginErr.message}`,
          );
          err.employeeUpdated = updated;
          throw err;
        }
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', profileId] });
      queryClient.invalidateQueries({ queryKey: ['employees-dir'] });
      setConfirmMode(null);
      setLeavingReason('');
      setToggleErr('');
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', profileId] });
      setToggleErr(e.message);
    },
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 220 }} placeholder="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">All branches</option>
          {(filters.data?.branches ?? []).map((b) => (<option key={b} value={b}>{b}</option>))}
        </select>
        <select className="filter-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {(filters.data?.departments ?? []).map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {EMP_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>Add employee</button>
      </div>
      {dir.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{dir.error.message}</div>
      ) : dir.isLoading ? (
        <EmptyState text="Loading…" />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Employee', render: empFullName },
            { key: 'empId', label: 'Emp ID', render: (e) => e.empId ?? '—' },
            { key: 'designation', label: 'Designation' },
            { key: 'department', label: 'Department' },
            { key: 'branch', label: 'Branch' },
            { key: 'status', label: 'Status', render: (e) => <StatusPill tone={statusTone(e.status)}>{e.status ?? '—'}</StatusPill> },
          ]}
          rows={items}
          emptyText="No employees match these filters."
          onRowClick={(e) => setProfileId(e._id ?? e.id)}
        />
      )}
      {addOpen && (
        <Modal title="Add employee" wide onClose={() => setAddOpen(false)}>
          <EmployeeForm
            bootstrap={bootstrap}
            heading="Payroll form — all sections"
            onDone={() => {
              setAddOpen(false);
              queryClient.invalidateQueries({ queryKey: ['employees'] });
            }}
          />
        </Modal>
      )}
      {profileId && (
        <Modal title="Employee profile" wide onClose={() => { setProfileId(null); setToggleErr(''); }}>
          {profile.isLoading ? (
            <EmptyState text="Loading…" />
          ) : profile.isError ? (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{profile.error.message}</div>
          ) : (
            (() => {
              const emp = profile.data?.employee ?? {};
              const login = emp.user ?? null;
              const loginId = login?._id ?? login?.id ?? (typeof login === 'string' ? login : null);
              const isExited = String(emp.status ?? '').toLowerCase() === 'exited';
              const isSelf =
                (me?.id && loginId && String(me.id) === String(loginId)) ||
                (me?.employee && (emp._id ?? emp.id) && String(me.employee) === String(emp._id ?? emp.id));
              return (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button type="button" className="approve-btn" onClick={() => setEditOpen(true)}>Edit details</button>
                    <button
                      type="button"
                      className="approve-btn"
                      disabled={toggle.isPending || !!isSelf}
                      title={isSelf ? 'You cannot deactivate your own login.' : undefined}
                      onClick={() => {
                        setToggleErr('');
                        setLeavingDate(new Date().toISOString().slice(0, 10));
                        setLeavingReason('');
                        setConfirmMode(isExited ? 'activate' : 'deactivate');
                      }}
                    >
                      {isExited ? 'Activate' : 'Deactivate'}
                    </button>
                  </div>
                  {isSelf && (
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>This is your own account — activation cannot be changed here.</p>
                  )}
                  <div className="field-grid">
                    <Field label="Name" value={empFullName(emp)} />
                    <Field label="Emp ID" value={emp.empId} mono />
                    <Field label="Designation" value={emp.designation} />
                    <Field label="Department" value={emp.department} />
                    <Field label="Branch" value={emp.branch} />
                    <Field label="Date of joining" value={emp.dateOfJoining} />
                    <Field label="Email" value={emp.email} />
                    <Field label="Mobile" value={emp.mobile} />
                    <Field label="Status" value={emp.status} />
                  </div>
                  <EmployeeDocuments empId={emp._id ?? emp.id} docs={emp.documents ?? []} />
                  <div className="section-label" style={{ marginTop: 12 }}>Linked login</div>
                  {!login ? (
                    <EmptyState text="No login linked to this employee." />
                  ) : (
                    <div className="field-grid">
                      <Field label="Email" value={login.email} />
                      <Field label="Role" value={login.role} />
                      <Field label="Active" value={String(login.isActive)} />
                    </div>
                  )}
                  {toggleErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{toggleErr}</div>}
                </>
              );
            })()
          )}
        </Modal>
      )}
      {editOpen && profileId && !profile.isLoading && !profile.isError && (
        <Modal title="Edit employee" wide onClose={() => setEditOpen(false)}>
          <EmployeeForm
            key={String(profileId)}
            bootstrap={bootstrap}
            heading="Edit all sections"
            hideImport
            initial={empToForm(profile.data?.employee ?? {})}
            onDone={() => {
              setEditOpen(false);
              queryClient.invalidateQueries({ queryKey: ['employees'] });
              queryClient.invalidateQueries({ queryKey: ['employee', profileId] });
              queryClient.invalidateQueries({ queryKey: ['employees-dir'] });
            }}
          />
        </Modal>
      )}
      {confirmMode && profileId && !profile.isLoading && !profile.isError && (
        <Modal
          title={confirmMode === 'deactivate' ? 'Deactivate employee' : 'Activate employee'}
          onClose={() => { setConfirmMode(null); setToggleErr(''); }}
        >
          {(() => {
            const emp = profile.data?.employee ?? {};
            const login = emp.user ?? null;
            const loginId = login?._id ?? login?.id ?? (typeof login === 'string' ? login : null);
            const name = empFullName(emp);
            return (
              <>
                <p style={{ fontSize: 13 }}>
                  {confirmMode === 'deactivate'
                    ? `Deactivate ${name}? HR status becomes Exited and their login will be disabled — they cannot sign in.`
                    : `Activate ${name}? HR status becomes Active and their login will be re-enabled.`}
                </p>
                {!loginId && (
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>No login linked — HR status only.</p>
                )}
                {confirmMode === 'deactivate' && (
                  <>
                    <div className="form-row">
                      <label className="form-label">Leaving date</label>
                      <input className="form-input" type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
                    </div>
                    <div className="form-row">
                      <label className="form-label">Leaving reason *</label>
                      <input className="form-input" value={leavingReason} onChange={(e) => setLeavingReason(e.target.value)} placeholder="e.g. Resigned" />
                    </div>
                  </>
                )}
                {toggleErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{toggleErr}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="approve-btn" onClick={() => { setConfirmMode(null); setToggleErr(''); }}>Cancel</button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={toggle.isPending || (confirmMode === 'deactivate' && !leavingReason.trim())}
                    onClick={() => toggle.mutate({
                      emp,
                      loginId,
                      activate: confirmMode === 'activate',
                      leavingDate,
                      leavingReason: leavingReason.trim(),
                    })}
                  >
                    {toggle.isPending ? 'Saving…' : confirmMode === 'deactivate' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}

function EmployeeDocuments({ empId, docs }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload(e) {
    e.preventDefault();
    if (!file) {
      setErr('Choose a file first.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await docsApi.employeeDoc(empId, file, name);
      setName('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['employee', empId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 12 }}>Documents</div>
      {(docs ?? []).length === 0 ? (
        <EmptyState text="No documents on file for this employee." />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Document' },
            {
              key: 'at', label: 'Uploaded', render: (d) => (d.at ? String(d.at).slice(0, 10) : '—'),
            },
            {
              key: 'file', label: 'File', render: (d) => (d.file ? <a href={fileUrl(d.file)} download>Download</a> : '—'),
            },
          ]}
          rows={docs ?? []}
          emptyText="No documents on file for this employee."
        />
      )}
      <form onSubmit={upload} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 220 }}
          placeholder="Document name (e.g. Aadhaar)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit" className="approve-btn" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
    </>
  );
}

function TrackTab() {
  const [empSearch, setEmpSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const searchQ = useQuery({
    queryKey: ['employees-track-search', empSearch],
    queryFn: () => employeesApi.list({ search: empSearch }),
    enabled: empSearch.trim().length > 0,
  });
  const detailQ = useQuery({
    queryKey: ['employee', selectedId],
    queryFn: () => employeesApi.get(selectedId),
    enabled: !!selectedId,
  });
  const teamsQ = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
    enabled: !!selectedId,
  });
  const workQ = useQuery({
    queryKey: ['work-entries', { employee: selectedId }],
    queryFn: () => workEntriesApi.list({ employee: selectedId }),
    enabled: !!selectedId,
  });
  const leaveQ = useQuery({
    queryKey: ['track-leave', selectedId],
    queryFn: () => leaveApi.list({ employee: selectedId }),
    enabled: !!selectedId,
  });
  const travelQ = useQuery({
    queryKey: ['track-travel', selectedId],
    queryFn: () => travelApi.list({ employee: selectedId }),
    enabled: !!selectedId,
  });

  const emp = detailQ.data?.employee ?? null;
  const memberships = useMemo(() => {
    if (!selectedId || !teamsQ.data?.items) return [];
    return teamsQ.data.items.filter((t) =>
      (t.members ?? []).some((m) => {
        const eid = typeof m.employee === 'object' ? (m.employee?._id ?? m.employee?.id) : m.employee;
        return String(eid) === String(selectedId);
      }),
    );
  }, [teamsQ.data, selectedId]);

  const workItems = workQ.data?.items ?? [];

  return (
    <>
      <div className="form-row" style={{ maxWidth: 360 }}>
        <label className="form-label">Employee picker</label>
        <input
          className="form-input"
          placeholder="Type a name to search"
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
        />
        {(searchQ.data?.items ?? []).length > 0 && (
          <div className="search-results">
            {searchQ.data.items.map((e) => (
              <div
                key={e._id ?? e.id}
                className="search-result-row"
                onClick={() => {
                  setSelectedId(e._id ?? e.id);
                  setEmpSearch('');
                }}
              >
                {empFullName(e)} · {e.designation ?? ''}
              </div>
            ))}
          </div>
        )}
      </div>
      {!selectedId ? (
        <EmptyState text="Pick an employee to see their track record." />
      ) : detailQ.isLoading ? (
        <EmptyState text="Loading…" />
      ) : detailQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{detailQ.error.message}</div>
      ) : (
        <>
          <Panel title="Joining & role">
            <div className="field-grid">
              <Field label="Name" value={empFullName(emp)} />
              <Field label="Designation" value={emp?.designation} />
              <Field label="Department" value={emp?.department} />
              <Field label="Date of joining" value={emp?.dateOfJoining} />
              <Field label="Branch" value={emp?.branch} />
              <Field label="Status" value={emp?.status} />
            </div>
          </Panel>
          <Panel title="Team memberships">
            {!teamsQ.data ? (
              <EmptyState text="Loading teams…" />
            ) : memberships.length === 0 ? (
              <EmptyState text="No team memberships found for this employee." />
            ) : (
              <DataTable
                columns={[{ key: 'name', label: 'Team' }, { key: 'service', label: 'Service' }, { key: 'branch', label: 'Branch' }]}
                rows={memberships}
                emptyText="No team memberships found for this employee."
              />
            )}
          </Panel>
          <Panel title="Work history">
            {workQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : workQ.isError ? (
              <EmptyState text="Work history is unavailable (the work-entries API does not support an employee filter yet)." />
            ) : workItems.length === 0 ? (
              <EmptyState text="No work entries found for this employee." />
            ) : (
              <>
                <p style={{ fontSize: 13, marginBottom: 10 }}>{workItems.length} entr(ies) found (filtered by employee).</p>
                <DataTable
                  columns={[
                    { key: 'project', label: 'Project', render: (w) => w.project?.name ?? w.project ?? '—' },
                    { key: 'hours', label: 'Hours' },
                    { key: 'date', label: 'Date' },
                    { key: 'status', label: 'Status', render: (w) => <StatusPill tone={statusTone(w.status)}>{w.status ?? '—'}</StatusPill> },
                  ]}
                  rows={workItems}
                  emptyText="No work entries found for this employee."
                />
              </>
            )}
          </Panel>
          <Panel title="Leave">
            {leaveQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : (
              <DataTable
                columns={[
                  { key: 'leaveType', label: 'Type' },
                  { key: 'from', label: 'From', render: (r) => String(r.from ?? '').slice(0, 10) },
                  { key: 'to', label: 'To', render: (r) => String(r.to ?? '').slice(0, 10) },
                  { key: 'days', label: 'Days' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                ]}
                rows={leaveQ.data?.items ?? []}
                emptyText="No leave history for this employee."
              />
            )}
          </Panel>
          <Panel title="Travel">
            {travelQ.isLoading ? (
              <EmptyState text="Loading…" />
            ) : (
              <DataTable
                columns={[
                  { key: 'route', label: 'Route', render: (r) => `${r.fromCity ?? '—'} → ${r.toCity ?? '—'}` },
                  { key: 'dates', label: 'Dates', render: (r) => `${r.departureDate ? String(r.departureDate).slice(0, 10) : '—'} → ${r.returnDate ? String(r.returnDate).slice(0, 10) : '—'}` },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status}>{r.status}</StatusPill> },
                  { key: 'settlement', label: 'Settlement', render: (r) => r.settlementStatus ?? '—' },
                ]}
                rows={travelQ.data?.items ?? []}
                emptyText="No travel history for this employee."
              />
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function RecruitmentTab({ bootstrap }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const roleKey = bootstrap?.role?.key ?? '';

  const listQ = useQuery({
    queryKey: ['recruitment'],
    queryFn: () => request('/api/work/recruitment'),
  });
  const items = listQ.data?.items ?? [];

  const setStatusMut = useMutation({
    mutationFn: ({ id, st }) =>
      request(`/api/work/recruitment/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: st }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment'] });
      setSelected(null);
      setStatus('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  if (!['hr', 'founding_director', 'working_director'].includes(roleKey)) {
    return <EmptyState text="Recruitment requests are visible to HR and directors only." />;
  }

  return (
    <>
      <Panel title="Recruitment requests">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'role', label: 'Role', render: (r) => r.role ?? r.designation ?? r.title ?? '—' },
              { key: 'team', label: 'Team', render: (r) => r.team?.name ?? r.team ?? '—' },
              { key: 'count', label: 'Count', render: (r) => r.count ?? r.headcount ?? '—' },
              { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
            ]}
            rows={items}
            emptyText="No recruitment requests yet."
            onRowClick={(r) => {
              setSelected(r);
              setStatus(r.status ?? '');
              setErr('');
            }}
          />
        )}
      </Panel>
      {selected && (
        <Modal title="Update recruitment status" onClose={() => setSelected(null)}>
          <div className="form-row">
            <label className="form-label">Status</label>
            <select className="filter-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Select status</option>
              {['Open', 'In Progress', 'On Hold', 'Closed', 'Cancelled'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button
            type="button"
            className="btn-primary"
            disabled={setStatusMut.isPending || !status}
            onClick={() => setStatusMut.mutate({ id: selected._id ?? selected.id, st: status })}
          >
            {setStatusMut.isPending ? 'Saving…' : 'Save status'}
          </button>
        </Modal>
      )}
    </>
  );
}

export default function HRPage({ bootstrap }) {
  const roleKey = bootstrap?.role?.key ?? '';
  const isSuperuser = roleKey === 'superuser';
  const [tab, setTab] = useState(isSuperuser ? 'manage' : 'overview');
  const isDirector = DIRECTOR_ROLES.has(roleKey);
  const tabs = isSuperuser
    ? [{ key: 'manage', label: 'Employee management' }]
    : isDirector
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'loginhours', label: 'Login Hours' },
        { key: 'travellog', label: 'Travel log' },
        { key: 'holidays', label: 'Holiday calendar' },
      ]
    : [
        { key: 'overview', label: 'Overview' },
        { key: 'manage', label: 'Employee management' },
        { key: 'track', label: 'Track record' },
        { key: 'recruitment', label: 'Recruitment' },
      ];
  return (
    <>
      <div className="page-head">
        <div className="page-title">HR</div>
        <div className="page-sub">Directory, headcount and track records — live from the employee API.</div>
      </div>
      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && (isDirector ? <DirectorOverviewTab /> : <OverviewTab />)}
      {!isDirector && tab === 'manage' && <ManageTab bootstrap={bootstrap} />}
      {!isDirector && tab === 'track' && <TrackTab />}
      {!isDirector && tab === 'recruitment' && <RecruitmentTab bootstrap={bootstrap} />}
      {isDirector && tab === 'loginhours' && <DirectorLoginHoursTab />}
      {isDirector && tab === 'travellog' && <DirectorTravelLogTab />}
      {isDirector && tab === 'holidays' && <DirectorHolidaysTab />}
    </>
  );
}
