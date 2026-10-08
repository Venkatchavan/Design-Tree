import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  employeesApi,
  projectsApi,
  request,
  teamsApi,
  toQuery,
  workEntriesApi,
} from '../lib/api.js';
import {
  areaApi,
  bimApi,
  boqApi,
  convApi,
  discApi,
  gbsApi,
  peerApi,
  rfiApi,
  visitsApi,
} from '../lib/functionsApi.js';
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
import { docsApi, fileUrl } from '../lib/docsApi.js';

const VARIANT_FOR_ROLE = {
  qs: 'qs',
  qs_head: 'qs',
  qaqc: 'qaqc',
  bim: 'bim',
  gbs: 'gbs',
  peer_reviewer: 'peer',
  peer_review_head: 'peer',
};

const FUNCTION_TITLES = {
  qs: 'QS / BOQ',
  qaqc: 'QA/QC',
  bim: 'BIM',
  gbs: 'GBS',
  peer: 'Peer Review',
};

const VARIANTS = ['qs', 'qaqc', 'bim', 'gbs', 'peer'];

const WORK_TYPES = ['Regular', 'Revision', 'Rework'];

const GBS_TEMPLATE = [
  'Registration',
  'Pre-assessment',
  'Documentation',
  'Review',
  'Certification',
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email || '—';
}

function meIdOf(user) {
  return user?._id ?? user?.id ?? null;
}

function PendingLogoutCallout() {
  if (!isPendingLogout()) return null;
  return (
    <div className="login-error" role="alert" style={{ display: 'block' }}>
      {MAN_HOUR_NOTE} Save today&apos;s entry to complete sign-out.
    </div>
  );
}

function InlineError({ error }) {
  if (!error) return null;
  return (
    <div className="login-error" role="alert" style={{ display: 'block' }}>
      {error.message ?? String(error)}
    </div>
  );
}

function ProjectOptions({ projects }) {
  return (
    <>
      <option value="">Select project</option>
      {(projects ?? []).map((p) => (
        <option key={p._id ?? p.id} value={p._id ?? p.id}>
          {p.name ?? p.code ?? '—'}
        </option>
      ))}
    </>
  );
}

/* ---------------- Common: log work ---------------- */

