// L-04, L-05, L-06, L-09, L-10, L-12, L-23, L-31 — geometry & proportions. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, boxes } from './helpers.mjs';

const G = tokens.geometry;
test.beforeEach(async ({ page }) => open(page));

test('L-04 shell aspect ratio (height/width) matches the real device', async ({ page }) => {
  const s = await box(page, sel.part('shell'));
  expect(Math.abs(s.height / s.width - G.shellAspect.target), `aspect ${(s.height / s.width).toFixed(3)}`).toBeLessThanOrEqual(G.shellAspect.tolerance);
});

test('L-05 vertical order head → switches → display → keypad → foot without overlap', async ({ page }) => {
  const order = ['head', 'switches', 'display', 'keypad', 'foot'];
  const b = [];
  for (const p of order) b.push(await box(page, sel.part(p)));
  for (let i = 1; i < b.length; i++) {
    expect(b[i].y, `${order[i]} below ${order[i - 1]}`).toBeGreaterThanOrEqual(b[i - 1].bottom - 0.5);
  }
});

test('L-06 height fractions of the faceplate match the reference', async ({ page }) => {
  const f = await box(page, sel.part('faceplate'));
  const { tolerance, ...fractions } = G.verticalFractions;
  for (const [part, target] of Object.entries(fractions)) {
    if (part.startsWith('$')) continue;
    const b = await box(page, sel.part(part));
    const frac = b.height / f.height;
    expect(Math.abs(frac - target), `${part}: ${frac.toFixed(3)} vs ${target}`).toBeLessThanOrEqual(tolerance);
  }
});

test('L-09 keypad is a 4×5 grid: aligned, evenly spaced, centered, in reference order', async ({ page }) => {
  const k = await boxes(page, sel.keys);
  expect(k).toHaveLength(20);
  const col = (c) => [0, 1, 2, 3, 4].map((r) => k[r * 4 + c]);
  const row = (r) => [0, 1, 2, 3].map((c) => k[r * 4 + c]);
  for (let c = 0; c < 4; c++) for (const b of col(c)) expect(Math.abs(b.cx - col(c)[0].cx), `column ${c} alignment`).toBeLessThanOrEqual(1);
  for (let r = 0; r < 5; r++) for (const b of row(r)) expect(Math.abs(b.cy - row(r)[0].cy), `row ${r} alignment`).toBeLessThanOrEqual(1);
  const cx = [0, 1, 2, 3].map((c) => col(c)[0].cx);
  const cy = [0, 1, 2, 3, 4].map((r) => row(r)[0].cy);
  const dx = cx.slice(1).map((v, i) => v - cx[i]);
  const dy = cy.slice(1).map((v, i) => v - cy[i]);
  for (const d of dx) expect(d, 'columns left→right').toBeGreaterThan(0);
  for (const d of dy) expect(d, 'rows top→bottom').toBeGreaterThan(0);
  expect(Math.max(...dx) - Math.min(...dx), 'even column pitch').toBeLessThanOrEqual(2);
  expect(Math.max(...dy) - Math.min(...dy), 'even row pitch').toBeLessThanOrEqual(2);
  const f = await box(page, sel.part('faceplate'));
  const left = k[0].x - f.x, right = f.right - k[3].right;
  expect(Math.abs(left - right), `grid centered (left ${left.toFixed(1)} / right ${right.toFixed(1)})`).toBeLessThanOrEqual(3);
});

test('L-10 keys: square, equal size, scaled to faceplate, pitch like the original', async ({ page }) => {
  const k = await boxes(page, sel.keys);
  expect(k).toHaveLength(20);
  const f = await box(page, sel.part('faceplate'));
  for (const b of k) {
    expect(b.width / b.height, 'key aspect').toBeGreaterThanOrEqual(G.keyAspect.min);
    expect(b.width / b.height, 'key aspect').toBeLessThanOrEqual(G.keyAspect.max);
    expect(Math.abs(b.width - k[0].width), 'equal widths').toBeLessThanOrEqual(1);
    expect(Math.abs(b.height - k[0].height), 'equal heights').toBeLessThanOrEqual(1);
  }
  const w = k[0].width;
  expect(Math.abs(w / f.width - G.keyWidthOfFaceplate.target), `key width ratio ${(w / f.width).toFixed(3)}`).toBeLessThanOrEqual(G.keyWidthOfFaceplate.tolerance);
  const colPitch = (k[3].cx - k[0].cx) / 3 / w;
  const rowPitch = (k[16].cy - k[0].cy) / 4 / w;
  expect(colPitch, 'column pitch / key width').toBeGreaterThanOrEqual(G.columnPitchOverKeyWidth.min);
  expect(colPitch, 'column pitch / key width').toBeLessThanOrEqual(G.columnPitchOverKeyWidth.max);
  expect(rowPitch, 'row pitch / key width').toBeGreaterThanOrEqual(G.rowPitchOverKeyWidth.min);
  expect(rowPitch, 'row pitch / key width').toBeLessThanOrEqual(G.rowPitchOverKeyWidth.max);
});

test('L-12 desktop 1280×900: device fully visible, centered, sized to viewport', async ({ page }) => {
  const s = await box(page, sel.part('shell'));
  const { width: W, height: H } = G.desktopViewport;
  expect(s.x).toBeGreaterThanOrEqual(0);
  expect(s.y).toBeGreaterThanOrEqual(0);
  expect(s.right).toBeLessThanOrEqual(W);
  expect(s.bottom).toBeLessThanOrEqual(H);
  expect(Math.abs(s.cx - W / 2), 'horizontally centered').toBeLessThanOrEqual(2);
  expect(s.height / H).toBeGreaterThanOrEqual(G.desktopShellHeightOfViewport.min);
  expect(s.height / H).toBeLessThanOrEqual(G.desktopShellHeightOfViewport.max);
});

test('L-23 digit cells: equal width, even spacing, LED proportions, span the window', async ({ page }) => {
  const d = await boxes(page, sel.digits);
  expect(d).toHaveLength(8);
  const win = await box(page, sel.part('display'));
  const steps = d.slice(1).map((b, i) => b.x - d[i].x);
  for (const b of d) {
    expect(Math.abs(b.width - d[0].width), 'equal cell width').toBeLessThanOrEqual(1);
    expect(b.height / b.width, 'cell aspect').toBeGreaterThanOrEqual(G.digitCellAspect.min);
    expect(b.height / b.width, 'cell aspect').toBeLessThanOrEqual(G.digitCellAspect.max);
  }
  for (const s of steps) expect(s).toBeGreaterThan(0);
  expect(Math.max(...steps) - Math.min(...steps), 'even spacing').toBeLessThanOrEqual(1.5);
  expect((d[7].right - d[0].x) / win.width, 'digit row spans ≥ 60% of window').toBeGreaterThanOrEqual(0.6);
});

test('L-31 mobile 375×812: no horizontal scroll, device fits width, keys ≥ 44px', async ({ page }) => {
  const { width, height } = G.mobileViewport;
  await page.setViewportSize({ width, height });
  await open(page);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll, 'no horizontal scroll').toBeLessThanOrEqual(width);
  const s = await box(page, sel.part('shell'));
  expect(s.x).toBeGreaterThanOrEqual(0);
  expect(s.right).toBeLessThanOrEqual(width);
  const k = await boxes(page, sel.keys);
  expect(k).toHaveLength(20);
  for (const b of k) expect(Math.min(b.width, b.height), 'touch target').toBeGreaterThanOrEqual(G.mobileMinKeySize);
});
