/**
 * Styled dropdown lists for native <select> elements.
 *
 * Browsers draw the open list of a <select> themselves, so its options cannot
 * be styled with CSS. This module keeps every eligible <select> in the DOM as
 * the source of truth (React still owns value/onChange) and puts a styled
 * button + popover in front of it. Choosing an option sets the select's
 * selectedIndex and dispatches a bubbling `change` event, which React's
 * onChange handlers receive exactly as if the user had used the native list.
 *
 * Eligible: select.filter-select / select.form-input that are single-choice.
 * Opt out per element with the `data-native` attribute.
 */

const SELECTOR = 'select.filter-select, select.form-input';
const CHECK =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 7.4 5.7 10.3 11.2 4.2"/></svg>';
const SEARCH_THRESHOLD = 10;

const entries = new Map(); // select -> { btn, label, sync }
let uid = 0;
let open = null; // { sel, btn, pop, items, active, query, teardown }

function eligible(sel) {
  return (
    sel instanceof HTMLSelectElement &&
    sel.matches(SELECTOR) &&
    !sel.multiple &&
    !(sel.size > 1) &&
    !sel.hasAttribute('data-native')
  );
}

/* ------------------------------------------------------------------ trigger */

function enhance(sel) {
  if (entries.has(sel) || !eligible(sel)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.className = 'dt-select-label';
  btn.appendChild(label);

  sel.classList.add('dt-select-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');
  sel.insertAdjacentElement('afterend', btn);

  let lastClass = null;
  const entry = {
    btn,
    sync() {
      const cls = sel.className.replace('dt-select-native', '').trim();
      if (cls !== lastClass) {
        lastClass = cls;
        btn.className = `dt-select ${cls}`.trim();
      }
      btn.style.cssText = sel.style.cssText;
      const opt = sel.options[sel.selectedIndex];
      const text = opt ? opt.textContent.trim() : '';
      if (label.textContent !== (text || ' ')) label.textContent = text || ' ';
      btn.classList.toggle('is-placeholder', !opt || opt.value === '');
      btn.disabled = sel.disabled;
      btn.hidden = sel.hidden;
      const aria = sel.getAttribute('aria-label');
      if (aria) btn.setAttribute('aria-label', aria);
      if (sel.title) btn.title = sel.title;
      if (sel.required) btn.setAttribute('aria-required', 'true');
    },
  };
  entries.set(sel, entry);
  entry.sync();

  btn.addEventListener('click', () => (open?.sel === sel ? closeList() : openList(sel)));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (open?.sel !== sel) openList(sel);
    }
  });
  // <label for=...> and programmatic focus() land on the hidden select; forward them.
  sel.addEventListener('focus', () => btn.focus());
}

function cleanup() {
  for (const [sel, entry] of entries) {
    if (!sel.isConnected) {
      if (open?.sel === sel) closeList();
      entry.btn.remove();
      entries.delete(sel);
    }
  }
}

/* --------------------------------------------------------------------- list */

function readItems(sel) {
  const items = [];
  const visit = (node, group) => {
    if (node instanceof HTMLOptGroupElement) {
      items.push({ type: 'group', text: node.label });
      [...node.children].forEach((c) => visit(c, node));
    } else if (node instanceof HTMLOptionElement) {
      items.push({
        type: 'option',
        text: node.textContent.trim(),
        index: node.index,
        disabled: node.disabled || Boolean(group?.disabled),
        empty: node.value === '',
        selected: node.selected,
      });
    }
  };
  [...sel.children].forEach((c) => visit(c, null));
  return items;
}

