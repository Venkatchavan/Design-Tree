export default function Field({ label, value, mono }) {
  const v = value === undefined || value === null || value === '' ? '—' : value;
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className={`field-value${mono ? ' mono' : ''}`}>{v}</div>
    </div>
  );
}
