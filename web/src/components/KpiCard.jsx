export default function KpiCard({
  label,
  value,
  accent,
  onClick,
  open,
  children,
}) {
  const cls = `kpi-card${accent ? ` accent-${accent}` : ''}${onClick ? ' clickable' : ''}${open ? ' open' : ''}`;
  const inner = (
    <>
      <div className="kpi-label">
        {label}
        {onClick && <span className="kpi-caret" aria-hidden="true" />}
      </div>
      <div className="kpi-value plain">{value}</div>
      {children && (
        <div className="kpi-drop" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </>
  );
  if (onClick) {
    return (
      <div
        className={cls}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick(e);
        }}
      >
        {inner}
      </div>
    );
  }
  return <div className={cls}>{inner}</div>;
}
