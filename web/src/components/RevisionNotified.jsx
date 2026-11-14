// 13 Nov 2026: who a revision was notified to automatically — the service's
// PTL / ATD / TD / AD on that project, plus every ED and Founding Director.
export default function RevisionNotified({ revision }) {
  const rows = revision?.autoNotified ?? [];
  if (!rows.length) return '—';
  return (
    <details>
      <summary style={{ cursor: 'pointer' }}>{rows.length} notified</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12.5 }}>
        {rows.map((n, i) => <li key={i}>{n.name || n.email || '—'} · {n.label}{n.service ? ` (${n.service})` : ''}</li>)}
      </ul>
    </details>
  );
}
