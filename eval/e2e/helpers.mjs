// Shared helpers for the e2e eval. FROZEN (covered by eval.lock).
import { readFileSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;

export const tokens = JSON.parse(readFileSync(new URL('../../spec/tokens.json', import.meta.url), 'utf8'));

export const sel = {
  part: (p) => `[data-part="${p}"]`,
  key: (k) => `[data-part="keypad"] button[data-key="${k}"]`,
  keys: '[data-part="keypad"] button[data-key]',
  sw: (id) => `[data-part="switches"] [data-switch="${id}"]`,
  digits: '[data-part="display"] [data-part="digit"]',
};

/** Load the app and wait until it has settled (fonts + a short grace period for startup). */
export async function open(page) {
  await page.goto('/');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(350);
}

export async function displayValue(page) {
  return page.locator(sel.part('display')).getAttribute('data-value');
}

export async function pressKeys(page, keys) {
  for (const k of keys) await page.locator(sel.key(k)).click();
}

export async function box(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no bounding box for ${selector}`);
  return { ...b, right: b.x + b.width, bottom: b.y + b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

export async function boxes(page, selector) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    }),
  );
}

/** Lit segment names per digit cell, e.g. [['a','b'], [], ...] plus the sign cell. */
export async function litState(page) {
  return page.evaluate(() => {
    const lit = (cell) => [...cell.querySelectorAll('[data-seg]')].filter((s) => s.classList.contains('lit')).map((s) => s.dataset.seg).sort().join('');
    const display = document.querySelector('[data-part="display"]');
    const sign = display.querySelector('[data-part="sign"]');
    return { sign: sign ? lit(sign) : null, digits: [...display.querySelectorAll('[data-part="digit"]')].map(lit) };
  });
}

export async function render(page, text) {
  await page.evaluate((t) => window.m64.render(t), text);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// ---------- pixels & color ----------

export async function snapshot(page) {
  const buf = await page.screenshot({ animations: 'disabled' });
  const png = PNG.sync.read(buf);
  return {
    width: png.width,
    height: png.height,
    /** average RGB over a (2r+1)^2 square around CSS pixel (x, y) — deviceScaleFactor is 1 */
    at(x, y, r = 1) {
      let R = 0, G = 0, B = 0, n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const px = Math.round(x) + dx, py = Math.round(y) + dy;
          if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
          const i = (py * png.width + px) * 4;
          R += png.data[i]; G += png.data[i + 1]; B += png.data[i + 2]; n++;
        }
      return [R / n, G / n, B / n];
    },
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function parseCssColor(c) {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparseable color ${c}`);
  return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
}

export function lab([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export function deltaE(rgb1, rgb2) {
  const a = lab(rgb1), b = lab(rgb2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const fmtRgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
