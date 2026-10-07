import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '../lib/phase4bApi.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}

function latestRemark(item) {
  if (!item) return '—';
  if (item.latestRemark) return item.latestRemark;
  if (item.remark) return item.remark;
  if (Array.isArray(item.remarks) && item.remarks.length > 0) {
    const last = item.remarks[item.remarks.length - 1];
    return typeof last === 'string' ? last : (last?.text ?? last?.remark ?? '—');
  }
  if (typeof item.remarks === 'string' && item.remarks) return item.remarks;
  return item.statusRemark ?? item.decisionRemarks ?? '—';
}

function SupportTab({ kind, title, showMonth, hint }) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [err, setErr] = useState('');

  const mineQ = useQuery({ queryKey: ['support-mine', kind], queryFn: supportApi.mine });
  const allMine = mineQ.data?.items ?? [];
  const mine = useMemo(() => allMine.filter((r) => String(r.kind ?? '').toLowerCase() === kind.toLowerCase()), [allMine, kind]);

  const create = useMutation({
    mutationFn: (body) => supportApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-mine'] });
      setMonth('');
      setCategory('');
      setSubject('');
      setDetails('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  function submit(e) {
    e.preventDefault();
    setErr('');
    if (!subject.trim() && !details.trim()) {
      setErr('Subject or details are required.');
      return;
    }
    create.mutate({
      kind,
      month: month || undefined,
      category: category || undefined,
      subject: subject || undefined,
      details: details || undefined,
    });
  }

  return (
    <>
      <Panel title={`${title} — new request`}>
        {hint && <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{hint}</p>}
        <form onSubmit={submit}>
          {showMonth && (
            <div className="form-row" style={{ maxWidth: 260 }}>
              <label className="form-label">Month (YYYY-MM)</label>
              <input className="form-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Category</label>
            <input className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional category" />
          </div>
          <div className="form-row">
            <label className="form-label">Subject</label>
            <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Details</label>
            <textarea className="form-input" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </Panel>
      <Panel title={`My ${title.toLowerCase()} requests`}>
        {mineQ.isLoading ? <EmptyState text="Loading…" /> : mineQ.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{mineQ.error.message}</div>
        ) : (
          <DataTable
            columns={[
              { key: 'subject', label: 'Subject', render: (r) => r.subject ?? r.title ?? r.month ?? r._id ?? '—' },
              { key: 'date', label: 'Raised', render: (r) => fmtDate(r.createdAt ?? r.date) },
              { key: 'status', label: 'Status', render: (r) => r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—' },
              { key: 'remark', label: 'Latest remark', render: latestRemark },
            ]}
            rows={mine}
            emptyText={`No ${title.toLowerCase()} requests yet.`}
          />
        )}
      </Panel>
    </>
  );
}

export default function EmployeeSupportPage({ bootstrap, user, viewKey }) {
  const [tab, setTab] = useState('salary-slip');
  return (
    <>
      <div className="page-head">
        <div className="page-title">Employee support</div>
        <div className="page-sub">Salary slips, complaints, suggestions and queries — live from the support API.</div>
      </div>
      <Tabs
        tabs={[
          { key: 'salary-slip', label: 'Salary slip' },
          { key: 'complaint', label: 'Complaint box' },
          { key: 'suggestion', label: 'Suggestion box' },
          { key: 'query', label: 'Queries' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'salary-slip' && (
        <SupportTab kind="salary-slip" title="Salary slip" showMonth hint="Request a salary slip for a payroll month." />
      )}
      {tab === 'complaint' && <SupportTab kind="complaint" title="Complaint" />}
      {tab === 'suggestion' && <SupportTab kind="suggestion" title="Suggestion" />}
      {tab === 'query' && <SupportTab kind="query" title="Query" />}
    </>
  );
}
