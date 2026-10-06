// L-41…L-43 — F10 Tastenklang: short, full-bodied mechanical key sound, synthesized with Web Audio. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, pressKeys } from './helpers.mjs';

const S = tokens.sound;
const EGG = '[data-part="foot"] [data-config="case"]';

/** render playKeyClick offline and measure it (runs in the page) */
const analyse = (page) =>
  page.evaluate(async (S) => {
    const { playKeyClick } = await import('/sound.js');
    const sr = 44100;
    const render = async () => {
      const ctx = new OfflineAudioContext(1, Math.round(sr * 0.4), sr);
      playKeyClick(ctx, 0);
      return (await ctx.startRendering()).getChannelData(0);
    };
    const x = await render();
    const y = await render();
    let peak = 0, peakIdx = 0;
    x.forEach((v, i) => { if (Math.abs(v) > peak) { peak = Math.abs(v); peakIdx = i; } });
    let last = 0;
    x.forEach((v, i) => { if (Math.abs(v) > peak * 0.01) last = i; });           // −40 dB
    let first = x.findIndex((v) => Math.abs(v) > peak * 0.01);
    // power spectrum of the first 4096 samples (naive DFT; no window: the sound decays inside the frame,
    // a Hann window would erase the transient at the start)
    const N = 4096, P = [];
    for (let k = 0; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const v = x[n] || 0, a = (2 * Math.PI * k * n) / N;
        re += v * Math.cos(a); im -= v * Math.sin(a);
      }
      P.push(re * re + im * im);
    }
    const hz = (k) => (k * sr) / N;
    const total = P.reduce((a, b) => a + b, 0) || 1;
    const share = (lo, hi) => P.reduce((a, p, k) => a + (hz(k) >= lo && hz(k) < hi ? p : 0), 0) / total;
    const centroid = P.reduce((a, p, k) => a + p * hz(k), 0) / total;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff = Math.max(diff, Math.abs(x[i] - y[i]));
    return {
      peak, attackMs: ((peakIdx - Math.max(0, first)) / sr) * 1000, durationMs: ((last - Math.max(0, first)) / sr) * 1000,
      low: share(0, S.lowCutHz), high: share(S.highCutHz, sr / 2), veryHigh: share(S.veryHighCutHz, sr / 2), centroid, maxDiff: diff,
    };
  }, S);

test.beforeEach(async ({ page }) => open(page));

test('L-41 the key sound is short, punchy and full-bodied (offline-rendered and measured)', async ({ page }) => {
  const a = await analyse(page);
  expect(a.peak, 'audible, no clipping').toBeGreaterThanOrEqual(S.peakMin);
  expect(a.peak).toBeLessThanOrEqual(S.peakMax);
  expect(a.attackMs, 'mechanical transient: fast attack').toBeLessThanOrEqual(S.attackMaxMs);
  expect(a.attackMs, `no sharp tick: soft onset (${a.attackMs.toFixed(1)} ms)`).toBeGreaterThanOrEqual(S.attackMinMs);
  expect(a.veryHigh, `no sharp tick: energy above ${S.veryHighCutHz} Hz (${(a.veryHigh * 100).toFixed(1)} %)`).toBeLessThanOrEqual(S.veryHighShareMax);
  expect(a.durationMs, `short (${a.durationMs.toFixed(0)} ms)`).toBeGreaterThanOrEqual(S.minMs);
  expect(a.durationMs, `short (${a.durationMs.toFixed(0)} ms)`).toBeLessThanOrEqual(S.maxMs);
  expect(a.low, `full body: energy below ${S.lowCutHz} Hz (${(a.low * 100).toFixed(0)} %)`).toBeGreaterThanOrEqual(S.lowShareMin);
  expect(a.low, `not just a dull thud: energy below ${S.lowCutHz} Hz (${(a.low * 100).toFixed(0)} %)`).toBeLessThanOrEqual(S.lowShareMax);
  expect(a.high, `mechanical click above ${S.highCutHz} Hz (${(a.high * 100).toFixed(1)} %)`).toBeGreaterThanOrEqual(S.highShareMin);
  expect(a.high, `not bright: above ${S.highCutHz} Hz (${(a.high * 100).toFixed(1)} %)`).toBeLessThanOrEqual(S.highShareMax);
  expect(a.centroid, `spectral centroid ${a.centroid.toFixed(0)} Hz`).toBeGreaterThanOrEqual(S.centroidMin);
  expect(a.centroid, `spectral centroid ${a.centroid.toFixed(0)} Hz`).toBeLessThanOrEqual(S.centroidMax);
  expect(a.maxDiff, 'each stroke slightly different (no machine-gun effect)').toBeGreaterThan(S.minVariation);
});

test('L-42 every key press (mouse and keyboard) plays the sound — silence on load, power off, easter egg, render()', async ({ page }) => {
  await page.addInitScript(() => {
    window.__starts = 0;
    const orig = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (...args) {
      if (!(this.context instanceof OfflineAudioContext)) window.__starts++;
      return orig.apply(this, args);
    };
  });
  await open(page);
  const starts = () => page.evaluate(() => window.__starts);
  expect(await starts(), 'no sound on load').toBe(0);
  await pressKeys(page, ['5']);
  const afterClick = await starts();
  expect(afterClick, 'click plays the sound').toBeGreaterThan(0);
  await page.keyboard.press('6');
  const afterKey = await starts();
  expect(afterKey, 'physical key plays the sound').toBeGreaterThan(afterClick);
  await page.evaluate(() => window.m64.render('1.'));
  await page.locator(EGG).click();
  await page.locator(EGG).click();
  await page.locator(sel.sw('power')).click();
  await pressKeys(page, ['7']);
  expect(await starts(), 'silent for render / easter egg / power off').toBe(afterKey);
});

test('L-43 the AudioContext is created lazily on the first key press (autoplay policy), no errors', async ({ page }) => {
  await page.addInitScript(() => {
    window.__contexts = 0;
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig { constructor(...a) { super(...a); window.__contexts++; } };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);
  expect(await page.evaluate(() => window.__contexts), 'no AudioContext before a user gesture').toBe(0);
  await pressKeys(page, ['1', '2', '+']);
  expect(await page.evaluate(() => window.__contexts), 'exactly one AudioContext, reused').toBe(1);
  expect(errors).toEqual([]);
});

test('L-54 Safari: the AudioContext is created or resumed inside a click/keyboard gesture, not only on pointerdown', async ({ page }) => {
  await page.addInitScript((allowed) => {
    window.__gestures = [];
    const note = (what) => window.__gestures.push({ what, type: window.event ? window.event.type : null });
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig { constructor(...a) { super(...a); note('create'); } };
    const resume = Orig.prototype.resume;
    Orig.prototype.resume = function (...a) { note('resume'); return resume.apply(this, a); };
  }, tokens.detail.audioGestureEvents);
  await open(page);
  await pressKeys(page, ['5']);
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => window.__gestures);
  const ok = g.some((x) => tokens.detail.audioGestureEvents.includes(x.type));
  expect(ok, `create/resume during ${JSON.stringify(g)} — needs one of ${tokens.detail.audioGestureEvents.join(', ')}`).toBe(true);
});
