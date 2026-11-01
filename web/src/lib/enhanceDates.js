/**
 * Styled pickers for the native temporal inputs:
 *   <input type="date">            12 Nov 2026
 *   <input type="month">           Nov 2026
 *   <input type="datetime-local">  12 Nov 2026, 14:30
 *   <input type="time">            14:30
 *
 * Browsers draw their own popups for these, which cannot be themed. This module
 * keeps every input in the DOM as the source of truth (the value keeps its native
 * format, React still owns value/onChange, min/max/required/disabled are still
 * honoured) and puts a styled button + popover in front of it. Picking writes the
 * value through the native setter and dispatches bubbling input/change events, so
 * React handlers see a normal change.
 *
 * Opt out per element with the `data-native` attribute.
 *
 * Keyboard (calendar): Arrow keys move by day/week, Home/End go to the start/end
 * of the week, PageUp/PageDown change month (Shift = year), Enter/Space pick,
 * Escape steps back (years > months > days) and then closes.
 * Keyboard (time fields): digits type, ArrowUp/ArrowDown step (Shift = 5), Enter closes.
 * Times are 24-hour.
 */

const KINDS = ['date', 'month', 'datetime-local', 'time'];
const SELECTOR = KINDS.map((k) => `input[type="${k}"]`).join(', ');
const LOCALE = 'en-IN';
const entries = new Map(); // input -> { btn, sync }
let open = null;
let uid = 0;

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a, b) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
function addMonths(d, n) {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
}

