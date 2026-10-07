const TONES = ['forest', 'blueprint', 'amber', 'rust', 'violet', 'teal', 'neutral'];

export function statusTone(status) {
  const s = String(status ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (['active', 'approved', 'present', 'inprogress', 'in-progress', 'ongoing'].includes(s)) return 'forest';
  if (['ontrack', 'on-track', 'submitted', 'pendingapproval'].includes(s)) return 'teal';
  if (['completed', 'complete', 'done', 'billed', 'paid'].includes(s)) return 'blueprint';
  if (['onhold', 'on-hold', 'pending', 'onleave', 'leave', 'review'].includes(s)) return 'amber';
  if (['delayed', 'overdue', 'rejected', 'cancelled', 'canceled', 'exited', 'inactive'].includes(s)) return 'rust';
  if (['draft', 'new', 'lead'].includes(s)) return 'violet';
  return 'neutral';
}

export default function StatusPill({ tone, status, children }) {
  const t = TONES.includes(tone) ? tone : statusTone(status ?? children);
  return <span className={`status-pill ${t}`}>{children ?? status ?? '—'}</span>;
}
