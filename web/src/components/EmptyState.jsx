export default function EmptyState({ text }) {
  return (
    <p style={{ color: 'var(--ink-muted)', fontSize: 13.5, padding: '8px 0' }}>
      {text ?? 'Nothing to show yet.'}
    </p>
  );
}
