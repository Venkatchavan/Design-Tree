import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutApi } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';

const COLLAPSE_KEY = 'dt-sidebar-collapsed';

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
      <div className="main">
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
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
