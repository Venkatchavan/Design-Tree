import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request, toQuery } from '../lib/api.js';
import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';

const empName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || 'Not recorded';
const projName = (p) => [p?.jobNumber || p?.code, p?.name].filter(Boolean).join(' · ') || 'Project';
const hrs = (v) => `${Math.round(Number(v ?? 0) * 10) / 10} h`;
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function monthStart() {
  const now = new Date();
  return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
}

// 13 Nov 2026: TL and above see the man-hours spent on each project stage and
// the login hours (sign-in → sign-out) of the people in their scope.
export default function TeamStageHoursPanel({ project }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd(new Date()));
  const q = useQuery({
    queryKey: ['team-stage-hours', from, to, project ?? ''],
    queryFn: () => request(`/api/reports/team-stage-hours${toQuery({ from: from || undefined, to: to || undefined, project: project || undefined })}`),
    refetchInterval: 30000,
  });
  const stages = q.data?.stages ?? [];
  const people = q.data?.people ?? [];
  const totalMan = stages.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const totalLogin = people.reduce((s, r) => s + Number(r.loginHours ?? 0), 0);
  return (
    <>
      <Panel title="Man-hours by project stage" sub={`Hours logged on each project stage · ${hrs(totalMan)} in the period`}>
        <div className="field-grid" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <label className="form-label" htmlFor="tsh-from">From</label>
            <input id="tsh-from" type="date" className="form-input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="tsh-to">To</label>
            <input id="tsh-to" type="date" className="form-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {q.isLoading ? <EmptyState text="Loading hours…" /> : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
        ) : (
          <DataTable
            rows={stages}
            emptyText="No man-hours logged in this period."
            columns={[
              { key: 'project', label: 'Project', render: (r) => projName(r.project) },
              { key: 'stage', label: 'Stage' },
              { key: 'hours', label: 'Man-hours', render: (r) => hrs(r.hours) },
              { key: 'people', label: 'People' },
              { key: 'entries', label: 'Updates' },
            ]}
          />
        )}
      </Panel>
      <Panel title="Login hours and man-hours" sub={`Per person · ${hrs(totalLogin)} login hours in the period`}>
        {q.isLoading ? <EmptyState text="Loading hours…" /> : q.isError ? null : (
          <DataTable
            rows={people}
            emptyText="No sign-in or work hours in this period."
            columns={[
              { key: 'name', label: 'Employee', render: (r) => empName(r.employee) },
              { key: 'designation', label: 'Designation', render: (r) => r.employee?.designation || 'Not recorded' },
              { key: 'days', label: 'Days signed in', render: (r) => r.days ?? 0 },
              { key: 'loginHours', label: 'Login hours', render: (r) => hrs(r.loginHours) },
              { key: 'manHours', label: 'Man-hours', render: (r) => hrs(r.manHours) },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
