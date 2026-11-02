/**
 * Shared isometric helpers for the login scene (30° / 30° projection).
 * Plan coordinates (x, y, z) -> screen coordinates in the scene's 620 x 420 viewBox.
 */

export const OX = 292; // screen x of plan origin
export const OY = 270; // screen y of plan origin (z = 0)
export const K = Math.sqrt(3) / 2;
export const FLOOR_Z = -16; // ground plane

const r1 = (n) => Math.round(n * 10) / 10;
export const iso = (x, y, z = 0) => [r1(OX + (x - y) * K), r1(OY + (x + y) / 2 - z)];
export const pt = ([x, y]) => `${x} ${y}`;

/** Closed/open polyline through plan points [x, y] on a single height z. */
export const pathOf = (pts, z, close = false) =>
  'M' + pts.map(([x, y]) => pt(iso(x, y, z))).join('L') + (close ? 'Z' : '');

export const square = (cx, cy, r) => [
  [cx - r, cy - r],
  [cx + r, cy - r],
  [cx + r, cy + r],
  [cx - r, cy + r],
];

/** Closed polygon through 3D plan points [x, y, z]. */
export const polyD = (pts) => 'M' + pts.map(([x, y, z]) => pt(iso(x, y, z))).join('L') + 'Z';

/** A single straight segment between two 3D plan points. */
export const seg = (a, b) => `M${pt(iso(...a))}L${pt(iso(...b))}`;

/** Outline of a square prism (used by the building's equipment box). */
export function boxPath(cx, cy, r, h, z) {
  const top = pathOf(square(cx, cy, r), z + h, true);
  const l = iso(cx - r, cy + r, z);
  const b = iso(cx + r, cy + r, z);
  const rt = iso(cx + r, cy - r, z);
  const lh = iso(cx - r, cy + r, z + h);
  const bh = iso(cx + r, cy + r, z + h);
  const rh = iso(cx + r, cy - r, z + h);
  return `${top}M${pt(lh)}L${pt(l)}L${pt(b)}L${pt(rt)}L${pt(rh)}M${pt(bh)}L${pt(b)}`;
}

/**
 * The three faces of a box that a viewer sees: top, the plane y = cy + ry
 * ("left") and the plane x = cx + rx ("right").
 */
export function boxFaces(cx, cy, rx, ry, h, z) {
  return {
    top: polyD([[cx - rx, cy - ry, z + h], [cx + rx, cy - ry, z + h], [cx + rx, cy + ry, z + h], [cx - rx, cy + ry, z + h]]),
    left: polyD([[cx - rx, cy + ry, z], [cx + rx, cy + ry, z], [cx + rx, cy + ry, z + h], [cx - rx, cy + ry, z + h]]),
    right: polyD([[cx + rx, cy + ry, z], [cx + rx, cy - ry, z], [cx + rx, cy - ry, z + h], [cx + rx, cy + ry, z + h]]),
  };
}
export const facesD = (f) => f.top + f.left + f.right;

/** Convex hull (monotone chain) of plan points [x, y]. */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Ground shadow of a box, thrown toward the back-right (light from the front-left). */
export function shadowD(cx, cy, rx, ry, h, z = FLOOR_Z) {
  const reach = h * 0.55;
  const dx = reach * 0.7;
  const dy = -reach * 0.7;
  const c = square(cx, cy, 1).map(([x, y]) => [cx + (x - cx) * rx, cy + (y - cy) * ry]);
  const moved = c.map(([x, y]) => [x + dx, y + dy]);
  return pathOf(hull([...c, ...moved]), z, true);
}