function LogWorkTab({ projects, variant }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [project, setProject] = useState('');
  const [type, setType] = useState('Regular');
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState('');

  const logQ = useQuery({
    queryKey: ['work-entries', { mine: true }],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  const revQ = useQuery({
    queryKey: ['work-revisions-open-wt'],
    queryFn: () => request(`/api/work/revisions${toQuery({ status: 'Open' })}`),
  });

  const items = logQ.data?.items ?? [];
  const openRevisions = revQ.data?.items ?? [];

  const week = useMemo(() => {
    const start = weekStartISO();
    const inWeek = items.filter((w) => {
      const d = w?.date ? new Date(w.date) : null;
      return d && !Number.isNaN(d) && d >= start;
    });
    return {
      count: inWeek.length,
      hours: inWeek.reduce((s, w) => s + (parseFloat(w.hours) || 0), 0),
    };
  }, [items]);

  const save = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      setProject('');
      setType('Regular');
      setNotes('');
      setHours('');
      setDate(todayISO());
      setErr('');
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
    save.mutate({
      project,
      type,
      notes: notes || undefined,
      hours: hours === '' ? undefined : Number(hours),
      date: date || undefined,
    });
  }

  return (
    <>
      <PendingLogoutCallout />
      <div className="kpi-grid cols-5">
        <KpiCard label="Items logged (this week)" value={week.count} accent="blueprint" />
        <KpiCard label="Hours (this week)" value={week.hours} accent="forest" />
        <KpiCard label="Open revisions" value={openRevisions.length} accent="amber" />
        {variant === 'qs' && (
          <KpiCard label="Pending settlements" value="—" accent="neutral" />
        )}
      </div>
      {variant === 'qs' && (
        <Panel title="Pending settlements">
          <EmptyState text="Settlement approvals are tracked in the QS tab below — no separate pending-settlement feed yet." />
        </Panel>
      )}
      <div className="two-col">
        <Panel title="Log work">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <ProjectOptions projects={projects} />
              </select>
            </div>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Type</label>
                <select className="filter-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value)}>
                  {WORK_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Hours</label>
                <input className="form-input" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{MAN_HOUR_NOTE}</p>
            {err && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {err}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Log work'}
            </button>
          </form>
        </Panel>
        <Panel title="Weekly figures">
          <div className="field-grid">
            <Field label="Items logged (this week)" value={week.count} />
            <Field label="Hours (this week)" value={week.hours} />
            <Field label="Open revisions" value={openRevisions.length} />
          </div>
        </Panel>
      </div>
      <Panel title="Work log (mine)">
        {logQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <>
            <InlineError error={logQ.isError ? logQ.error : null} />
            <DataTable
              columns={[
                { key: 'wu', label: 'WU no', render: (w) => w.wuNo ?? w.refNo ?? '—' },
                { key: 'project', label: 'Project', render: (w) => w?.project?.name ?? w?.project ?? '—' },
                { key: 'type', label: 'Type' },
                { key: 'hours', label: 'Hours' },
                { key: 'date', label: 'Date', render: (w) => (w.date ? String(w.date).slice(0, 10) : '—') },
                {
                  key: 'status',
                  label: 'Status',
                  render: (w) => (w.status ? <StatusPill tone={statusTone(w.status)}>{w.status}</StatusPill> : '—'),
                },
              ]}
              rows={items}
              emptyText="No work entries yet."
            />
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- Common: revisions ---------------- */

function RevisionsTab({ projects }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [err, setErr] = useState('');

  const listQ = useQuery({
    queryKey: ['work-revisions'],
    queryFn: () => request(`/api/work/revisions${toQuery({})}`),
  });
  const rows = listQ.data?.items ?? [];

  const save = useMutation({
    mutationFn: (body) =>
      request('/api/work/revisions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-revisions'] });
      queryClient.invalidateQueries({ queryKey: ['work-revisions-open-wt'] });
      setProject('');
      setDescription('');
      setDueDate('');
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
    save.mutate({ project, description: description || undefined, dueDate: dueDate || undefined });
  }

  return (
    <>
      <Panel title="Log revision">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <ProjectOptions projects={projects} />
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Due date</label>
              <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Log revision'}
          </button>
        </form>
      </Panel>
      <Panel title="Revision log">
        {listQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <>
            <InlineError error={listQ.isError ? listQ.error : null} />
            <DataTable
              columns={[
                { key: 'ref', label: 'Ref', render: (r) => r.title ?? r.refNo ?? r._id ?? '—' },
                { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => ((r.revisionStatus ?? r.status) ? <StatusPill tone={statusTone(r.revisionStatus ?? r.status)}>{r.revisionStatus ?? r.status}</StatusPill> : '—'),
                },
                { key: 'due', label: 'Due', render: (r) => r.due ?? r.dueDate ?? '—' },
                { key: 'remarks', label: 'Remarks', render: (r) => r.revisionRemarks ?? r.remarks ?? r.description ?? '—' },
              ]}
              rows={rows}
              emptyText="No revisions logged yet."
            />
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- QS: area settlement ---------------- */

function QsSettlement({ projects, roleKey }) {
  const queryClient = useQueryClient();
  const [filterProject, setFilterProject] = useState('');
  const [project, setProject] = useState('');
  const [zone, setZone] = useState('');
  const [initial, setInitial] = useState('');
  const [revised, setRevised] = useState('');
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');

  const canReview = roleKey === 'qs_head' || SUPER_ROLES.includes(roleKey);

  const listQ = useQuery({
    queryKey: ['area-settlements', { project: filterProject }],
    queryFn: () => areaApi.list(filterProject ? { project: filterProject } : {}),
  });
  const rows = listQ.data?.items ?? [];

  const save = useMutation({
    mutationFn: (body) => areaApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['area-settlements'] });
      setProject('');
      setZone('');
      setInitial('');
      setRevised('');
      setRemarks('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const review = useMutation({
    mutationFn: ({ id, status }) => areaApi.review(id, { status, remark: reviewRemark || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['area-settlements'] });
      setReviewRemark('');
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
    if (!zone) {
      setErr('Zone is required.');
      return;
    }
    save.mutate({
      project,
      zone,
      initial: initial === '' ? undefined : Number(initial),
      revised: revised === '' ? undefined : Number(revised),
      remarks: remarks || undefined,
    });
  }

  return (
    <>
      <Panel title="QS / BOQ — Area settlement">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <ProjectOptions projects={projects} />
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Zone</label>
              <input className="form-input" value={zone} onChange={(e) => setZone(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Initial area</label>
              <input className="form-input" type="number" step="0.01" value={initial} onChange={(e) => setInitial(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Revised area</label>
              <input className="form-input" type="number" step="0.01" value={revised} onChange={(e) => setRevised(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Remarks</label>
            <input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          {initial !== '' && revised !== '' && (
            <p style={{ fontSize: 13.5 }}>
              Variance: <b className="mono">{Number(revised) - Number(initial)}</b>
            </p>
          )}
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Add settlement'}
          </button>
        </form>
      </Panel>
      <Panel title="QS / BOQ — Settlement register">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select className="filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>
                {p.name ?? p.code ?? '—'}
              </option>
            ))}
          </select>
        </div>
        {canReview && (
          <div className="form-row" style={{ maxWidth: 360, marginBottom: 12 }}>
            <label className="form-label">Review remark (applies to approve / reject)</label>
            <input className="form-input" value={reviewRemark} onChange={(e) => setReviewRemark(e.target.value)} />
          </div>
        )}
        {listQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <>
            <InlineError error={listQ.isError ? listQ.error : null} />
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                { key: 'zone', label: 'Zone' },
                { key: 'initial', label: 'Initial' },
                { key: 'revised', label: 'Revised' },
                {
                  key: 'variance',
                  label: 'Variance',
                  render: (r) => (r.initial != null && r.revised != null ? Number(r.revised) - Number(r.initial) : '—'),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—'),
                },
                ...(canReview
                  ? [{
                    key: 'review',
                    label: 'Review',
                    render: (r) => (
                      <span style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="approve-btn" disabled={review.isPending} onClick={() => review.mutate({ id: r._id ?? r.id, status: 'Approved' })}>
                          Approve
                        </button>
                        <button type="button" className="approve-btn" disabled={review.isPending} onClick={() => review.mutate({ id: r._id ?? r.id, status: 'Rejected' })}>
                          Reject
                        </button>
                      </span>
                    ),
                  }]
                  : []),
              ]}
              rows={rows}
              emptyText="No settlements recorded yet."
            />
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- QS / BOQ items ---------------- */

function BoqItems({ projects, roleKey }) {
  const queryClient = useQueryClient();
  const [filterProject, setFilterProject] = useState('');
  const [project, setProject] = useState('');
  const [itemNo, setItemNo] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [status, setStatus] = useState('Draft');
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');

  const canCreate = roleKey === 'qs' || SUPER_ROLES.includes(roleKey);
  const canReview = roleKey === 'qs_head' || SUPER_ROLES.includes(roleKey);

  const listQ = useQuery({
    queryKey: ['boq-items', { project: filterProject }],
    queryFn: () => boqApi.list(filterProject ? { project: filterProject } : {}),
  });
  const rows = listQ.data?.items ?? [];

  const save = useMutation({
    mutationFn: (body) => boqApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boq-items'] });
      setProject('');
      setItemNo('');
      setDescription('');
      setUnit('');
      setQty('');
      setRate('');
      setStatus('Draft');
      setRemarks('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const review = useMutation({
    mutationFn: ({ id, next }) => boqApi.review(id, { status: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boq-items'] }),
    onError: (e) => setErr(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!project) {
      setErr('Project is required.');
      return;
    }
    if (!description.trim()) {
      setErr('Description is required.');
      return;
    }
    save.mutate({
      project,
      itemNo: itemNo || undefined,
      description,
      unit: unit || undefined,
      qty: qty === '' ? undefined : Number(qty),
      rate: rate === '' ? undefined : Number(rate),
      status,
      remarks: remarks || undefined,
    });
  }

  return (
    <>
      {canCreate && (
        <Panel title="QS / BOQ — BOQ items (QS logs Draft → Submitted)">
          <form onSubmit={handleSubmit}>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                  <ProjectOptions projects={projects} />
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Item no</label>
                <input className="form-input" value={itemNo} onChange={(e) => setItemNo(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Unit</label>
                <input className="form-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Qty</label>
                <input className="form-input" type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Rate</label>
                <input className="form-input" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Status</label>
                <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>Draft</option>
                  <option>Submitted</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Description *</label>
              <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Remarks</label>
              <input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            {qty !== '' && rate !== '' && (
              <p style={{ fontSize: 13.5 }}>
                Amount: <b className="mono">{Number(qty) * Number(rate)}</b>
              </p>
            )}
            {err && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {err}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Add BOQ item'}
            </button>
          </form>
        </Panel>
      )}
      <Panel title="QS / BOQ — BOQ register">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select className="filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>
                {p.name ?? p.code ?? '—'}
              </option>
            ))}
          </select>
        </div>
        {listQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : (
          <>
            <InlineError error={listQ.isError ? listQ.error : (review.isError ? review.error : null)} />
            <DataTable
              columns={[
                { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                { key: 'itemNo', label: 'Item' },
                { key: 'description', label: 'Description' },
                { key: 'unit', label: 'Unit' },
                { key: 'qty', label: 'Qty' },
                { key: 'rate', label: 'Rate' },
                { key: 'amount', label: 'Amount' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—'),
                },
                ...(canReview
                  ? [{
                    key: 'review',
                    label: 'Review',
                    render: (r) => (
                      <span style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="approve-btn" disabled={review.isPending} onClick={() => review.mutate({ id: r._id ?? r.id, next: 'Submitted' })}>
                          Submit
                        </button>
                        <button type="button" className="approve-btn" disabled={review.isPending} onClick={() => review.mutate({ id: r._id ?? r.id, next: 'Approved' })}>
                          Approve
                        </button>
                      </span>
                    ),
                  }]
                  : []),
              ]}
              rows={rows}
              emptyText="No BOQ items yet."
            />
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- QA/QC ---------------- */

function QaqcTools({ projects, employees, user }) {
  const queryClient = useQueryClient();
  const myId = meIdOf(user);
  const [filterProject, setFilterProject] = useState('');

  // Visit form
  const [vProject, setVProject] = useState('');
  const [vType, setVType] = useState('');
  const [vDate, setVDate] = useState(todayISO());
  const [vPhotoFiles, setVPhotoFiles] = useState([]);
  const [vUploading, setVUploading] = useState(false);
  const [vRemarksClient, setVRemarksClient] = useState('');
  const [vRemarksDesigner, setVRemarksDesigner] = useState('');
  const [vAdditional, setVAdditional] = useState(false);
  const [vDiscFound, setVDiscFound] = useState(false);
  const [vSeverity, setVSeverity] = useState('');
  const [vErr, setVErr] = useState('');

  // Discrepancy form
  const [dProject, setDProject] = useState('');
  const [dDiscipline, setDDiscipline] = useState('');
  const [dSeverity, setDSeverity] = useState('');
  const [dIssue, setDIssue] = useState('');
  const [dRaised, setDRaised] = useState('');
  const [dDue, setDDue] = useState('');
  const [dErr, setDErr] = useState('');
  const [dStatus, setDStatus] = useState({});

  // Conveyance form
  const [cDate, setCDate] = useState(todayISO());
  const [cProject, setCProject] = useState('');
  const [cEmployee, setCEmployee] = useState('');
  const [cPurpose, setCPurpose] = useState('');
  const [cArea, setCArea] = useState('');
  const [cVehicle, setCVehicle] = useState('');
  const [cKm, setCKm] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDocument, setCDocument] = useState('');
  const [cErr, setCErr] = useState('');

  // RFI form
  const [rProject, setRProject] = useState('');
  const [rType, setRType] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rTeam, setRTeam] = useState('');
  const [rAssigned, setRAssigned] = useState('');
  const [rDue, setRDue] = useState('');
  const [rErr, setRErr] = useState('');

  const pq = filterProject ? { project: filterProject } : {};
  const visitsQ = useQuery({ queryKey: ['site-visits', pq], queryFn: () => visitsApi.list(pq) });
  const discQ = useQuery({ queryKey: ['discrepancies', pq], queryFn: () => discApi.list(pq) });
  const convQ = useQuery({ queryKey: ['conveyance', pq], queryFn: () => convApi.list(pq) });
  const rfiQ = useQuery({ queryKey: ['rfis', pq], queryFn: () => rfiApi.list(pq) });
  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });

  const visits = visitsQ.data?.items ?? [];
  const discs = discQ.data?.items ?? [];
  const convs = convQ.data?.items ?? [];
  const rfis = rfiQ.data?.items ?? [];
  const myRfis = useMemo(
    () => (myId == null ? rfis : rfis.filter((r) => {
      const rb = r.raisedBy;
      const rid = rb?._id ?? rb?.id ?? rb ?? null;
      return rid != null && String(rid) === String(myId);
    })),
    [rfis, myId],
  );

  const weekly = useMemo(() => {
    const m = new Map();
    for (const v of visits) {
      const d = v?.date ? new Date(v.date) : null;
      if (!d || Number.isNaN(d)) continue;
      const monday = new Date(d);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, { week: key, visits: 0, additional: 0, discrepancies: 0 });
      const row = m.get(key);
      row.visits += 1;
      if (v.additionalVisit) row.additional += 1;
      if (v.discrepancyFound) row.discrepancies += 1;
    }
    return [...m.values()].sort((a, b) => (a.week < b.week ? 1 : -1));
  }, [visits]);

  const visitSave = useMutation({
    mutationFn: (body) => visitsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVProject(''); setVType(''); setVDate(todayISO()); setVPhotoFiles([]);
      setVRemarksClient(''); setVRemarksDesigner('');
      setVAdditional(false); setVDiscFound(false); setVSeverity('');
      setVErr('');
    },
    onError: (e) => setVErr(e.message),
  });

  const discSave = useMutation({
    mutationFn: (body) => discApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] });
      setDProject(''); setDDiscipline(''); setDSeverity('');
      setDIssue(''); setDRaised(''); setDDue(''); setDErr('');
    },
    onError: (e) => setDErr(e.message),
  });

  const discUpdate = useMutation({
    mutationFn: ({ id, patch }) => discApi.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discrepancies'] }),
    onError: (e) => setDErr(e.message),
  });

  const convSave = useMutation({
    mutationFn: (body) => convApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conveyance'] });
      setCDate(todayISO()); setCProject(''); setCEmployee(''); setCPurpose('');
      setCArea(''); setCVehicle(''); setCKm(''); setCAmount(''); setCDocument('');
      setCErr('');
    },
    onError: (e) => setCErr(e.message),
  });

  const rfiSave = useMutation({
    mutationFn: (body) => rfiApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      setRProject(''); setRType(''); setRDesc(''); setRTeam('');
      setRAssigned(''); setRDue(''); setRErr('');
    },
    onError: (e) => setRErr(e.message),
  });

  async function submitVisit(e) {
    e.preventDefault();
    setVErr('');
    if (!vProject) {
      setVErr('Project is required.');
      return;
    }
    setVUploading(true);
    try {
      const created = await visitsApi.create({
        project: vProject,
        visitType: vType || undefined,
        date: vDate || undefined,
        remarksClient: vRemarksClient || undefined,
        remarksDesigner: vRemarksDesigner || undefined,
        additionalVisit: vAdditional || undefined,
        discrepancyFound: vDiscFound || undefined,
        severity: vSeverity || undefined,
      });
      const id = created?.item?._id ?? created?.item?.id;
      if (vPhotoFiles.length > 0 && id) {
        await docsApi.visitPhotos(id, vPhotoFiles);
      }
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVProject(''); setVType(''); setVDate(todayISO()); setVPhotoFiles([]);
      setVRemarksClient(''); setVRemarksDesigner('');
      setVAdditional(false); setVDiscFound(false); setVSeverity('');
    } catch (err) {
      setVErr(err.message);
    } finally {
      setVUploading(false);
    }
  }

  function submitDisc(e) {
    e.preventDefault();
    setDErr('');
    if (!dProject) {
      setDErr('Project is required.');
      return;
    }
    if (!dIssue) {
      setDErr('Issue description is required.');
      return;
    }
    discSave.mutate({
      project: dProject,
      discipline: dDiscipline || undefined,
      severity: dSeverity || undefined,
      issue: dIssue,
      raised: dRaised || undefined,
      due: dDue || undefined,
    });
  }

  function submitConv(e) {
    e.preventDefault();
    setCErr('');
    convSave.mutate({
      date: cDate || undefined,
      project: cProject || undefined,
      employee: cEmployee || undefined,
      purpose: cPurpose || undefined,
      area: cArea || undefined,
      vehicle: cVehicle || undefined,
      kilometers: cKm === '' ? undefined : Number(cKm),
      amount: cAmount === '' ? undefined : Number(cAmount),
      document: cDocument || undefined,
    });
  }

  function submitRfi(e) {
    e.preventDefault();
    setRErr('');
    if (!rDesc) {
      setRErr('Description is required.');
      return;
    }
    rfiSave.mutate({
      project: rProject || undefined,
      type: rType || undefined,
      description: rDesc,
      team: rTeam || undefined,
      assignedTo: rAssigned || undefined,
      due: rDue || undefined,
    });
  }

  return (
    <>
      <Panel title="Site visits">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select className="filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
            ))}
          </select>
        </div>
      </Panel>
      <div className="two-col">
        <Panel title="Log site visit">
          <form onSubmit={submitVisit}>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" style={{ width: '100%' }} value={vProject} onChange={(e) => setVProject(e.target.value)}>
                  <ProjectOptions projects={projects} />
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Visit type</label>
                <input className="form-input" value={vType} onChange={(e) => setVType(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Severity</label>
                <input className="form-input" value={vSeverity} onChange={(e) => setVSeverity(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Site photos (upload)</label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => setVPhotoFiles([...(e.target.files ?? [])])}
              />
              {vPhotoFiles.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
                  {vPhotoFiles.length} file(s) selected
                </div>
              )}
            </div>
            <div className="form-row">
              <label className="form-label">Client remarks</label>
              <textarea className="form-input" value={vRemarksClient} onChange={(e) => setVRemarksClient(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Designer remarks</label>
              <textarea className="form-input" value={vRemarksDesigner} onChange={(e) => setVRemarksDesigner(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <label className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={vAdditional} onChange={(e) => setVAdditional(e.target.checked)} />
                Additional visit
              </label>
              <label className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={vDiscFound} onChange={(e) => setVDiscFound(e.target.checked)} />
                Discrepancy found
              </label>
            </div>
            {vErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{vErr}</div>}
            <button type="submit" className="btn-primary" disabled={vUploading}>
              {vUploading ? 'Saving…' : 'Log visit'}
            </button>
          </form>
        </Panel>
        <Panel title="Visits">
          {visitsQ.isLoading ? <EmptyState text="Loading…" /> : (
            <>
              <InlineError error={visitsQ.isError ? visitsQ.error : null} />
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (v) => (v.date ? String(v.date).slice(0, 10) : '—') },
                  { key: 'project', label: 'Project', render: (v) => v?.project?.name ?? v?.project ?? '—' },
                  { key: 'visitType', label: 'Type' },
                  { key: 'severity', label: 'Severity' },
                  { key: 'additionalVisit', label: 'Addl.', render: (v) => (v.additionalVisit ? 'Yes' : '—') },
                  { key: 'discrepancyFound', label: 'Disc.', render: (v) => (v.discrepancyFound ? 'Yes' : '—') },
                  {
                    key: 'photos', label: 'Photos', render: (v) => (v.photos ?? []).length === 0 ? '—' : (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(v.photos ?? []).map((p, i) => (
                          String(p).includes('/') ? (
                            <a key={i} href={fileUrl(p)} download>
                              Photo {i + 1}
                            </a>
                          ) : (
                            <a key={i} href={String(p)} target="_blank" rel="noreferrer">
                              Link {i + 1}
                            </a>
                          )
                        ))}
                      </span>
                    ),
                  },
                ]}
                rows={visits}
                emptyText="No site visits yet."
              />
            </>
          )}
        </Panel>
      </div>
      <Panel title="Weekly report (visits by week)">
        {weekly.length === 0 ? (
          <EmptyState text="No visits to report yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'week', label: 'Week starting' },
              { key: 'visits', label: 'Visits' },
              { key: 'additional', label: 'Additional' },
              { key: 'discrepancies', label: 'With discrepancy' },
            ]}
            rows={weekly}
            emptyText="No visits to report yet."
          />
        )}
      </Panel>
      <div className="two-col">
        <Panel title="Raise discrepancy">
          <form onSubmit={submitDisc}>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" style={{ width: '100%' }} value={dProject} onChange={(e) => setDProject(e.target.value)}>
                  <ProjectOptions projects={projects} />
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Discipline</label>
                <input className="form-input" value={dDiscipline} onChange={(e) => setDDiscipline(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Severity</label>
                <input className="form-input" value={dSeverity} onChange={(e) => setDSeverity(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Raised (date)</label>
                <input className="form-input" type="date" value={dRaised} onChange={(e) => setDRaised(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Due</label>
                <input className="form-input" type="date" value={dDue} onChange={(e) => setDDue(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Issue</label>
              <textarea className="form-input" value={dIssue} onChange={(e) => setDIssue(e.target.value)} />
            </div>
            {dErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{dErr}</div>}
            <button type="submit" className="btn-primary" disabled={discSave.isPending}>
              {discSave.isPending ? 'Saving…' : 'Raise discrepancy'}
            </button>
          </form>
        </Panel>
        <Panel title="Discrepancy log">
          {discQ.isLoading ? <EmptyState text="Loading…" /> : (
            <>
              <InlineError error={discQ.isError ? discQ.error : null} />
              <DataTable
                columns={[
                  { key: 'issue', label: 'Issue', render: (d) => d.issue ?? '—' },
                  { key: 'discipline', label: 'Discipline' },
                  { key: 'severity', label: 'Severity' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (d) => (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="form-input"
                          style={{ maxWidth: 130 }}
                          value={dStatus[d._id ?? d.id] ?? d.status ?? ''}
                          onChange={(e) => setDStatus((p) => ({ ...p, [d._id ?? d.id]: e.target.value }))}
                          aria-label="Discrepancy status"
                        />
                        <button
                          type="button"
                          className="approve-btn"
                          disabled={discUpdate.isPending}
                          onClick={() => discUpdate.mutate({ id: d._id ?? d.id, patch: { status: dStatus[d._id ?? d.id] ?? d.status } })}
                        >
                          Save
                        </button>
                      </span>
                    ),
                  },
                ]}
                rows={discs}
                emptyText="No discrepancies logged yet."
              />
            </>
          )}
        </Panel>
      </div>
      <div className="two-col">
        <Panel title="Log conveyance">
          <form onSubmit={submitConv}>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" style={{ width: '100%' }} value={cProject} onChange={(e) => setCProject(e.target.value)}>
                  <option value="">—</option>
                  {(projects ?? []).map((p) => (
                    <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Employee</label>
                <select className="filter-select" style={{ width: '100%' }} value={cEmployee} onChange={(e) => setCEmployee(e.target.value)}>
                  <option value="">—</option>
                  {(employees ?? []).map((emp) => (
                    <option key={emp._id ?? emp.id} value={emp._id ?? emp.id}>{empName(emp)}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Purpose</label>
                <input className="form-input" value={cPurpose} onChange={(e) => setCPurpose(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Area</label>
                <input className="form-input" value={cArea} onChange={(e) => setCArea(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Vehicle</label>
                <input className="form-input" value={cVehicle} onChange={(e) => setCVehicle(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Kilometers</label>
                <input className="form-input" type="number" min="0" step="0.1" value={cKm} onChange={(e) => setCKm(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" min="0" step="0.01" value={cAmount} onChange={(e) => setCAmount(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Document</label>
                <input className="form-input" value={cDocument} onChange={(e) => setCDocument(e.target.value)} />
              </div>
            </div>
            {cErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{cErr}</div>}
            <button type="submit" className="btn-primary" disabled={convSave.isPending}>
              {convSave.isPending ? 'Saving…' : 'Log conveyance'}
            </button>
          </form>
        </Panel>
        <Panel title="Conveyance log">
          {convQ.isLoading ? <EmptyState text="Loading…" /> : (
            <>
              <InlineError error={convQ.isError ? convQ.error : null} />
              <DataTable
                columns={[
                  { key: 'date', label: 'Date', render: (c) => (c.date ? String(c.date).slice(0, 10) : '—') },
                  { key: 'purpose', label: 'Purpose' },
                  { key: 'area', label: 'Area' },
                  { key: 'kilometers', label: 'Km' },
                  { key: 'amount', label: 'Amount' },
                ]}
                rows={convs}
                emptyText="No conveyance entries yet."
              />
            </>
          )}
        </Panel>
      </div>
      <div className="two-col">
        <Panel title="Raise RFI">
          <form onSubmit={submitRfi}>
            <div className="field-grid">
              <div className="form-row">
                <label className="form-label">Project</label>
                <select className="filter-select" style={{ width: '100%' }} value={rProject} onChange={(e) => setRProject(e.target.value)}>
                  <option value="">—</option>
                  {(projects ?? []).map((p) => (
                    <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Type</label>
                <input className="form-input" value={rType} onChange={(e) => setRType(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Team</label>
                <select className="filter-select" style={{ width: '100%' }} value={rTeam} onChange={(e) => setRTeam(e.target.value)}>
                  <option value="">—</option>
                  {(teamsQ.data?.items ?? []).map((t) => (
                    <option key={t._id ?? t.id} value={t._id ?? t.id}>{t.name ?? '—'}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Assigned to</label>
                <select className="filter-select" style={{ width: '100%' }} value={rAssigned} onChange={(e) => setRAssigned(e.target.value)}>
                  <option value="">—</option>
                  {(employees ?? []).map((emp) => (
                    <option key={emp._id ?? emp.id} value={emp._id ?? emp.id}>{empName(emp)}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Due</label>
                <input className="form-input" type="date" value={rDue} onChange={(e) => setRDue(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
            </div>
            {rErr && <div className="login-error" role="alert" style={{ display: 'block' }}>{rErr}</div>}
            <button type="submit" className="btn-primary" disabled={rfiSave.isPending}>
              {rfiSave.isPending ? 'Saving…' : 'Raise RFI'}
            </button>
          </form>
        </Panel>
        <Panel title="RFIs I've raised">
          {rfiQ.isLoading ? <EmptyState text="Loading…" /> : (
            <>
              <InlineError error={rfiQ.isError ? rfiQ.error : null} />
              <DataTable
                columns={[
                  { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
                  { key: 'type', label: 'Type' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => (r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—'),
                  },
                  { key: 'due', label: 'Due', render: (r) => (r.due ? String(r.due).slice(0, 10) : '—') },
                ]}
                rows={myRfis}
                emptyText="You haven't raised any RFIs yet."
              />
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ---------------- BIM ---------------- */

function BimOrders({ projects }) {
  const queryClient = useQueryClient();
  const [filterProject, setFilterProject] = useState('');
  const [woNo, setWoNo] = useState('');
  const [project, setProject] = useState('');
  const [scope, setScope] = useState('');
  const [date, setDate] = useState('');
  const [fee, setFee] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');

  const listQ = useQuery({
    queryKey: ['bim-orders', { project: filterProject }],
    queryFn: () => bimApi.list(filterProject ? { project: filterProject } : {}),
  });
  const rows = listQ.data?.items ?? [];

  const save = useMutation({
    mutationFn: (body) => bimApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bim-orders'] });
      setWoNo(''); setProject(''); setScope(''); setDate(''); setFee(''); setStatus('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }) => bimApi.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bim-orders'] }),
    onError: (e) => setErr(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    save.mutate({
      woNo: woNo || undefined,
      project: project || undefined,
      scope: scope || undefined,
      date: date || undefined,
      fee: fee === '' ? undefined : Number(fee),
      status: status || undefined,
    });
  }

  return (
    <>
      <Panel title="New BIM work order">
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="form-row">
              <label className="form-label">WO no</label>
              <input className="form-input" value={woNo} onChange={(e) => setWoNo(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Project</label>
              <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">—</option>
                {(projects ?? []).map((p) => (
                  <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Fee</label>
              <input className="form-input" type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Status</label>
              <input className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Scope</label>
            <textarea className="form-input" value={scope} onChange={(e) => setScope(e.target.value)} />
          </div>
          {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Add work order'}
          </button>
        </form>
      </Panel>
      <Panel title="BIM work order register">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select className="filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
            ))}
          </select>
        </div>
        {listQ.isLoading ? <EmptyState text="Loading…" /> : (
          <>
            <InlineError error={listQ.isError ? listQ.error : null} />
            <DataTable
              columns={[
                { key: 'woNo', label: 'WO no' },
                { key: 'project', label: 'Project', render: (r) => r?.project?.name ?? r?.project ?? '—' },
                { key: 'scope', label: 'Scope' },
                { key: 'fee', label: 'Fee' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <span style={{ display: 'flex', gap: 6 }}>
                      {r.status ? <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> : '—'}
                      <input
                        className="form-input"
                        style={{ maxWidth: 130 }}
                        placeholder="Set status"
                        defaultValue=""
                        id={`bim-status-${r._id ?? r.id}`}
                        aria-label="BIM order status"
                      />
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={update.isPending}
                        onClick={() => {
                          const el = document.getElementById(`bim-status-${r._id ?? r.id}`);
                          update.mutate({ id: r._id ?? r.id, patch: { status: el?.value || undefined } });
                        }}
                      >
                        Save
                      </button>
                    </span>
                  ),
                },
              ]}
              rows={rows}
              emptyText="No BIM work orders yet."
            />
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- GBS ---------------- */

function GbsCert({ projects }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [steps, setSteps] = useState([]);
  const [isTemplate, setIsTemplate] = useState(false);
  const [err, setErr] = useState('');

  const certQ = useQuery({
    queryKey: ['gbs-cert', project],
    queryFn: () => gbsApi.get(project),
    enabled: !!project,
  });

  const savedSteps = certQ.data?.steps ?? certQ.data?.item?.steps ?? [];

  function loadIntoEditor() {
    if (savedSteps.length > 0) {
      setSteps(savedSteps.map((s, i) => ({
        n: s.n ?? i + 1,
        phase: s.phase ?? '',
        status: s.status ?? '',
        remarks: s.remarks ?? '',
        date: s.date ? String(s.date).slice(0, 10) : '',
      })));
      setIsTemplate(false);
    } else {
      setSteps(GBS_TEMPLATE.map((phase, i) => ({ n: i + 1, phase, status: '', remarks: '', date: '' })));
      setIsTemplate(true);
    }
  }

  function setStep(i, patch) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  const save = useMutation({
    mutationFn: (body) => gbsApi.save(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gbs-cert'] });
      setErr('');
      setIsTemplate(false);
    },
    onError: (e) => setErr(e.message),
  });

  function handleSave() {
    setErr('');
    if (!project) {
      setErr('Select a project first.');
      return;
    }
    save.mutate({
      project,
      steps: steps.map((s) => ({
        n: s.n,
        phase: s.phase,
        status: s.status || undefined,
        remarks: s.remarks || undefined,
        date: s.date || undefined,
      })),
    });
  }

  return (
    <>
      <Panel title="Certification workflow">
        <div className="form-row" style={{ maxWidth: 360 }}>
          <label className="form-label">Project</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setSteps([]);
              setIsTemplate(false);
              setErr('');
            }}
          >
            <option value="">Select project</option>
            {(projects ?? []).map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>{p.name ?? p.code ?? '—'}</option>
            ))}
          </select>
        </div>
        {!project ? (
          <EmptyState text="Select a project to view its certification workflow." />
        ) : certQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : certQ.isError ? (
          <InlineError error={certQ.error} />
        ) : steps.length === 0 ? (
          <>
            {savedSteps.length > 0 ? (
              <DataTable
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'phase', label: 'Phase' },
                  { key: 'status', label: 'Status', render: (s) => (s.status ? <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill> : '—') },
                  { key: 'remarks', label: 'Remarks' },
                  { key: 'date', label: 'Date', render: (s) => (s.date ? String(s.date).slice(0, 10) : '—') },
                ]}
                rows={savedSteps}
                emptyText="No certification steps saved yet."
              />
            ) : (
              <EmptyState text="No certification steps saved for this project yet." />
            )}
            <button type="button" className="btn-primary" onClick={loadIntoEditor} style={{ marginTop: 8 }}>
              {savedSteps.length > 0 ? 'Edit steps' : 'Start from template'}
            </button>
          </>
        ) : (
          <>
            {isTemplate && (
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                Starter template — default 5 phases. Edit and save to record the actual workflow.
              </p>
            )}
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr key={i}>
                    <td>{s.n}</td>
                    <td>
                      <input className="form-input" value={s.phase} onChange={(e) => setStep(i, { phase: e.target.value })} aria-label={`Phase ${s.n}`} />
                    </td>
                    <td>
                      <input className="form-input" value={s.status} onChange={(e) => setStep(i, { status: e.target.value })} aria-label={`Status ${s.n}`} />
                    </td>
                    <td>
                      <input className="form-input" value={s.remarks} onChange={(e) => setStep(i, { remarks: e.target.value })} aria-label={`Remarks ${s.n}`} />
                    </td>
                    <td>
                      <input className="form-input" type="date" value={s.date} onChange={(e) => setStep(i, { date: e.target.value })} aria-label={`Date ${s.n}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-primary" disabled={save.isPending} onClick={handleSave}>
                {save.isPending ? 'Saving…' : 'Save workflow'}
              </button>
              <button type="button" className="approve-btn" onClick={() => { setSteps([]); setIsTemplate(false); }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

/* ---------------- Peer review ---------------- */

function normStatus(s) {
  return String(s ?? '').toLowerCase().replace(/[\s_]+/g, '');
}

function PeerReview({ projects, employees, roleKey, user }) {
  const queryClient = useQueryClient();
  const canFinal = roleKey === 'peer_review_head' || SUPER_ROLES.includes(roleKey);
  const [selectedId, setSelectedId] = useState('');
  const [err, setErr] = useState('');

  // New review (2-step)
  const [step, setStep] = useState(1);
  const [jobNo, setJobNo] = useState('');
  const [nProject, setNProject] = useState('');
  const [nStage, setNStage] = useState('');
  const [nDiscipline, setNDiscipline] = useState('');
  const [nSubmission, setNSubmission] = useState('');
  const [nReviewer, setNReviewer] = useState('');
  const [nResp, setNResp] = useState('');
  const [nDue, setNDue] = useState('');
  const [nStatus, setNStatus] = useState('');

  // Checklist add
  const [clSection, setClSection] = useState('');
  const [clItem, setClItem] = useState('');
  const [clReq, setClReq] = useState('');
  const [clStatus, setClStatus] = useState('');
  const [clReviewer, setClReviewer] = useState('');
  const [clRemarks, setClRemarks] = useState('');
  const [clEdit, setClEdit] = useState({});

  // Comment add
  const [cmNo, setCmNo] = useState('');
  const [cmDocRef, setCmDocRef] = useState('');
  const [cmObs, setCmObs] = useState('');
  const [cmReviewer, setCmReviewer] = useState('');
  const [cmResp, setCmResp] = useState('');
  const [cmAction, setCmAction] = useState('');
  const [cmResponse, setCmResponse] = useState('');
  const [cmRev, setCmRev] = useState('');
  const [cmClosure, setCmClosure] = useState('');
  const [cmVerified, setCmVerified] = useState('');
  const [cmEdit, setCmEdit] = useState({});

  const listQ = useQuery({ queryKey: ['peer-reviews'], queryFn: () => peerApi.list({}) });
  const reviews = listQ.data?.items ?? [];
  const detailQ = useQuery({
    queryKey: ['peer-review', selectedId],
    queryFn: () => peerApi.get(selectedId),
    enabled: !!selectedId,
  });
  const detail = detailQ.data?.item ?? detailQ.data ?? {};
  const checklist = detail.checklist ?? detail.checklistItems ?? [];
  const comments = detail.comments ?? [];

  const kpis = useMemo(() => {
    const now = Date.now();
    let pending = 0;
    let inprog = 0;
    let overdue = 0;
    let commentsOpen = 0;
    let finalPending = 0;
    for (const r of reviews) {
      const s = normStatus(r.status);
      if (['pending', 'submitted', 'new', 'draft'].includes(s)) pending += 1;
      if (['inprogress', 'in-progress', 'underreview', 'review', 'ongoing'].includes(s)) inprog += 1;
      const due = r.dueDate ?? r.due;
      if (due && !Number.isNaN(Date.parse(due)) && Date.parse(due) < now && !['closed', 'issued', 'approved', 'completed'].includes(s)) overdue += 1;
      commentsOpen += r.openComments ?? r.commentsOpen ?? 0;
      if ((r.finalVerified || r.finalApproved) && !r.issuedAt) finalPending += 1;
      else if (s === 'approved' && !r.issuedAt) finalPending += 1;
    }
    return { total: reviews.length, pending, inprog, overdue, commentsOpen, finalPending };
  }, [reviews]);

  const create = useMutation({
    mutationFn: (body) => peerApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peer-reviews'] });
      setStep(1);
      setJobNo(''); setNProject(''); setNStage(''); setNDiscipline(''); setNSubmission('');
      setNReviewer(''); setNResp(''); setNDue(''); setNStatus('');
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const mutateAndRefresh = (fn) => ({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peer-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['peer-review', selectedId] });
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const addChecklist = useMutation(mutateAndRefresh((item) => peerApi.addChecklist(selectedId, item)));
  const updChecklist = useMutation(mutateAndRefresh(({ itemId, patch }) => peerApi.updateChecklist(selectedId, itemId, patch)));
  const addComment = useMutation(mutateAndRefresh((comment) => peerApi.addComment(selectedId, comment)));
  const updComment = useMutation(mutateAndRefresh(({ itemId, patch }) => peerApi.updateComment(selectedId, itemId, patch)));
  const setFinal = useMutation(mutateAndRefresh((body) => peerApi.setFinal(selectedId, body)));

  function submitNewReview() {
    setErr('');
    create.mutate({
      jobNo: jobNo || undefined,
      project: nProject || undefined,
      stage: nStage || undefined,
      discipline: nDiscipline || undefined,
      submission: nSubmission || undefined,
      reviewer: nReviewer || undefined,
      respEngineer: nResp || undefined,
      dueDate: nDue || undefined,
      status: nStatus || undefined,
    });
  }

  function submitChecklist(e) {
    e.preventDefault();
    if (!selectedId) {
      setErr('Select a review first.');
      return;
    }
    addChecklist.mutate({
      section: clSection || undefined,
      item: clItem || undefined,
      requirement: clReq || undefined,
      status: clStatus || undefined,
      reviewer: clReviewer || undefined,
      remarks: clRemarks || undefined,
    });
    setClSection(''); setClItem(''); setClReq(''); setClStatus(''); setClReviewer(''); setClRemarks('');
  }

  function submitComment(e) {
    e.preventDefault();
    if (!selectedId) {
      setErr('Select a review first.');
      return;
    }
    if (!cmObs) {
      setErr('Observation is required.');
      return;
    }
    addComment.mutate({
      no: cmNo || undefined,
      docRef: cmDocRef || undefined,
      observation: cmObs,
      reviewer: cmReviewer || undefined,
      respEngineer: cmResp || undefined,
      actionRequired: cmAction || undefined,
      response: cmResponse || undefined,
      rev: cmRev || undefined,
      closureStatus: cmClosure || undefined,
      verifiedBy: cmVerified || undefined,
    });
    setCmNo(''); setCmDocRef(''); setCmObs(''); setCmReviewer(''); setCmResp('');
    setCmAction(''); setCmResponse(''); setCmRev(''); setCmClosure(''); setCmVerified('');
  }

  void user;
  void employees;
  void projects;

  return (
    <>
      {err && <div className="login-error" role="alert" style={{ display: 'block' }}>{err}</div>}
      <Panel title="Review dashboard">
        {listQ.isLoading ? <EmptyState text="Loading…" /> : (
          <>
            <InlineError error={listQ.isError ? listQ.error : null} />
            <div className="kpi-grid cols-5">
              <KpiCard label="Total reviews" value={kpis.total} accent="blueprint" />
              <KpiCard label="Pending" value={kpis.pending} accent="amber" />
              <KpiCard label="In progress" value={kpis.inprog} accent="teal" />
              <KpiCard label="Overdue" value={kpis.overdue} accent="rust" />
              <KpiCard label="Comments open" value={kpis.commentsOpen} accent="violet" />
              <KpiCard label="Final pending" value={kpis.finalPending} accent="neutral" />
            </div>
          </>
        )}
      </Panel>

      <Panel title="New review">
        {step === 1 ? (
          <>
            <div className="section-label">Step 1 — request</div>
            <div className="field-grid">
              <div className="form-row"><label className="form-label">Job no</label><input className="form-input" value={jobNo} onChange={(e) => setJobNo(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Project</label><input className="form-input" value={nProject} onChange={(e) => setNProject(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Stage</label><input className="form-input" value={nStage} onChange={(e) => setNStage(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Discipline</label><input className="form-input" value={nDiscipline} onChange={(e) => setNDiscipline(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Submission</label><input className="form-input" value={nSubmission} onChange={(e) => setNSubmission(e.target.value)} /></div>
            </div>
            <button type="button" className="btn-primary" onClick={() => setStep(2)}>Next — allocation</button>
          </>
        ) : (
          <>
            <div className="section-label">Step 2 — allocation</div>
            <div className="field-grid">
              <div className="form-row"><label className="form-label">Reviewer</label><input className="form-input" value={nReviewer} onChange={(e) => setNReviewer(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Responsible engineer</label><input className="form-input" value={nResp} onChange={(e) => setNResp(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Due date</label><input className="form-input" type="date" value={nDue} onChange={(e) => setNDue(e.target.value)} /></div>
              <div className="form-row"><label className="form-label">Status</label><input className="form-input" value={nStatus} onChange={(e) => setNStatus(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="approve-btn" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn-primary" disabled={create.isPending} onClick={submitNewReview}>
                {create.isPending ? 'Saving…' : 'Create review'}
              </button>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Design checklist & comments">
        <div className="form-row" style={{ maxWidth: 360 }}>
          <label className="form-label">Review</label>
          <select className="filter-select" style={{ width: '100%' }} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Select review</option>
            {reviews.map((r) => (
              <option key={r._id ?? r.id} value={r._id ?? r.id}>
                {r.jobNo ?? r._id ?? 'Review'} · {r?.project?.name ?? r?.project ?? ''}
              </option>
            ))}
          </select>
        </div>
        {!selectedId ? (
          <EmptyState text="Select a review to see its checklist and comments." />
        ) : detailQ.isLoading ? (
          <EmptyState text="Loading…" />
        ) : detailQ.isError ? (
          <InlineError error={detailQ.error} />
        ) : (
          <>
            <div className="section-label">Checklist</div>
            <DataTable
              columns={[
                { key: 'section', label: 'Section' },
                { key: 'item', label: 'Item' },
                { key: 'requirement', label: 'Requirement' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (c) => (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        style={{ maxWidth: 130 }}
                        value={clEdit[c._id ?? c.id] ?? c.status ?? ''}
                        onChange={(e) => setClEdit((p) => ({ ...p, [c._id ?? c.id]: e.target.value }))}
                        aria-label="Checklist status"
                      />
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={updChecklist.isPending}
                        onClick={() => updChecklist.mutate({ itemId: c._id ?? c.id, patch: { status: clEdit[c._id ?? c.id] ?? c.status } })}
                      >
                        Save
                      </button>
                    </span>
                  ),
                },
                { key: 'reviewer', label: 'Reviewer' },
                { key: 'remarks', label: 'Remarks' },
              ]}
              rows={checklist}
              emptyText="No checklist items yet."
            />
            <form onSubmit={submitChecklist} style={{ marginTop: 8 }}>
              <div className="field-grid">
                <div className="form-row"><label className="form-label">Section</label><input className="form-input" value={clSection} onChange={(e) => setClSection(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Item</label><input className="form-input" value={clItem} onChange={(e) => setClItem(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Requirement</label><input className="form-input" value={clReq} onChange={(e) => setClReq(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Status</label><input className="form-input" value={clStatus} onChange={(e) => setClStatus(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Reviewer</label><input className="form-input" value={clReviewer} onChange={(e) => setClReviewer(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Remarks</label><input className="form-input" value={clRemarks} onChange={(e) => setClRemarks(e.target.value)} /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={addChecklist.isPending}>
                {addChecklist.isPending ? 'Adding…' : 'Add checklist item'}
              </button>
            </form>

            <div className="section-label" style={{ marginTop: 16 }}>Comment register</div>
            <DataTable
              columns={[
                { key: 'no', label: 'No' },
                { key: 'docRef', label: 'Doc ref' },
                { key: 'observation', label: 'Observation' },
                { key: 'reviewer', label: 'Reviewer' },
                { key: 'actionRequired', label: 'Action req.' },
                { key: 'response', label: 'Response' },
                {
                  key: 'closureStatus',
                  label: 'Closure',
                  render: (c) => (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        style={{ maxWidth: 130 }}
                        value={cmEdit[c._id ?? c.id] ?? c.closureStatus ?? ''}
                        onChange={(e) => setCmEdit((p) => ({ ...p, [c._id ?? c.id]: e.target.value }))}
                        aria-label="Comment closure status"
                      />
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={updComment.isPending}
                        onClick={() => updComment.mutate({ itemId: c._id ?? c.id, patch: { closureStatus: cmEdit[c._id ?? c.id] ?? c.closureStatus } })}
                      >
                        Save
                      </button>
                    </span>
                  ),
                },
                { key: 'verifiedBy', label: 'Verified by' },
              ]}
              rows={comments}
              emptyText="No comments yet."
            />
            <form onSubmit={submitComment} style={{ marginTop: 8 }}>
              <div className="field-grid">
                <div className="form-row"><label className="form-label">No</label><input className="form-input" value={cmNo} onChange={(e) => setCmNo(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Doc ref</label><input className="form-input" value={cmDocRef} onChange={(e) => setCmDocRef(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Reviewer</label><input className="form-input" value={cmReviewer} onChange={(e) => setCmReviewer(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Resp. engineer</label><input className="form-input" value={cmResp} onChange={(e) => setCmResp(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Action required</label><input className="form-input" value={cmAction} onChange={(e) => setCmAction(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Response</label><input className="form-input" value={cmResponse} onChange={(e) => setCmResponse(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Rev</label><input className="form-input" value={cmRev} onChange={(e) => setCmRev(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Closure status</label><input className="form-input" value={cmClosure} onChange={(e) => setCmClosure(e.target.value)} /></div>
                <div className="form-row"><label className="form-label">Verified by</label><input className="form-input" value={cmVerified} onChange={(e) => setCmVerified(e.target.value)} /></div>
              </div>
              <div className="form-row"><label className="form-label">Observation *</label><textarea className="form-input" value={cmObs} onChange={(e) => setCmObs(e.target.value)} /></div>
              <button type="submit" className="btn-primary" disabled={addComment.isPending}>
                {addComment.isPending ? 'Adding…' : 'Add comment'}
              </button>
            </form>
          </>
        )}
      </Panel>

      <Panel title="Final approval">
        {!selectedId ? (
          <EmptyState text="Select a review above to approve it." />
        ) : !canFinal ? (
          <EmptyState text="Final verification and approval are restricted to the peer review head." />
        ) : (
          <>
            <div className="field-grid">
              <Field label="Final verified" value={detail.finalVerified ? 'Yes' : '—'} />
              <Field label="Final approved" value={detail.finalApproved ? 'Yes' : '—'} />
              <Field label="Issued at" value={detail.issuedAt} />
              <Field label="Status" value={detail.status} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="approve-btn" disabled={setFinal.isPending} onClick={() => setFinal.mutate({ finalVerified: true })}>
                Verify
              </button>
              <button type="button" className="approve-btn" disabled={setFinal.isPending} onClick={() => setFinal.mutate({ finalApproved: true })}>
                Approve
              </button>
              <button type="button" className="btn-primary" disabled={setFinal.isPending} onClick={() => setFinal.mutate({ issuedAt: todayISO(), status: 'Approved for Issue' })}>
                Issue
              </button>
            </div>
          </>
        )}
      </Panel>

      <Panel title="SOP reference">
        <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          <p><b>Responsibilities.</b> The reviewer checks design submissions for correctness and completeness; the responsible engineer actions each comment and records a response.</p>
          <p><b>Review stages.</b> Request → allocation to a reviewer → checklist-based review → comment register → response and verification → final approval before issue.</p>
          <p><b>Checklist use.</b> Work through the design checklist section by section, marking each item&apos;s status and adding remarks where the submission falls short.</p>
          <p><b>Comment register.</b> Every observation is logged with a document reference, required action, response, revision, and closure status; closure must be verified.</p>
          <p><b>Approval before issue.</b> No submission is issued until it is verified and approved by the peer review head.</p>
        </div>
      </Panel>
    </>
  );
}

/* ---------------- Page ---------------- */

export default function WorkTrackingPage({ bootstrap, user }) {
  const [tab, setTab] = useState('work');
  const roleKey = bootstrap?.role?.key;
  const isSuper = SUPER_ROLES.includes(roleKey);
  const [superVariant, setSuperVariant] = useState('qs');
  const variant = isSuper ? superVariant : (VARIANT_FOR_ROLE[roleKey] ?? 'qs');

  const projectsQ = useQuery({
    queryKey: ['projects', 'active-wt'],
    queryFn: () => projectsApi.list({ status: 'Active' }),
  });
  const employeesQ = useQuery({
    queryKey: ['employees-dir'],
    queryFn: () => employeesApi.list({}),
  });

  const projects = projectsQ.data?.items ?? [];
  const employees = employeesQ.data?.items ?? [];
  const title = FUNCTION_TITLES[variant] ?? variant;

  return (
    <>
      <div className="page-head">
        <div className="page-title">{title} Work Tracking</div>
        <div className="page-sub">{user?.name ?? '—'}</div>
      </div>
      {isSuper && (
        <Panel title="Role note">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5 }}>
              Previewing function workspaces as {bootstrap?.role?.label ?? roleKey}. Variant:
            </span>
            <select className="filter-select" value={superVariant} onChange={(e) => setSuperVariant(e.target.value)}>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>{FUNCTION_TITLES[v]}</option>
              ))}
            </select>
          </div>
        </Panel>
      )}
      <Tabs
        tabs={[
          { key: 'work', label: 'Log work' },
          { key: 'revisions', label: 'Revisions' },
          { key: 'function', label: title },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'work' && <LogWorkTab projects={projects} variant={variant} />}
      {tab === 'revisions' && <RevisionsTab projects={projects} />}
      {tab === 'function' && variant === 'qs' && <QsSettlement projects={projects} roleKey={roleKey} />}
      {tab === 'function' && variant === 'qs' && <BoqItems projects={projects} roleKey={roleKey} />}
      {tab === 'function' && variant === 'qaqc' && <QaqcTools projects={projects} employees={employees} user={user} />}
      {tab === 'function' && variant === 'bim' && <BimOrders projects={projects} />}
      {tab === 'function' && variant === 'gbs' && <GbsCert projects={projects} />}
      {tab === 'function' && variant === 'peer' && <PeerReview projects={projects} employees={employees} roleKey={roleKey} user={user} />}
    </>
  );
}
