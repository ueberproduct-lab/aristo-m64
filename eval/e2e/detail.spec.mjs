// L-49…L-53 — F13 close to the original (M 64 front detail photo): housing curves, translucent display,
// switch haptics, keys, audible sound. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, box, snapshot, lab, deltaE, fmtRgb, render } from './helpers.mjs';

const D = tokens.detail;
test.beforeEach(async ({ page }) => open(page));

test('L-49 housing: rounded corners and clearly visible rounded side edges (light band along both sides)', async ({ page }) => {
  const f = await box(page, sel.part('faceplate'));
  const radii = await page.locator(sel.part('faceplate')).evaluate((e) => {
    const cs = getComputedStyle(e);
    return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map((k) => parseFloat(cs[k]) || 0);
  });
  for (const r of radii) {
    expect(r / f.width, `corner radius ${(r / f.width).toFixed(3)} of the width`).toBeGreaterThanOrEqual(D.cornerRadiusMin);
    expect(r / f.width, `corner radius ${(r / f.width).toFixed(3)} of the width`).toBeLessThanOrEqual(D.cornerRadiusMax);
  }
  const R = D.sideRounding;
  const head = await box(page, sel.part('head'));
  const foot = await box(page, sel.part('foot'));
  const img = await snapshot(page);
  const band = Math.round(f.width * R.bandOfWidth);
  for (const [where, y] of [['head', head.cy], ['foot', foot.cy]]) {
    for (const side of ['left', 'right']) {
      const xAt = (d) => (side === 'left' ? f.x + d : f.right - 1 - d);
      const inner = lab(img.at(side === 'left' ? f.x + f.width * R.interiorAtOfWidth : f.right - f.width * R.interiorAtOfWidth, y, 0))[0];
      const prof = Array.from({ length: band }, (_, d) => lab(img.at(xAt(d), y, 0))[0] - inner);
      const peak = Math.max(...prof);
      const zone = prof.filter((v) => v >= R.zoneMinDeltaL).length;
      expect(peak, `${side} edge @${where}: highlight ΔL* ${peak.toFixed(1)} (profile ${prof.map((v) => v.toFixed(0)).join(' ')})`).toBeGreaterThanOrEqual(R.peakMinDeltaL);
      expect(zone, `${side} edge @${where}: rounded zone ${zone}px wide`).toBeGreaterThanOrEqual(R.zoneMinPx);
    }
  }
});

test('L-50 display: wide, deep translucent window with small, fine LED digits and barely visible ghosts', async ({ page }) => {
  const f = await box(page, sel.part('faceplate'));
  const win = await box(page, sel.part('display'));
  expect(Math.abs(win.width / f.width - D.windowWidthOfFaceplate.target), `window width ${(win.width / f.width).toFixed(3)} of the faceplate`).toBeLessThanOrEqual(D.windowWidthOfFaceplate.tolerance);
  await render(page, '88888888.');
  const g = await page.evaluate(() => {
    const cell = document.querySelectorAll('[data-part="digit"]')[7];
    const bb = (e) => e.getBoundingClientRect();
    const a = bb(cell.querySelector('[data-seg="a"]')), d = bb(cell.querySelector('[data-seg="d"]')), c = bb(cell);
    return { stroke: a.height / c.width, glyph: d.bottom - a.top };
  });
  expect(g.stroke, `segment stroke ${g.stroke.toFixed(3)} of the cell width`).toBeLessThanOrEqual(D.strokeOfCellMax);
  expect(g.glyph / win.height, `glyph height ${(g.glyph / win.height).toFixed(2)} of the window`).toBeLessThanOrEqual(D.glyphOfWindowMax);

  await render(page, '0.');
  const img = await snapshot(page);
  const bg = img.at(win.x + 3, win.cy, 0);
  const ghost = await page.locator(sel.digits).nth(0).locator('[data-seg="g"]').evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const gRgb = img.at(ghost[0], ghost[1], 0);
  expect(deltaE(gRgb, bg), `ghost ${fmtRgb(gRgb)} vs window ${fmtRgb(bg)}: barely visible`).toBeLessThanOrEqual(D.ghostMaxDeltaE);
  const depth = lab(img.at(win.x + 3, win.cy, 0))[0] - lab(img.at(win.x + 3, win.y + 2, 0))[0];
  expect(depth, `window depth: centre lighter than the top edge (ΔL* ${depth.toFixed(1)})`).toBeGreaterThanOrEqual(D.windowDepthMinDeltaL);
});

