/**
 * Styled date picker for native <input type="date">.
 *
 * Browsers draw their own date popup, which cannot be themed. This module keeps
 * every date input in the DOM as the source of truth (value is still
 * "YYYY-MM-DD", React still owns value/onChange, min/max/required/disabled are
 * still honoured) and puts a styled button + calendar popover in front of it.
 * Picking a day writes the value through the native setter and dispatches
 * bubbling input/change events, so React handlers see a normal change.
 *
 * Opt out per element with the `data-native` attribute.
 *
 * Keyboard (popover): Arrow keys move by day/week, Home/End go to the start/end
 * of the week, PageUp/PageDown change month (Shift = year), Enter/Space pick,
 * Escape steps back (years > months > days) and then closes.
 */

const SELECTOR = 'input[type="date"]';
const LOCALE = 'en-IN';
const entries = new Map(); // input -> { btn, sync }
let open = null;
let uid = 0;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a, b) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function addMonths(d, n) {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
}
function parse(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}
const fmt = (d) => d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
const fmtLong = (d) => d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const ICON = {
  prev: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>',
  caret:
    '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>',
};

function setValue(input, v) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function eligible(el) {
  return el instanceof HTMLInputElement && el.type === 'date' && !el.hasAttribute('data-native');
}

/* ------------------------------------------------------------------ trigger */

function labelFor(input) {
  const own = input.getAttribute('aria-label');
  if (own) return own;
  const row = input.closest('.form-row, .field, label');
  const text = row?.querySelector('label, .form-label, .field-label')?.textContent?.replace('*', '').trim();
  return text || 'Date';
}

function enhance(input) {
  if (entries.has(input) || !eligible(input)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.className = 'dt-select-label';
  btn.appendChild(label);

  input.classList.add('dt-date-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.insertAdjacentElement('afterend', btn);

  let lastClass = null;
  const entry = {
    btn,
    sync() {
      const cls = input.className.replace('dt-date-native', '').trim();
      if (cls !== lastClass) {
        lastClass = cls;
        btn.className = `dt-select dt-date ${cls}`.trim();
      }
      btn.style.cssText = input.style.cssText;
      const d = parse(input.value);
      const text = d ? fmt(d) : input.placeholder || 'Select date';
      if (label.textContent !== text) label.textContent = text;
      btn.classList.toggle('is-placeholder', !d);
      btn.disabled = input.disabled || input.readOnly;
      btn.hidden = input.hidden;
      btn.setAttribute('aria-label', `${labelFor(input)}: ${d ? fmtLong(d) : 'no date selected'}`);
      if (input.required) btn.setAttribute('aria-required', 'true');
    },
  };
  entries.set(input, entry);
  entry.sync();

  btn.addEventListener('click', () => (open?.input === input ? closePicker() : openPicker(input)));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (open?.input !== input) openPicker(input);
    }
  });
  // form validation and <label> clicks focus the hidden input; forward them
  input.addEventListener('focus', () => btn.focus());
}

function cleanup() {
  for (const [input, entry] of entries) {
    if (!input.isConnected) {
      if (open?.input === input) closePicker();
      entry.btn.remove();
      entries.delete(input);
    }
  }
}

/* ------------------------------------------------------------------- picker */