/** Native value string -> { date, h, m } (date and/or time part, null when absent). */
function parseValue(kind, v) {
  const s = String(v ?? '');
  let m;
  if (kind === 'date') {
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), h: 0, m: 0 };
  }
  if (kind === 'month') {
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, 1), h: 0, m: 0 };
  }
  if (kind === 'datetime-local') {
    m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), h: +m[4], m: +m[5] };
  }
  m = /^(\d{2}):(\d{2})/.exec(s);
  return m ? { date: null, h: +m[1], m: +m[2] } : null;
}
/** Draft parts -> native value string. */
function formatValue(kind, { date, h, m }) {
  if (kind === 'date') return isoDate(date);
  if (kind === 'month') return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}`;
  if (kind === 'datetime-local') return `${isoDate(date)}T${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}`;
}
const fmtDay = (d) => d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMonth = (d) => d.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
const fmtLong = (d) => d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function display(kind, p) {
  if (!p) return '';
  if (kind === 'date') return fmtDay(p.date);
  if (kind === 'month') return fmtMonth(p.date);
  if (kind === 'datetime-local') return `${fmtDay(p.date)}, ${pad(p.h)}:${pad(p.m)}`;
  return `${pad(p.h)}:${pad(p.m)}`;
}
const PLACEHOLDER = { date: 'Select date', month: 'Select month', 'datetime-local': 'Select date & time', time: 'Select time' };
const NOUN = { date: 'date', month: 'month', 'datetime-local': 'date and time', time: 'time' };

const ICON = {
  prev: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>',
  caret:
    '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>',
  up: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>',
};

function setValue(input, v) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const kindOf = (el) => (el instanceof HTMLInputElement ? el.type : '');
function eligible(el) {
  return el instanceof HTMLInputElement && KINDS.includes(el.type) && !el.hasAttribute('data-native');
}

/* ------------------------------------------------------------------ trigger */

function labelFor(input) {
  const own = input.getAttribute('aria-label');
  if (own) return own;
  const row = input.closest('.form-row, .field, .fld, label');
  const text = row?.querySelector('label, .form-label, .field-label')?.textContent?.replace('*', '').trim();
  return text || 'Date';
}

function enhance(input) {
  if (entries.has(input) || !eligible(input)) return;
  const kind = kindOf(input);

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
    kind,
    sync() {
      const cls = input.className.replace('dt-date-native', '').trim();
      if (cls !== lastClass) {
        lastClass = cls;
        btn.className = `dt-select dt-date dt-kind-${kind} ${cls}`.trim();
      }
      btn.style.cssText = input.style.cssText;
      const p = parseValue(kind, input.value);
      const text = p ? display(kind, p) : input.placeholder || PLACEHOLDER[kind];
      if (label.textContent !== text) label.textContent = text;
      btn.classList.toggle('is-placeholder', !p);
      btn.disabled = input.disabled || input.readOnly;
      btn.hidden = input.hidden;
      btn.setAttribute(
        'aria-label',
        `${labelFor(input)}: ${p ? (kind === 'date' ? fmtLong(p.date) : display(kind, p)) : `no ${NOUN[kind]} selected`}`,
      );
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

function el(tag, cls, text, attrs = {}) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function openPicker(input) {
  closePicker();
  const entry = entries.get(input);
  if (!entry || entry.btn.disabled) return;
  const { btn, kind } = entry;
  const hasDay = kind === 'date' || kind === 'datetime-local';
  const hasTime = kind === 'datetime-local' || kind === 'time';
  const baseView = kind === 'month' ? 'months' : 'days';

  const current = parseValue(kind, input.value);
  const today = day0(new Date());
  // min/max limit the calendar part only (a month input uses YYYY-MM, the others YYYY-MM-DD).
  const rangeKind = kind === 'month' ? 'month' : 'date';
  const rangeDate = (v) => (kind === 'time' ? null : parseValue(rangeKind, String(v ?? '').slice(0, rangeKind === 'month' ? 7 : 10))?.date ?? null);
  const min = rangeDate(input.min);
  const max = rangeDate(input.max);
  const clamp = (d) => (min && d < min ? min : max && d > max ? max : d);
  const dayOk = (d) => !(min && d < min) && !(max && d > max);
  const monthOk = (y, m) => {
    const idx = y * 12 + m;
    return !(min && idx < monthIndex(min)) && !(max && idx > monthIndex(max));
  };

  const id = `dt-cal-${++uid}`;
  const pop = document.createElement('div');
  pop.className = `dt-pop dt-cal${kind === 'time' ? ' dt-cal--time' : ''}`;
  pop.id = id;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', `${labelFor(input)} ${kind === 'time' ? 'time' : 'calendar'}`);

  const now = new Date();
  const st = {
    input,
    btn,
    pop,
    view: baseView,
    date: current?.date ?? null, // chosen calendar date (date / month / datetime)
    h: current?.h ?? (kind === 'time' ? now.getHours() : 9), // draft time of day
    m: current?.m ?? (kind === 'time' ? now.getMinutes() : 0),
    focus: clamp(current?.date ?? today), // day with the roving tab stop
    shown: clamp(current?.date ?? today), // month/year being displayed
  };

  function title() {
    if (st.view === 'days') return st.shown.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
    if (st.view === 'months') return String(st.shown.getFullYear());
    const start = Math.floor(st.shown.getFullYear() / 12) * 12;
    return `${start} – ${start + 11}`;
  }
  function iconBtn(key, html, labelText, onClick) {
    const b = el('button', 'dt-cal-nav', null, { type: 'button', 'aria-label': labelText, 'data-key': key });
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

  /** Write the current draft to the input. Returns false if there is nothing to write yet. */
  function commit() {
    if (kind === 'time') setValue(input, formatValue(kind, st));
    else if (st.date) setValue(input, formatValue(kind, { date: st.date, h: st.h, m: st.m }));
    else return false;
    entry.sync();
    return true;
  }
  function finish() {
    closePicker();
    btn.focus();
  }
  function pickDate(d) {
    st.date = d;
    st.focus = d;
    commit();
    if (hasTime) render(`d:${isoDate(d)}`); // keep open: the time still needs choosing
    else finish();
  }
  function pickMonth(y, m) {
    st.date = new Date(y, m, 1);
    commit();
    finish();
  }

  /** Move the "selected" highlight to st.date without rebuilding the popover. */
  function markSelectedDay() {
    for (const b of pop.querySelectorAll('.dt-day')) {
      const on = b.getAttribute('data-key') === `d:${isoDate(st.date)}`;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  function stepper(unit, max) {
    const wrap = el('div', 'dt-step');
    const up = el('button', 'dt-step-btn', null, { type: 'button', tabindex: '-1', 'aria-label': `Increase ${unit}` });
    up.innerHTML = ICON.up;
    const down = el('button', 'dt-step-btn', null, { type: 'button', tabindex: '-1', 'aria-label': `Decrease ${unit}` });
    down.innerHTML = ICON.down;
    const field = el('input', 'dt-step-input', null, {
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      'aria-label': unit === 'hour' ? 'Hour (00 to 23)' : 'Minute (00 to 59)',
      'data-key': unit,
    });
    const key = unit === 'hour' ? 'h' : 'm';
    field.value = pad(st[key]);
    // `rewrite` is false while typing, so the digits the user is entering are not replaced.
    const apply = (n, rewrite = true) => {
      const size = max + 1;
      st[key] = ((n % size) + size) % size;
      if (rewrite) field.value = pad(st[key]);
      if (kind === 'datetime-local' && !st.date) {
        st.date = clamp(today); // time edited before any day: use today
        st.focus = st.date;
        st.shown = st.date;
        markSelectedDay();
      }
      commit();
    };
    up.addEventListener('click', () => apply(st[key] + 1));
    down.addEventListener('click', () => apply(st[key] - 1));
    // The first digit typed after focusing or clicking replaces the whole value
    // (a click would otherwise leave a caret inside a full box); the second digit
    // then appends, so "23" is typed as 2, 3 like in any time field.
    let fresh = true;
    field.addEventListener('focus', () => {
      fresh = true;
      field.select();
    });
    field.addEventListener('mouseup', () => {
      fresh = true;
    });
    field.addEventListener('input', () => {
      field.value = field.value.replace(/\D/g, '').slice(-2); // keep the last two digits typed
      if (field.value !== '') apply(Math.min(max, +field.value), false);
    });
    field.addEventListener('blur', () => {
      field.value = pad(st[key]);
    });
    field.addEventListener('keydown', (e) => {
      if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (fresh) field.select(); // typing replaces the selection
        fresh = false;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        apply(st[key] + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 5 : 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finish();
      }
    });
    wrap.append(up, field, down);
    return wrap;
  }

  function render(refocus) {
    const active = pop.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
    const want = refocus ?? active;
    pop.textContent = '';

    // ---- header
    const head = el('div', 'dt-cal-head');
    if (kind === 'time') {
      head.appendChild(el('div', 'dt-cal-title dt-cal-title--static', 'Select time'));
    } else {
      const t = el('button', 'dt-cal-title', null, { type: 'button', 'data-key': 'title', 'aria-live': 'polite' });
      t.innerHTML = `<span>${title()}</span>${st.view === 'years' ? '' : ICON.caret}`;
      t.addEventListener('click', () => {
        st.view = st.view === 'days' ? 'months' : 'years';
        render('title');
      });
      head.appendChild(t);
    }
    const nowLabel = kind === 'date' ? 'Today' : kind === 'month' ? 'This month' : 'Now';
    const todayBtn = el('button', 'dt-cal-today', nowLabel, { type: 'button', 'data-key': 'today' });
    todayBtn.disabled = kind === 'month' ? !monthOk(today.getFullYear(), today.getMonth()) : kind === 'time' ? false : !dayOk(today);
    todayBtn.addEventListener('click', () => {
      const n = new Date();
      if (kind === 'date') pickDate(today);
      else if (kind === 'month') pickMonth(today.getFullYear(), today.getMonth());
      else if (kind === 'datetime-local') {
        st.h = n.getHours();
        st.m = n.getMinutes();
        st.shown = today;
        st.view = 'days';
        pickDate(today);
      } else {
        st.h = n.getHours();
        st.m = n.getMinutes();
        commit();
        render('hour');
      }
    });
    head.appendChild(todayBtn);
    if (kind !== 'time') {
      const unit = st.view === 'days' ? ['Previous month', 'Next month'] : st.view === 'months' ? ['Previous year', 'Next year'] : ['Previous years', 'Next years'];
      head.appendChild(iconBtn('prev', ICON.prev, unit[0], () => shiftView(-1)));
      head.appendChild(iconBtn('next', ICON.next, unit[1], () => shiftView(1)));
    }
    pop.appendChild(head);

    // ---- body
    if (kind !== 'time') {
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
          if (sameDay(d, st.date)) cls.push('is-selected');
          const b = el('button', cls.join(' '), String(d.getDate()), {
            type: 'button',
            'data-key': `d:${isoDate(d)}`,
            'aria-label': fmtLong(d),
            'aria-pressed': String(sameDay(d, st.date)),
            tabindex: sameDay(d, st.focus) ? '0' : '-1',
          });
          if (!dayOk(d)) b.disabled = true;
          else b.addEventListener('click', () => pickDate(d));
          grid.appendChild(b);
        }
        body.appendChild(grid);
      } else if (st.view === 'months') {
        const y = st.shown.getFullYear();
        for (let m = 0; m < 12; m++) {
          const cur = st.date && st.date.getFullYear() === y && st.date.getMonth() === m;
          const isNow = today.getFullYear() === y && today.getMonth() === m;
          const b = el('button', `dt-cell${cur ? ' is-selected' : ''}${isNow ? ' is-today' : ''}`,
            new Date(y, m, 1).toLocaleDateString(LOCALE, { month: 'short' }), { type: 'button', 'data-key': `m:${m}` });
          if (!monthOk(y, m)) b.disabled = true;
          b.addEventListener('click', () => {
            if (kind === 'month') return pickMonth(y, m);
            st.shown = new Date(y, m, 1);
            st.focus = clamp(new Date(y, m, Math.min(st.focus.getDate(), new Date(y, m + 1, 0).getDate())));
            st.view = 'days';
            return render(`d:${isoDate(st.focus)}`);
          });
          body.appendChild(b);
        }
      } else {
        const start = Math.floor(st.shown.getFullYear() / 12) * 12;
        for (let y = start; y < start + 12; y++) {
          const b = el('button', `dt-cell${st.date && st.date.getFullYear() === y ? ' is-selected' : ''}${today.getFullYear() === y ? ' is-today' : ''}`,
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
    }

    // ---- time of day (datetime-local and time)
    if (hasTime && (kind === 'time' || st.view === 'days')) {
      const row = el('div', 'dt-time');
      if (kind === 'datetime-local') row.appendChild(el('span', 'dt-time-label', 'Time'));
      row.appendChild(stepper('hour', 23));
      row.appendChild(el('span', 'dt-time-sep', ':', { 'aria-hidden': 'true' }));
      row.appendChild(stepper('minute', 59));
      pop.appendChild(row);
    }

    // ---- footer
    const canClear = !input.required && input.value;
    if (hasTime || canClear) {
      const foot = el('div', 'dt-cal-foot');
      if (canClear) {
        const clear = el('button', 'dt-cal-clear', 'Clear', { type: 'button', 'data-key': 'clear' });
        clear.addEventListener('click', () => {
          closePicker();
          setValue(input, '');
          entry.sync();
          btn.focus();
        });
        foot.appendChild(clear);
      }
      if (hasTime) {
        const done = el('button', 'dt-cal-done', 'Done', { type: 'button', 'data-key': 'done' });
        done.addEventListener('click', finish);
        foot.appendChild(done);
      }
      pop.appendChild(foot);
    }

    // restore focus to the equivalent control after a rebuild
    const fallback =
      st.view === 'days' && hasDay ? `d:${isoDate(st.focus)}` : kind === 'time' ? 'hour' : null;
    const target =
      (want && pop.querySelector(`[data-key="${want}"]:not(:disabled)`)) ||
      (fallback ? pop.querySelector(`[data-key="${fallback}"]:not(:disabled)`) : null);
    target?.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (st.view !== baseView) {
        st.view = st.view === 'years' ? 'months' : 'days';
        render(st.view === 'days' ? `d:${isoDate(st.focus)}` : 'title');
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
    if (!dayOk(next)) return;
    st.focus = next;
    st.shown = new Date(next.getFullYear(), next.getMonth(), 1);
    render(`d:${isoDate(next)}`);
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
  // Close when the page (or a container holding the field) scrolls, so the
  // popover never floats away from its field; unrelated scrolling is ignored.
  const onScroll = (e) => {
    const t = e.target;
    if (pop.contains(t)) return;
    if (t === document || (t instanceof Element && t.contains(btn))) closePicker();
  };
  const onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (to && !pop.contains(to) && to !== btn) closePicker();
  };

  document.body.appendChild(pop);
  render(kind === 'time' ? 'hour' : st.view === 'days' ? `d:${isoDate(st.focus)}` : 'title');
  position(pop, btn, kind === 'time' ? 264 : 320);

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

function position(pop, btn, preferred) {
  const r = btn.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(preferred, window.innerWidth - 32);
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
