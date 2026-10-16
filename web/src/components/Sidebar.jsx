import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  ChartColumn,
  CircleDollarSign,
  ClipboardList,
  Cog,
  Crown,
  DraftingCompass,
  Droplets,
  Eye,
  FileCheck,
  Flame,
  FolderKanban,
  Gauge,
  GitBranch,
  Globe,
  Handshake,
  LayoutDashboard,
  Leaf,
  LifeBuoy,
  LogOut,
  Luggage,
  Megaphone,
  PanelLeftClose,
  PencilLine,
  Plane,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  UsersRound,
  UserCog,
  Video,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import SignOutButton from './SignOutButton.jsx';

function initials(name) {
  return (name ?? '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Claude/OpenAI-style rail: every nav entry gets a Lucide glyph.
// `dashboard` is reused for both "Dashboard" and "Projects", so the
// Projects entry is keyed off its label.
function navIcon(view, label) {
  if (label === 'Projects') return FolderKanban;
  switch (view) {
    case 'dashboard':
      return LayoutDashboard;
    case 'billing':
      return Receipt;
    case 'certificates':
      return BadgeCheck;
    case 'teams':
      return Users;
    case 'branches':
      return GitBranch;
    case 'hr':
      return UserCog;
    case 'work-progress':
      return Activity;
    case 'transmittal-log':
      return Send;
    case 'transmittal':
      return FileCheck;
    case 'design-mgmt':
      return DraftingCompass;
    case 'marketing':
      return Megaphone;
    case 'finance':
      return Wallet;
    case 'finance-hub':
      return Wallet;
    case 'finance-occ':
      return Gauge;
    case 'travel-booking':
      return Plane;
    case 'revenue-reports':
      return ChartColumn;
    case 'billing-status':
      return CircleDollarSign;
    case 'qaqc-specs':
      return ShieldCheck;
    case 'bim-head':
      return Boxes;
    case 'gbs-head':
      return Leaf;
    case 'peer-review-head':
      return Eye;
    case 'qs-head':
      return Calculator;
    case 'structural':
      return Building2;
    case 'mechanical':
      return Cog;
    case 'electrical':
      return Zap;
    case 'phe':
      return Droplets;
    case 'fire':
      return Flame;
    case 'project-portal':
      return Globe;
    case 'update-work-progress':
      return PencilLine;
    case 'admin-work-update':
      return ClipboardList;
    case 'leave-travel':
      return Luggage;
    case 'employee-support':
      return LifeBuoy;
    case 'management':
      return Crown;
    case 'my-team':
      return UsersRound;
    case 'my-coordination':
      return Handshake;
    case 'my-work':
      return Briefcase;
    case 'my-meetings':
      return Video;
    case 'meetings':
      return Video;
    case 'qs-log':
      return Calculator;
    case 'work-tracking':
      return Timer;
    case 'settings':
      return Settings;
    default:
      // Keeps role-specific labels (e.g. "BIM Head") on a sensible glyph.
      if (/meeting|calendar/i.test(label ?? '')) return CalendarDays;
      return LayoutDashboard;
  }
}

export default function Sidebar({
  nav,
  activeView,
  user,
  roleLabel,
  roleKey,
  onLogout,
  logoutPending,
  collapsed = false,
  mobileOpen = false,
  onClose,
  onCollapse,
}) {
  const navigate = useNavigate();
  const storageKey = `dt-nav-order:${roleKey ?? 'default'}:${user?._id ?? user?.id ?? user?.email ?? 'anon'}`;
  const [order, setOrder] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setOrder(raw ? JSON.parse(raw) : null);
    } catch {
      setOrder(null);
    }
  }, [storageKey]);

  const items = useMemo(() => {
    const base = nav ?? [];
    if (!order || order.length === 0) return base;
    const byKey = new Map(base.map((n, i) => [[n.view, n.label].join('|'), { n, i }]));
    const out = [];
    for (const k of order) {
      const hit = byKey.get(k);
      if (hit) { out.push(hit.n); byKey.delete(k); }
    }
    for (const [, v] of [...byKey.values()].sort((a, b) => a.i - b.i)) out.push(v.n);
    return out;
  }, [nav, order]);

  function persist(next) {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  }

  function move(from, to) {
    const keys = items.map((n) => `${n.view}|${n.label}`);
    const [k] = keys.splice(from, 1);
    keys.splice(to, 0, k);
    persist(keys);
  }

  function go(item) {
    navigate(item.path);
    onClose?.();
  }

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`}
      aria-label="Primary"
      aria-hidden={false}
    >
      <div className="brand">
        <BrandLogo showName={!collapsed} className="sidebar-logo" />
        <span className="brand-actions">
          {!collapsed && onCollapse && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={onCollapse}
            >
              <PanelLeftClose size={17} />
            </button>
          )}
          <button
            type="button"
            className="sidebar-close-btn"
            title="Close menu"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </span>
      </div>
      <nav className="nav">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 6px' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>Drag to rearrange</span>
          <button type="button" className="approve-btn" style={{ padding: '2px 8px', fontSize: 11, color: '#fff', background: '#2563eb', border: 'none' }} onClick={() => { try { localStorage.removeItem(storageKey); } catch {} setOrder(null); }}>
            Reset
          </button>
        </div>
        {items.map((item, i) => {
          const Icon = navIcon(item.view, item.label);
          const active = item.view === activeView;
          return (
            <div
              key={`${item.view}-${item.label}-${i}`}
              draggable
              onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}
              onTouchStart={() => setDragIdx(i)}
              onTouchEnd={() => setDragIdx(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: dragIdx === i ? 0.6 : 1 }}
            >
              <span aria-hidden="true" title="Drag to rearrange" style={{ cursor: 'grab', padding: '0 2px 0 6px', color: 'var(--ink-muted)', touchAction: 'none' }}>⠿</span>
              <button
                type="button"
                className={`nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => go(item)}
                style={{ flex: 1 }}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">{initials(user?.name ?? '?')}</div>
        <div className="sidebar-footer-text" style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-footer-name">{user?.name ?? ''}</div>
          <div className="sidebar-footer-role">{roleLabel}</div>
        </div>
        {roleKey ? (
          <SignOutButton user={user} roleKey={roleKey} className="nav-item sidebar-logout" />
        ) : (
          <button
            type="button"
            className="nav-item sidebar-logout"
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
