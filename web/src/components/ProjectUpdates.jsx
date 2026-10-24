import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, request, toQuery } from '../lib/api.js';
import ContactPicker from './ContactPicker.jsx';
import Panel from './Panel.jsx';
import Modal from './Modal.jsx';
import DataTable from './DataTable.jsx';

const SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'QS',
  'QA/QC',
  'BIM',
  'GBS',
  'Peer Review',
];
const errBox = (error) =>
  error && (
    <p role="alert" className="login-error" style={{ display: 'block' }}>
      {error.message}
    </p>
  );
const contact = (c) =>
  c
    ? Object.fromEntries(
        ['name', 'company', 'phone', 'email', 'designation', 'salutation'].map(
          (k) => [
            k,
            k === 'company' ? c.company || c.organization || '' : c[k] || '',
          ],
        ),
      )
    : null;

export function SpocContacts({ project }) {
  const qc = useQueryClient(),
    [draft, setDraft] = useState(project.contacts ?? {});
  const save = useMutation({
    mutationFn: () =>
      projectsApi.saveSpocContacts(project._id, {
        pmc: contact(draft.pmc),
        peerReview: contact(draft.peerReview),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project._id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  return (
    <Panel title="PMC and Peer Review contacts">
      <div className="field-grid">
        {[
          ['pmc', 'PMC'],
          ['peerReview', 'Peer Review'],
        ].map(([key, label]) => (
          <ContactPicker
            key={key}
            label={label + ' Contact'}
            contactType={label}
            value={draft[key]}
            onPick={(v) => setDraft((d) => ({ ...d, [key]: v }))}
            onClear={() => setDraft((d) => ({ ...d, [key]: null }))}
          />
        ))}
      </div>
      {errBox(save.error)}
      {save.isSuccess && <p role="status">Contacts saved.</p>}
      <button
        type="button"
        className="btn-primary"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        Save contacts
      </button>
    </Panel>
  );
}

export function ProjectHold({ project }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(project.status === 'On Hold' ? 'On Hold' : 'Active');
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => projectsApi.updateHold(project._id, { status, reason: reason.trim() }),
    onSuccess: () => {
      for (const key of ['project', 'projects', 'projects-stats', 'projects-summary', 'projects-filters', 'my-teams', 'spoc-assigned-projects']) qc.invalidateQueries({ queryKey: [key] });
      setReason('');
    },
  });
  return <Panel title="Project hold status" sub="Project status only; stage completion and billing approvals are retained.">
    <p>Current status: <b>{project.status}</b></p>
    {project.hold?.reason && <p>Last status reason: {project.hold.reason}</p>}
    {['Active', 'On Hold'].includes(project.status) ? <form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="field-grid">
        <label className="form-label">Project status<select aria-label="Project hold status" className="filter-select" value={status} onChange={e => setStatus(e.target.value)}><option>Active</option><option>On Hold</option></select></label>
        <label className="form-label">Reason<textarea aria-label="Project status reason" className="form-input" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </div>
      {errBox(save.error)}{save.isSuccess && <p role="status">Project status saved.</p>}
      <button type="submit" className="btn-primary" disabled={save.isPending || !reason.trim()}>{save.isPending ? 'Saving…' : 'Save project status'}</button>
    </form> : <p>Completed projects cannot be placed on hold here.</p>}
  </Panel>;
}

export function CoordinationPanel({ projectId, canEdit = false, service }) {
  const qc = useQueryClient(),
    [draft, setDraft] = useState({
      channel: 'Internal team',
      service: service || 'Structural',
      topic: '',
      deadline: '',
    });
  const q = useQuery({
    queryKey: ['coordination-items', projectId, service],
    queryFn: () =>
      request(
        '/api/coordination-items' + toQuery({ project: projectId, service }),
      ),
    refetchInterval: 15000,
  });
  const create = useMutation({
    mutationFn: () =>
      request('/api/coordination-items', {
        method: 'POST',
        body: JSON.stringify({ ...draft, project: projectId }),
      }),
    onSuccess: () => {
      setDraft((d) => ({ ...d, topic: '', deadline: '' }));
      qc.invalidateQueries({ queryKey: ['coordination-items'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }) =>
      request('/api/coordination-items/' + id, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coordination-items'] }),
  });
  return (
    <>
      {canEdit && (
        <Panel title="Log a coordination item">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="field-grid">
              {['channel', 'service'].map((key) => (
                <div className="form-row" key={key}>
                  <label className="form-label">
                    {key === 'channel' ? 'Channel' : 'Service'}
                  </label>
                  <select
                    aria-label={'Coordination ' + key}
                    className="filter-select"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [key]: e.target.value }))
                    }
                  >
                    {(key === 'channel'
                      ? [
                          'Internal team',
                          'Client',
                          'Architect',
                          'PMC',
                          'Peer Review',
                        ]
                      : SERVICES
                    ).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="form-row">
                <label className="form-label">Topic</label>
                <input
                  aria-label="Coordination topic"
                  required
                  className="form-input"
                  value={draft.topic}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, topic: e.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label className="form-label">Deadline</label>
                <input
                  aria-label="Coordination deadline"
                  required
                  type="date"
                  className="form-input"
                  value={draft.deadline}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, deadline: e.target.value }))
                  }
                />
              </div>
            </div>
            {errBox(create.error)}
            <button className="btn-primary" disabled={create.isPending}>
              Log item
            </button>
          </form>
        </Panel>
      )}
      <Panel title="Coordination items">
        {errBox(q.error || update.error)}
        <DataTable
          columns={[
            {
              key: 'project',
              label: 'Project',
              render: (r) => r.project?.name || '—',
            },
            { key: 'channel', label: 'Channel' },
            { key: 'service', label: 'Service' },
            { key: 'topic', label: 'Topic' },
            {
              key: 'deadline',
              label: 'Deadline',
              render: (r) => new Date(r.deadline).toLocaleDateString(),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) =>
                r.status === 'Open' &&
                new Date(r.deadline) < new Date(new Date().toDateString()) ? (
                  <strong className="text-danger">Overdue</strong>
                ) : (
                  r.status
                ),
            },
            ...(canEdit
              ? [
                  {
                    key: 'actions',
                    label: 'Action',
                    render: (r) => (
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({
                            id: r._id,
                            status:
                              r.status === 'Resolved' ? 'Open' : 'Resolved',
                          })
                        }
                      >
                        {r.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={q.data?.items ?? []}
          emptyText={
            q.isLoading
              ? 'Loading coordination items…'
              : 'No coordination items.'
          }
        />
      </Panel>
    </>
  );
}

const EDIT_FIELDS = [
  ['name', 'Project name'],
  ['jobNumber', 'Job number'],
  ['sourcePerson', 'Source person'],
  ['referral', 'Referral'],
  ['projectType', 'Project type'],
  ['state', 'State'],
  ['branch', 'Branch'],
  ['owner', 'Owner'],
  ['startDate', 'Start date', 'date'],
  ['expectedCompletion', 'Expected completion', 'date'],
  ['actualCompletion', 'Actual completion', 'date'],
  ['workOrderDate', 'Work order date', 'date'],
  ['workOrderDocument', 'Work order document'],
  ['clientSpoc', 'Client SPOC'],
  ['description', 'Description'],
  ['requirements', 'Requirements'],
  ['completion', 'Completion %', 'number'],
  ['currentStage', 'Current stage', ['CD', 'SD', 'DD', 'TD', 'GFC']],
  ['status', 'Status', ['Active', 'On Hold', 'Completed', 'Other']],
  ['category', 'Category', ['', 'Category A', 'Category B', 'Category C']],
];
export function ProjectEdit({ project, onClose }) {
  const qc = useQueryClient();
  const [contacts, setContacts] = useState(() =>
    Object.fromEntries(
      ['client', 'architect', 'billing'].map((key) => [
        key,
        project.contacts?.[key] ?? {},
      ]),
    ),
  );
  const [services, setServices] = useState(project.services ?? []);
  const [scope, setScope] = useState(project.scope ?? []);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(
      EDIT_FIELDS.map(([key, , type]) => [
        key,
        type === 'date'
          ? (project[key] ?? '').slice(0, 10)
          : (project[key] ?? ''),
      ]),
    ),
  );
  const save = useMutation({
    mutationFn: () =>
      projectsApi.update(project._id, {
        contacts,
        services,
        scope: scope.map(({ service, scope, fee }) => ({
          service,
          scope,
          ...(fee !== '' && fee != null ? { fee: Number(fee) } : {}),
        })),
        ...Object.fromEntries(
          EDIT_FIELDS.filter(
            ([key]) => !['category', 'branch'].includes(key) || draft[key],
          ).map(([key, , type]) => [
            key,
            type === 'date'
              ? draft[key] || null
              : type === 'number'
                ? draft[key] === ''
                  ? 0
                  : Number(draft[key])
                : draft[key],
          ]),
        ),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project._id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-audit', project._id] });
      qc.invalidateQueries({ queryKey: ['projects-stats'] });
      qc.invalidateQueries({ queryKey: ['projects-summary'] });
      qc.invalidateQueries({ queryKey: ['my-teams'] });
      qc.invalidateQueries({ queryKey: ['spoc-assigned-projects'] });
      onClose();
    },
  });
  return (
    <Modal title="Edit project details" wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="field-grid">
          {EDIT_FIELDS.map(([key, label, type]) => (
            <div className="form-row" key={key}>
              <label className="form-label" htmlFor={'edit-' + key}>
                {label}
              </label>
              {Array.isArray(type) ? (
                <select
                  id={'edit-' + key}
                  className="filter-select"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value }))
                  }
                >
                  {type.map((v) => (
                    <option key={v} value={v}>
                      {v || 'Not set'}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={'edit-' + key}
                  className="form-input"
                  type={type || 'text'}
                  min={type === 'number' ? 0 : undefined}
                  max={type === 'number' ? 100 : undefined}
                  required={key === 'name'}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        <h3>Services</h3>
        <div className="field-grid">
          {[
            'STR',
            'PHE',
            'ELE',
            'HVAC',
            'FIRE',
            'SMEP',
            'SMEPF',
            'MEP',
            'BIM',
            'GBS',
            'Peer Review',
          ].map((v) => (
            <label key={v}>
              <input
                type="checkbox"
                checked={services.includes(v)}
                onChange={(e) =>
                  setServices((old) =>
                    e.target.checked ? [...old, v] : old.filter((x) => x !== v),
                  )
                }
              />
              {v}
            </label>
          ))}
        </div>
        <h3>Scope and fees</h3>
        {scope.map((row, i) => (
          <div className="field-grid" key={i}>
            {['service', 'scope', 'fee'].map((key) => (
              <input
                key={key}
                aria-label={'Scope ' + key + ' ' + (i + 1)}
                className="form-input"
                type={key === 'fee' ? 'number' : 'text'}
                min={key === 'fee' ? 0 : undefined}
                value={row[key] ?? ''}
                onChange={(e) =>
                  setScope((old) =>
                    old.map((r, n) =>
                      n === i ? { ...r, [key]: e.target.value } : r,
                    ),
                  )
                }
              />
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setScope((old) => [...old, { service: '', scope: '', fee: '' }])
          }
        >
          Add scope row
        </button>
        <h3>Project contacts</h3>
        {['client', 'architect', 'billing'].map((key) => (
          <section key={key}>
            <h4>
              {key === 'billing'
                ? 'Billing'
                : key === 'client'
                  ? 'Client'
                  : 'Architect'}
            </h4>
            <div className="field-grid">
              {['name', 'company', 'designation', 'email', 'phone'].map(
                (field) => (
                  <input
                    key={field}
                    className="form-input"
                    aria-label={key + ' ' + field}
                    placeholder={field}
                    value={contacts[key][field] ?? ''}
                    type={field === 'email' ? 'email' : 'text'}
                    onChange={(e) =>
                      setContacts((old) => ({
                        ...old,
                        [key]: { ...old[key], [field]: e.target.value },
                      }))
                    }
                  />
                ),
              )}
            </div>
          </section>
        ))}
        {errBox(save.error)}
        <button className="btn-primary" disabled={save.isPending}>
          Save project details
        </button>
      </form>
    </Modal>
  );
}

export function ProjectAudit({ projectId }) {
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ['project-audit', projectId, page],
    queryFn: () => request(`/api/projects/${projectId}/history?page=${page}`),
  });
  return (
    <Panel
      title="Project update history"
      sub="Recorded changes are retained for reference."
    >
      {errBox(q.error)}
      <DataTable
        columns={[
          { key: 'actorName', label: 'Updated by' },
          {
            key: 'at',
            label: 'Date and time',
            render: (r) => new Date(r.at).toLocaleString(),
          },
          { key: 'recordType', label: 'Record' },
          { key: 'action', label: 'Action' },
          {
            key: 'changes',
            label: 'Changed information',
            render: (r) => (
              <details>
                <summary>{r.changes.length} field(s)</summary>
                {r.changes.map((c) => (
                  <div key={c.field}>
                    <b>{c.field}</b>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        maxWidth: 450,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {JSON.stringify(c.previous)} → {JSON.stringify(c.updated)}
                    </pre>
                  </div>
                ))}
              </details>
            ),
          },
        ]}
        rows={q.data?.items ?? []}
        emptyText={
          q.isLoading ? 'Loading history…' : 'No recorded changes yet.'
        }
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!q.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </Panel>
  );
}
