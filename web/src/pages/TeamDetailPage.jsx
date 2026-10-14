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

const APPROVAL_PAGE_SIZE = 5;

function memberName(m) {
  if (!m) return '—';
  if (typeof m.employee === 'object' && m.employee) {
    const e = m.employee;
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || '—';
  }
  return String(m.employee ?? '—');
}

function rosterGroup(employee) {
  const designation = String(employee?.designation ?? '').toLowerCase();
  if (designation.includes('senior')) return 'Senior designers';
  if (designation.includes('junior')) return 'Junior designers';
  if (designation.includes('drafter')) return 'Drafters';
  return 'Team members';
}

function employeeId(employee) {
  if (!employee) return '';
  return String(typeof employee === 'object' ? employee._id ?? employee.id ?? '' : employee);
}

function employeeDisplayName(employee) {
  if (!employee || typeof employee !== 'object') return String(employee ?? '—');
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empId || '—';
}

function weekDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EmployeeWorkLogModal({ employee, onClose }) {
  const id = employeeId(employee);
  const query = useQuery({
    queryKey: ['employee-work-log', id],
    queryFn: () => workEntriesApi.list({ employee: id }),
    enabled: Boolean(id),
  });

  return (
    <Modal title={`${employeeDisplayName(employee)} — work log`} wide onClose={onClose}>
      {query.isLoading ? <EmptyState text="Loading work log…" /> : query.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>{query.error.message}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (entry) => weekDate(entry.date) },
            { key: 'project', label: 'Project', render: (entry) => entry.project?.name ?? '—' },
            { key: 'stage', label: 'Stage', render: (entry) => entry.stage ?? '—' },
            { key: 'hours', label: 'Hours', render: (entry) => `${Number(entry.hours ?? 0)} hrs` },
            { key: 'status', label: 'Status', render: (entry) => <StatusPill tone={statusTone(entry.status)}>{entry.status ?? '—'}</StatusPill> },
          ]}
          rows={query.data?.items ?? []}
          emptyText="No work entries found for this employee."
        />
      )}
    </Modal>
  );
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
  const role = bootstrap?.role?.key ?? '';
  const isAdmin = role === 'admin_billing';
  const [allocOpen, setAllocOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logEmployee, setLogEmployee] = useState(null);
  const [approvalPage, setApprovalPage] = useState(0);

  const q = useQuery({ queryKey: ['team', id], queryFn: () => teamsApi.get(id) });
  const decide = useMutation({
    mutationFn: ({ entryId, status }) => workEntriesApi.decide(entryId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
    },
  });

  if (q.isLoading) return <EmptyState text="Loading team…" />;
  if (q.isError) {
    return (
      <>
        <button type="button" className="back-link" onClick={() => navigate('/teams')}>← Back to teams</button>
        <div className="login-error" role="alert" style={{ display: 'block' }}>{q.error.message}</div>
      </>
    );
  }

  const team = q.data?.team ?? {};
  const weekEntries = q.data?.weekEntries ?? [];
  const members = team.members ?? [];
  const rosterGroups = ['Senior designers', 'Junior designers', 'Drafters', 'Team members']
    .map((title) => ({
      title,
      members: members.filter((member) => rosterGroup(member.employee) === title),
    }))
    .filter((group) => group.members.length > 0);
  const projectHours = q.data?.projectHours ?? [];
  const loggedHours = projectHours.reduce((sum, row) => sum + Number(row.hours ?? 0), 0);
  const teamHoursCapacity = members.length * 40;
  const approvalRows = weekEntries.slice(
    approvalPage * APPROVAL_PAGE_SIZE,
    (approvalPage + 1) * APPROVAL_PAGE_SIZE,
  );
  const approvalFirst = weekEntries.length ? approvalPage * APPROVAL_PAGE_SIZE + 1 : 0;
  const approvalLast = Math.min((approvalPage + 1) * APPROVAL_PAGE_SIZE, weekEntries.length);

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('/teams')}>← Back to teams</button>

      {isAdmin && (
        <Panel title={team.name ?? 'Team'}>
          <div className="field-grid">
            <Field label="Principal team lead" value={employeeDisplayName(team.lead)} />
            <Field label="Service" value={team.service} />
            <Field label="Team size" value={`${members.length} people`} />
          </div>
        </Panel>
      )}

      <Panel title="Team roster" sub="Click a name to open their work log.">
        {members.length === 0 ? (
          <EmptyState text="No members in this team yet." />
        ) : (
          rosterGroups.map((group) => (
            <section key={group.title} style={{ marginBottom: 16 }}>
              <h3>{group.title}{group.title !== 'Team members' ? ` (${group.members.length})` : ''}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {group.members.map((member) => {
                  const employee = member.employee;
                  const experience = Number(employee?.experience);
                  return (
                    <button
                      key={employeeId(employee) || memberName(member)}
                      type="button"
                      className="roster-chip"
                      disabled={!employee || typeof employee !== 'object'}
                      onClick={() => employee && typeof employee === 'object' && setLogEmployee(employee)}
                    >
                      {memberName(member)}
                      {Number.isFinite(experience) && experience > 0 && (
                        <span style={{ color: 'var(--ink-muted)', marginLeft: 4 }}>· {experience} yrs exp.</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </Panel>

      <Panel
        title="Projects this week"
        sub={`${loggedHours.toLocaleString('en-IN')} of ~${teamHoursCapacity.toLocaleString('en-IN')} team hours logged${q.data?.weekStart ? ` · Week of ${weekDate(q.data.weekStart)}–${weekDate(q.data.weekEnd)}` : ''}`}
      >
        {projectHours.length === 0 ? (
          <EmptyState text="No work logged this week." />
        ) : (
          <DataTable
            columns={[
              { key: 'project', label: 'Project', render: (row) => row.project?.name ?? row.project?.code ?? '—' },
              { key: 'hours', label: 'Hours logged', render: (row) => Number(row.hours ?? 0).toLocaleString('en-IN') },
              ...(isAdmin ? [{
                key: 'share',
                label: '% of logged time',
                render: (row) => loggedHours > 0
                  ? `${Math.round((Number(row.hours ?? 0) / loggedHours) * 100)}%`
                  : '0%',
              }] : []),
            ]}
            rows={projectHours}
            emptyText="No work logged this week."
          />
        )}
      </Panel>

      {(isAdmin || role === 'hr') && (
        <Panel
          title="Weekly approval"
          sub={`${q.data?.weekStart ? `Week of ${weekDate(q.data.weekStart)}–${weekDate(q.data.weekEnd)}` : 'This week'} · ${approvalFirst}–${approvalLast} of ${weekEntries.length} shown`}
        >
          {decide.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>{decide.error.message}</div>
          )}
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (entry) => employeeDisplayName(entry.employee) },
              { key: 'role', label: 'Role', render: (entry) => entry.employee?.designation ?? '—' },
              { key: 'hours', label: 'Hours', render: (entry) => Number(entry.hours ?? 0).toLocaleString('en-IN') },
              { key: 'status', label: 'Status', render: (entry) => <StatusPill tone={statusTone(entry.status)}>{entry.status ?? '—'}</StatusPill> },
              {
                key: 'action',
                label: 'Action',
                render: (entry) => entry.status === 'Pending' ? (
                  <button
                    type="button"
                    className="approve-btn"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ entryId: entry._id ?? entry.id, status: 'Approved' })}
                  >
                    Approve
                  </button>
                ) : '—',
              },
            ]}
            rows={approvalRows}
            emptyText="No work entries this week."
          />
          {weekEntries.length > APPROVAL_PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="approve-btn"
                disabled={approvalPage === 0}
                onClick={() => setApprovalPage((page) => Math.max(0, page - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="approve-btn"
                disabled={(approvalPage + 1) * APPROVAL_PAGE_SIZE >= weekEntries.length}
                onClick={() => setApprovalPage((page) => page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </Panel>
      )}

      {allocOpen && <AllocationModal teamId={id} team={team} onClose={() => setAllocOpen(false)} />}
      {logOpen && <LogWorkModal teamId={id} onClose={() => setLogOpen(false)} />}
      {logEmployee && <EmployeeWorkLogModal employee={logEmployee} onClose={() => setLogEmployee(null)} />}
    </>
  );
}
