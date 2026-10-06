// L-46…L-48 — F12 Feinschliff: logo typography, raised switch knobs, sculpted relief (head step, switch groove, foot ledge). FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, snapshot, lab } from './helpers.mjs';

const P = tokens.polish;
test.beforeEach(async ({ page }) => open(page));

test('L-46 logo: moderate tracking, normal word gaps, broad geometric face', async ({ page }) => {
  const r = await page.locator(sel.part('logo')).evaluate((el) => {
    const main = parseFloat(getComputedStyle(el).fontSize);
    const hosts = new Set();
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.textContent.trim()) hosts.add(n.parentElement);
    const cs = getComputedStyle(el);
    return {
      main,
      family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      weight: Number(cs.fontWeight),
      wordSpacing: cs.wordSpacing === 'normal' ? 0 : parseFloat(cs.wordSpacing),
      tracking: [...hosts].map((h) => (parseFloat(getComputedStyle(h).letterSpacing) || 0) / main),
    };
  });
  for (const t of r.tracking) {
    expect(t, `letter-spacing ${t.toFixed(3)}em of the logo size`).toBeGreaterThanOrEqual(P.logoTrackingMin);
    expect(t, `letter-spacing ${t.toFixed(3)}em of the logo size`).toBeLessThanOrEqual(P.logoTrackingMax);
  }
  expect(Math.abs(r.wordSpacing) / r.main, 'normal word gaps').toBeLessThanOrEqual(P.logoWordSpacingMax);
  expect(P.logoFamilies, `first font-family "${r.family}" must be a broad geometric face`).toContain(r.family);
  expect(r.weight).toBeGreaterThanOrEqual(P.logoWeightMin);
  expect(r.weight).toBeLessThanOrEqual(P.logoWeightMax);
});

test('L-47 slide switches: chunky raised knobs that nearly fill the slot, with a shaded front edge', async ({ page }) => {
  for (const id of ['k', 'dec', 'power']) {
    const sw = page.locator(sel.sw(id));
    await expect(sw.locator('[data-part="switch-slot"]'), `${id} slot`).toHaveCount(1);
    await expect(sw.locator('[data-part="switch-knob"]'), `${id} knob`).toHaveCount(1);
    const slot = await sw.locator('[data-part="switch-slot"]').boundingBox();
    const knob = await sw.locator('[data-part="switch-knob"]').boundingBox();
    expect(knob.height / slot.height, `${id}: knob height / slot height`).toBeGreaterThanOrEqual(P.knobFillMin);
    expect(knob.width / knob.height, `${id}: knob aspect`).toBeGreaterThanOrEqual(P.knobAspectMin);
    expect(knob.width / knob.height, `${id}: knob aspect`).toBeLessThanOrEqual(P.knobAspectMax);
    const cs = await sw.locator('[data-part="switch-knob"]').evaluate((e) => ({ bg: getComputedStyle(e).backgroundImage, shadow: getComputedStyle(e).boxShadow }));
    expect(cs.bg, `${id}: knob shaded (gradient)`).toMatch(/gradient/);
    expect(cs.shadow, `${id}: knob casts a shadow`).not.toBe('none');
  }
  const k = await page.locator(sel.sw('power')).locator('[data-part="switch-knob"]').boundingBox();
  const img = await snapshot(page);
  const top = lab(img.at(k.x + k.width / 2, k.y + k.height * 0.2, 0))[0];
  const front = lab(img.at(k.x + k.width / 2, k.y + k.height * 0.9, 0))[0];
  expect(top - front, `power knob: top face L* ${top.toFixed(1)} lighter than front edge ${front.toFixed(1)}`).toBeGreaterThanOrEqual(P.knobEdgeMinDeltaL);
});

test('L-48 relief: head plate steps down to a recessed switch groove; the foot is a separate ledge', async ({ page }) => {
  const f = await box(page, sel.part('faceplate'));
  const head = await box(page, sel.part('head'));
  const foot = await box(page, sel.part('foot'));
  const img = await snapshot(page);
  const profile = (yc) => {
    const out = [];
    for (const fx of P.reliefSampleX) {
      const x = f.x + f.width * fx;
      const ls = [];
      for (let dy = -P.reliefBandPx; dy <= P.reliefBandPx; dy++) ls.push(lab(img.at(x, yc + dy, 0))[0]);
      out.push(Math.max(...ls) - Math.min(...ls));
    }
    return Math.min(...out);
  };
  const flat = profile(f.y + f.height * 0.5 + 1e-3);
  const headStep = profile(head.bottom);
  const footLedge = profile(foot.y);
  expect(headStep, `head → switch groove: visible step (L* range ${headStep.toFixed(1)})`).toBeGreaterThanOrEqual(P.headStepMinDeltaL);
  expect(footLedge, `keypad → foot ledge: visible edge (L* range ${footLedge.toFixed(1)})`).toBeGreaterThanOrEqual(P.footLedgeMinDeltaL);
  expect(flat, 'reference: the plain faceplate (keypad margin) stays flat').toBeLessThan(P.flatMaxDeltaL);
});
