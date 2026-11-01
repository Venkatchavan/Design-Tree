/**
 * Backdrop for the login showcase panel, layered back to front:
 *   1. aurora: soft spectral light (amber, rose, violet, blue) rising from the
 *      bottom over a warm off-white, drifting very slowly;
 *   2. an isometric floor grid that fades in towards the bottom;
 *   3. a fine film grain over everything;
 *   4. a few small confetti flecks in the same spectrum.
 * Pure markup + CSS (index.css, "Showcase backdrop"); motion stops under
 * prefers-reduced-motion.
 */

// [left %, top %, colour, rotation deg, float duration s]
const FLECKS = [
  [7, 54, '#e5487c', -30, 9],
  [16, 74, '#3a6ff0', -50, 11],
  [24, 90, '#f2992f', 20, 8],
  [35, 63, '#2fb57a', 45, 10],
  [48, 95, '#8a44d6', -15, 12],
  [59, 46, '#3a6ff0', 30, 9],
  [67, 20, '#f2992f', -20, 13],
  [72, 75, '#e2b52a', -40, 10],
  [79, 91, '#2fb57a', 25, 8],
  [85, 37, '#1f9f8a', 10, 11],
  [90, 13, '#3a6ff0', 35, 12],
  [93, 66, '#e5487c', 60, 9],
];

export default function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden="true">
      <div className="login-aurora">
        <span className="login-aurora-blob login-aurora-blob--amber" />
        <span className="login-aurora-blob login-aurora-blob--rose" />
        <span className="login-aurora-blob login-aurora-blob--violet" />
        <span className="login-aurora-blob login-aurora-blob--blue" />
      </div>

      <svg className="login-floor" focusable="false">
        <defs>
          {/* one diamond of a 30° / 30° isometric lattice */}
          <pattern id="login-floor-cell" width="64" height="36.95" patternUnits="userSpaceOnUse">
            <path d="M0 0L64 36.95M0 36.95L64 0" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-floor-cell)" />
      </svg>

      <div className="login-grain" />

      {FLECKS.map(([x, y, c, r, dur], i) => (
        <span
          key={i}
          className="login-fleck"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            '--fc': c,
            '--fr': `${r}deg`,
            '--fd': `${dur}s`,
            '--fdelay': `${-i * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}
