/**
 * LoginScene — stroke-only isometric "exploded building" for the login showcase.
 *
 * Everything is drawn as outlines (fill: none). Geometry is generated from a
 * single iso() projection so every line sits exactly on the 30°/30° grid.
 * All motion is CSS-driven (see login.css) and respects prefers-reduced-motion.
 */

// ── Projection ────────────────────────────────────────────────────────────
const W = 100; // slab half-size in plan units
const GAP = 64; // vertical distance between slabs
const THICK = 7; // slab thickness
const OX = 292; // screen x of plan origin
const OY = 270; // screen y of plan origin (z = 0)
const K = Math.sqrt(3) / 2;

const r1 = (n) => Math.round(n * 10) / 10;
const iso = (x, y, z = 0) => [r1(OX + (x - y) * K), r1(OY + (x + y) / 2 - z)];
const pt = ([x, y]) => `${x} ${y}`;
const pathOf = (pts, z, close = false) =>
  'M' + pts.map(([x, y]) => pt(iso(x, y, z))).join('L') + (close ? 'Z' : '');
const square = (cx, cy, r) => [
  [cx - r, cy - r],
  [cx + r, cy - r],
  [cx + r, cy + r],
  [cx - r, cy + r],
];

function boxPath(cx, cy, r, h, z) {
  const top = pathOf(square(cx, cy, r), z + h, true);
  const l = iso(cx - r, cy + r, z);
  const b = iso(cx + r, cy + r, z);
  const rt = iso(cx + r, cy - r, z);
  const lh = iso(cx - r, cy + r, z + h);
  const bh = iso(cx + r, cy + r, z + h);
  const rh = iso(cx + r, cy - r, z + h);
  return `${top}M${pt(lh)}L${pt(l)}L${pt(b)}L${pt(rt)}L${pt(rh)}M${pt(bh)}L${pt(b)}`;
}

// ── Static geometry ───────────────────────────────────────────────────────
const LAYERS = [
  { tone: 'structural', no: '01', name: 'STRUCTURE', z: 0 },
  { tone: 'mep', no: '02', name: 'MEP', z: GAP },
  { tone: 'qaqc', no: '03', name: 'QA / QC', z: GAP * 2 },
];
const TOP_Z = GAP * 2;

function slabPaths(z) {
  const left = iso(-W, W, z);
  const bottom = iso(W, W, z);
  const right = iso(W, -W, z);
  const leftD = iso(-W, W, z - THICK);
  const bottomD = iso(W, W, z - THICK);
  const rightD = iso(W, -W, z - THICK);
  return {
    top: pathOf(square(0, 0, W), z, true),
    edge: `M${pt(left)}L${pt(leftD)}L${pt(bottomD)}L${pt(rightD)}L${pt(right)}M${pt(bottom)}L${pt(bottomD)}`,
    inset: pathOf(square(0, 0, W - 11), z, true),
  };
}

// 01 — Structure: column grid, beams, drafting dimension line
function structure(z) {
  const cols = [-60, -20, 20, 60];
  return {
    beams: cols
      .map((c) => pathOf([[c, -60], [c, 60]], z) + pathOf([[-60, c], [60, c]], z))
      .join(''),
    columns: cols
      .flatMap((cx) => cols.map((cy) => pathOf(square(cx, cy, 4.5), z, true)))
      .join(''),
    dim:
      pathOf([[-W, W + 17], [W, W + 17]], z) +
      pathOf([[-W, W + 11], [-W, W + 23]], z) +
      pathOf([[W, W + 11], [W, W + 23]], z),
  };
}

// 02 — MEP: orthogonal service routes, equipment, one coordination clash
const MEP_ROUTES = [
  { pts: [[-78, -72], [-78, 6], [8, 6], [8, 66], [74, 66]], dur: 1.9 },
  { pts: [[-30, -78], [-30, -34], [46, -34], [46, 34], [78, 34]], dur: 2.6 },
  { pts: [[74, -72], [74, -6], [22, -6], [22, 50]], dur: 2.2 },
];
const CLASH = [46, -6];

// 03 — QA/QC: reticle brackets, inspection points, approval tick
function quality(z) {
  const arm = 24;
  const R = 78;
  const brackets = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([sx, sy]) =>
      pathOf(
        [[sx * R - sx * arm, sy * R], [sx * R, sy * R], [sx * R, sy * R - sy * arm]],
        z,
      ),
    )
    .join('');
  const points = [[-58, 22], [38, -60], [60, 40], [-34, -50]];
  return {
    brackets,
    crosses: points
      .map(([x, y]) => pathOf([[x - 5, y], [x + 5, y]], z) + pathOf([[x, y - 5], [x, y + 5]], z))
      .join(''),
    tick: pathOf([[-14, 0], [-3, 11], [17, -13]], z),
    ringA: pathOf(square(0, 0, 34), z, true),
    ringB: pathOf(square(0, 0, 52), z, true),
    ping: iso(60, 40, z),
  };
}

