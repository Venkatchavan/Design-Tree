import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { metaApi } from '../lib/api.js';
import Modal from './Modal.jsx';

export default function LocationModal({ onSave, onClose }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [manual, setManual] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [fullAddress, setFullAddress] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const geoQ = useQuery({
    queryKey: ['geocode', debounced],
    queryFn: () => metaApi.geocode(debounced),
    enabled: debounced.length >= 3,
    retry: false,
  });
  const hits = geoQ.data?.items ?? [];

  return (
    <Modal title="Set project location" onClose={onClose} wide>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
        Search for the project / site location — no need to paste a Google Maps link
      </p>
      <div className="form-row">
        <label className="form-label">Search location</label>
        <input
          className="form-input"
          placeholder="e.g. Whitefield, Bengaluru"
          value={q}
          onChange={(e) => { setQ(e.target.value); setManual(false); }}
        />
      </div>
      {debounced.length >= 3 && (
        <div className="location-results">
          {geoQ.isLoading ? <div className="location-result-row">Searching…</div>
            : geoQ.isError ? <div className="location-result-row">Search is unavailable right now.</div>
              : hits.length === 0 ? <div className="location-result-row">No matches found.</div>
                : hits.map((h) => {
                    const sub = [h.address1, h.city, h.state, h.zip].filter(Boolean).join(', ');
                    return (
                      <div
                        key={`${h.label}-${sub}`}
                        className="location-result-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => onSave(h)}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSave(h); }}
                      >
                        <b>{h.label || '—'}</b>
                        {sub && (
                          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{sub}</div>
                        )}
                      </div>
                    );
                  })}
        </div>
      )}
      <p style={{ fontSize: 13, marginTop: 12 }}>
        Can&apos;t find it? Enter the site address manually.
      </p>
      {!manual ? (
        <button type="button" className="approve-btn" onClick={() => setManual(true)}>Custom address</button>
      ) : (
        <>
          <div className="form-row">
            <label className="form-label">Custom address</label>
            <input className="form-input" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Whitefield, Bengaluru" />
          </div>
          <div className="form-row">
            <label className="form-label">Full project / site address</label>
            <textarea className="form-input" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} />
          </div>
        </>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Location search © OpenStreetMap contributors</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {manual && (
          <button
            type="button"
            className="btn-primary"
            disabled={!customLabel.trim()}
            onClick={() => onSave({ label: customLabel.trim(), address1: fullAddress.trim(), address2: '', city: '', state: '', zip: '' })}
          >
            Save Location
          </button>
        )}
        <button type="button" className="approve-btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
