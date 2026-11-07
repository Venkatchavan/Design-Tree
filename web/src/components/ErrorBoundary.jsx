import { Component } from 'react'

// Without a boundary, one render exception unmounts the whole React tree and the
// user is left on a blank white page. This catches it, shows what failed, and lets
// them retry. `scope="page"` keeps the sidebar/topbar alive; the default fills the screen.

const CHUNK_ERROR = /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i
const RELOAD_KEY = 'dt-chunk-reload-at'

function reloadedRecently() {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    return Date.now() - at < 30000
  } catch {
    return true // storage unavailable: never auto-reload, avoids any loop
  }
}

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('DesignTree render error:', error, info?.componentStack)
    // A page chunk that no longer exists means a new version was deployed under an
    // open tab. One automatic reload picks up the new files; never repeat it.
    if (CHUNK_ERROR.test(String(error?.message ?? '')) && !reloadedRecently()) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      window.location.reload()
    }
  }

  componentDidUpdate(prev) {
    // Navigating to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const page = this.props.scope === 'page'
    return (
      <div
        role="alert"
        style={{
          padding: page ? '32px 24px' : 24,
          minHeight: page ? undefined : '100vh',
          display: 'flex',
          alignItems: page ? 'flex-start' : 'center',
          justifyContent: 'center',
          background: page ? 'transparent' : '#f5f6fa',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            background: '#fff',
            border: '1px solid #e1e4eb',
            borderRadius: 14,
            padding: '28px 28px 24px',
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>This page hit a problem</h2>
          <p style={{ color: '#5c6470', marginBottom: 12 }}>
            Nothing has been lost. Try again, and if it keeps happening send the message below to the
            DesignTree team.
          </p>
          <pre
            style={{
              fontSize: 12,
              background: '#f5f6fa',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 140,
              overflow: 'auto',
            }}
          >
            {String(error?.message ?? error)}
          </pre>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-primary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button type="button" className="approve-btn" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
