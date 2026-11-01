/**
 * The context around the login building: neighbouring site blocks, trees, a stack
 * of drawing sheets (the "design desk") and a tower crane lifting a steel beam.
 *
 * Same projection and dark line work as LoginScene. Every object is an
 * `.iso-obj`: a moving `.iso-obj-body`, a ground shadow that stays put, and a
 * transparent `.iso-hit` area that stays put too, so hovering never flickers when
 * the body lifts away from the cursor. Styles and motion live in index.css.
 */
import {
  FLOOR_Z,
  boxFaces,
  facesD,
  iso,
  pathOf,
  polyD,
  seg,
  shadowD,
  square,
} from './isoGeometry.js';

const Z0 = FLOOR_Z;

// ── Neighbouring blocks ──────────────────────────────────────────────────
// Placed outside the building's screen footprint so they frame it.
const BLOCKS = [
  {
    id: 'tower',
    cx: -195,
    cy: 55,
    parts: [
      { rx: 27, ry: 23, h: 14, z: Z0 }, // podium
      { rx: 18, ry: 15, h: 74, z: Z0 + 14, windows: true, roof: true }, // tower
    ],
  },
  {
    id: 'midrise',
    cx: 195,
    cy: -70,
    parts: [{ rx: 18, ry: 22, h: 38, z: Z0, windows: true, roof: true }],
  },
].sort((a, b) => a.cx + a.cy - (b.cx + b.cy)); // far to near

/** Window cells on the two visible faces of a part. */
function windowCells(cx, cy, p) {
  const { rx, ry } = p;
  const margin = 3.5;
  const colW = 9;
  const rowH = 8;
  const gap = 4.5;
  const pad = 1.2;
  const nL = Math.max(1, Math.floor((2 * rx - 2 * margin) / colW));
  const nR = Math.max(1, Math.floor((2 * ry - 2 * margin) / colW));
  const cwL = (2 * rx - 2 * margin) / nL;
  const cwR = (2 * ry - 2 * margin) / nR;
  let d = '';
  for (let zz = p.z + 6; zz + rowH <= p.z + p.h - 3; zz += rowH + gap) {
    for (let i = 0; i < nL; i++) {
      const x0 = cx - rx + margin + i * cwL + pad;
      const x1 = x0 + cwL - 2 * pad;
      d += polyD([[x0, cy + ry, zz], [x1, cy + ry, zz], [x1, cy + ry, zz + rowH], [x0, cy + ry, zz + rowH]]);
    }
    for (let i = 0; i < nR; i++) {
      const y0 = cy + ry - margin - i * cwR - pad;
      const y1 = y0 - (cwR - 2 * pad);
      d += polyD([[cx + rx, y0, zz], [cx + rx, y1, zz], [cx + rx, y1, zz + rowH], [cx + rx, y0, zz + rowH]]);
    }
  }
  return d;
}

const BLOCK_SHAPES = BLOCKS.map((b) => {
  const parts = b.parts.map((p) => {
    const faces = boxFaces(b.cx, b.cy, p.rx, p.ry, p.h, p.z);
    const ztop = p.z + p.h;
    const out = { faces, windows: p.windows ? windowCells(b.cx, b.cy, p) : '' };
    if (p.roof) {
      // parapet, plus two rooftop plant boxes
      out.parapet = pathOf(square(0, 0, 1).map(([x, y]) => [b.cx + x * (p.rx - 2.2), b.cy + y * (p.ry - 2.2)]), ztop, true);
      out.units = [
        boxFaces(b.cx - p.rx * 0.35, b.cy - p.ry * 0.25, p.rx * 0.28, p.ry * 0.3, 5, ztop),
        boxFaces(b.cx + p.rx * 0.3, b.cy + p.ry * 0.25, p.rx * 0.2, p.ry * 0.22, 3.4, ztop),
      ];
    }
    return out;
  });
  const top = b.parts[b.parts.length - 1];
  return {
    id: b.id,
    parts,
    shadow: b.parts.map((p) => shadowD(b.cx, b.cy, p.rx, p.ry, p.z + p.h - Z0)).join(''),
    hit: parts.map((p) => facesD(p.faces)).join(''),
    height: top.z + top.h,
  };
});

