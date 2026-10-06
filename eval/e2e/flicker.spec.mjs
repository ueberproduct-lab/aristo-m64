// L-38…L-40 — F9 Display-Flackern (very light, very short LED flicker on key press). FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, pressKeys } from './helpers.mjs';

const FL = tokens.flicker;
const EGG = '[data-part="foot"] [data-config="case"]';

/** record every add/remove of the `flicker` class on the display (performance.now timestamps) */
async function recordFlicker(page) {
  await page.evaluate(() => {
    const d = document.querySelector('[data-part="display"]');
    window.__flick = [];
    let on = d.classList.contains('flicker');
    new MutationObserver(() => {
      const now = d.classList.contains('flicker');
      if (now !== on) { window.__flick.push({ on: now, t: performance.now() }); on = now; }
    }).observe(d, { attributes: true, attributeFilter: ['class'] });
  });
}
/** durations (ms) of completed flickers */
const flickers = (page) =>
  page.evaluate(() => {
    const out = [];
    let start = null;
    for (const e of window.__flick) {
      if (e.on) start = e.t;
      else if (start !== null) { out.push(e.t - start); start = null; }
    }
    return { durations: out, adds: window.__flick.filter((e) => e.on).length };
  });

test.beforeEach(async ({ page }) => open(page));

test('L-38 every key press (mouse and keyboard) flickers the display for 40–120 ms', async ({ page }) => {
  await recordFlicker(page);
  await pressKeys(page, ['5']);
  await page.waitForTimeout(300);
  await pressKeys(page, ['+']);
  await page.waitForTimeout(300);
  await page.keyboard.press('7');
  await page.waitForTimeout(300);
  const { durations, adds } = await flickers(page);
  expect(adds, 'one flicker per press').toBe(3);
  expect(durations).toHaveLength(3);
  for (const d of durations) {
    expect(d, `flicker duration ${d.toFixed(0)} ms`).toBeGreaterThanOrEqual(FL.minMs - 5);
    expect(d, `flicker duration ${d.toFixed(0)} ms`).toBeLessThanOrEqual(FL.maxMs + 20);
  }
});

test('L-39 the flicker is a short CSS/Web animation and very light (dips ≤ 0.95, never below 0.6)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const d = document.querySelector('[data-part="display"]');
    const seg = d.querySelectorAll('[data-part="digit"]')[7].querySelector('[data-seg="a"]');
    const valueBefore = d.dataset.value;
    d.classList.add('flicker');
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const anims = document.getAnimations().filter((a) => {
      const t = a.effect && a.effect.target;
      return t && (t === d || d.contains(t));
    });
    const effective = () => {
      let v = 1;
      for (let n = seg; n && n !== d.parentElement; n = n.parentElement || n.parentNode) {
        if (!(n instanceof Element)) break;
        const cs = getComputedStyle(n);
        v *= Number(cs.opacity);
        const m = cs.filter.match(/brightness\(([\d.]+)(%?)\)/);
        if (m) v *= m[2] ? Number(m[1]) / 100 : Number(m[1]);
      }
      return v;
    };
    const samples = [];
    let end = 0;
    for (const a of anims) { a.pause(); end = Math.max(end, a.effect.getComputedTiming().endTime); }
    for (let i = 0; i <= 24 && anims.length; i++) {
      const t = (end * i) / 24;
      for (const a of anims) a.currentTime = Math.min(t, a.effect.getComputedTiming().endTime);
      samples.push(effective());
    }
    for (const a of anims) a.cancel();
    d.classList.remove('flicker');
    return { count: anims.length, end, min: Math.min(...samples), samples, valueSame: d.dataset.value === valueBefore, segLit: seg.classList.contains('lit') };
  });
  expect(r.segLit, 'probe segment is lit (initial "0.")').toBe(true);
  expect(r.count, 'flicker implemented as CSS/Web animation on the display').toBeGreaterThan(0);
  expect(r.end, 'animation length').toBeLessThanOrEqual(FL.maxMs);
  expect(r.min, `visible dip (min ${r.min.toFixed(2)})`).toBeLessThanOrEqual(FL.maxDipOpacity);
  expect(r.min, `very light: never below ${FL.minOpacity}`).toBeGreaterThanOrEqual(FL.minOpacity);
  expect(r.valueSame, 'data-value untouched by the flicker').toBe(true);
});

test('L-40 no flicker when off, on the easter egg, on render(), or with reduced motion', async ({ page }) => {
  await recordFlicker(page);
  await page.evaluate(() => window.m64.render('42.'));
  await page.locator(EGG).click();
  await page.locator(EGG).click();
  await page.locator(sel.sw('power')).click();
  await pressKeys(page, ['5']);
  await page.keyboard.press('6');
  await page.waitForTimeout(250);
  expect((await flickers(page)).adds, 'no flicker for render / easter egg / power off').toBe(0);
  await page.locator(sel.sw('power')).click();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await recordFlicker(page);
  await pressKeys(page, ['5']);
  await page.waitForTimeout(250);
  expect((await flickers(page)).adds, 'no flicker with prefers-reduced-motion').toBe(0);
  expect(await page.locator(sel.part('display')).getAttribute('data-value')).toBe('5.');
});
