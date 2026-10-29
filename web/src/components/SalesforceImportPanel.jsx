import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Panel from './Panel.jsx';
import EmptyState from './EmptyState.jsx';
import { salesforceApi } from '../lib/api.js';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ResultRow({ item, onSelect }) {
  const imported = item.existingProject;
  const name = item.prefill?.name || '(no name)';
  const code = item.prefill?.code || 'No code';
  const branch = item.prefill?.branch;
  const services = item.prefill?.services ?? [];
  const warnings = item.warnings?.length ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 240, flex: '1 1 320px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 13.5 }}>{name}</b>
          <span className="status-pill neutral">{code}</span>
          {item.source?.usedFor ? (
            <span className="status-pill blueprint">{item.source.usedFor}</span>
          ) : null}
          {imported ? (
            <span className="status-pill amber">Already imported</span>
          ) : null}
          {warnings > 0 ? (
            <span className="status-pill amber">
              {warnings} warning{warnings === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        <div className="page-sub" style={{ marginTop: 4 }}>
          {[branch || 'No matching branch', services.join(', ') || 'No services']
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div className="page-sub" style={{ marginTop: 2, fontSize: 12 }}>
          {[
            imported
              ? `Datum project ${imported.code}`
              : 'Not imported yet',
            item.source?.lastModifiedAt
              ? `Salesforce updated ${formatDate(item.source.lastModifiedAt)}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {item.source?.url ? (
          <a
            className="approve-btn"
            href={item.source.url}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            Open in Salesforce
          </a>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={Boolean(imported)}
          title={imported ? 'This Salesforce project is already in Datum.' : undefined}
          onClick={() => onSelect(item)}
        >
          {imported ? 'Imported' : 'Use this project'}
        </button>
      </div>
    </div>
  );
}

export default function SalesforceImportPanel({ selected, onSelect, onClear }) {
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [includeProposals, setIncludeProposals] = useState(false);

  const statusQ = useQuery({
    queryKey: ['salesforce-status'],
    queryFn: salesforceApi.status,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const searchQ = useQuery({
    queryKey: ['salesforce-projects', submitted, includeProposals],
    queryFn: () => salesforceApi.search({ q: submitted, includeProposals }),
    enabled: submitted.length >= 2,
    retry: false,
  });

  const configured = statusQ.data?.configured === true;
  const statusError = statusQ.isError ? statusQ.error.message : '';
  const items = searchQ.data?.items ?? [];

  function submitSearch(event) {
    event.preventDefault();
    const value = term.trim();
    if (value.length < 2) return;
    setSubmitted(value);
  }

  if (statusQ.isLoading) {
    return (
      <Panel title="Import from Salesforce">
        <span className="page-sub">Checking the Salesforce connection…</span>
      </Panel>
    );
  }

  if (statusError || (!configured && !statusQ.isLoading)) {
    return (
      <Panel
        title="Import from Salesforce"
        sub="Read-only lookup of Salesforce projects. Nothing is written back to Salesforce."
      >
        <div className="page-sub">
          {statusError
            ? `Could not check the Salesforce connection: ${statusError}`
            : 'Salesforce is not connected on this server. Ask your administrator to configure the integration before importing projects.'}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Import from Salesforce"
      sub="Search the commercial project master and prefill this form. Salesforce-owned fields are copied; workflow fields stay in Datum."
    >
      {selected ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '10px 12px',
            marginBottom: 14,
            borderRadius: 8,
            background: 'var(--surface-alt)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13 }}>
            <b>Prefilled from Salesforce</b>
            {selected.source?.projectCode ? ` · ${selected.source.projectCode}` : ''}
            {selected.source?.lastModifiedAt
              ? ` · updated ${formatDate(selected.source.lastModifiedAt)}`
              : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selected.source?.url ? (
              <a
                className="approve-btn"
                href={selected.source.url}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none' }}
              >
                Open record
              </a>
            ) : null}
            <button type="button" className="approve-btn" onClick={onClear}>
              Clear prefill
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 280px' }}>
          <label className="form-label" htmlFor="sf-search">Project name, code, customer or entity</label>
          <input
            id="sf-search"
            className="form-input"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="e.g. PRJ-00428 or Business park"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={term.trim().length < 2 || searchQ.isFetching}>
          {searchQ.isFetching ? 'Searching…' : 'Search Salesforce'}
        </button>
      </form>

      <label
        className="form-label"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}
      >
        <input
          type="checkbox"
          checked={includeProposals}
          onChange={(event) => setIncludeProposals(event.target.checked)}
        />
        Include proposals (records without a work order)
      </label>

      {searchQ.isError ? (
        <div
          className="login-error"
          role="alert"
          style={{ display: 'block', marginTop: 12 }}
        >
          {searchQ.error.message}
        </div>
      ) : null}

      {submitted && !searchQ.isFetching && !searchQ.isError ? (
        items.length === 0 ? (
          <div style={{ marginTop: 12 }}>
            <EmptyState text={`No Salesforce projects match “${submitted}”.`} />
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <span className="page-sub">
              {items.length} match{items.length === 1 ? '' : 'es'}
              {includeProposals ? '' : ' · work orders only'}
            </span>
            {items.map((item) => (
              <ResultRow key={item.source.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        )
      ) : null}
    </Panel>
  );
}
