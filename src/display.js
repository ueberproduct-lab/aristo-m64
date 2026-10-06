// 7-segment LED display.
// Builds 1 sign cell + 8 digit cells as inline SVG inside [data-part="display"] and renders
// display text into them. Pure view: no calculator logic lives here.

import { DIGITS } from './engine.js';

// Segment patterns, identical to spec/tokens.json → segments.
const PATTERNS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  E: 'adefg', '-': 'g',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const GLOW_ID = 'm64-led-glow';

// Cell geometry in SVG user units. A cell is one digit position of the LED strip (W × H);
// the small, fine glyph (GW × GH) sits in its middle, like the tiny LED digits behind the
// filter of the original. CSS sizes the <svg> so that one user unit is the same on screen
// for every cell.
const W = 80;          // digit cell width (one position of the strip)
const H = 110;         // cell height
const SIGN_W = 50;     // sign cell width (only the minus bar)
const GW = 38;         // glyph width
const GH = 68;         // glyph height
const T = 7;           // segment thickness: fine strokes
const G = 1.2;         // gap between neighbouring segments
const SLANT = 7;       // italic lean in degrees (LED digits of the era lean slightly right)
const LEAN = Math.tan((SLANT * Math.PI) / 180) * GH; // horizontal shift top → bottom
const DP_R = 4.2;      // decimal point radius
const GY = (H - GH) / 2;                              // glyph top
const GX = (W - (GW + LEAN / 2 + 3 + 2 * DP_R)) / 2 + LEAN / 2; // glyph left (glyph + dp centred)

const fmt = (pts) => pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');

/** horizontal bar with pointed ends, centred on y, spanning x1…x2 (tip to tip) */
function hBar(x1, x2, y) {
  const h = T / 2;
  return fmt([[x1, y], [x1 + h, y - h], [x2 - h, y - h], [x2, y], [x2 - h, y + h], [x1 + h, y + h]]);
}

/** vertical bar with pointed ends, centred on x, spanning y1…y2 (tip to tip) */
function vBar(x, y1, y2) {
  const h = T / 2;
  return fmt([[x, y1], [x + h, y1 + h], [x + h, y2 - h], [x, y2], [x - h, y2 - h], [x - h, y1 + h]]);
}

