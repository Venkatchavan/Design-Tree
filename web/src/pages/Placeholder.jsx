import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { logoutApi } from '../lib/api.js';

export default function Placeholder({ user }) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      // Drop cached auth immediately so the UI flips to login at once.
      // (A refetch here would just 401 against the cleared cookie.)
      queryClient.setQueryData(['me'], null);
    },
  });

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-main" style={{ gridColumn: '1 / -1' }}>
          <div className="login-title">Welcome, {user.name}</div>
          <div className="login-sub">
            Signed in as {user.email} · role: {user.role}
          </div>
          <button
            type="button"
            className="login-btn"
            style={{
              width: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
            }}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={16} />
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
