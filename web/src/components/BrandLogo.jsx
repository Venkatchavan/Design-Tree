export default function BrandLogo({ showName = true, className = '', label = 'DesignTree Service Consultants Pvt Ltd' }) {
  return (
    <span className={`dt-logo${showName ? '' : ' is-compact'} ${className}`} aria-label={label}>
      <img
        src="/logo.png"
        alt={label}
        className="dt-logo-img"
        draggable="false"
      />
    </span>
  );
}
