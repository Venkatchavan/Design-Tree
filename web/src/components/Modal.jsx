export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className={`modal-box${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          <button
            type="button"
            className="approve-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
