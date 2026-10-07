import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { employeesApi, projectsApi, teamsApi, workEntriesApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';

const APPROVER_ROLES = new Set([
  'team_lead',
  'assoc_technical_director',
  'technical_director',
  'founding_director',
  'working_director',
]);

function memberName(m) {
  if (!m) return '—';
  if (typeof m.employee === 'object' && m.employee) {
    const e = m.employee;
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
  }
  return String(m.employee ?? '—');
}

function LogWorkModal({ teamId, onClose }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState('');
  const [stage, setStage] = useState('');
  const [hours, setHours] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');

  const projects = useQuery({
    queryKey: ['projects-lite'],
    queryFn: () => projectsApi.list({}),
  });

  const create = useMutation({
    mutationFn: (body) => workEntriesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!project) return;
    create.mutate({
      team: teamId,
      project,
      stage: stage || undefined,
      hours: Number(hours) || undefined,
      type: type || undefined,
      notes: notes || undefined,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <Modal title="Log today's work" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Project *</label>
          <select className="filter-select" style={{ width: '100%' }} value={project} onChange={(e) => setProject(e.target.value)} required>
            <option value="">Select project</option>
            {(projects.data?.items ?? []).map((p) => (
              <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Stage</label>
          <input className="form-input" value={stage} onChange={(e) => setStage(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Hours</label>
          <input type="number" min="0" step="0.5" className="form-input" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Type</label>
          <input className="form-input" value={type} onChange={(e) => setType(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Notes</label>
          <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {create.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{create.error.message}</div>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Log work'}
        </button>
      </form>
    </Modal>
  );
}

function AllocationModal({ teamId, team, onClose }) {
  const queryClient = useQueryClient();
  const [members, setMembers] = useState(
    (team.members ?? []).map((m) => ({
      employee: typeof m.employee === 'object' ? (m.employee?._id ?? m.employee?.id ?? '') : (m.employee ?? ''),
      allocation: m.allocation ?? '',
    })),
  );
  const [empSearch, setEmpSearch] = useState('');

  const empQuery = useQuery({
    queryKey: ['employees-search', empSearch],
    queryFn: () => employeesApi.list({ search: empSearch }),
    enabled: empSearch.trim().length > 0,
  });

  const save = useMutation({
    mutationFn: (rows) => teamsApi.updateMembers(teamId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });

  function addEmployee(emp) {
    const id = emp._id ?? emp.id;
    if (members.some((m) => String(m.employee) === String(id))) return;
    setMembers((ms) => [...ms, { employee: id, allocation: '' }]);
    setEmpSearch('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    save.mutate(
      members.map((m) => ({
        employee: m.employee,
        allocation: m.allocation === '' ? undefined : Number(m.allocation),
      })),
    );
  }

  return (
    <Modal title="Edit allocations" wide onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {members.length === 0 && <EmptyState text="No members in this team." />}
        {members.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <input
              className="form-input"
              value={m.employee}
              placeholder="Employee id"
              onChange={(e) =>
                setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, employee: e.target.value } : x)))
              }
            />
            <input
              className="form-input"
              style={{ maxWidth: 120 }}
              placeholder="Alloc %"
              type="number"
              value={m.allocation}
              onChange={(e) =>
                setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, allocation: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="approve-btn"
              onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="form-label">Add member — search employees</label>
          <input
            className="form-input"
            placeholder="Type a name to search"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
          />
          {(empQuery.data?.items ?? []).length > 0 && (
            <div className="search-results">
              {empQuery.data.items.map((emp) => (
                <div
                  key={emp._id ?? emp.id}
                  className="search-result-row"
                  onClick={() => addEmployee(emp)}
                >
                  {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.empId} · {emp.designation ?? ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {save.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>{save.error.message}</div>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save members'}
        </button>
      </form>
    </Modal>
  );
}

export default function TeamDetailPage({ bootstrap }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [allocOpen, setAllocOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const canApprove = APPROVER_ROLES.has(bootstrap?.role?.key);

  const q = useQuery({ queryKey: ['team', id], queryFn: () => teamsApi.get(id) });

  const decide = useMutation({
    mutationFn: ({ entryId, status, remark }) =>
      workEntriesApi.decide(entryId, { status, remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
    },
  });

  if (q.isLoading) return <EmptyState text="Loading team…" />;
  if (q.isError) {
    return (
      <>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>← Back</button>
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      </>
    );
  }

  const team = q.data?.team ?? {};
  const weekEntries = q.data?.weekEntries ?? [];
  const pending = q.data?.pending ?? [];
  const members = team.members ?? [];

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>← Back</button>
      <div className="page-head">
        <div className="page-title">{team.name ?? '—'}</div>
        <div className="page-sub">{[team.service, team.branch].filter(Boolean).join(' · ')}</div>
      </div>

      <Panel title="Team">
        <div className="field-grid">
          <Field label="Name" value={team.name} />
          <Field label="Service" value={team.service} />
          <Field label="Branch" value={team.branch} />
          <Field label="Lead" value={team.lead?.name ?? team.lead} />
          <Field label="Members" value={team.memberCount ?? members.length} />
          <Field label="Week hours" value={team.weekHours} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="approve-btn" onClick={() => setAllocOpen(true)}>
            Edit allocations
          </button>
          <button type="button" className="btn-primary" onClick={() => setLogOpen(true)}>
            Log today's work
          </button>
        </div>
      </Panel>

      <Panel title="Roster">
        {members.length === 0 ? (
          <EmptyState text="No members in this team yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'employee', label: 'Member', render: memberName },
              { key: 'allocation', label: 'Allocation', render: (m) => (m.allocation ?? '—') },
            ]}
            rows={members}
            emptyText="No members in this team yet."
          />
        )}
      </Panel>

      <Panel title="Projects this week">
        {weekEntries.length === 0 ? (
          <EmptyState text="No work logged this week." />
        ) : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (w) => w.project?.name ?? w.project ?? '—' },
              { key: 'stage', label: 'Stage' },
              { key: 'hours', label: 'Hours' },
              { key: 'date', label: 'Date' },
              {
                key: 'status',
                label: 'Status',
                render: (w) => <StatusPill tone={statusTone(w.status)}>{w.status ?? '—'}</StatusPill>,
              },
            ]}
            rows={weekEntries}
            emptyText="No work logged this week."
          />
        )}
      </Panel>

      <Panel title="Weekly approval">
        {!canApprove ? (
          <EmptyState text="Approval actions are available to team leads and directors." />
        ) : pending.length === 0 ? (
          <EmptyState text="No entries pending approval." />
        ) : (
          <>
            {decide.isError && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>{decide.error.message}</div>
            )}
            <DataTable
              columns={[
                { key: 'employee', label: 'Employee', render: (w) => w.employee?.name ?? w.employee ?? '—' },
                { key: 'project', label: 'Project', render: (w) => w.project?.name ?? w.project ?? '—' },
                { key: 'hours', label: 'Hours' },
                { key: 'date', label: 'Date' },
                {
                  key: 'actions',
                  label: 'Decision',
                  render: (w) => (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ entryId: w._id ?? w.id, status: 'approved' })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ entryId: w._id ?? w.id, status: 'rejected' })}
                      >
                        Reject
                      </button>
                    </span>
                  ),
                },
              ]}
              rows={pending}
              emptyText="No entries pending approval."
            />
          </>
        )}
      </Panel>

      {allocOpen && <AllocationModal teamId={id} team={team} onClose={() => setAllocOpen(false)} />}
      {logOpen && <LogWorkModal teamId={id} onClose={() => setLogOpen(false)} />}
    </>
  );
}
