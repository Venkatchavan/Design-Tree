import { useEffect, useRef } from 'react';

/**
 * Light ordered-dither texture for the login showcase panel.
 *
 * It reproduces the panel's soft blue / violet corner washes as a fine pixel
 * stipple: each cell is switched on or off by comparing the wash intensity with an
 * 8 x 8 Bayer matrix, so the dots thin out smoothly into the white instead of
 * ending on a hard edge. Density follows an eased curve, and the dot colour blends
 * between blue and violet in proportion to the two washes.
 *
 * Motion: two slow, soft light waves travel across the panel and raise or lower
 * the wash intensity a little, so cells near their threshold switch on and off as
 * a wave passes and the stipple shimmers. Colours and thresholds never change, so
 * each frame only recomputes which cells are lit (a few ms). It runs at ~24 fps,
 * pauses while the tab is hidden and stays still under prefers-reduced-motion.
 */

/** n x n Bayer threshold matrix (n a power of two), values in (0, 1). */
function bayer(n) {
  let m = [[0, 2], [3, 1]];
  while (m.length < n) {
    const s = m.length;
    const next = Array.from({ length: s * 2 }, () => new Array(s * 2));
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + s] = v + 2;
        next[y + s][x] = v + 3;
        next[y + s][x + s] = v + 1;
      }
    }
    m = next;
  }
  const total = n * n;
  return m.map((row) => row.map((v) => (v + 0.5) / total));
}

const N = 8;
const BAYER = bayer(N);

const CELL = 2; // css pixels per dither cell (fine grain)
const BLUE = [91, 155, 240];
const VIOLET = [183, 148, 246];
const MAX_COVERAGE = 0.3; // share of cells filled at the strongest point: keeps it light
const DOT_ALPHA = 0.22;
const CURVE = 1.5; // >1 pushes the density into the corners and feathers the rest

// Wave motion: [wavelength in cells, direction (radians), speed (rad/s), amplitude]
// Slow and shallow, so the stipple drifts rather than flickers.
const WAVES = [
  [190, Math.PI / 4, 0.3, 0.22],
  [130, -Math.PI / 5, -0.22, 0.14],
];
const FRAME_MS = 1000 / 24;

// The same four washes the panel background uses (index.css, .login-side):
// [corner x, corner y, radius x, radius y, peak strength, isBlue]
const WASHES = [
  [0, 0, 0.8, 0.65, 0.2, true],
  [1, 1, 0.75, 0.65, 0.2, false],
  [1, 0, 0.6, 0.5, 0.07, true],
  [0, 1, 0.6, 0.5, 0.07, false],
];
const PEAK = 0.2; // strongest single wash, used to normalise the level to 0..1
const FADE_AT = 0.8; // a wash reaches zero at 80% of its radius, as in the CSS gradient

const smooth = (t) => t * t * (3 - 2 * t);

function wash(u, v) {
  let blue = 0;
  let violet = 0;
  for (const [cx, cy, rx, ry, strength, isBlue] of WASHES) {
    const t = Math.min(1, Math.hypot((u - cx) / rx, (v - cy) / ry) / FADE_AT);
    // eased falloff, like the multi-stop CSS gradient (no hard rim)
    const a = strength * (1 - smooth(t));
    if (isBlue) blue += a;
    else violet += a;
  }
  return { blue, violet };
}

/**
 * Everything that does not change between frames, for a canvas of cols x rows:
 * only cells that can ever light up are kept ("active"), with their base level,
 * Bayer threshold, wave phases and a fixed colour.
 */