// Ground grid
const FLOOR_Z = -16;
const FLOOR_R = 128;
const FLOOR_STEP = 32;
const FLOOR_GRID = (() => {
  let d = '';
  for (let i = -FLOOR_R; i <= FLOOR_R; i += FLOOR_STEP) {
    d += pathOf([[i, -FLOOR_R], [i, FLOOR_R]], FLOOR_Z);
    d += pathOf([[-FLOOR_R, i], [FLOOR_R, i]], FLOOR_Z);
  }
  return d;
})();
const FLOOR_EDGE = pathOf(square(0, 0, FLOOR_R), FLOOR_Z, true);

const PILLARS = [[-W, -W], [W, -W], [W, W], [-W, W]].map(
  ([x, y]) => `M${pt(iso(x, y, 0))}L${pt(iso(x, y, TOP_Z))}`,
);
const AXIS = `M${pt(iso(0, 0, -14))}L${pt(iso(0, 0, TOP_Z + 24))}`;
const scanPath = (dz) => pathOf(square(0, 0, W + 14), -10 + dz, true);

// ── Pieces ────────────────────────────────────────────────────────────────
function Ellipse({ at, rx = 4.6, ry = 2.7, className = 'iso-node', style }) {
  return <ellipse cx={at[0]} cy={at[1]} rx={rx} ry={ry} className={className} style={style} />;
}

function LayerDetails({ tone, z, delay }) {
  if (tone === 'structural') {
    const s = structure(z);
    return (
      <g className="iso-detail" style={{ '--d': `${delay}s` }}>
        <path className="iso-grid" d={s.beams} />
        <path className="iso-col" d={s.columns} />
        <path className="iso-dim" d={s.dim} />
      </g>
    );
  }
  if (tone === 'mep') {
    return (
      <g className="iso-detail" style={{ '--d': `${delay}s` }}>
        {MEP_ROUTES.map((r, i) => {
          const d = pathOf(r.pts, z);
          return (
            <g key={i}>
              <path className="iso-route-base" d={d} />
              <path className="iso-route-flow" d={d} style={{ '--dur': `${r.dur}s` }} />
              <Ellipse at={iso(...r.pts[0], z)} />
              <Ellipse at={iso(...r.pts[r.pts.length - 1], z)} />
            </g>
          );
        })}
        <path className="iso-grid" d={boxPath(-56, 50, 11, 14, z)} />
        <Ellipse at={iso(...CLASH, z)} className="iso-clash" rx={4} ry={2.3} />
        <Ellipse at={iso(...CLASH, z)} className="iso-clash iso-ping" rx={4} ry={2.3} />
      </g>
    );
  }
  const q = quality(z);
  return (
    <g className="iso-detail" style={{ '--d': `${delay}s` }}>
      <path className="iso-bracket" d={q.brackets} />
      <path className="iso-ring-a" d={q.ringA} />
      <path className="iso-ring-b" d={q.ringB} />
      <path className="iso-grid" d={q.crosses} />
      <path className="iso-tick" d={q.tick} />
      <Ellipse at={q.ping} rx={6} ry={3.4} />
      <Ellipse at={q.ping} rx={6} ry={3.4} className="iso-node iso-ping" />
    </g>
  );
}

