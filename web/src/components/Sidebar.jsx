import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import SignOutButton from './SignOutButton.jsx';

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Sidebar({
  nav,
  activeView,
  user,
  roleLabel,
  roleKey,
  onLogout,
  logoutPending,
}) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">D</div>
        <div className="brand-name">DesignTree</div>
      </div>
      <nav className="nav">
        {nav.map((item, i) => (
          <button
            key={`${item.view}-${i}`}
            type="button"
            className={`nav-item${item.view === activeView ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">{initials(user.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-footer-name">{user.name}</div>
          <div className="sidebar-footer-role">{roleLabel}</div>
        </div>
        {roleKey ? (
          <SignOutButton user={user} roleKey={roleKey} />
        ) : (
          <button
            type="button"
            className="nav-item"
            style={{ width: 'auto', padding: 8 }}
            title="Sign out"
            onClick={onLogout}
            disabled={logoutPending}
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
    </aside>
  );
}
