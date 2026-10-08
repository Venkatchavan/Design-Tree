import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi, employeesApi, usersApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill, { statusTone } from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

function OwnerDatesModal({ project, mode, onClose }) {
  const queryClient = useQueryClient();
  const [owner, setOwner] = useState(project.owner ?? '');
  const [startDate, setStartDate] = useState((project.startDate ?? '').slice(0, 10));
  const [expectedCompletion, setExpectedCompletion] = useState(
    (project.expectedCompletion ?? '').slice(0, 10),
  );
  const [actualCompletion, setActualCompletion] = useState(
    (project.actualCompletion ?? '').slice(0, 10),
  );

  const save = useMutation({
    mutationFn: (body) => projectsApi.update(project._id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project._id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'owner') save.mutate({ owner });
    else {
      save.mutate({
        startDate: startDate || null,
        expectedCompletion: expectedCompletion || null,
        actualCompletion: actualCompletion || null,
      });
    }
  }

  return (
    <Modal title={mode === 'owner' ? 'Change owner' : 'Edit dates'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {mode === 'owner' ? (
          <div className="form-row">
            <label className="form-label" htmlFor="pd-owner">Owner</label>
            <input
              id="pd-owner"
              className="form-input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-start">Start date</label>
              <input
                id="pd-start"
                className="form-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-exp">Expected completion</label>
              <input
                id="pd-exp"
                className="form-input"
                type="date"
                value={expectedCompletion}
                onChange={(e) => setExpectedCompletion(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pd-act">Actual completion</label>
              <input
                id="pd-act"
                className="form-input"
                type="date"
                value={actualCompletion}
                onChange={(e) => setActualCompletion(e.target.value)}
              />
            </div>
          </>
        )}
        {save.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {save.error.message}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}

// Contacts arrive as objects ({name, company, email, ...}) from the API
// or as plain strings from the New Project form — render either safely.
// (Raw objects used to crash this page: objects are not valid React children.)
function contactText(c) {
  if (!c) return c;
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    return [c.name, c.company, c.email, c.phone].filter(Boolean).join(' · ') || '—';
  }
  return String(c);
}

function DirectoryPreview({ projectId }) {
  const dirQ = useQuery({
    queryKey: ['directory', projectId],
    queryFn: () => projectsApi.directory(projectId),
    retry: false,
  });
  if (dirQ.isLoading) return <EmptyState text="Loading directory…" />;
  if (dirQ.isError) return null;
  const sections = dirQ.data?.item?.sections ?? [];
  if (sections.length === 0) return <EmptyState text="No directory sections yet." />;
  return (
    <DataTable
      columns={[
        { key: 'title', label: 'Section' },
        {
          key: 'body',
          label: 'Content',
          render: (r) => (
            <span style={{ whiteSpace: 'pre-wrap' }}>{String(r.body ?? '').slice(0, 220) || '—'}</span>
          ),
        },
      ]}
      rows={sections}
      emptyText="No directory sections yet."
    />
  );
}

function PortalAccessPanel({ projectId, initialIds, isAdmin }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState((initialIds ?? []).map(String));
  const [saved, setSaved] = useState(false);

  const usersQ = useQuery({
    queryKey: ['users-portal', projectId],
    queryFn: () => usersApi.list({}),
    enabled: isAdmin,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (userIds) => projectsApi.setPortalUsers(projectId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSaved(true);
    },
  });

  if (!isAdmin) return null;
  const users = usersQ.data?.items ?? usersQ.data ?? [];
  const external = users.filter((u) => u.role === 'client' || u.role === 'architect');

  function toggle(uid) {
    setSaved(false);
    setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-label">Directory access — Client / Architect portal</div>
      {usersQ.isLoading ? (
        <EmptyState text="Loading users…" />
      ) : usersQ.isError ? (
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {usersQ.error.message}
        </div>
      ) : external.length === 0 ? (
        <EmptyState text="No client / architect logins yet — create them in HR / Users first." />
      ) : (
        <>
          {external.map((u) => {
            const uid = String(u._id ?? u.id);
            return (
              <label key={uid} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                <input type="checkbox" checked={selected.includes(uid)} onChange={() => toggle(uid)} />
                {u.name ?? u.email} ({u.role})
              </label>
            );
          })}
          {save.isError && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {save.error.message}
            </div>
          )}
          <button
            type="button"
            className="approve-btn"
            disabled={save.isPending}
            onClick={() => save.mutate(selected)}
            style={{ marginTop: 8 }}
          >
            {save.isPending ? 'Saving…' : 'Save portal access'}
          </button>
          {saved && <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Portal access saved.</p>}
        </>
      )}
    </div>
  );
}

export default function ProjectDetailPage({ bootstrap }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [spocId, setSpocId] = useState('');

  const q = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });
  const role = bootstrap?.role?.key ?? '';
  const isSuper = role === 'founding_director' || role === 'working_director';
  const isAdmin = role === 'admin_billing' || isSuper;

  const employees = useQuery({
    queryKey: ['employees-spoc', id],
    queryFn: () => employeesApi.list({}),
    enabled: isAdmin,
    retry: false,
  });
  const activate = useMutation({
    mutationFn: (body) => projectsApi.activate(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] });
      setSpocId('');
    },
  });

  if (q.isLoading) return <EmptyState text="Loading project…" />;
  if (q.isError) {
    return (
      <>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="login-error" role="alert" style={{ display: 'block' }}>
          {q.error.message}
        </div>
      </>
    );
  }

  const project = q.data?.project ?? {};
  const scope = project.scope ?? [];
  const totalFee = scope.reduce((s, r) => s + (Number(r.fee) || 0), 0);
  const contacts = project.contacts ?? {};
  const billing = contacts.billing ?? {};
  const ptls = project.principalTeamLeads ?? [];
  const loc = project.location ?? {};
  const related = project.related ?? {};

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className="page-head">
        <div className="page-title">{project.name ?? '—'}</div>
        <div className="page-sub">
          {[project.code, project.branch, project.clientName].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <StatusPill tone={statusTone(project.status)}>{project.status ?? '—'}</StatusPill>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            {project.completion != null ? `${project.completion}% complete` : 'Completion —'}
          </span>
        </div>
      </div>

      <Tabs tabs={[{ key: 'overview', label: 'Overview' }]} active="overview" onChange={() => {}} />

      <Panel title="Status">
        <div className="field-grid">
          <Field label="Status" value={project.status} />
          <Field label="Completion" value={project.completion != null ? `${project.completion}%` : null} />
          <Field label="Current stage" value={project.currentStage} />
          <Field label="Project type" value={project.projectType} />
        </div>
      </Panel>

      <Panel title="Details">
        <div className="field-grid">
          <Field label="Name" value={project.name} />
          <Field label="Code" value={project.code} mono />
          <Field label="State" value={project.state} />
          <Field label="Branch" value={project.branch} />
          <Field label="Used for" value={project.usedFor} />
          <Field label="Entity" value={project.entityName} />
          <Field label="Job number" value={project.jobNumber} mono />
          <Field label="Location" value={loc.label} />
          <Field label="Address" value={[loc.address1, loc.address2].filter(Boolean).join(', ')} />
          <Field label="City" value={loc.city} />
          <Field label="ZIP" value={loc.zip} mono />
        </div>
        {project.description && (
          <div style={{ marginTop: 8 }}>
            <Field label="Description" value={project.description} />
          </div>
        )}
        {project.requirements && (
          <div style={{ marginTop: 8 }}>
            <Field label="Project requirements" value={project.requirements} />
          </div>
        )}
        {project.complexity && (
          <div style={{ marginTop: 8 }}>
            <Field label="Complexity" value={project.complexity} />
          </div>
        )}
      </Panel>

      <Panel title="Activation & approvals">
        <div className="field-grid">
          <Field label="Activation" value={project.activation?.status} />
          <Field label="Activated at" value={project.activation?.activatedAt ? fmtDate(project.activation.activatedAt) : null} />
          <Field label="Team confirmation" value={project.teamConfirmation?.status} />
          <Field label="Shared to Admin" value={project.teamConfirmation?.sharedToAdminAt ? fmtDate(project.teamConfirmation.sharedToAdminAt) : null} />
          <Field label="Final approval" value={project.finalApproval?.status} />
        </div>
        {(project.teamConfirmation?.disciplines?.length ?? 0) > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label">Confirmed team (DMH)</div>
            <DataTable
              columns={[
                { key: 'discipline', label: 'Discipline' },
                { key: 'spoc', label: 'SPOC' },
                { key: 'ptlTl', label: 'PTL / TL' },
                { key: 'detail', label: 'Detail' },
              ]}
              rows={project.teamConfirmation.disciplines}
              emptyText="No confirmed disciplines."
            />
          </div>
        )}
        {isAdmin && project.activation?.status !== 'Activated' && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label">Admin activation — assign confirmed SPOC</div>
            <div className="form-row" style={{ maxWidth: 360 }}>
              <label className="form-label" htmlFor="pd-spoc">SPOC (coordinator)</label>
              <select
                id="pd-spoc"
                className="filter-select"
                value={spocId}
                onChange={(e) => setSpocId(e.target.value)}
              >
                <option value="">Select…</option>
                {((employees.data?.items ?? employees.data ?? [])).map((e) => (
                  <option key={e._id ?? e.id} value={e._id ?? e.id}>
                    {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.empId || e.email} ({e.empId ?? '—'})
                  </option>
                ))}
              </select>
            </div>
            {activate.isError && (
              <div className="login-error" role="alert" style={{ display: 'block' }}>
                {activate.error.message}
              </div>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={activate.isPending}
              onClick={() => activate.mutate(spocId ? { coordinator: spocId } : {})}
            >
              {activate.isPending ? 'Activating…' : 'Activate project'}
            </button>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              Activation assigns the SPOC and opens the SPOC workspace. Re-activation re-confirms.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Project Directory">
        <DirectoryPreview projectId={id} />
        <PortalAccessPanel
          projectId={id}
          initialIds={project.portalUsers ?? []}
          isAdmin={isAdmin}
        />
      </Panel>

      <Panel title="Work order">
        {scope.length === 0 ? (
          <EmptyState text="No scope rows recorded for this project." />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'scope', label: 'Scope' },
                { key: 'fee', label: 'Fee', render: (r) => (r.fee ?? '—') },
              ]}
              rows={scope}
              emptyText="No scope rows recorded for this project."
            />
            <p style={{ fontSize: 13, marginTop: 10 }}>
              Total fee: <b className="mono">{totalFee}</b>
            </p>
          </>
        )}
      </Panel>

      <Panel title="Contacts">
        <div className="field-grid">
          <Field label="Client" value={contactText(contacts.client)} />
          <Field label="Architect" value={contactText(contacts.architect)} />
          <Field label="PMC" value={contactText(contacts.pmc)} />
          <Field label="Peer review" value={contactText(contacts.peerReview)} />
          <Field label="Billing contact" value={billing.name} />
          <Field label="Billing salutation" value={billing.salutation} />
          <Field label="Billing designation" value={billing.designation} />
          <Field label="Billing company" value={billing.company} />
          <Field label="Billing phone" value={billing.phone} />
          <Field label="Billing email" value={billing.email} />
        </div>
      </Panel>

      <Panel title="Scope & services">
        {scope.length === 0 ? (
          <EmptyState text="No scope & services data yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'scope', label: 'Scope' },
              { key: 'fee', label: 'Fee' },
            ]}
            rows={scope}
            emptyText="No scope & services data yet."
          />
        )}
      </Panel>

      <Panel title="BIM work order">
        {!project.bimWorkOrder ? (
          <EmptyState text="No BIM work order for this project." />
        ) : (
          <div className="field-grid">
            <Field label="Scope" value={project.bimWorkOrder.scope} />
            <Field label="Fee" value={project.bimWorkOrder.fee} />
            <Field label="Description" value={project.bimWorkOrder.description} />
          </div>
        )}
      </Panel>

      <Panel title="Owner & dates">
        <div className="field-grid">
          <Field label="Owner" value={project.owner} />
          <Field label="Start date" value={fmtDate(project.startDate)} />
          <Field label="Expected completion" value={fmtDate(project.expectedCompletion)} />
          <Field label="Actual completion" value={fmtDate(project.actualCompletion)} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" className="approve-btn" onClick={() => setModal('owner')}>
            Change owner
          </button>
          <button type="button" className="approve-btn" onClick={() => setModal('dates')}>
            Edit dates
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="section-label">Related</div>
          <div className="field-grid">
            <Field label="Project director" value={related.projectDirector} />
            <Field label="Director designation" value={related.projectDirectorDesignation} />
            <Field label="Project head" value={related.projectHead} />
            <Field label="Head designation" value={related.projectHeadDesignation} />
          </div>
        </div>
      </Panel>

      <Panel title="Principal team leads">
        {ptls.length === 0 ? (
          <EmptyState text="No principal team leads assigned yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'name', label: 'Name' },
            ]}
            rows={ptls}
            emptyText="No principal team leads assigned yet."
          />
        )}
      </Panel>

      {modal && (
        <OwnerDatesModal project={project} mode={modal} onClose={() => setModal(null)} />
      )}
    </>
  );
}