function Label({ layer, lit = false, index }) {
  const [x0, y0] = iso(W, -W, layer.z);
  const cls = lit
    ? `iso-label iso-label--lit login-pulse login-pulse--${index} tone-${layer.tone}`
    : 'iso-label';
  return (
    <g className={cls}>
      <circle cx={x0} cy={y0} r="2.3" />
      <path d={`M${x0 + 8} ${y0}L${x0 + 40} ${y0}`} />
      <text className="iso-label-no" x={x0 + 50} y={y0 - 4}>{layer.no}</text>
      <text className="iso-label-name" x={x0 + 50} y={y0 + 9}>{layer.name}</text>
    </g>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────
export default function LoginScene() {
  const gizmoX = [r1(26 * K), 13];
  const gizmoY = [r1(-26 * K), 13];

  return (
    <div className="login-scene-stage" aria-hidden="true">
      <svg className="login-iso" viewBox="0 0 620 420" focusable="false">
        <defs>
          <linearGradient id="login-scan-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5B9BF0" />
            <stop offset=".5" stopColor="#E6DEFF" />
            <stop offset="1" stopColor="#B794F6" />
          </linearGradient>
          <linearGradient
            id="login-axis-grad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={OY + 20}
            x2="0"
            y2={OY - TOP_Z - 28}
          >
            <stop offset="0" stopColor="#5B9BF0" stopOpacity="0" />
            <stop offset=".5" stopColor="#9DB9FF" stopOpacity=".7" />
            <stop offset="1" stopColor="#B794F6" stopOpacity="0" />
          </linearGradient>
          <radialGradient
            id="login-floor-fade"
            gradientUnits="userSpaceOnUse"
            cx={OX}
            cy={OY + 22}
            r="170"
            gradientTransform={`translate(${OX} ${OY + 22}) scale(1.3 .78) translate(${-OX} ${-(OY + 22)})`}
          >
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset=".55" stopColor="#fff" stopOpacity=".45" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="login-floor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="620" height="420">
            <rect width="620" height="420" fill="url(#login-floor-fade)" />
          </mask>
          <filter id="login-blur" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* meta */}
        <text className="iso-meta" x="22" y="34">AXONOMETRIC · 30° / 30°</text>
        <text className="iso-meta" x="598" y="34" textAnchor="end">LAYERS 03</text>

        {/* ground */}
        <g mask="url(#login-floor-mask)">
          <path className="iso-floor-grid" d={FLOOR_GRID} />
        </g>
        <path className="iso-floor-edge" d={FLOOR_EDGE} />

        {/* vertical skeleton */}
        <g className="iso-detail" style={{ '--d': '1.1s' }}>
          {PILLARS.map((d, i) => (
            <path key={i} className="iso-pillar" d={d} />
          ))}
          <path className="iso-axis" d={AXIS} />
        </g>

        {/* slabs */}
        {LAYERS.map((layer, i) => {
          const p = slabPaths(layer.z);
          const delay = 0.15 + i * 0.28;
          return (
            <g key={layer.tone} className={`iso-layer tone-${layer.tone}`}>
              <path className="iso-draw iso-slab" pathLength="1" d={p.top} style={{ '--d': `${delay}s` }} />
              <path className="iso-draw iso-edge" pathLength="1" d={p.edge} style={{ '--d': `${delay + 0.2}s` }} />
              <path className="iso-inset" d={p.inset} />
              <LayerDetails tone={layer.tone} z={layer.z} delay={delay + 0.9} />
              <Ellipse at={iso(0, 0, layer.z)} rx={3.4} ry={2} className="iso-axis-node" />
            </g>
          );
        })}

        {/* layer highlight, synced to the scan plane */}
        {LAYERS.map((layer, i) => {
          const p = slabPaths(layer.z);
          return (
            <g key={layer.tone} className={`iso-glow login-pulse login-pulse--${i} tone-${layer.tone}`}>
              <path d={p.top} />
              <path d={p.edge} />
            </g>
          );
        })}

        {/* labels */}
        <g className="iso-detail" style={{ '--d': '1.4s' }}>
          {LAYERS.map((l, i) => (
            <Label key={`b${l.tone}`} layer={l} index={i} />
          ))}
          {LAYERS.map((l, i) => (
            <Label key={`l${l.tone}`} layer={l} index={i} lit />
          ))}
        </g>

        {/* scan plane */}
        <g className="iso-scan">
          <path className="iso-scan-glow" d={scanPath(0)} />
          <path className="iso-scan-echo" style={{ opacity: 0.16 }} d={scanPath(-20)} />
          <path className="iso-scan-echo" style={{ opacity: 0.3 }} d={scanPath(-10)} />
          <path className="iso-scan-main" d={scanPath(0)} />
        </g>

        {/* axis gizmo */}
        <g className="iso-gizmo" transform="translate(60 352)">
          <path d={`M0 0L${gizmoX[0]} ${gizmoX[1]}M0 0L${gizmoY[0]} ${gizmoY[1]}M0 0L0 -26`} />
          <circle cx="0" cy="0" r="1.8" />
          <text x={gizmoX[0] + 4} y={gizmoX[1] + 7}>X</text>
          <text x={gizmoY[0] - 10} y={gizmoY[1] + 7}>Y</text>
          <text x="-3" y="-31">Z</text>
        </g>
      </svg>
    </div>
  );
}