function digitSegments() {
  const xl = GX + T / 2, xr = GX + GW - T / 2;                // centre lines of the vertical bars
  const yt = GY + T / 2, ym = H / 2, yb = GY + GH - T / 2;    // centre lines of the horizontal bars
  return {
    a: hBar(xl + G, xr - G, yt),
    g: hBar(xl + G, xr - G, ym),
    d: hBar(xl + G, xr - G, yb),
    f: vBar(xl, yt + G, ym - G),
    b: vBar(xr, yt + G, ym - G),
    e: vBar(xl, ym + G, yb - G),
    c: vBar(xr, ym + G, yb - G),
  };
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function segEl(name, points) {
  const p = svgEl('polygon', { points, class: `seg seg-${name}` });
  p.dataset.seg = name;
  return p;
}

/** italic group: lean to the right around the centre of the glyph */
function leanGroup(cx) {
  return svgEl('g', { transform: `translate(${cx.toFixed(2)} ${H / 2}) skewX(${-SLANT}) translate(${(-cx).toFixed(2)} ${-H / 2})` });
}

function makeCell(part, width) {
  const cell = document.createElement('span');
  cell.className = `cell cell-${part}`;
  cell.dataset.part = part;
  cell.setAttribute('aria-hidden', 'true');
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${H}`, class: 'cell-svg', focusable: 'false' });
  cell.appendChild(svg);
  return { cell, svg };
}

function makeDigit() {
  const { cell, svg } = makeCell('digit', W);
  const g = leanGroup(GX + GW / 2);
  const segs = digitSegments();
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) g.appendChild(segEl(name, segs[name]));
  svg.appendChild(g);
  // decimal point: its own round dot, bottom right of the leaning digit, in the gap to the next cell
  const dp = svgEl('circle', { cx: (GX + GW - LEAN / 2 + 3 + DP_R).toFixed(2), cy: (GY + GH - DP_R).toFixed(2), r: DP_R, class: 'seg seg-dp' });
  dp.dataset.seg = 'dp';
  svg.appendChild(dp);
  return cell;
}

function makeSign() {
  const { cell, svg } = makeCell('sign', SIGN_W);
  const g = leanGroup(SIGN_W / 2);
  g.appendChild(segEl('g', hBar(SIGN_W / 2 - GW / 2 + G, SIGN_W / 2 + GW / 2 - G, H / 2)));
  svg.appendChild(g);
  return cell;
}

/** shared SVG defs: the LED glow filter (a tight halo plus a soft bloom) */
function makeDefs() {
  const svg = svgEl('svg', { class: 'display-defs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
  const defs = svgEl('defs');
  const f = svgEl('filter', {
    id: GLOW_ID, filterUnits: 'userSpaceOnUse',
    x: -40, y: -40, width: W + 80, height: H + 80, 'color-interpolation-filters': 'sRGB',
  });
  f.appendChild(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 2.6, result: 'halo' }));
  f.appendChild(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 8, result: 'bloom' }));
  const bloom = svgEl('feComponentTransfer', { in: 'bloom', result: 'bloomSoft' });
  bloom.appendChild(svgEl('feFuncA', { type: 'linear', slope: 0.9 }));
  f.appendChild(bloom);
  const merge = svgEl('feMerge');
  for (const n of ['bloomSoft', 'halo', 'SourceGraphic']) merge.appendChild(svgEl('feMergeNode', { in: n }));
  f.appendChild(merge);
  defs.appendChild(f);
  svg.appendChild(defs);
  return svg;
}

/**
 * Create the sign cell and the 8 digit cells (left → right) inside `root`.
 * Returns { root, render(text) }.
 */
export function buildDisplay(root) {
  root.replaceChildren();
  root.appendChild(makeDefs());
  const sign = makeSign();
  root.appendChild(sign);
  const digits = [];
  for (let i = 0; i < DIGITS; i++) {
    const d = makeDigit();
    digits.push(d);
    root.appendChild(d);
  }
  const live = document.createElement('span');
  live.className = 'sr-only';
  root.appendChild(live);

  const segsOf = (cell) => {
    const map = {};
    for (const s of cell.querySelectorAll('[data-seg]')) map[s.dataset.seg] = s;
    return map;
  };
  const signSegs = segsOf(sign);
  const digitSegs = digits.map(segsOf);

  function render(text) {
    const value = text == null ? '' : String(text);
    const cells = layout(value);
    signSegs.g.classList.toggle('lit', cells.minus);
    cells.digits.forEach((c, i) => {
      const on = new Set(c.ch ? PATTERNS[c.ch] : '');
      if (c.dp) on.add('dp');
      for (const [name, el] of Object.entries(digitSegs[i])) el.classList.toggle('lit', on.has(name));
    });
    root.dataset.value = value;
    live.textContent = value === '' ? '' : value === 'E' ? 'Fehler' : value;
  }

  return { root, render };
}

/**
 * Map display text to cells: { minus, digits: [{ ch, dp }] × 8 }.
 *   ""   → everything dark
 *   "E"  → E in the leftmost digit cell
 *   else → optional "-" in the sign cell, digits right-aligned, "." lights dp of the digit before it
 */
function layout(text) {
  const digits = Array.from({ length: DIGITS }, () => ({ ch: '', dp: false }));
  let minus = false;
  if (text === 'E') {
    digits[0].ch = 'E';
    return { minus, digits };
  }
  let s = text;
  if (s.startsWith('-')) { minus = true; s = s.slice(1); }
  const glyphs = [];
  for (const ch of s) {
    if (ch === '.') {
      if (glyphs.length) glyphs[glyphs.length - 1].dp = true;
      else glyphs.push({ ch: '', dp: true });
    } else if (ch in PATTERNS) {
      glyphs.push({ ch, dp: false });
    }
  }
  const shown = glyphs.slice(-DIGITS);
  const offset = DIGITS - shown.length;
  shown.forEach((g, i) => { digits[offset + i] = g; });
  return { minus, digits };
}