function openList(sel) {
  closeList();
  const entry = entries.get(sel);
  if (!entry || sel.disabled) return;
  const { btn } = entry;

  const items = readItems(sel);
  const optionCount = items.filter((i) => i.type === 'option').length;
  const searchable = optionCount > SEARCH_THRESHOLD;
  const id = `dt-pop-${++uid}`;

  const pop = document.createElement('div');
  pop.className = 'dt-pop';
  pop.id = id;
  pop.innerHTML =
    (searchable
      ? '<div class="dt-pop-search"><input type="text" placeholder="Search…" aria-label="Search options" autocomplete="off" spellcheck="false"></div>'
      : '') + '<div class="dt-pop-list" role="listbox"></div>';
  const list = pop.querySelector('.dt-pop-list');
  const input = pop.querySelector('input');
  const state = { sel, btn, pop, items, active: -1, query: '', typed: '', typedAt: 0 };

  function render() {
    const q = state.query.trim().toLowerCase();
    list.textContent = '';
    state.rows = [];
    let pendingGroup = null;
    for (const item of items) {
      if (item.type === 'group') {
        pendingGroup = item;
        continue;
      }
      if (q && !item.text.toLowerCase().includes(q)) continue;
      if (pendingGroup) {
        const g = document.createElement('div');
        g.className = 'dt-group';
        g.textContent = pendingGroup.text;
        list.appendChild(g);
        pendingGroup = null;
      }
      const row = document.createElement('div');
      row.className = 'dt-opt';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(item.selected));
      if (item.disabled) row.setAttribute('aria-disabled', 'true');
      if (item.empty) row.classList.add('is-empty');
      const text = document.createElement('span');
      text.textContent = item.text || ' ';
      row.appendChild(text);
      if (item.selected) row.insertAdjacentHTML('beforeend', CHECK);
      row.addEventListener('mousemove', () => setActive(state.rows.indexOf(entryRow), false));
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!item.disabled) choose(item.index);
      });
      const entryRow = { item, row };
      state.rows.push(entryRow);
      list.appendChild(row);
    }
    if (!state.rows.length) {
      const empty = document.createElement('div');
      empty.className = 'dt-empty';
      empty.textContent = 'No matches';
      list.appendChild(empty);
    }
    const sel0 = state.rows.findIndex((r) => r.item.selected && !r.item.disabled);
    const first = state.rows.findIndex((r) => !r.item.disabled);
    setActive(q ? first : sel0 >= 0 ? sel0 : first, !q);
  }

  function setActive(i, scroll = true) {
    state.active = i;
    state.rows?.forEach((r, n) => {
      r.row.classList.toggle('is-active', n === i);
      if (n === i) {
        r.row.id = `${id}-opt`;
        if (scroll) r.row.scrollIntoView({ block: 'nearest' });
      } else r.row.removeAttribute('id');
    });
    if (i >= 0) btn.setAttribute('aria-activedescendant', `${id}-opt`);
  }

  function move(delta) {
    const n = state.rows.length;
    if (!n) return;
    let i = state.active;
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!state.rows[i].item.disabled) return setActive(i);
    }
  }

  function choose(index) {
    closeList();
    if (sel.selectedIndex !== index) {
      sel.selectedIndex = index;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    entry.sync();
    btn.focus();
  }

  function onKey(e) {
    if (['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key) || (e.key === ' ' && !searchable)) {
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeList();
      btn.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home' && !searchable) {
      e.preventDefault();
      setActive(state.rows.findIndex((r) => !r.item.disabled));
    } else if (e.key === 'End' && !searchable) {
      e.preventDefault();
      const last = [...state.rows].reverse().findIndex((r) => !r.item.disabled);
      if (last >= 0) setActive(state.rows.length - 1 - last);
    } else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) {
      e.preventDefault();
      const r = state.rows[state.active];
      if (r && !r.item.disabled) choose(r.item.index);
    } else if (e.key === 'Tab') {
      closeList();
    } else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // type-ahead
      const now = Date.now();
      state.typed = now - state.typedAt > 700 ? e.key : state.typed + e.key;
      state.typedAt = now;
      const t = state.typed.toLowerCase();
      const hit = state.rows.findIndex((r) => !r.item.disabled && r.item.text.toLowerCase().startsWith(t));
      if (hit >= 0) setActive(hit);
    }
  }

  function onOutside(e) {
    if (pop.contains(e.target) || btn.contains(e.target)) return;
    closeList();
    // Like a native list: the click that dismisses it does nothing else.
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, true), 400);
  }
  const onScroll = (e) => {
    if (!pop.contains(e.target)) closeList();
  };

  if (input) {
    input.addEventListener('input', () => {
      state.query = input.value;
      render();
    });
  }

  document.body.appendChild(pop);
  render();
  position(pop, btn);

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', closeList);

  state.teardown = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', closeList);
    pop.remove();
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-activedescendant');
    btn.removeAttribute('aria-controls');
  };
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-controls', id);
  open = state;
  if (input) input.focus({ preventScroll: true });
}

function position(pop, btn) {
  const r = btn.getBoundingClientRect();
  const margin = 8;
  pop.style.minWidth = `${Math.max(r.width, 160)}px`;
  pop.style.maxWidth = `${Math.min(420, window.innerWidth - margin * 2)}px`;
  const list = pop.querySelector('.dt-pop-list');
  const natural = pop.offsetHeight;
  const below = window.innerHeight - r.bottom - margin;
  const above = r.top - margin;
  const flip = natural > below && above > below;
  const room = Math.max(120, flip ? above : below);
  list.style.maxHeight = `${Math.min(300, room - (pop.querySelector('.dt-pop-search') ? 52 : 14))}px`;
  const h = pop.offsetHeight;
  pop.style.top = `${flip ? Math.max(margin, r.top - h - 6) : r.bottom + 6}px`;
  const left = Math.min(r.left, window.innerWidth - pop.offsetWidth - margin);
  pop.style.left = `${Math.max(margin, left)}px`;
  pop.classList.toggle('is-above', flip);
}

function closeList() {
  if (!open) return;
  const state = open;
  open = null;
  state.teardown();
}

/* ------------------------------------------------------------------- start */

export function enhanceSelects() {
  if (typeof document === 'undefined' || window.__dtSelects) return;
  window.__dtSelects = true;

  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches?.(SELECTOR)) enhance(root);
    root.querySelectorAll?.(SELECTOR).forEach(enhance);
  };

  scan(document.body);
  new MutationObserver((mutations) => {
    let removed = false;
    for (const m of mutations) {
      m.addedNodes.forEach(scan);
      if (m.removedNodes.length) removed = true;
      // options added/removed inside an enhanced select change its label
      if (m.target instanceof HTMLSelectElement) entries.get(m.target)?.sync();
    }
    if (removed) cleanup();
  }).observe(document.body, { childList: true, subtree: true });

  // React sets value/disabled as properties (no DOM event), so poll cheaply.
  setInterval(() => {
    if (document.hidden) return;
    for (const entry of entries.values()) entry.sync();
  }, 250);
  document.addEventListener('change', (e) => entries.get(e.target)?.sync(), true);
}
