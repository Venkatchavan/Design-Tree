import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi } from '../lib/api.js';
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

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);

  const q = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });

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
