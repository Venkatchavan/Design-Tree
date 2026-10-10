import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutApi } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';

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

  return (
    <div className="app">
      <Sidebar
        nav={bootstrap.nav}
        activeView={activeView}
        user={user}
        roleLabel={bootstrap.role.label}
        roleKey={bootstrap.role.key}
        onLogout={() => logout.mutate()}
        logoutPending={logout.isPending}
      />
      <div className="main">
        <Topbar
          crumbs={crumbs}
          user={user}
          roleKey={bootstrap.role.key}
          canSearch={(bootstrap.nav ?? []).some((n) => n.view === 'dashboard')}
          onLogout={() => logout.mutate()}
          logoutPending={logout.isPending}
        />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
