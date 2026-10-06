// L-34…L-37 — F8 Schutzhülle (protective case on/off), toggled by the easter egg on "MADE IN GERMANY". FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, boxes, snapshot, hexToRgb, deltaE, lab, fmtRgb, displayValue, pressKeys } from './helpers.mjs';

const CFG = '[data-part="foot"] [data-config="case"]';
const K = tokens.case;
const intersects = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

test.beforeEach(async ({ page }) => open(page));

test('L-34 easter egg: clicking "MADE IN GERMANY" toggles the case — and nothing gives it away', async ({ page }) => {
  const egg = page.locator(CFG);
  await expect(egg).toHaveCount(1);
  expect((await egg.innerText()).replace(/\s+/g, ' ').trim().toUpperCase()).toBe('MADE IN GERMANY');
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', K.default);
  await expect(page.getByText(/Schutzhülle/i).filter({ visible: true }), 'no visible "Schutzhülle" anywhere').toHaveCount(0);
  const look = () => egg.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { cursor: cs.cursor, color: cs.color, deco: cs.textDecorationLine, opacity: cs.opacity, shadow: cs.textShadow, transform: cs.transform };
  });
  const rest = await look();
  expect(rest.cursor, 'no pointer cursor').not.toBe('pointer');
  await egg.hover();
  await page.waitForTimeout(150);
  expect(await look(), 'no hover change').toEqual(rest);

  await egg.click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'off');
  expect(await displayValue(page), 'the click does not reach the calculator').toBe('0.');
  await egg.click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'on');
  expect(await displayValue(page)).toBe('0.');
});

test('L-35 without case: no cream anywhere the case rim was — background or black body instead', async ({ page }) => {
  const s = await box(page, sel.part('shell'));
  const f = await box(page, sel.part('faceplate'));
  const points = { top: [s.cx, (s.y + f.y) / 2], bottom: [s.cx, (s.bottom + f.bottom) / 2] };
  for (const frac of K.rimSampleFractionsOfHeight) {
    const y = s.y + frac * s.height;
    points[`left @${frac * 100}%`] = [(s.x + f.x) / 2, y];
    points[`right @${frac * 100}%`] = [(s.right + f.right) / 2, y];
  }
  await page.locator(CFG).click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'off');
  await page.waitForTimeout(300);
  const img = await snapshot(page);
  const cream = hexToRgb(tokens.colors['--m64-shell']);
  for (const [name, [x, y]] of Object.entries(points)) {
    const rgb = img.at(x, y, 0);
    const bgX = name.startsWith('right') ? s.right + K.backgroundSampleOffsetPx : s.x - K.backgroundSampleOffsetPx;
    const bg = name === 'top' ? img.at(s.x - K.backgroundSampleOffsetPx, s.y - K.backgroundSampleOffsetPx, 0)
      : name === 'bottom' ? img.at(s.x - K.backgroundSampleOffsetPx, s.bottom + K.backgroundSampleOffsetPx, 0)
      : img.at(bgX, y, 0);
    const isBackground = deltaE(rgb, bg) <= K.offBackgroundMaxDeltaE;
    const isBody = lab(rgb)[0] <= K.offBodyMaxLightness;
    expect(isBackground || isBody, `${name}: ${fmtRgb(rgb)} must be background ${fmtRgb(bg)} or black body (ΔE to cream ${deltaE(rgb, cream).toFixed(1)})`).toBe(true);
  }
  await page.locator(CFG).click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'on');
});

test('L-36 toggling the case moves nothing on the device and keeps the calculator state', async ({ page }) => {
  const parts = [sel.part('faceplate'), sel.part('display'), sel.keys];
  const before = [];
  for (const p of parts) before.push(...(await boxes(page, p)));
  await pressKeys(page, ['1', '2', '3']);
  await page.locator(CFG).click();
  await page.waitForTimeout(300);
  const after = [];
  for (const p of parts) after.push(...(await boxes(page, p)));
  expect(after).toHaveLength(before.length);
  before.forEach((b, i) => {
    for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(after[i][k] - b[k]), `element ${i} ${k}`).toBeLessThanOrEqual(K.layoutShiftMaxPx);
  });
  expect(await displayValue(page)).toBe('123.');
  await pressKeys(page, ['+', '1', '=']);
  expect(await displayValue(page)).toBe('124.');
});

test('L-37 the choice survives a reload; default "on"; works without storage', async ({ page, context }) => {
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', K.default);
  await page.locator(CFG).click();
  await open(page);
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'off');
  expect(await page.evaluate((k) => localStorage.getItem(k), K.storageKey)).toBe('off');
  await page.locator(CFG).click();
  await open(page);
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-case', 'on');

  const blocked = await context.newPage();
  const errors = [];
  blocked.on('pageerror', (e) => errors.push(String(e)));
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }));
  await open(blocked);
  await blocked.locator(CFG).click();
  await expect(blocked.locator(sel.part('shell'))).toHaveAttribute('data-case', 'off');
  expect(errors, 'no errors when storage is unavailable').toEqual([]);
});
