import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

const MAX_ROWS = 50;

/** Wraps the part of `text` that matches `query` in <mark>. */
function Highlight({ text, query }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * Text field with a suggestion list. Free text is allowed (a typed value that is
 * not in `options` is offered as a new entry), so it can replace an <input list>
 * + <datalist> pair with the app's own themed list.
 *
 * It renders a real <input className="form-input">, so native `required`
 * validation, autofill and scripted `fill` keep working.
 */
export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder,
  required,
  disabled,
  id,
  addLabel = (text) => `Add “${text}” as a new entry`,
  emptyLabel = 'No matching entries',
  'aria-label': ariaLabel,
}) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Show the whole list when the field is focused, filter only once the user types.
  const [typed, setTyped] = useState(false);

  const query = typed ? value : '';
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, MAX_ROWS),
    [options, q],
  );
  const trimmed = value.trim();
  const isNew = trimmed !== '' && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const rows = useMemo(
    () => [
      ...matches.map((text) => ({ kind: 'option', text })),
      ...(isNew ? [{ kind: 'add', text: trimmed }] : []),
    ],
    [matches, isNew, trimmed],
  );

  // Close when focus or a click leaves the whole control.
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector('.dt-opt.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, rows.length]);

  function choose(row) {
    onChange(row.text.trim());
    setOpen(false);
    setTyped(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && rows[active]) {
      e.preventDefault(); // pick the row, do not submit the form
      choose(rows[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation(); // close the list only, not a surrounding dialog
      e.nativeEvent.stopImmediatePropagation?.();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const activeId = open && rows[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="dt-combo" ref={wrapRef}>
      <input
        id={inputId}
        className="form-input dt-combo-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setTyped(false);
          setActive(Math.max(0, options.findIndex((o) => o === value.trim())));
          setOpen(true);
        }}
        onBlur={(e) => {
          // trim stray spaces once the user leaves the field
          if (value !== value.trim()) onChange(value.trim());
          if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {value && !disabled ? (
        <button
          type="button"
          className="dt-combo-btn dt-combo-clear"
          aria-label="Clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('');
            setTyped(false);
            setOpen(true);
            document.getElementById(inputId)?.focus();
          }}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
      <span className="dt-combo-chevron" aria-hidden="true">
        <ChevronDown size={14} strokeWidth={1.9} />
      </span>
      {open && (
        <div className="dt-pop dt-combo-pop" role="listbox" id={listId} aria-label={ariaLabel}>
          <div className="dt-pop-list">
            {rows.length === 0 && <div className="dt-empty">{emptyLabel}</div>}
            {rows.map((row, i) => (
              <div
                key={`${row.kind}:${row.text}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={row.kind === 'option' && row.text === value.trim()}
                className={`dt-opt${i === active ? ' is-active' : ''}${row.kind === 'add' ? ' is-add' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(row)}
              >
                <span>{row.kind === 'add' ? addLabel(row.text) : <Highlight text={row.text} query={query} />}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
