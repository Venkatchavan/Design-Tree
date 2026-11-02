import { useEffect, useRef } from 'react';

/**
 * Playful password-visibility eye for the login form.
 * Closed (asleep, with lashes) while the password is hidden; open while it is
 * shown, with the pupil following the pointer and a blink every few seconds.
 * Pure SVG + CSS (index.css, "Playful eye"); motion stops under
 * prefers-reduced-motion. Pointer tracking writes CSS vars, no re-renders.
 */
export default function LoginEye({ open }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const el = ref.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    function look(e) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        // ease toward the edge of the eye: far pointers look fully, near ones gently
        const reach = Math.min(1, dist / 120);
        el.style.setProperty('--lx', `${((dx / dist) * 2.6 * reach).toFixed(2)}px`);
        el.style.setProperty('--ly', `${((dy / dist) * 1.5 * reach).toFixed(2)}px`);
      });
    }
    window.addEventListener('pointermove', look);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', look);
      el.style.removeProperty('--lx');
      el.style.removeProperty('--ly');
    };
  }, [open]);

  return (
    <svg
      ref={ref}
      className={`login-eye ${open ? 'is-open' : 'is-closed'}`}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* open eye: almond, iris + pupil that look around, blinking lid */}
      <g className="login-eye-open">
        <path className="login-eye-shape" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <g className="login-eye-look">
          <circle className="login-eye-iris" cx="12" cy="12" r="3.6" />
          <circle className="login-eye-pupil" cx="12" cy="12" r="1.6" />
          <circle className="login-eye-glint" cx="13.3" cy="10.7" r="0.75" />
        </g>
      </g>
      {/* closed eye: a sleepy curve with lashes */}
      <g className="login-eye-closed">
        <path className="login-eye-shape" d="M3 11c2.5 3.5 5.6 5 9 5s6.5-1.5 9-5" />
        <path className="login-eye-lash" d="M5.6 14l-1.4 1.9M9.6 15.7l-.6 2.3M14.4 15.7l.6 2.3M18.4 14l1.4 1.9" />
      </g>
    </svg>
  );
}
