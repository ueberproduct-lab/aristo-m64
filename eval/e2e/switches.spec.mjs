// L-55…L-57 — F14 slide switches like the original: long cream guide, chunky protruding knob with a hard
// front edge, larger and brighter labels. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, snapshot, lab, parseCssColor } from './helpers.mjs';

const S = tokens.switchesF14;
const IDS = ['k', 'dec', 'power'];
test.beforeEach(async ({ page }) => open(page));

test('L-55 guide ≈ 15 % of the device width; the knob is a block that protrudes from the slot', async ({ page }) => {
  const f = await box(page, sel.part('faceplate'));
  for (const id of IDS) {
    const sw = page.locator(sel.sw(id));
    const slot = await sw.locator('[data-part="switch-slot"]').boundingBox();
    const knob = await sw.locator('[data-part="switch-knob"]').boundingBox();
    expect(Math.abs(slot.width / f.width - S.slotOfWidth.target), `${id}: guide ${(slot.width / f.width).toFixed(3)} of the width`).toBeLessThanOrEqual(S.slotOfWidth.tolerance);
    expect(knob.height / slot.height, `${id}: knob protrudes (height ${(knob.height / slot.height).toFixed(2)} × slot)`).toBeGreaterThanOrEqual(S.knobOverSlotHeight.min);
    expect(knob.height / slot.height, `${id}: knob protrudes (height ${(knob.height / slot.height).toFixed(2)} × slot)`).toBeLessThanOrEqual(S.knobOverSlotHeight.max);
    expect(knob.width / slot.width, `${id}: knob width ${(knob.width / slot.width).toFixed(2)} of the guide`).toBeGreaterThanOrEqual(S.knobOfSlotWidth.min);
    expect(knob.width / slot.width, `${id}: knob width ${(knob.width / slot.width).toFixed(2)} of the guide`).toBeLessThanOrEqual(S.knobOfSlotWidth.max);
  }
});

test('L-56 knob relief: light top face, clearly darker front edge, hard edge between them', async ({ page }) => {
  const img = await snapshot(page);
  for (const id of IDS) {
    const knob = await page.locator(sel.sw(id)).locator('[data-part="switch-knob"]').boundingBox();
    const cx = knob.x + knob.width / 2;
    const prof = [];
    for (let y = Math.ceil(knob.y); y < Math.floor(knob.y + knob.height); y++) prof.push(lab(img.at(cx, y, 0))[0]);
    const n = prof.length;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const top = mean(prof.slice(0, Math.max(1, Math.round(n * 0.4))));
    const front = mean(prof.slice(Math.round(n * 0.7), Math.max(Math.round(n * 0.7) + 1, Math.round(n * 0.9))));
    const inner = prof.slice(Math.round(n * 0.1), Math.round(n * 0.85));
    const hard = Math.max(...inner.slice(1).map((v, i) => Math.abs(v - inner[i])));
    const pr = prof.map((v) => v.toFixed(0)).join(' ');
    expect(top - front, `${id}: top face vs front edge ΔL* (${pr})`).toBeGreaterThanOrEqual(S.topMinusFrontMinDeltaL);
    expect(hard, `${id}: hard edge between top face and front edge (${pr})`).toBeGreaterThanOrEqual(S.hardEdgeMinStepL);
  }
});

test('L-57 switch labels larger and brighter, like the original print', async ({ page }) => {
  const logo = await page.locator(sel.part('logo')).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  for (const id of IDS) {
    const l = await page.locator(sel.sw(id)).evaluate((el) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const out = [];
      let n;
      while ((n = w.nextNode())) if (n.textContent.trim()) { const cs = getComputedStyle(n.parentElement); out.push({ size: parseFloat(cs.fontSize), color: cs.color }); }
      return out;
    });
    expect(l.length, `${id}: two labels`).toBeGreaterThanOrEqual(2);
    for (const x of l) {
      expect(x.size / logo, `${id}: label ${(x.size / logo).toFixed(2)} of the logo size`).toBeGreaterThanOrEqual(S.labelOfLogoMin);
      expect(lab(parseCssColor(x.color))[0], `${id}: label lightness`).toBeGreaterThanOrEqual(S.labelMinLightness);
    }
  }
});
