import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../lib/phase4bApi.js';

function timeAgo(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toISOString().slice(0, 10);
}

export default function NotifBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 60000,
  });

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? items.filter((n) => !n.read).length;

  const readOne = useMutation({
    mutationFn: (id) => notificationsApi.read(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
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

  function handleItem(n) {
    const id = n.id ?? n._id;
    if (!n.read && id) readOne.mutate(id);
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell bell"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && <span className="notif-badge badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel panel">
          <div className="notif-panel-head head">
            <span>Notifications{unread > 0 ? ` (${unread})` : ''}</span>
            {items.length > 0 && (
              <button
                type="button"
                className="notif-markall"
                disabled={readAll.isPending}
                onClick={() => readAll.mutate()}
              >
                {readAll.isPending ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>
          {q.isLoading ? (
            <div className="notif-empty empty">Loading…</div>
          ) : q.isError ? (
            <div className="notif-empty empty">{q.error.message}</div>
          ) : items.length === 0 ? (
            <div className="notif-empty empty">No notifications.</div>
          ) : (
            <div className="notif-list list">
              {items.map((n, i) => (
                <div
                  key={String(n.id ?? n._id ?? i)}
                  className={`notif-item item${n.read ? '' : ' unread'}`}
                  onClick={() => handleItem(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleItem(n);
                  }}
                >
                  <div className="notif-item-title">{n.title ?? '—'}</div>
                  {n.detail && <div className="notif-item-detail">{n.detail}</div>}
                  <div className="notif-item-time">{timeAgo(n.at ?? n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
