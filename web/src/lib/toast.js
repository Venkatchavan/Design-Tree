/**
 * Global toast store (no React, no dependencies).
 *
 *   import { toast } from '../lib/toast.js';
 *   toast.success('Changes saved');
 *   toast.error('Could not save', { description: err.message });
 *   toast({ id: 'upload', title: 'Uploading…', duration: 0 });   // persistent
 *   toast({ id: 'upload', title: 'Uploaded', type: 'success' }); // updates in place
 *
 * <ToastViewport /> (components/ToastViewport.jsx) renders whatever is here.
 */

const MAX_VISIBLE = 4;
const EXIT_MS = 200; // keep in step with the exit animation in index.css
const DUPLICATE_WINDOW_MS = 1000;
const DEFAULT_DURATION = { success: 4500, info: 4500, warning: 6000, error: 7000 };

let toasts = [];
let seq = 0;
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot for useSyncExternalStore: a new array only when something changed. */
export function getToasts() {
  return toasts;
}

function show(input) {
  const o = typeof input === 'string' ? { title: input } : { ...input };
  const type = DEFAULT_DURATION[o.type] ? o.type : 'info';
  const duration = o.duration ?? DEFAULT_DURATION[type];
  const now = Date.now();

  // Same id: update in place (the copy changes, nothing new stacks up).
  if (o.id) {
    const existing = toasts.find((t) => t.id === o.id && !t.leaving);
    if (existing) {
      toasts = toasts.map((t) =>
        t === existing
          ? {
              ...t,
              type,
              duration,
              title: o.title ?? t.title,
              description: 'description' in o ? o.description : t.description,
              action: 'action' in o ? o.action : t.action,
              rev: t.rev + 1, // restarts the auto-dismiss timer
            }
          : t,
      );
      emit();
      return existing.id;
    }
  }

  // An identical toast in the last second just restarts instead of stacking.
  const twin = toasts.find(
    (t) =>
      !t.leaving &&
      t.type === type &&
      t.title === (o.title ?? '') &&
      t.description === o.description &&
      now - t.createdAt < DUPLICATE_WINDOW_MS,
  );
  if (twin) {
    toasts = toasts.map((t) => (t === twin ? { ...t, rev: t.rev + 1 } : t));
    emit();
    return twin.id;
  }

  const id = o.id ?? `toast-${++seq}`;
  toasts = [
    ...toasts,
    {
      id,
      type,
      title: o.title ?? '',
      description: o.description,
      action: o.action,
      duration,
      createdAt: now,
      rev: 0,
      leaving: false,
    },
  ].slice(-MAX_VISIBLE);
  emit();
  return id;
}

/** Start the exit animation, then remove. No id dismisses everything. */
function dismiss(id) {
  const ids = id === undefined ? toasts.map((t) => t.id) : [id];
  const hit = toasts.filter((t) => ids.includes(t.id) && !t.leaving);
  if (hit.length === 0) return;
  toasts = toasts.map((t) => (hit.includes(t) ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => !ids.includes(t.id) || !t.leaving);
    emit();
  }, EXIT_MS);
}

export const toast = Object.assign(show, {
  success: (title, opts) => show({ ...opts, title, type: 'success' }),
  error: (title, opts) => show({ ...opts, title, type: 'error' }),
  warning: (title, opts) => show({ ...opts, title, type: 'warning' }),
  info: (title, opts) => show({ ...opts, title, type: 'info' }),
  dismiss,
});

export default toast;