function buildModel(cols, rows) {
  const idx = [];
  const base = [];
  const thr = [];
  const ph0 = [];
  const ph1 = [];
  const rgb = [];
  const [w0, w1] = WAVES;
  const k0 = [(2 * Math.PI) / w0[0] * Math.cos(w0[1]), (2 * Math.PI) / w0[0] * Math.sin(w0[1])];
  const k1 = [(2 * Math.PI) / w1[0] * Math.cos(w1[1]), (2 * Math.PI) / w1[0] * Math.sin(w1[1])];
  const maxAmp = w0[3] + w1[3];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const { blue, violet } = wash((x + 0.5) / cols, (y + 0.5) / rows);
      const total = blue + violet;
      // PEAK is the strongest single wash, so total / PEAK is roughly 0..1
      const level = smooth(Math.min(1, total / PEAK)) ** CURVE * MAX_COVERAGE;
      const threshold = BAYER[y % N][x % N];
      // a cell that cannot light up even at the top of the wave never needs a look
      if (level * (1 + maxAmp) <= threshold && level * (1 - maxAmp) <= threshold) continue;
      const wb = blue / total;
      idx.push(y * cols + x);
      base.push(level);
      thr.push(threshold);
      ph0.push(k0[0] * x + k0[1] * y);
      ph1.push(k1[0] * x + k1[1] * y);
      rgb.push(
        Math.round(BLUE[0] * wb + VIOLET[0] * (1 - wb)),
        Math.round(BLUE[1] * wb + VIOLET[1] * (1 - wb)),
        Math.round(BLUE[2] * wb + VIOLET[2] * (1 - wb)),
      );
    }
  }
  return {
    n: idx.length,
    idx: Int32Array.from(idx),
    base: Float32Array.from(base),
    thr: Float32Array.from(thr),
    ph0: Float32Array.from(ph0),
    ph1: Float32Array.from(ph1),
    rgb: Uint8ClampedArray.from(rgb),
  };
}

/** Light the cells whose (wave-modulated) level is above their threshold. */
function draw(ctx, image, model, seconds) {
  const px = image.data;
  const { n, idx, base, thr, ph0, ph1 } = model;
  const t0 = seconds * WAVES[0][2];
  const t1 = seconds * WAVES[1][2];
  const a0 = WAVES[0][3];
  const a1 = WAVES[1][3];
  const alpha = Math.round(DOT_ALPHA * 255);
  for (let i = 0; i < n; i++) {
    const m = 1 + a0 * Math.sin(ph0[i] - t0) + a1 * Math.sin(ph1[i] - t1);
    px[idx[i] * 4 + 3] = base[i] * m > thr[i] ? alpha : 0;
  }
  ctx.putImageData(image, 0, 0);
}

export default function LoginDither() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let model = null;
    let image = null;
    let raf = 0;
    let last = 0;
    let start = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!model || now - last < FRAME_MS) return;
      last = now;
      draw(ctx, image, model, (now - start) / 1000);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const run = () => {
      stop();
      if (!model) return;
      draw(ctx, image, model, 0); // always show a first, still frame
      if (reduced?.matches || document.hidden) return;
      start = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const rebuild = () => {
      const r = parent.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const cols = Math.max(1, Math.ceil(r.width / CELL));
      const rows = Math.max(1, Math.ceil(r.height / CELL));
      canvas.width = cols;
      canvas.height = rows;
      image = ctx.createImageData(cols, rows);
      model = buildModel(cols, rows);
      // colours are fixed; copy them into the pixel buffer once
      for (let i = 0; i < model.n; i++) {
        const p = model.idx[i] * 4;
        image.data[p] = model.rgb[i * 3];
        image.data[p + 1] = model.rgb[i * 3 + 1];
        image.data[p + 2] = model.rgb[i * 3 + 2];
      }
      run();
    };

    rebuild();
    const onVisibility = () => (document.hidden ? stop() : run());
    document.addEventListener('visibilitychange', onVisibility);
    reduced?.addEventListener?.('change', run);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(rebuild) : null;
    ro?.observe(parent);

    return () => {
      stop();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced?.removeEventListener?.('change', run);
    };
  }, []);

  return <canvas ref={ref} className="login-dither" aria-hidden="true" />;
}
