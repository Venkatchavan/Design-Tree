import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { marketingApi } from '../lib/phase4aApi.js';
function F({ label, children }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
export default function ContactPicker({
  label,
  contactType,
  value,
  onPick,
  onClear,
}) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    organization: '',
    phone: '',
    email: '',
  });
  const [err, setErr] = useState('');
  const searchQ = useQuery({
    queryKey: ['contact-search', q],
    queryFn: () => marketingApi.contacts.list({ search: q }),
    enabled: q.trim().length >= 2,
  });
  const create = useMutation({
    mutationFn: (body) => marketingApi.contacts.create(body),
    onSuccess: (data) => {
      onPick(data?.item ?? data);
      setAdding(false);
      setDraft({ name: '', organization: '', phone: '', email: '' });
      setErr('');
      setQ('');
    },
    onError: (e) => setErr(e.message),
  });

  if (value) {
    return (
      <div className="form-row">
        <label className="form-label">{label}</label>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <b>{value.name}</b>
            {value.organization ? ` · ${value.organization}` : ''}
            {value.phone ? ` · ${value.phone}` : ''}
          </span>
          <button type="button" className="approve-btn" onClick={onClear}>
            Change
          </button>
        </div>
      </div>
    );
  }
  if (adding) {
    return (
      <div className="form-row">
        <label className="form-label">{label} — new</label>
        <div className="field-grid">
          <F label="Name *">
            <input
              required
              className="form-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </F>
          <F label="Organization *">
            <input
              required
              className="form-input"
              value={draft.organization}
              onChange={(e) =>
                setDraft({ ...draft, organization: e.target.value })
              }
            />
          </F>
          <F label="Phone *">
            <input
              required
              className="form-input"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </F>
          <F label="Email">
            <input
              type="email"
              className="form-input"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </F>
        </div>
        {err && (
          <div
            className="login-error"
            role="alert"
            style={{ display: 'block' }}
          >
            {err}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={
              create.isPending ||
              !draft.name.trim() ||
              !draft.organization.trim() ||
              !draft.phone.trim()
            }
            onClick={() =>
              create.mutate({
                type: contactType,
                name: draft.name.trim(),
                organization: draft.organization.trim(),
                phone: draft.phone.trim(),
                email: draft.email.trim() || undefined,
              })
            }
          >
            {create.isPending ? 'Saving…' : 'Save contact'}
          </button>
          <button
            type="button"
            className="approve-btn"
            onClick={() => setAdding(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  const hits = searchQ.data?.items ?? arr(searchQ.data);
  function arr(v) {
    return Array.isArray(v) ? v : (v?.items ?? []);
  }
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="Search Contacts..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="approve-btn"
          onClick={() => {
            setAdding(true);
            setDraft((d) => ({ ...d, name: q }));
          }}
        >
          Add
        </button>
      </div>
      {q.trim().length >= 2 && (
        <div className="location-results">
          {searchQ.isLoading ? (
            <div className="location-result-row">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="location-result-row">
              No matches — use Add to create it.
            </div>
          ) : (
            hits.slice(0, 8).map((c) => (
              <div
                key={c._id ?? c.id}
                className="location-result-row"
                role="button"
                tabIndex={0}
                onClick={() => {
                  onPick({
                    company: c.organization,
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                  });
                  setQ('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onPick({
                      company: c.organization,
                      name: c.name,
                      phone: c.phone,
                      email: c.email,
                    });
                    setQ('');
                  }
                }}
              >
                <b>{c.name}</b>
                {c.organization ? ` · ${c.organization}` : ''}
                {c.phone ? ` · ${c.phone}` : ''}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