test('L-51 switches: cream slider guide in the slot (not black), light veil on K and F/2', async ({ page }) => {
  const img = await snapshot(page);
  const knobColor = {};
  for (const id of ['k', 'dec', 'power']) {
    const sw = page.locator(sel.sw(id));
    const slot = await sw.locator('[data-part="switch-slot"]').boundingBox();
    const knob = await sw.locator('[data-part="switch-knob"]').boundingBox();
    const leftGap = knob.x - slot.x, rightGap = slot.x + slot.width - (knob.x + knob.width);
    const x = leftGap > rightGap ? slot.x + leftGap / 2 : knob.x + knob.width + rightGap / 2;
    expect(Math.max(leftGap, rightGap), `${id}: free part of the slot visible`).toBeGreaterThanOrEqual(3);
    const L = lab(img.at(x, slot.y + slot.height / 2, 0))[0];
    expect(L, `${id}: slot guide is light cream, L* ${L.toFixed(1)}`).toBeGreaterThanOrEqual(id === 'power' ? D.slotMinLightness : D.slotMinLightnessVeiled);
    knobColor[id] = img.at(knob.x + knob.width / 2, knob.y + knob.height * 0.3, 0);
  }
  for (const id of ['k', 'dec']) {
    expect(deltaE(knobColor[id], knobColor.power), `${id}: only a light veil vs the power knob`).toBeLessThanOrEqual(D.veilMaxDeltaE);
  }
});

test('L-52 keys like the original: geometric legend face, "CE" as large as "C"', async ({ page }) => {
  const r = await page.locator(sel.keys).evaluateAll((els) =>
    els.map((k) => {
      const w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) if (n.textContent.trim()) break;
      const cs = getComputedStyle(n.parentElement);
      return { key: k.dataset.key, family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(cs.fontSize) };
    }),
  );
  for (const k of r.filter((x) => /^[0-9]$|^C$|^CE$|^%$/.test(x.key))) {
    expect(tokens.polish.logoFamilies, `${k.key}: legend face "${k.family}"`).toContain(k.family);
  }
  const C = r.find((x) => x.key === 'C'), CE = r.find((x) => x.key === 'CE');
  expect(CE.size / C.size, '"CE" as large as "C"').toBeGreaterThanOrEqual(D.ceSizeOfCMin);
});

test('L-53 the key sound really reaches the audio output (running context, audible level) — and nothing while muted', async ({ page }) => {
  await page.addInitScript(() => {
    window.__peak = 0;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode && !(this.context instanceof OfflineAudioContext)) {
        const ctx = this.context;
        if (!ctx.__tap) {
          ctx.__tap = ctx.createAnalyser();
          ctx.__tap.fftSize = 2048;
          const buf = new Float32Array(2048);
          setInterval(() => {
            ctx.__tap.getFloatTimeDomainData(buf);
            for (const v of buf) window.__peak = Math.max(window.__peak, Math.abs(v));
            window.__state = ctx.state;
          }, 10);
        }
        orig.call(this, ctx.__tap);
      }
      return orig.call(this, dest, ...rest);
    };
  });
  await open(page);
  await page.locator(sel.key('5')).click();
  await page.waitForTimeout(400);
  const on = await page.evaluate(() => ({ peak: window.__peak, state: window.__state }));
  expect(on.state, 'AudioContext running').toBe('running');
  expect(on.peak, `audible at the output (peak ${on.peak.toFixed(3)})`).toBeGreaterThanOrEqual(D.audibleMinPeak);
  await page.locator('[data-part="head"] [data-config="sound"]').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__peak = 0; });
  await page.locator(sel.key('6')).click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__peak), 'muted: silence at the output').toBe(0);
});
