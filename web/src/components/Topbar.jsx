import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';
import NotifBell from './NotifBell.jsx';
import SignOutButton from './SignOutButton.jsx';
import { projectsApi } from '../lib/api.js';

export default function Topbar({
  crumbs,
  user,
  roleKey,
  canSearch,
  onLogout,
  logoutPending,
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const searchQuery = useQuery({
    queryKey: ['topbar-search', debounced],
    queryFn: () => projectsApi.list({ search: debounced }),
    enabled: !!canSearch && debounced.length >= 2,
    staleTime: 30000,
  });

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const items = searchQuery.data?.items ?? [];
  const total = searchQuery.data?.total ?? items.length;
  const showDropdown = !!canSearch && open && debounced.length >= 2;

  function goToProject(id) {
    setOpen(false);
    setQ('');
    setDebounced('');
    if (id) navigate(`/projects/${id}`);
  }

  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span> / </span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : c}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {canSearch && (
          <div className="topbar-search-wrap" ref={wrapRef}>
            <div className="search">
              <Search size={14} />
              <input
                className="topbar-search-input"
                placeholder="Search projects"
                aria-label="Search projects"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
            {showDropdown && (
              <div className="topbar-search-panel" role="listbox" aria-label="Project results">
                {searchQuery.isLoading ? (
                  <div className="topbar-search-empty">Searching…</div>
                ) : searchQuery.isError ? (
                  <div className="topbar-search-empty">
                    {searchQuery.error?.status === 403
                      ? 'No project access for your role.'
                      : (searchQuery.error?.message ?? 'Search failed.')}
                  </div>
                ) : items.length === 0 ? (
                  <div className="topbar-search-empty">No projects match “{debounced}”.</div>
                ) : (
                  <>
                    {items.slice(0, 8).map((p) => (
                      <div
                        key={String(p._id ?? p.id)}
                        className="topbar-search-row"
                        role="option"
                        aria-selected="false"
                        tabIndex={0}
                        onClick={() => goToProject(p._id ?? p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') goToProject(p._id ?? p.id);
                        }}
                      >
                        <div className="topbar-search-name">{p.name ?? '—'}</div>
                        <div className="topbar-search-meta">
                          {[p.code, p.branch, p.status].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ))}
                    {total > 8 && (
                      <div className="topbar-search-more">+{total - 8} more — refine your search</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <NotifBell />
        {roleKey ? (
          <SignOutButton user={user} roleKey={roleKey} className="notif-bell" />
        ) : (
          <button
            type="button"
            className="notif-bell"
            title="Sign out"
            aria-label="Sign out"
            onClick={onLogout}
            disabled={logoutPending}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
