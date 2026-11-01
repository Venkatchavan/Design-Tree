import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { getToasts, subscribe, toast } from '../lib/toast.js';

const SWIPE_DISTANCE = 80; // px
const SWIPE_VELOCITY = 0.48; // px per ms (= 480 px/s)

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function Icon({ type }) {
  if (type === 'success') {
    return (
      <svg className="dt-toast-check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5 9.8 17.2 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const Cmp = type === 'error' ? CircleAlert : type === 'warning' ? TriangleAlert : Info;
  return <Cmp size={18} strokeWidth={2} aria-hidden="true" />;
}

function ToastItem({ t }) {
  const ref = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const remaining = useRef(t.duration);
  const startedAt = useRef(0);
  const drag = useRef(null);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // A changed toast (same id, or a repeat) gets a fresh full duration.
  useEffect(() => {
    remaining.current = t.duration;
  }, [t.rev, t.duration]);

  // Auto-dismiss. Pauses while hovered/focused/dragged or the tab is hidden,
  // and resumes with only the time that was left.
  const paused = hovering || dragging || hidden;
  useEffect(() => {
    if (t.duration <= 0 || t.leaving || paused) return undefined;
    startedAt.current = Date.now();
    const id = setTimeout(() => toast.dismiss(t.id), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [t.id, t.rev, t.duration, t.leaving, paused]);

  // ---- swipe to dismiss (horizontal; mouse, touch and pen) ----
  function onPointerDown(e) {
    if (prefersReducedMotion() || t.leaving) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    drag.current = { x: e.clientX, dx: 0, last: e.clientX, lastT: e.timeStamp, v: 0 };
    ref.current?.setPointerCapture?.(e.pointerId);
    setDragging(true);
    if (ref.current) ref.current.style.transition = 'none';
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d || !ref.current) return;
    d.dx = e.clientX - d.x;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientX - d.last) / dt;
    d.last = e.clientX;
    d.lastT = e.timeStamp;
    ref.current.style.transform = `translateX(${d.dx}px)`;
    ref.current.style.opacity = String(Math.max(0.35, 1 - Math.abs(d.dx) / 320));
  }
  function endDrag() {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    setDragging(false);
    if (!d || !el) return;
    const thrown = Math.abs(d.dx) > SWIPE_DISTANCE || Math.abs(d.v) > SWIPE_VELOCITY;
    el.style.transition = thrown
      ? 'transform 0.22s ease-out, opacity 0.22s ease-out'
      : 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease';
    if (thrown) {
      const dir = d.dx !== 0 ? Math.sign(d.dx) : Math.sign(d.v) || 1;
      el.style.transform = `translateX(${dir * Math.max(window.innerWidth * 0.6, 360)}px)`;
      el.style.opacity = '0';
      toast.dismiss(t.id);
    } else {
      el.style.transform = '';
      el.style.opacity = '';
    }
  }

  return (
    <div
      ref={ref}
      className={`dt-toast dt-toast--${t.type}${t.leaving ? ' is-leaving' : ''}${dragging ? ' is-dragging' : ''}`}
      role={t.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovering(false);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="dt-toast-icon">
        <Icon type={t.type} />
      </span>
      <div className="dt-toast-text">
        <div className="dt-toast-title" key={`title-${t.rev}`}>{t.title}</div>
        {t.description && <div className="dt-toast-desc" key={`desc-${t.rev}`}>{t.description}</div>}
      </div>
      {t.action && (
        <button
          type="button"
          className="dt-toast-action"
          onClick={() => {
            t.action.onClick?.();
            toast.dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        className="dt-toast-close"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(t.id)}
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ToastViewport() {
  const items = useSyncExternalStore(subscribe, getToasts, getToasts);
  return (
    <div className="dt-toast-viewport" role="region" aria-label="Notifications">
      {items.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
