// L-07, L-14, L-19, L-20, L-21, L-22, L-25 — rendered pixels vs. tokens. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, boxes, snapshot, hexToRgb, deltaE, lab, fmtRgb, render } from './helpers.mjs';

const C = tokens.colors, T = tokens.pixelTolerance, LED = tokens.led;
test.beforeEach(async ({ page }) => open(page));

async function segBox(page, cell, seg) {
  return page.locator(sel.digits).nth(cell).locator(`[data-seg="${seg}"]`).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
}

/** a point inside the display window that is left of every LED cell */
async function windowSample(page) {
  const win = await box(page, sel.part('display'));
  const sign = await box(page, '[data-part="display"] [data-part="sign"]');
  const first = await box(page, sel.digits);
  const left = Math.min(sign.x, first.x);
  expect(left - win.x, 'display window needs ≥ 4px margin left of the LED cells').toBeGreaterThanOrEqual(4);
  return { x: win.x + (left - win.x) / 2, y: win.cy };
}

test('L-07 case on (top view): an even cream frame on all four sides, as on the original', async ({ page }) => {
  const s = await box(page, sel.part('shell'));
  const f = await box(page, sel.part('faceplate'));
  const R = tokens.case.rimOfShellWidth;
  const rim = { left: f.x - s.x, right: s.right - f.right, top: f.y - s.y, bottom: s.bottom - f.bottom };
  for (const [side, w] of Object.entries(rim)) {
    expect(w, `${side} rim visible`).toBeGreaterThanOrEqual(3);
    expect(Math.abs(w / s.width - R.target), `${side} rim ${(w / s.width).toFixed(3)} of the shell width`).toBeLessThanOrEqual(R.tolerance);
  }
  expect(Math.abs(rim.top - rim.bottom), 'top rim = bottom rim').toBeLessThanOrEqual(1);
  expect(Math.abs(rim.left - rim.right), 'left rim = right rim').toBeLessThanOrEqual(1);
  const img = await snapshot(page);
  const shell = hexToRgb(C['--m64-shell']);
  const rims = { top: img.at(s.cx, (s.y + f.y) / 2, 0), bottom: img.at(s.cx, (s.bottom + f.bottom) / 2, 0) };
  for (const frac of tokens.case.rimSampleFractionsOfHeight) {
    const y = s.y + frac * s.height;
    rims[`left @${frac * 100}%`] = img.at((s.x + f.x) / 2, y, 0);
    rims[`right @${frac * 100}%`] = img.at((s.right + f.right) / 2, y, 0);
  }
  for (const [name, rgb] of Object.entries(rims)) {
    expect(deltaE(rgb, shell), `${name} rim ${fmtRgb(rgb)} vs ${C['--m64-shell']}`).toBeLessThanOrEqual(T.shellDeltaE);
  }
});

test('L-14 faceplate renders matte black (token color)', async ({ page }) => {
  const k = await boxes(page, sel.keys);
  const foot = await box(page, sel.part('foot'));
  const img = await snapshot(page);
  const target = hexToRgb(C['--m64-faceplate']);
  const points = {
    'gap col0/col1 row2': [(k[8].right + k[9].x) / 2, k[8].cy],
    'gap col2/col3 row3': [(k[14].right + k[15].x) / 2, k[14].cy],
    'gap row1/row2 col1': [k[5].cx, (k[5].bottom + k[9].y) / 2],
    'foot plate left': [foot.x + foot.width * 0.08, foot.cy],
  };
  for (const [name, [x, y]] of Object.entries(points)) {
    const rgb = img.at(x, y);
    expect(deltaE(rgb, target), `${name} ${fmtRgb(rgb)} vs ${C['--m64-faceplate']}`).toBeLessThanOrEqual(T.faceplateDeltaE);
  }
});

test('L-19 lit segments glow LED red', async ({ page }) => {
  await render(page, '88888888.');
  const img = await snapshot(page);
  for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const b = await segBox(page, 7, seg);
    const [r, g, bl] = img.at(b.cx, b.cy);
    expect(r, `seg ${seg} red ${fmtRgb([r, g, bl])}`).toBeGreaterThanOrEqual(LED.litMinRed);
    expect(g, `seg ${seg} green`).toBeLessThanOrEqual(LED.litMaxGreen);
    expect(bl, `seg ${seg} blue`).toBeLessThanOrEqual(LED.litMaxBlue);
  }
});

test('L-20 unlit segments are faintly visible (ghost segments)', async ({ page }) => {
  await render(page, '0.');
  const img = await snapshot(page);
  const w = await windowSample(page);
  const bg = img.at(w.x, w.y);
  for (const seg of ['a', 'd', 'g']) {
    const b = await segBox(page, 0, seg);
    const ghost = img.at(b.cx, b.cy);
    expect(deltaE(ghost, bg), `ghost ${seg} ${fmtRgb(ghost)} vs window ${fmtRgb(bg)}`).toBeGreaterThanOrEqual(LED.ghostMinDeltaEFromWindow);
    expect(lab(ghost)[0], `ghost ${seg} stays dark`).toBeLessThanOrEqual(LED.ghostMaxLightness);
  }
});

test('L-21 lit segments have a red glow around them', async ({ page }) => {
  await render(page, '8.');
  const img = await snapshot(page);
  const lit = await segBox(page, 7, 'f');
  const dark = await segBox(page, 6, 'f');
  const litHalo = img.at(lit.x - 2, lit.cy, 0);
  const darkHalo = img.at(dark.x - 2, dark.cy, 0);
  expect(litHalo[0] - darkHalo[0], `halo ${fmtRgb(litHalo)} vs ${fmtRgb(darkHalo)}`).toBeGreaterThanOrEqual(LED.glowMinRedGain);
});

test('L-22 display window is dark and red-tinted', async ({ page }) => {
  const img = await snapshot(page);
  const w = await windowSample(page);
  const [L, a] = lab(img.at(w.x, w.y));
  expect(L, 'window lightness').toBeLessThanOrEqual(20);
  expect(a, 'window red tint (a*)').toBeGreaterThan(0);
});

test('L-25 rendered key colors match the tokens', async ({ page }) => {
  const k = await boxes(page, sel.keys);
  expect(k).toHaveLength(20);
  const img = await snapshot(page);
  const tokenOf = { white: '--m64-key-white', yellow: '--m64-key-yellow', red: '--m64-key-red' };
  for (const [i, def] of tokens.keys.entries()) {
    const rgb = img.at(k[i].x + k[i].width * 0.22, k[i].cy);
    const target = C[tokenOf[def.color]];
    expect(deltaE(rgb, hexToRgb(target)), `key ${def.key} ${fmtRgb(rgb)} vs ${target}`).toBeLessThanOrEqual(T.keyDeltaE);
  }
});
