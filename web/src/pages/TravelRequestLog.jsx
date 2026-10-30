import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { downloadCsv } from '../lib/phase3Api.js';
import { allowanceApi } from '../lib/phase4bApi.js';
import { fileUrl } from '../lib/docsApi.js';
import Panel from '../components/Panel.jsx';
import KpiCard from '../components/KpiCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
const arr = v => Array.isArray(v) ? v : (v?.items ?? []);
const money = v => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const REQ_TYPE_LABEL = { LA: 'Local Allowance', Cab: 'Cab booking', Other: 'Other' };
const REQ_STATUSES = ['Pending', 'Approved', 'Rejected', 'Returned for clarification', 'Completed'];

function fmtShort(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function allowanceDetails(r) {
  if (r.reqType === 'LA') {
    return r.days != null ? `${r.days} day${Number(r.days) === 1 ? '' : 's'}` : (r.description ?? r.purpose ?? '—');
  }
  const route = r.route ?? [r.pickup, r.drop].filter(Boolean).join(' → ');
  const parts = [route, r.meetingTime, r.vehicle, r.passengers != null ? `${r.passengers} pax` : ''].filter(Boolean);
  return parts.join(' · ') || (r.description ?? r.purpose ?? '—');
}

function allowanceEmployee(r) {
  const e = r.employee;
  if (e && typeof e === 'object') {
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
  }
  return '—';
}

export default function TravelRequestLog({ canWrite }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [err, setErr] = useState('');

  const listQ = useQuery({ queryKey: ['allowances-all'], queryFn: () => allowanceApi.list({}) });
  const items = arr(listQ.data);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => !typeFilter || r.reqType === typeFilter)
      .filter((r) => !statusFilter || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        const emp = allowanceEmployee(r).toLowerCase();
        const proj = (r.project?.name ?? '').toLowerCase();
        return emp.includes(q) || proj.includes(q);
      })
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [items, search, typeFilter, statusFilter]);

  const count = (s) => items.filter((r) => r.status === s).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['allowances-all'] });

  async function decide(id, status) {
    setErr('');
    let remarks;
    if (status === 'Rejected') {
      const v = window.prompt('Reason for rejecting (required, shown to the requester):', '');
      if (v == null) return;
      remarks = v.trim();
      if (!remarks) {
        setErr('A reason is required when rejecting.');
        return;
      }
    }
    try {
      await allowanceApi.decide(id, { status, remarks });
      invalidate();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function markCompleted(id) {
    setErr('');
    try {
      await allowanceApi.complete(id);
      invalidate();
    } catch (e) {
      setErr(e.message);
    }
  }

  // Pending rows get Approve + Reject (reject prompts for the required
  // reason); Approved rows get Mark completed; clarification returns wait.
  function reviewCell(r) {
    if (!canWrite) return '—';
    if (r.status === 'Pending') {
      return (
        <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
          <button type="button" className="approve-btn" onClick={() => decide(r._id, 'Approved')}>Approve</button>
          <button type="button" className="approve-btn" onClick={() => decide(r._id, 'Rejected')}>Reject</button>
        </span>
      );
    }
    if (r.status === 'Approved') {
      return <button type="button" className="approve-btn" onClick={() => markCompleted(r._id)}>Mark completed</button>;
    }
    if (r.status === 'Returned for clarification') {
      return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Awaiting employee</span>;
    }
    return '—';
  }

  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => allowanceEmployee(r) },
    { key: 'department', label: 'Department', render: (r) => r.employee?.department ?? r.employee?.designation ?? '—' },
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
    { key: 'type', label: 'Type', render: (r) => REQ_TYPE_LABEL[r.reqType] ?? r.reqType ?? '—' },
    { key: 'date', label: 'Date', render: (r) => fmtShort(r.date) },
    { key: 'details', label: 'Details', render: (r) => allowanceDetails(r) },
    { key: 'purpose', label: 'Purpose', render: (r) => r.purpose ?? r.description ?? '—' },
    { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
    { key: 'bill', label: 'Bill', render: (r) => (r.bill ? <a href={fileUrl(r.bill)} target="_blank" rel="noreferrer">View bill</a> : 'No bill') },
    { key: 'status', label: 'Status', render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status ?? '—'}</StatusPill> },
    { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
    { key: 'submitted', label: 'Submitted', render: (r) => fmtShort(r.createdAt) },
    { key: 'actions', label: '', render: (r) => reviewCell(r) },
  ];

  const csvColumns = [
    { label: 'Employee', value: (r) => allowanceEmployee(r) },
    { label: 'Department', value: (r) => r.employee?.department ?? r.employee?.designation ?? '' },
    { label: 'Project', value: (r) => r.project?.name ?? '' },
    { label: 'Type', value: (r) => REQ_TYPE_LABEL[r.reqType] ?? r.reqType ?? '' },
    { label: 'Date', value: (r) => fmtShort(r.date) },
    { label: 'Details', value: (r) => allowanceDetails(r) },
    { label: 'Purpose', value: (r) => r.purpose ?? r.description ?? '' },
    { label: 'Amount', value: (r) => r.amount ?? 0 },
    { label: 'Bill attached', value: (r) => (r.bill ? 'Yes' : 'No') },
    { label: 'Status', value: (r) => r.status ?? '' },
    { label: 'Remarks', value: (r) => r.remarks ?? '' },
    { label: 'Submitted', value: (r) => fmtShort(r.createdAt) },
  ];

  return (
    <>
      <div className="kpi-grid cols-4">
        <KpiCard label="Pending" value={count('Pending')} accent="amber" />
        <KpiCard label="Approved" value={count('Approved')} accent="blueprint" />
        <KpiCard label="Rejected" value={count('Rejected')} accent="rust" />
        <KpiCard label="Completed" value={count('Completed')} accent="forest" />
      </div>
      <Panel title="Request log" sub="Every Local Allowance, Cab booking and other travel request, most recent first">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            className="filter-select"
            style={{ width: 190 }}
            placeholder="Search employee / project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="LA">Local Allowance</option>
            <option value="Cab">Cab booking</option>
            <option value="Other">Other</option>
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {REQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="approve-btn" onClick={() => downloadCsv(rows, csvColumns, 'request-log.csv')}>
            Export CSV
          </button>
        </div>
        {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
        {listQ.isLoading ? (
          <EmptyState text="Loading requests…" />
        ) : listQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{listQ.error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            emptyText={search || typeFilter || statusFilter ? 'No requests match these filters.' : 'No requests submitted yet.'}
          />
        )}
      </Panel>
    </>
  );
}
