export default function BrandLogo({ showName = true, className = '', label = 'DesignTree' }) {
  return (
    <span className={`dt-logo ${className}`} aria-label={label} role="img">
      <span className="dt-logo-mark" aria-hidden="true">
        D
      </span>
      {showName && <span className="dt-logo-name">{label}</span>}
    </span>
  );
}
