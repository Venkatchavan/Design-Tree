/**
 * Expanding search bars.
 *
 * Every search field starts as a small circular button with a magnifier and
 * expands into the full field when it is clicked or focused. It collapses
 * again when it loses focus while empty, and stays open while it holds a
 * query. Styling lives in index.css (.dt-search*); this module only toggles
 * the `is-collapsed` / `is-open` classes and records the open width so the
 * width can animate.
 *
 * Works on existing markup (no wrapper nodes, React keeps full control):
 *   - a standalone <input>            -> the input itself morphs
 *   - an <input> inside a `.search`   -> the `.search` container morphs
 * Opt out with `data-no-expand` on the input.
 */

const SEARCH_RE = /search|type a name/i;
const entries = new Map(); // input -> state

function isSearchInput(el) {
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (type !== 'text' && type !== 'search') return false;
  if (el.hasAttribute('data-no-expand')) return false;
  // The mobile top-bar row already has its own open/close toggle.
  if (el.closest('.topbar-search-mobile')) return false;
  return (
    type === 'search' ||
    SEARCH_RE.test(el.getAttribute('placeholder') || '') ||
    SEARCH_RE.test(el.getAttribute('aria-label') || '')
  );
}

/** Natural (expanded) width, measured without the collapsed/open classes. */
function measure(s) {
  const { el } = s;
  if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return 0;
  const prev = el.style.transition;
  const wasCollapsed = el.classList.contains('is-collapsed');
  const wasOpen = el.classList.contains('is-open');
  el.style.transition = 'none';
  el.classList.remove('is-collapsed', 'is-open');
  const w = Math.round(el.getBoundingClientRect().width);
  el.classList.toggle('is-collapsed', wasCollapsed);
  el.classList.toggle('is-open', wasOpen);
  void el.offsetWidth; // flush so the restore is not animated
  el.style.transition = prev;
  if (w > 40) el.style.setProperty('--dt-w', `${w}px`);
  return w;
}

function setOpen(s, open, animate = true) {
  const { el } = s;
  const isOpen = el.classList.contains('is-open');
  if (open === isOpen && (open || el.classList.contains('is-collapsed'))) return;
  if (open) {
    if (!measure(s)) return; // hidden for now; retried by the poll
    if (!animate) el.style.transition = 'none';
    el.classList.remove('is-collapsed');
    el.classList.add('is-open');
  } else {
    if (!animate) el.style.transition = 'none';
    el.classList.remove('is-open');
    el.classList.add('is-collapsed');
  }
  if (!animate) {
    void el.offsetWidth;
    el.style.transition = '';
  }
}

function shouldBeOpen(s) {
  return s.input.value !== '' || document.activeElement === s.input;
}

function enhance(input) {
  if (entries.has(input) || !isSearchInput(input)) return;
  const box = input.parentElement?.classList.contains('search') ? input.parentElement : null;
  const el = box || input;
  const s = { input, el, collapseTimer: 0 };
  entries.set(input, s);

  el.classList.add('dt-search', box ? 'dt-search-box' : 'dt-search-input');
  el.classList.add('is-collapsed'); // start as the circle, then settle below
  if (!input.getAttribute('aria-label') && input.placeholder) {
    input.setAttribute('aria-label', input.placeholder);
  }

  input.addEventListener('focus', () => {
    clearTimeout(s.collapseTimer);
    setOpen(s, true);
  });
  input.addEventListener('blur', () => {
    clearTimeout(s.collapseTimer);
    // Small delay so a click on a result row is not lost to the collapse.
    s.collapseTimer = setTimeout(() => {
      if (!shouldBeOpen(s)) setOpen(s, false);
    }, 140);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value === '') input.blur();
  });
  if (box) {
    box.addEventListener('mousedown', (e) => {
      if (box.classList.contains('is-collapsed') && e.target !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // Settle into the right initial state without animating.
  setOpen(s, shouldBeOpen(s), false);
}

function cleanup() {
  for (const [input, s] of entries) {
    if (!input.isConnected) {
      clearTimeout(s.collapseTimer);
      entries.delete(input);
    }
  }
}

export function enhanceSearch() {
  if (typeof document === 'undefined' || window.__dtSearch) return;
  window.__dtSearch = true;

  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches?.('input')) enhance(root);
    root.querySelectorAll?.('input').forEach(enhance);
  };
  scan(document.body);

  new MutationObserver((mutations) => {
    let removed = false;
    for (const m of mutations) {
      m.addedNodes.forEach(scan);
      if (m.removedNodes.length) removed = true;
    }
    if (removed) cleanup();
  }).observe(document.body, { childList: true, subtree: true });

  // React can set a query (or clear it) without any DOM event; keep in step.
  setInterval(() => {
    if (document.hidden) return;
    for (const s of entries.values()) {
      const wantOpen = shouldBeOpen(s);
      const isOpen = s.el.classList.contains('is-open');
      if (wantOpen !== isOpen) setOpen(s, wantOpen);
    }
  }, 300);

  // Re-measure open fields when the layout changes width.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const s of entries.values()) {
        if (s.el.classList.contains('is-open')) measure(s);
      }
    }, 150);
  });
}
