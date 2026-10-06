// F-01…F-43 via UI clicks (cases.mjs) and F-50…F-54 (keyboard, power, click handling). FROZEN.
import { test, expect } from '@playwright/test';
import { CASES, keysOf } from '../cases.mjs';
import { open, sel, displayValue, pressKeys } from './helpers.mjs';

test.beforeEach(async ({ page }) => open(page));

for (const c of CASES) {
  test(`${c.id} [ui] ${c.keys || '(Start)'} → ${c.expect}`, async ({ page }) => {
    await pressKeys(page, keysOf(c));
    expect(await displayValue(page)).toBe(c.expect);
  });
}

test('F-50 keyboard: digits, operators, Enter/=, comma as decimal point', async ({ page }) => {
  const run = async (typed, expected, enter = false) => {
    await page.keyboard.press('Escape');
    await page.keyboard.type(typed);
    if (enter) await page.keyboard.press('Enter');
    expect(await displayValue(page), typed).toBe(expected);
  };
  await run('12+7=', '19.');
  await run('6*7', '42.', true);
  await run('9/4=', '2.25');
  await run('1,5+1=', '2.5');
  await run('8-10=', '-2.');
});

test('F-51 keyboard: Escape=C, Backspace/Delete=CE, % and r=√', async ({ page }) => {
  await page.keyboard.type('12');
  await page.keyboard.press('Escape');
  expect(await displayValue(page)).toBe('0.');
  await page.keyboard.type('12+3');
  await page.keyboard.press('Backspace');
  expect(await displayValue(page)).toBe('0.');
  await page.keyboard.type('4=');
  expect(await displayValue(page)).toBe('16.');
  await page.keyboard.press('Escape');
  await page.keyboard.type('5+7');
  await page.keyboard.press('Delete');
  await page.keyboard.type('1=');
  expect(await displayValue(page)).toBe('6.');
  await page.keyboard.press('Escape');
  await page.keyboard.type('200*15%');
  expect(await displayValue(page)).toBe('30.');
  await page.keyboard.press('Escape');
  await page.keyboard.type('9r');
  expect(await displayValue(page)).toBe('3.');
});

test('F-52 holding a physical key shows the on-screen key pressed', async ({ page }) => {
  const key = page.locator(sel.key('7'));
  await page.keyboard.down('7');
  await expect(key).toHaveClass(/(^|\s)pressed(\s|$)/);
  await page.keyboard.up('7');
  await expect(key).not.toHaveClass(/(^|\s)pressed(\s|$)/);
  expect(await displayValue(page)).toBe('7.');
});

test('F-53 power switch: off blanks the display and ignores keys; on resets to 0.', async ({ page }) => {
  const power = page.locator(sel.sw('power'));
  await expect(power).toHaveAttribute('aria-checked', 'true');
  await pressKeys(page, ['1', '2', '+']);
  await power.click();
  await expect(power).toHaveAttribute('aria-checked', 'false');
  expect(await displayValue(page)).toBe('');
  expect(await page.locator('[data-part="display"] [data-seg].lit').count(), 'no lit segment while off').toBe(0);
  await pressKeys(page, ['5']);
  expect(await displayValue(page)).toBe('');
  await power.click();
  await expect(power).toHaveAttribute('aria-checked', 'true');
  expect(await displayValue(page)).toBe('0.');
  await pressKeys(page, ['3', '=']);
  expect(await displayValue(page), 'state was reset by power cycle').toBe('3.');
});

test('F-54 every click counts exactly once', async ({ page }) => {
  await page.locator(sel.key('1')).dblclick();
  expect(await displayValue(page)).toBe('11.');
  await pressKeys(page, ['2', '3']);
  expect(await displayValue(page)).toBe('1123.');
});