// ── Trees ────────────────────────────────────────────────────────────────
const TREES = [
  [100, 125],
  [150, 62],
  [205, 22],
].map(([x, y]) => {
  const [sx, sy] = iso(x, y, Z0);
  return { sx, sy };
});

// ── Drawing sheets (the design desk) ─────────────────────────────────────
const SHEET = { cx: -92, cy: 172, rx: 34, ry: 24 };
const SHEET_SHAPES = [0, 1, 2].map((k) => {
  const cx = SHEET.cx + k * 3;
  const cy = SHEET.cy - k * 3;
  const z = Z0 + k * 3;
  const { rx, ry } = SHEET;
  const rect = (a, b, c, d) => [[cx + a, cy + b], [cx + c, cy + b], [cx + c, cy + d], [cx + a, cy + d]];
  const shape = { outline: pathOf(rect(-rx, -ry, rx, ry), z, true), detail: '', tools: null };
  if (k === 2) {
    const i = 4;
    shape.detail =
      pathOf(rect(-rx + i, -ry + i, rx - i, ry - i), z, true) + // border
      pathOf(rect(8, ry - i - 9, rx - i, ry - i), z, true) + // title block
      pathOf([[cx + 8, cy + ry - i - 5], [cx + rx - i, cy + ry - i - 5]], z) + // title block rule
      pathOf(rect(-24, -15, -2, 4), z, true) + // plan: room
      pathOf([[-13, -15], [-13, 4]].map(([x, y]) => [cx + x, cy + y]), z) +
      pathOf([[-24, 9], [-2, 9]].map(([x, y]) => [cx + x, cy + y]), z) + // dimension line
      pathOf([[-24, 7], [-24, 11]].map(([x, y]) => [cx + x, cy + y]), z) +
      pathOf([[-2, 7], [-2, 11]].map(([x, y]) => [cx + x, cy + y]), z);
    // set square and pencil resting on the top sheet
    const zt = z + 1.4;
    const tri = (pts) => pathOf(pts.map(([x, y]) => [cx + x, cy + y]), zt, true);
    shape.tools = {
      square: tri([[5, -17], [27, -17], [5, 2]]) + tri([[9, -12.5], [19.5, -12.5], [9, -3.5]]),
      pencil: facesD(boxFaces(cx - 14, cy + 15.5, 12, 1.3, 1.5, z + 1.2)),
      tip: pathOf([[cx - 2, cy + 14.4], [cx - 2, cy + 16.6], [cx + 3, cy + 15.5]], z + 1.9, true),
    };
  }
  return shape;
});
const SHEET_HIT = pathOf(
  [[SHEET.cx - SHEET.rx - 4, SHEET.cy - SHEET.ry - 4], [SHEET.cx + SHEET.rx + 4, SHEET.cy - SHEET.ry - 4], [SHEET.cx + SHEET.rx + 4, SHEET.cy + SHEET.ry + 4], [SHEET.cx - SHEET.rx - 4, SHEET.cy + SHEET.ry + 4]],
  Z0 + 3,
  true,
);
const SHEET_SHADOW = shadowD(SHEET.cx, SHEET.cy, SHEET.rx, SHEET.ry, 8);

