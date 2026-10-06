// L-58, L-59 — F15 pitch per key row: the bottom row sounds lowest, every row above slightly higher. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens } from './helpers.mjs';

const P = tokens.sound.rowPitch;
const semis = (ratio) => 12 * Math.log2(ratio);

test.beforeEach(async ({ page }) => open(page));

test('L-58 playKeyClick(ctx, when, { pitch }) shifts the whole stroke; L-41 holds for every row pitch', async ({ page }) => {
  const r = await page.evaluate(async (P) => {
    const { playKeyClick } = await import('/sound.js');
    const sr = 44100;
    const render = async (pitch) => {
      const ctx = new OfflineAudioContext(1, Math.round(sr * 0.3), sr);
      playKeyClick(ctx, 0, { pitch });
      return (await ctx.startRendering()).getChannelData(0);
    };
    const centroid = (x) => {
      const N = 4096, P2 = [];
      for (let k = 0; k < N / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) { const v = x[n] || 0, a = (2 * Math.PI * k * n) / N; re += v * Math.cos(a); im -= v * Math.sin(a); }
        P2.push(re * re + im * im);
      }
      const tot = P2.reduce((a, b) => a + b, 0);
      return { c: P2.reduce((a, p, k) => a + p * (k * sr) / N, 0) / tot, hi3k: P2.reduce((a, p, k) => a + ((k * sr) / N >= 3000 ? p : 0), 0) / tot, hi2k: P2.reduce((a, p, k) => a + ((k * sr) / N >= 2000 ? p : 0), 0) / tot, low: P2.reduce((a, p, k) => a + ((k * sr) / N < 600 ? p : 0), 0) / tot };
    };
    const top = Math.pow(2, (P.semitonesPerRow * 4) / 12);
    const avg = async (pitch) => {
      const xs = [];
      for (let i = 0; i < 6; i++) xs.push(centroid(await render(pitch)));
      const mean = (k) => xs.reduce((a, x) => a + x[k], 0) / xs.length;
      return { c: mean('c'), hi3k: mean('hi3k'), hi2k: mean('hi2k'), low: mean('low') };
    };
    return { base: await avg(1), top: await avg(top), expected: top };
  }, P);
  const shift = semis(r.top.c / r.base.c), want = semis(r.expected);
  expect(Math.abs(shift - want), `pitch option shifts the spectrum by ${shift.toFixed(2)} semitones (want ${want.toFixed(2)})`).toBeLessThanOrEqual(P.toleranceSemitones);
  const S = tokens.sound;
  for (const [name, m] of [['bottom row (pitch 1)', r.base], ['top row', r.top]]) {
    expect(m.hi3k, `${name}: no sharp tick above ${S.veryHighCutHz} Hz`).toBeLessThanOrEqual(S.veryHighShareMax);
    expect(m.hi2k, `${name}: not bright above ${S.highCutHz} Hz`).toBeLessThanOrEqual(S.highShareMax);
    expect(m.hi2k, `${name}: mechanical part above ${S.highCutHz} Hz`).toBeGreaterThanOrEqual(S.highShareMin);
    expect(m.low, `${name}: body below ${S.lowCutHz} Hz`).toBeGreaterThanOrEqual(S.lowShareMin);
    expect(m.c, `${name}: centroid`).toBeLessThanOrEqual(S.centroidMax);
  }
});

test('L-59 every row sounds slightly higher than the one below (mouse and keyboard)', async ({ page }) => {
  await page.addInitScript(() => {
    window.__strokes = [];
    const orig = BaseAudioContext.prototype.createOscillator;
    BaseAudioContext.prototype.createOscillator = function (...a) {
      const o = orig.apply(this, a);
      if (!(this instanceof OfflineAudioContext)) {
        const p = o.frequency, sv = p.setValueAtTime.bind(p);
        p.setValueAtTime = (v, t) => { window.__freqs.push(v); return sv(v, t); };
      }
      return o;
    };
    window.__freqs = [];
  });
  await open(page);
  // lowest oscillator frequency of one stroke = its body; averaged over several strokes per row
  const strokeBody = async (doPress) => {
    await page.evaluate(() => { window.__freqs = []; });
    await doPress();
    const f = await page.evaluate(() => window.__freqs);
    expect(f.length, 'the press plays a stroke').toBeGreaterThan(0);
    return Math.min(...f);
  };
  const rows = [['C', 'CE'], ['7', '9'], ['4', '6'], ['1', '3'], ['0', '=']]; // top → bottom
  const means = [];
  for (const keys of rows) {
    const v = [];
    for (let i = 0; i < 4; i++) for (const k of keys) v.push(await strokeBody(() => page.locator(sel.key(k)).click()));
    means.push(v.reduce((a, b) => a + b, 0) / v.length);
  }
  for (let i = 0; i < 4; i++) {
    expect(semis(means[i] / means[i + 1]), `row ${i + 1} higher than row ${i + 2}`).toBeGreaterThanOrEqual(P.minStepSemitones);
  }
  const total = semis(means[0] / means[4]), want = P.semitonesPerRow * 4;
  expect(Math.abs(total - want), `top row ${total.toFixed(2)} semitones above the bottom row (want ${want})`).toBeLessThanOrEqual(P.toleranceSemitones);
  // physical keys: same row, same pitch range as the on-screen key
  const kb = [];
  for (let i = 0; i < 6; i++) kb.push(await strokeBody(() => page.keyboard.press('7')));
  const kbMean = kb.reduce((a, b) => a + b, 0) / kb.length;
  expect(Math.abs(semis(kbMean / means[1])), 'keyboard "7" sounds like the on-screen 7 row').toBeLessThanOrEqual(P.toleranceSemitones);
});
