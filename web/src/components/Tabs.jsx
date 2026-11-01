import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Segmented tab bar: a row of tabs with one white pill that slides to the
 * selected tab. Pure CSS + a little measuring (no animation library).
 *
 * Keyboard: Tab focuses the selected tab only; Arrow keys move and select,
 * wrapping at the ends; Home/End select the first/last tab.
 */
export default function Tabs({ tabs, active, onChange, label }) {
  const rootRef = useRef(null);
  const btnRefs = useRef({});

  // Measure the selected tab and hand its position to the CSS pill.
  const place = useCallback(() => {
    const root = rootRef.current;
    const el = root?.querySelector('[aria-selected="true"]');
    if (!root) return;
    if (!el) {
      root.style.setProperty('--pill-w', '0px');
      return;
    }
    root.style.setProperty('--pill-x', `${el.offsetLeft}px`);
    root.style.setProperty('--pill-w', `${el.offsetWidth}px`);
    // Keep the selected tab visible when the bar scrolls sideways.
    const left = el.offsetLeft - 8;
    const right = el.offsetLeft + el.offsetWidth + 8;
    if (left < root.scrollLeft) root.scrollLeft = left;
    else if (right > root.scrollLeft + root.clientWidth) root.scrollLeft = right - root.clientWidth;
  }, []);

  useLayoutEffect(() => {
    place();
    const root = rootRef.current;
    // Turn animation on only after the first placement so the pill does not
    // fly in from the left on page load.
    const id = requestAnimationFrame(() => root?.classList.add('is-ready'));
    return () => cancelAnimationFrame(id);
  }, [active, tabs, place]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    ro?.observe(root);
    window.addEventListener('resize', place);
    document.fonts?.ready?.then(place);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [place]);

  function onKeyDown(e) {
    const keys = tabs.map((t) => t.key);
    const i = keys.indexOf(active);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % keys.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + keys.length) % keys.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = keys.length - 1;
    if (next === null || next === i) return;
    e.preventDefault();
    onChange(keys[next]);
    btnRefs.current[keys[next]]?.focus();
  }

  return (
    <div
      className="tabs seg"
      role="tablist"
      aria-label={label}
      ref={rootRef}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            ref={(el) => {
              btnRefs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected || !tabs.some((x) => x.key === active) ? 0 : -1}
            className={`tab-btn${selected ? ' active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
