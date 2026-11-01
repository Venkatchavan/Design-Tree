import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Pop-up dialog. Escape closes it, a click on the backdrop closes it (only if
 * the press also started there, so selecting text and releasing outside does
 * not dismiss), Tab stays inside, focus moves in on open and returns on close,
 * and the page behind does not scroll.
 */
export default function Modal({ title, onClose, children, wide }) {
  const boxRef = useRef(null);
  const downOnOverlay = useRef(false);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose; // always call the latest handler from the key listener
  });

  useEffect(() => {
    const box = boxRef.current;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      [...box.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.getAttribute('tabindex') !== '-1' && el.offsetParent !== null,
      );

    // Land on the first field, not the close button.
    const raf = requestAnimationFrame(() => {
      const first =
        box.querySelector('[autofocus]') ||
        box.querySelector('.modal-body input:not([type="hidden"]):not([tabindex="-1"]), .modal-body textarea, .modal-body button.dt-select, .modal-body select:not([tabindex="-1"])') ||
        focusables().find((el) => !el.classList.contains('modal-close')) ||
        box;
      first.focus?.({ preventScroll: true });
    });

    function onKeyDown(e) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className="modal-overlay open"
      onMouseDown={(e) => {
        downOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnOverlay.current) onClose?.();
      }}
    >
      <div
        ref={boxRef}
        className={`modal-box${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={17} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
