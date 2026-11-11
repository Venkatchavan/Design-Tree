import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutApi } from '../lib/api.js';
import { disconnectSocket } from '../lib/realtime.js';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const COLLAPSE_KEY = 'dt-sidebar-collapsed';

// Compact fallbacks: a crash in the menu or top bar must not take the page down.
// The usual cause for the menu is a saved menu order that no longer fits, so
// "Reset menu" clears those saved orders before retrying.
function sidebarFallback({ error, retry }) {
  function resetMenu() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('dt-nav-order:')) localStorage.removeItem(key);
      }
    } catch {
      /* storage unavailable */
    }
    retry();
  }
  return (
    <aside className="sidebar" aria-label="Primary" role="alert" style={{ padding: 16 }}>
      <p style={{ fontSize: 13, marginBottom: 8 }}>The menu could not load.</p>
      <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 12, wordBreak: 'break-word' }}>{String(error?.message ?? error)}</p>
      <button type="button" className="approve-btn" onClick={resetMenu}>Reset menu</button>{' '}
      <button type="button" className="approve-btn" onClick={() => window.location.reload()}>Reload</button>
    </aside>
  );
}

function topbarFallback({ retry }) {
  return (
    <div className="topbar" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
      <span style={{ fontSize: 13 }}>The top bar could not load.</span>
      <button type="button" className="approve-btn" onClick={retry}>Try again</button>
      <button type="button" className="approve-btn" onClick={() => window.location.reload()}>Reload</button>
    </div>
  );
}

export default function AppShell({
  bootstrap,
  user,
  activeView,
  crumbs,
  children,
}) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      disconnectSocket();
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['bootstrap'] });
    },
  });

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastView, setLastView] = useState(activeView);
  if (lastView !== activeView) {
    setLastView(activeView);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Private mode: persist is best-effort only.
    }
  }, [collapsed]);

  // Escape closes the mobile drawer; lock body scroll while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleMenuClick = useCallback(() => {
    const isMobile = window.matchMedia('(max-width: 920px)').matches;
    if (isMobile) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }, []);

  return (
    <div className={`app${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-open' : ''}`}>
      <div
        className="sidebar-overlay"
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />
      <ErrorBoundary fallback={sidebarFallback}>
      <Sidebar
        nav={bootstrap.nav}
        activeView={activeView}
        user={user}
        roleLabel={bootstrap.role.label}
        roleKey={bootstrap.role.key}
        onLogout={() => logout.mutate()}
        logoutPending={logout.isPending}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onCollapse={() => setCollapsed((v) => !v)}
      />
      </ErrorBoundary>
      <div className="main">
        <ErrorBoundary fallback={topbarFallback}>
        <Topbar
          crumbs={crumbs}
          user={user}
          roleKey={bootstrap.role.key}
          canSearch={(bootstrap.nav ?? []).some((n) => n.view === 'dashboard')}
          onLogout={() => logout.mutate()}
          logoutPending={logout.isPending}
          onMenuClick={handleMenuClick}
          sidebarCollapsed={collapsed}
          sidebarOpen={mobileOpen}
        />
        </ErrorBoundary>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
