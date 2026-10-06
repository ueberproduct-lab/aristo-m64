// L-44, L-45 — F11 mute easter egg on the "ARISTO M 64" logo. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, displayValue, pressKeys } from './helpers.mjs';

const EGG = '[data-part="head"] [data-config="sound"]';
const M = tokens.mute;

async function instrument(page) {
  await page.addInitScript(() => {
    window.__starts = 0;
    const orig = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (...args) {
      if (!(this.context instanceof OfflineAudioContext)) window.__starts++;
      return orig.apply(this, args);
    };
  });
  await open(page);
}
const starts = (page) => page.evaluate(() => window.__starts);

test.beforeEach(async ({ page }) => open(page));

test('L-44 easter egg: clicking the logo toggles mute — nothing gives it away, the calculator is untouched', async ({ page }) => {
  const egg = page.locator(EGG);
  await expect(egg).toHaveCount(1);
  expect((await egg.innerText()).replace(/\s+/g, ' ').trim().toLowerCase()).toBe('aristo m 64');
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-sound', M.default);
  await expect(page.getByText(/stumm|mute|lautlos|sound/i).filter({ visible: true }), 'no visible hint').toHaveCount(0);
  const look = () => egg.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { cursor: cs.cursor, color: cs.color, deco: cs.textDecorationLine, opacity: cs.opacity, shadow: cs.textShadow, transform: cs.transform };
  });
  const rest = await look();
  expect(rest.cursor, 'no pointer cursor').not.toBe('pointer');
  await egg.hover();
  await page.waitForTimeout(150);
  expect(await look(), 'no hover change').toEqual(rest);

  await page.evaluate(() => {
    const d = document.querySelector('[data-part="display"]');
    window.__flickAdds = 0;
    new MutationObserver(() => { if (d.classList.contains('flicker')) window.__flickAdds++; }).observe(d, { attributes: true, attributeFilter: ['class'] });
  });
  await egg.click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-sound', 'off');
  await egg.click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-sound', 'on');
  expect(await displayValue(page), 'the click does not reach the calculator').toBe('0.');
  expect(await page.evaluate(() => window.__flickAdds), 'no display flicker on the easter egg').toBe(0);
});

test('L-45 muted: key presses are silent; unmuting plays one confirmation click; the choice survives a reload', async ({ page, context }) => {
  await instrument(page);
  await pressKeys(page, ['5']);
  const s1 = await starts(page);
  expect(s1, 'sound before muting').toBeGreaterThan(0);

  await page.locator(EGG).click();
  expect(await starts(page), 'muting itself is silent').toBe(s1);
  await pressKeys(page, ['6']);
  await page.keyboard.press('7');
  expect(await starts(page), 'muted: no sound on click or physical key').toBe(s1);
  expect(await displayValue(page), 'the calculator still works while muted').toBe('567.');

  await page.locator(EGG).click();
  const s2 = await starts(page);
  expect(s2, 'unmuting plays a confirmation click').toBeGreaterThan(s1);
  await pressKeys(page, ['8']);
  expect(await starts(page), 'sound is back').toBeGreaterThan(s2);

  await page.locator(EGG).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), M.storageKey)).toBe('off');
  await open(page);
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-sound', 'off');
  await pressKeys(page, ['9']);
  expect(await starts(page), 'still muted after reload').toBe(0);
  await page.locator(EGG).click();
  await expect(page.locator(sel.part('shell'))).toHaveAttribute('data-sound', 'on');

  const blocked = await context.newPage();
  const errors = [];
  blocked.on('pageerror', (e) => errors.push(String(e)));
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }));
  await open(blocked);
  await blocked.locator(EGG).click();
  await expect(blocked.locator(sel.part('shell'))).toHaveAttribute('data-sound', 'off');
  expect(errors, 'no errors when storage is unavailable').toEqual([]);
});
