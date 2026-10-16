import useOnlineStatus from '../hooks/useOnlineStatus.js'

export default function OfflineGate({ children }) {
  const online = useOnlineStatus()

  if (online) return children

  return (
    <>
      {children}
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f5f6fa',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e1e4eb',
            borderRadius: 14,
            padding: '32px 28px',
          }}
        >
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>📡</div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>No internet connection</h1>
          <p style={{ color: '#5c6470', marginBottom: 20 }}>
            Please check your internet connection. DesignTree needs to be online —
            all functionality is paused until you reconnect.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#1d68d6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    </>
  )
}