function openPicker(input) {
  closePicker();
  const entry = entries.get(input);
  if (!entry || entry.btn.disabled) return;
  const { btn } = entry;

  const selected = parse(input.value);
  const today = day0(new Date());
  const min = parse(input.min);
  const max = parse(input.max);
  const clamp = (d) => (min && d < min ? min : max && d > max ? max : d);
  const inRange = (d) => !(min && d < min) && !(max && d > max);

  const id = `dt-cal-${++uid}`;
  const pop = document.createElement('div');
  pop.className = 'dt-pop dt-cal';
  pop.id = id;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', `${labelFor(input)} calendar`);

  const st = {
    input,
    btn,
    pop,
    view: 'days',
    focus: clamp(selected || today), // day with the roving tab stop
    shown: clamp(selected || today), // month/year being displayed
  };

  function title() {
    if (st.view === 'days') return st.shown.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
    if (st.view === 'months') return String(st.shown.getFullYear());
    const start = Math.floor(st.shown.getFullYear() / 12) * 12;
    return `${start} – ${start + 11}`;
  }

  function el(tag, cls, text, attrs = {}) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }
  function iconBtn(key, html, label, onClick) {
    const b = el('button', 'dt-cal-nav', null, { type: 'button', 'aria-label': label, 'data-key': key });
    b.innerHTML = html;
    b.addEventListener('click', onClick);
    return b;
  }

  function shiftView(dir) {
    if (st.view === 'days') {
      st.shown = addMonths(st.shown, dir);
      st.focus = addMonths(st.focus, dir);
    } else if (st.view === 'months') st.shown = new Date(st.shown.getFullYear() + dir, st.shown.getMonth(), 1);
    else st.shown = new Date(st.shown.getFullYear() + dir * 12, st.shown.getMonth(), 1);
    render();
  }

  function pick(d) {
    closePicker();
    setValue(input, iso(d));
    entry.sync();
    btn.focus();
  }

  function render(refocus) {
    const active = pop.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
    const want = refocus ?? active;
    pop.textContent = '';

    // header
    const head = el('div', 'dt-cal-head');
    const t = el('button', 'dt-cal-title', null, { type: 'button', 'data-key': 'title', 'aria-live': 'polite' });
    t.innerHTML = `<span>${title()}</span>${st.view === 'years' ? '' : ICON.caret}`;
    t.addEventListener('click', () => {
      st.view = st.view === 'days' ? 'months' : st.view === 'months' ? 'years' : 'years';
      render('title');
    });
    head.appendChild(t);
    const todayBtn = el('button', 'dt-cal-today', 'Today', { type: 'button', 'data-key': 'today' });
    todayBtn.disabled = !inRange(today);
    // Today selects today's date (and closes), like picking it in the grid.
    todayBtn.addEventListener('click', () => pick(today));
    head.appendChild(todayBtn);
    head.appendChild(iconBtn('prev', ICON.prev, st.view === 'days' ? 'Previous month' : st.view === 'months' ? 'Previous year' : 'Previous years', () => shiftView(-1)));
    head.appendChild(iconBtn('next', ICON.next, st.view === 'days' ? 'Next month' : st.view === 'months' ? 'Next year' : 'Next years', () => shiftView(1)));
    pop.appendChild(head);

    const body = el('div', `dt-cal-body dt-cal-${st.view}`);
    if (st.view === 'days') {
      const dow = el('div', 'dt-cal-dow', null, { 'aria-hidden': 'true' });
      for (let i = 0; i < 7; i++) {
        // 2023-01-01 was a Sunday
        dow.appendChild(el('span', null, new Date(2023, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'narrow' })));
      }
      body.appendChild(dow);
      const grid = el('div', 'dt-cal-grid', null, { role: 'grid' });
      const first = new Date(st.shown.getFullYear(), st.shown.getMonth(), 1);
      const start = addDays(first, -first.getDay());
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const cls = ['dt-day'];
        if (d.getMonth() !== st.shown.getMonth()) cls.push('is-outside');
        if (sameDay(d, today)) cls.push('is-today');
        if (sameDay(d, selected)) cls.push('is-selected');
        const b = el('button', cls.join(' '), String(d.getDate()), {
          type: 'button',
          'data-key': `d:${iso(d)}`,
          'aria-label': fmtLong(d),
          'aria-pressed': String(sameDay(d, selected)),
          tabindex: sameDay(d, st.focus) ? '0' : '-1',
        });
        if (!inRange(d)) {
          b.disabled = true;
        } else {
          b.addEventListener('click', () => pick(d));
        }
        grid.appendChild(b);
      }
      body.appendChild(grid);
    } else if (st.view === 'months') {
      for (let m = 0; m < 12; m++) {
        const d = new Date(st.shown.getFullYear(), m, 1);
        const cur = selected && selected.getFullYear() === d.getFullYear() && selected.getMonth() === m;
        const b = el('button', `dt-cell${cur ? ' is-selected' : ''}${today.getFullYear() === d.getFullYear() && today.getMonth() === m ? ' is-today' : ''}`,
          d.toLocaleDateString(LOCALE, { month: 'short' }), { type: 'button', 'data-key': `m:${m}` });
        b.addEventListener('click', () => {
          st.shown = new Date(st.shown.getFullYear(), m, 1);
          st.focus = clamp(new Date(st.shown.getFullYear(), m, Math.min(st.focus.getDate(), new Date(st.shown.getFullYear(), m + 1, 0).getDate())));
          st.view = 'days';
          render(`d:${iso(st.focus)}`);
        });
        body.appendChild(b);
      }
    } else {
      const start = Math.floor(st.shown.getFullYear() / 12) * 12;
      for (let y = start; y < start + 12; y++) {
        const b = el('button', `dt-cell${selected && selected.getFullYear() === y ? ' is-selected' : ''}${today.getFullYear() === y ? ' is-today' : ''}`,
          String(y), { type: 'button', 'data-key': `y:${y}` });
        if ((min && y < min.getFullYear()) || (max && y > max.getFullYear())) b.disabled = true;
        b.addEventListener('click', () => {
          st.shown = new Date(y, st.shown.getMonth(), 1);
          st.view = 'months';
          render(`m:${st.shown.getMonth()}`);
        });
        body.appendChild(b);
      }
    }
    pop.appendChild(body);

    if (!input.required && input.value) {
      const foot = el('div', 'dt-cal-foot');
      const clear = el('button', 'dt-cal-clear', 'Clear', { type: 'button', 'data-key': 'clear' });
      clear.addEventListener('click', () => {
        closePicker();
        setValue(input, '');
        entry.sync();
        btn.focus();
      });
      foot.appendChild(clear);
      pop.appendChild(foot);
    }

    // restore focus to the equivalent control after a rebuild
    const target =
      (want && pop.querySelector(`[data-key="${want}"]:not(:disabled)`)) ||
      (st.view === 'days' ? pop.querySelector(`[data-key="d:${iso(st.focus)}"]:not(:disabled)`) : null);
    target?.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (st.view !== 'days') {
        st.view = st.view === 'years' ? 'months' : 'days';
        render(st.view === 'days' ? `d:${iso(st.focus)}` : 'title');
      } else {
        closePicker();
        btn.focus();
      }
      return;
    }
    const dayEl = e.target instanceof Element ? e.target.closest('.dt-day') : null;
    if (!dayEl || st.view !== 'days') return;
    let next;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(st.focus, -1); break;
      case 'ArrowRight': next = addDays(st.focus, 1); break;
      case 'ArrowUp': next = addDays(st.focus, -7); break;
      case 'ArrowDown': next = addDays(st.focus, 7); break;
      case 'Home': next = addDays(st.focus, -st.focus.getDay()); break;
      case 'End': next = addDays(st.focus, 6 - st.focus.getDay()); break;
      case 'PageUp': next = addMonths(st.focus, e.shiftKey ? -12 : -1); break;
      case 'PageDown': next = addMonths(st.focus, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!inRange(next)) return;
    st.focus = next;
    st.shown = new Date(next.getFullYear(), next.getMonth(), 1);
    render(`d:${iso(next)}`);
  }

  function onOutside(e) {
    if (pop.contains(e.target) || btn.contains(e.target)) return;
    closePicker();
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, true), 400);
  }
  const onScroll = (e) => {
    if (!pop.contains(e.target)) closePicker();
  };
  const onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (to && !pop.contains(to) && to !== btn) closePicker();
  };

  document.body.appendChild(pop);
  render(`d:${iso(st.focus)}`);
  position(pop, btn);

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', closePicker);
  pop.addEventListener('focusout', onFocusOut);

  st.teardown = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', closePicker);
    pop.remove();
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-controls');
  };
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-controls', id);
  open = st;
}

function position(pop, btn) {
  const r = btn.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(320, window.innerWidth - 32);
  pop.style.width = `${width}px`;
  const h = pop.offsetHeight;
  const below = window.innerHeight - r.bottom - margin;
  const flip = h > below && r.top - margin > below;
  pop.style.top = `${flip ? Math.max(margin, r.top - h - 6) : r.bottom + 6}px`;
  const left = Math.min(r.left, window.innerWidth - width - 16);
  pop.style.left = `${Math.max(16, left)}px`;
  pop.classList.toggle('is-above', flip);
}

function closePicker() {
  if (!open) return;
  const st = open;
  open = null;
  st.teardown();
}

/* ------------------------------------------------------------------- start */

export function enhanceDates() {
  if (typeof document === 'undefined' || window.__dtDates) return;
  window.__dtDates = true;

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
