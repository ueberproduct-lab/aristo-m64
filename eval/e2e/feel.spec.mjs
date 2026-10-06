// L-28, L-32 — tactile feel and runtime hygiene. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, pressKeys } from './helpers.mjs';

test('L-28 key press: travels down ≥1px, shadow changes, springs back; transition ≤100ms', async ({ page }) => {
  await open(page);
  const key = page.locator(sel.key('5'));
  const read = () =>
    key.evaluate((e) => {
      const cs = getComputedStyle(e);
      const durations = cs.transitionDuration.split(',').map((d) => (d.trim().endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000));
      return { y: e.getBoundingClientRect().y, shadow: cs.boxShadow, pressed: e.classList.contains('pressed'), maxTransition: Math.max(0, ...durations) };
    });
  const rest = await read();
  expect(rest.maxTransition, 'transition duration').toBeLessThanOrEqual(100);
  const b = await key.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const down = await read();
  expect(down.pressed, '.pressed while held').toBe(true);
  expect(down.y - rest.y, 'key travels down').toBeGreaterThanOrEqual(1);
  expect(down.shadow, 'shadow changes when pressed').not.toBe(rest.shadow);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const up = await read();
  expect(up.pressed, '.pressed removed after release').toBe(false);
  expect(Math.abs(up.y - rest.y), 'key returns').toBeLessThanOrEqual(0.5);
  expect(up.shadow).toBe(rest.shadow);
});

test('L-32 no console errors while loading and calculating', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);
  await expect(page.locator(sel.keys)).toHaveCount(20);
  await pressKeys(page, ['1', '2', '+', '3', '=', 'sqrt', '%', 'C', '1', '/', '0', '=', 'C']);
  expect(errors).toEqual([]);
});
