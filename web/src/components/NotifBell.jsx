import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { meApi } from '../lib/api.js';
import { notificationsApi } from '../lib/phase4bApi.js';
import { subscribeNotifications } from '../lib/realtime.js';

// Deep-link map for notification click-through (bell only, 2A).
function pathForLink(link, role) {
  if (!link?.view) return null;
  switch (link.view) {
    case 'announcement':
      return link.id ? `/announcements/${link.id}` : '/announcements';
    case 'meeting':
      return `${['coordinator','design_mgmt_head'].includes(role) ? '/meetings' : '/meetings/mine'}${link.id ? `?meeting=${link.id}` : ''}`;
    case 'leave':
    case 'travel':
    case 'allowance':
      return '/leave-travel';
    case 'support':
      return '/support';
    case 'transmittal':
      return '/transmittals';
    case 'revision':
      return role === 'team_lead' ? '/my-team' : '/my-coordination';
    case 'stage-timeline':
      return link.id ? `/projects/${link.id}/stage-timeline` : '/dashboard';
    case 'project-detail':
    case 'dashboard':
      return link.id ? `/projects/${link.id}` : '/dashboard';
    case 'design-mgmt':
      return link.id ? `/projects/${link.id}` : '/design-management';
    case 'my-coordination':
      return '/my-coordination';
    // Assigned-work alerts (assigned, due soon, overdue).
    case 'my-work':
      if (role === 'coordinator') return '/my-coordination';
      return ['team_lead', 'assoc_technical_director'].includes(role) ? '/my-team' : '/my-work';
    case 'my-team':
      return '/my-team';
    default:
      return null;
  }
}

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
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    // Fallback when the live socket is down; the socket invalidates sooner.
    refetchInterval: 60000,
  });
  const meQ = useQuery({ queryKey: ['me'], queryFn: meApi });
  const myRole = meQ.data?.user?.role;

  // Live push (2A): any relevant notification refreshes the badge instantly.
  useEffect(
    () =>
      subscribeNotifications(() => {
        for (const key of ['notifications','announcements','meetings','meeting','project-stages','stage-approvals','billing-status-stages','my-teams','project-team','projects','projects-stats','projects-summary','spoc-allocations','spoc-assigned-projects','project']) queryClient.invalidateQueries({ queryKey: [key] });
      }),
    [queryClient],
  );

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? items.filter((n) => !n.read).length;

  // Bell swings when new notifications arrive (harder for several at once);
  // the count rolls to its new value and the badge shrinks away at zero.
  // State is adjusted during render (not in an effect) when the count changes.
  const [t, setT] = useState({ prev: null, shown: 0, swing: '', leaving: false });
  if (q.isSuccess && t.prev !== unread) {
    const prev = t.prev; // null on the first load: no swing
    setT({
      prev: unread,
      shown: unread > 0 ? unread : t.shown, // keep the last number while the badge shrinks out
      swing: prev !== null && unread > prev ? (unread - prev > 1 ? 'swing-strong' : 'swing') : '',
      leaving: unread === 0 && (prev ?? 0) > 0,
    });
  }
  const { swing, shown, leaving } = t;
  useEffect(() => {
    if (!t.swing && !t.leaving) return undefined;
    const id = setTimeout(
      () => setT((x) => ({ ...x, swing: '', leaving: false, shown: x.leaving ? 0 : x.shown })),
      t.leaving ? 240 : 1100,
    );
    return () => clearTimeout(id);
  }, [t.swing, t.leaving, t.prev]);

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
    const path = pathForLink(n.link, myRole);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`notif-bell bell${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span key={t.prev} className={`notif-bell-icon ${swing}`.trim()}>
          <Bell size={18} strokeWidth={1.7} fill="currentColor" />
        </span>
        {(unread > 0 || leaving) && (
          <span className={`notif-badge badge${leaving ? ' is-leaving' : ''}`} aria-hidden="true">
            <span className="notif-badge-num" key={shown}>
              {shown > 99 ? '99+' : shown}
            </span>
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel panel">
          <div className="notif-panel-head head">
            <span>
              Notifications
              {unread > 0 && <span className="notif-count">{unread} new</span>}
            </span>
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
