import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '../lib/api.js';
import Panel from '../components/Panel.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusPill from '../components/StatusPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';

function RenameModal({ branch, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(branch.name ?? '');
  const save = useMutation({
    mutationFn: (body) => branchesApi.update(branch._id ?? branch.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate({ name: name.trim() });
  }

  return (
    <Modal title={`Rename branch — ${branch.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label" htmlFor="br-rename">Branch name</label>
          <input
            id="br-rename"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {save.isError && (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {save.error.message}
          </div>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Renaming updates every project, employee and team using this branch.
        </p>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}

export default function BranchesPage({ bootstrap }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const canManage = (bootstrap?.role?.key ?? '') === 'admin_billing';

  const q = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchesApi.list(true),
  });
  const create = useMutation({
    mutationFn: (body) => branchesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
      setName('');
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => branchesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
    },
  });

  const items = q.data?.items ?? [];

  function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim() });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">Branches</div>
        <div className="page-sub">
          Branch master — every branch input across the app is a strict dropdown sourced from this list.
        </div>
      </div>

      {canManage && (
        <Panel title="Add branch">
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ maxWidth: 320 }}
              placeholder="e.g. Mumbai"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add branch'}
            </button>
          </form>
          {create.isError && (
            <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>
              {create.error.message}
            </div>
          )}
        </Panel>
      )}

      <Panel title={`Branches (${items.length})`}>
        {q.isLoading ? (
          <EmptyState text="Loading branches…" />
        ) : q.isError ? (
          <div className="login-error" role="alert" style={{ display: 'block' }}>
            {q.error.message}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Branch' },
              {
                key: 'isActive',
                label: 'Status',
                render: (r) => (
                  <StatusPill status={r.isActive ? 'Active' : 'Inactive'}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </StatusPill>
                ),
              },
              {
                key: 'projects',
                label: 'Projects',
                render: (r) => r.usage?.projects ?? '—',
              },
              {
                key: 'employees',
                label: 'Employees',
                render: (r) => r.usage?.employees ?? '—',
              },
              {
                key: 'teams',
                label: 'Teams',
                render: (r) => r.usage?.teams ?? '—',
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => {
                  if (!canManage) return '—';
                  const id = r._id ?? r.id;
                  return (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="approve-btn" onClick={() => setRenaming(r)}>
                        Rename
                      </button>
                      <button
                        type="button"
                        className="approve-btn"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id, isActive: !r.isActive })}
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  );
                },
              },
            ]}
            rows={items}
            emptyText={canManage ? 'No branches yet — add the first one above.' : 'No branches yet.'}
          />
        )}
        {toggle.isError && (
          <div className="login-error" role="alert" style={{ display: 'block', marginTop: 10 }}>
            {toggle.error.message}
          </div>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Deactivated branches disappear from every dropdown but stay on existing records.
        </p>
      </Panel>

      {canManage && renaming && (
        <RenameModal branch={renaming} onClose={() => setRenaming(null)} />
      )}
    </>
  );
}