// ── Tower crane ──────────────────────────────────────────────────────────
const CRANE = (() => {
  const bx = 95;
  const by = -175;
  const half = 6;
  const jib = 112;
  const counter = 46;
  const zt = Z0 + 215; // underside of the jib
  const z0 = Z0 + 4; // top of the foundation

  // foundation + ballast
  const plinth = boxFaces(bx, by, 13, 13, 4, Z0);
  const ballast = [[-10, -10], [10, -10], [10, 10], [-10, 10]].map(([dx, dy]) => boxFaces(bx + dx * 1.15, by + dy * 1.15, 4, 4, 5, z0));

  // mast: four legs and cross-bracing on the two visible faces
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([sx, sy]) => seg([bx + sx * half, by + sy * half, z0], [bx + sx * half, by + sy * half, zt]))
    .join('');
  let lattice = '';
  const step = 21;
  for (let z = z0, i = 0; z < zt - 1; z += step, i++) {
    const z2 = Math.min(z + step, zt);
    const even = i % 2 === 0;
    lattice += even ? seg([bx - half, by + half, z], [bx + half, by + half, z2]) : seg([bx + half, by + half, z], [bx - half, by + half, z2]);
    lattice += seg([bx - half, by + half, z2], [bx + half, by + half, z2]);
    lattice += even ? seg([bx + half, by + half, z], [bx + half, by - half, z2]) : seg([bx + half, by - half, z], [bx + half, by + half, z2]);
    lattice += seg([bx + half, by + half, z2], [bx + half, by - half, z2]);
  }

  // slewing unit and operator's cab
  const slew = boxFaces(bx, by, 9.5, 9.5, 5, zt - 1);
  const cab = boxFaces(bx + 9, by + 7, 4.5, 5.5, 9, zt + 4);
  const cabWindow = polyD([[bx + 13.5, by + 10.5, zt + 7], [bx + 13.5, by + 3.5, zt + 7], [bx + 13.5, by + 3.5, zt + 11.5], [bx + 13.5, by + 10.5, zt + 11.5]]);

  // jib lattice: two lower chords, one tapering upper chord, diagonals
  const topAt = (y) => zt + 14 - 10 * ((y - by) / jib);
  let jibD =
    seg([bx - 3, by, zt], [bx - 3, by + jib, zt]) +
    seg([bx + 3, by, zt], [bx + 3, by + jib, zt]) +
    seg([bx, by, zt + 14], [bx, by + jib, topAt(by + jib)]) +
    seg([bx - 3, by + jib, zt], [bx + 3, by + jib, zt]) +
    seg([bx, by + jib, topAt(by + jib)], [bx + 3, by + jib, zt]);
  for (let y = by, i = 0; y < by + jib - 1; y += 13, i++) {
    const y2 = Math.min(y + 13, by + jib);
    jibD += i % 2 === 0 ? seg([bx + 3, y, zt], [bx, y2, topAt(y2)]) : seg([bx, y, topAt(y)], [bx + 3, y2, zt]);
    if (i % 2 === 0) jibD += seg([bx - 3, y, zt], [bx + 3, y, zt]);
  }
  // counter-jib
  const topC = (y) => zt + 14 - 8 * ((by - y) / counter);
  let counterD =
    seg([bx - 3, by, zt], [bx - 3, by - counter, zt]) +
    seg([bx + 3, by, zt], [bx + 3, by - counter, zt]) +
    seg([bx, by, zt + 14], [bx, by - counter, topC(by - counter)]) +
    seg([bx + 3, by - counter, zt], [bx, by - counter, topC(by - counter)]);
  for (let y = by, i = 0; y > by - counter + 1; y -= 12, i++) {
    const y2 = Math.max(y - 12, by - counter);
    counterD += i % 2 === 0 ? seg([bx + 3, y, zt], [bx, y2, topC(y2)]) : seg([bx, y, topC(y)], [bx + 3, y2, zt]);
  }
  const weights = [0, 1, 2].map((n) => boxFaces(bx, by - counter + 3, 6.5, 7.5, 5, zt - 6 - n * 5.5)).reverse();

  // A-frame, pendants and the beacon
  const apex = [bx, by, zt + 46];
  const frame = seg([bx - 5, by, zt + 11], apex) + seg([bx + 5, by, zt + 11], apex) + seg([bx - 5, by, zt + 11], [bx + 5, by, zt + 11]);
  const pendants =
    seg(apex, [bx, by + jib * 0.42, topAt(by + jib * 0.42)]) +
    seg(apex, [bx, by + jib * 0.93, topAt(by + jib * 0.93)]) +
    seg(apex, [bx, by - counter, topC(by - counter)]);
  const [beaconX, beaconY] = iso(...apex);

  // trolley, falls, hook block, slings and the beam (hangs and swings)
  const ty = by + jib * 0.78;
  const hookZ = zt - 46;
  const beamZ = hookZ - 26;
  const trolley = boxFaces(bx, ty, 4, 5, 3.2, zt - 3.4);
  const falls = seg([bx - 1.6, ty, zt - 3.4], [bx - 1.6, ty, hookZ + 5]) + seg([bx + 1.6, ty, zt - 3.4], [bx + 1.6, ty, hookZ + 5]);
  const block = boxFaces(bx, ty, 3.4, 3.4, 5, hookZ);
  const [hx, hy] = iso(bx, ty, hookZ - 3.5);
  const hookRing = `M${hx - 2.6} ${hy}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
  const slings = seg([bx, ty, hookZ - 3.5], [bx, ty + 21, beamZ + 5.5]) + seg([bx, ty, hookZ - 3.5], [bx, ty - 21, beamZ + 5.5]);
  const beam = boxFaces(bx, ty, 3.4, 23, 5.5, beamZ);
  const web = seg([bx, ty - 23, beamZ + 2.75], [bx, ty + 23, beamZ + 2.75]);
  const [pivotX, pivotY] = iso(bx, ty, zt - 3.4);

  const hit = polyD([
    [bx - 11, by + 9, Z0],
    [bx + 11, by + 9, Z0],
    [bx + 11, by + 9, zt - 6],
    [bx + 5, by + jib + 5, zt - 6],
    [bx + 5, by + jib + 5, zt + 8],
    [bx + 3, by, zt + 49],
    [bx - 4, by - counter - 5, zt + 12],
    [bx - 4, by - counter - 5, zt - 18],
    [bx - 11, by - 9, zt - 6],
  ]);
  const loadHit = polyD([[bx + 5, ty + 27, beamZ - 3], [bx + 5, ty - 27, beamZ - 3], [bx + 5, ty - 27, beamZ + 8], [bx + 5, ty + 27, beamZ + 8]]);

  return {
    plinth, ballast, legs, lattice, slew, cab, cabWindow, jibD, counterD, weights, frame, pendants,
    beacon: { x: beaconX, y: beaconY }, trolley, falls, block, hookRing, slings, beam, web,
    pivot: { x: pivotX, y: pivotY }, hit, loadHit,
    shadow: shadowD(bx, by, 13, 13, 52),
  };
})();

// ── Components ───────────────────────────────────────────────────────────

/** Everything that sits on the ground behind/beside the building. */
export function SiteGround() {
  return (
    <>
      {/* neighbouring blocks */}
      {BLOCK_SHAPES.map((b, bi) => (
        <g key={b.id} className="iso-obj iso-obj-block iso-detail" style={{ '--d': `${0.8 + bi * 0.15}s` }}>
          <path className="iso-cast" d={b.shadow} />
          <g className="iso-obj-body">
            {b.parts.map((p, i) => (
              <g key={i}>
                <path className="iso-site-face iso-site-face--left" d={p.faces.left} />
                <path className="iso-site-face iso-site-face--right" d={p.faces.right} />
                <path className="iso-site-face iso-site-face--top" d={p.faces.top} />
                {p.windows && <path className="iso-window" d={p.windows} />}
                <path className="iso-site-line iso-site-line--edge" d={facesD(p.faces)} />
                {p.parapet && <path className="iso-site-line" d={p.parapet} />}
                {p.units?.map((u, n) => (
                  <g key={n}>
                    <path className="iso-site-face iso-site-face--right" d={u.right} />
                    <path className="iso-site-face iso-site-face--left" d={u.left} />
                    <path className="iso-site-line iso-site-line--edge" d={facesD(u)} />
                  </g>
                ))}
              </g>
            ))}
          </g>
          <path className="iso-hit" d={b.hit} />
        </g>
      ))}

      {/* trees */}
      {TREES.map((t, i) => (
        <g key={i} className="iso-obj iso-tree iso-detail" style={{ '--d': `${1.0 + i * 0.1}s` }}>
          <ellipse className="iso-cast" cx={t.sx + 8} cy={t.sy + 1} rx="11" ry="4" />
          <g className="iso-obj-body">
            <path className="iso-site-line iso-site-line--edge" d={`M${t.sx} ${t.sy}L${t.sx} ${t.sy - 13}`} />
            <circle className="iso-tree-crown" cx={t.sx} cy={t.sy - 21} r="9.5" />
            <circle className="iso-tree-crown iso-tree-crown--top" cx={t.sx + 1.5} cy={t.sy - 30} r="6.5" />
            <path className="iso-tree-shine" d={`M${t.sx - 6} ${t.sy - 24}A7 7 0 0 1 ${t.sx - 1} ${t.sy - 29}`} />
          </g>
          <circle className="iso-hit" cx={t.sx} cy={t.sy - 18} r="15" />
        </g>
      ))}

      {/* the design desk: drawing sheets, set square, pencil */}
      <g className="iso-obj iso-obj-sheets iso-detail" style={{ '--d': '1.25s' }}>
        <path className="iso-cast" d={SHEET_SHADOW} />
        <g className="iso-obj-body">
          {SHEET_SHAPES.map((s, i) => (
            <g key={i} className={`iso-sheet iso-sheet--${i}`}>
              <path className="iso-sheet-fill" d={s.outline} />
              <path className="iso-site-line iso-site-line--edge" d={s.outline} />
              {s.detail && <path className="iso-site-line" d={s.detail} />}
              {s.tools && (
                <>
                  <path className="iso-tool-fill" d={s.tools.square} />
                  <path className="iso-site-line iso-site-line--edge" d={s.tools.square} />
                  <path className="iso-tool-fill iso-tool-fill--pencil" d={s.tools.pencil} />
                  <path className="iso-site-line iso-site-line--edge" d={s.tools.pencil + s.tools.tip} />
                </>
              )}
            </g>
          ))}
        </g>
        <path className="iso-hit" d={SHEET_HIT} />
      </g>
    </>
  );
}

/** The crane stands behind the building but its jib reaches over it, so it is drawn on top. */
export function SiteCrane() {
  const c = CRANE;
  return (
    <g className="iso-obj iso-obj-crane iso-detail" style={{ '--d': '1.6s' }}>
      <path className="iso-cast" d={c.shadow} />
      <g className="iso-obj-body iso-crane">
        {[c.plinth, ...c.ballast].map((f, i) => (
          <g key={i}>
            <path className="iso-site-face iso-site-face--left" d={f.left} />
            <path className="iso-site-face iso-site-face--right" d={f.right} />
            <path d={facesD(f)} />
          </g>
        ))}
        <path d={c.legs} />
        <path className="iso-crane-thin" d={c.lattice} />
        {c.weights.map((w, i) => (
          <g key={i}>
            <path className="iso-site-face iso-site-face--left" d={w.left} />
            <path className="iso-site-face iso-site-face--right" d={w.right} />
            <path d={facesD(w)} />
          </g>
        ))}
        <path d={c.counterD} />
        <path d={c.jibD} />
        <path className="iso-site-face iso-site-face--left" d={c.slew.left} />
        <path className="iso-site-face iso-site-face--right" d={c.slew.right} />
        <path d={facesD(c.slew)} />
        <path className="iso-site-face iso-site-face--left" d={c.cab.left} />
        <path className="iso-site-face iso-site-face--right" d={c.cab.right} />
        <path d={facesD(c.cab)} />
        <path className="iso-window" d={c.cabWindow} />
        <path d={c.frame} />
        <path className="iso-crane-thin" d={c.pendants} />
        <path d={facesD(c.trolley)} />
        {/* the hanging load swings about the trolley */}
        <g className="iso-hook" style={{ transformOrigin: `${c.pivot.x}px ${c.pivot.y}px` }}>
          <path className="iso-crane-thin" d={c.falls + c.slings} />
          <path d={facesD(c.block)} />
          <path d={c.hookRing} />
          <path className="iso-beam-face iso-beam-face--left" d={c.beam.left} />
          <path className="iso-beam-face iso-beam-face--right" d={c.beam.right} />
          <path className="iso-beam-face iso-beam-face--top" d={c.beam.top} />
          <path className="iso-beam-line" d={facesD(c.beam)} />
          <path className="iso-crane-thin" d={c.web} />
        </g>
        <circle className="iso-beacon" cx={c.beacon.x} cy={c.beacon.y} r="2.4" />
      </g>
      <path className="iso-hit" d={c.hit} />
      <path className="iso-hit" d={c.loadHit} />
    </g>
  );
}
