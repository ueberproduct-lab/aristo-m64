// F-01…F-43 against the pure engine (src/engine.js) + F-53 power at engine level. FROZEN.
// Dynamic import so a missing/broken engine fails each test individually instead of the whole file.
import { test, expect } from '@playwright/test';
import { CASES, keysOf } from '../cases.mjs';

const load = async () => (await import('../../src/engine.js')).createEngine();

for (const c of CASES) {
  test(`${c.id} [engine] ${c.keys || '(Start)'} → ${c.expect}`, async () => {
    const e = await load();
    for (const k of keysOf(c)) e.press(k);
    expect(e.display()).toBe(c.expect);
    expect(e.isError()).toBe(c.expect === 'E');
  });
}

test('F-53 [engine] setPower(false) blanks and ignores keys; setPower(true) resets', async () => {
  const e = await load();
  e.press('4');
  e.press('+');
  e.setPower(false);
  expect(e.display()).toBe('');
  e.press('5');
  expect(e.display()).toBe('');
  e.setPower(true);
  expect(e.display()).toBe('0.');
  e.press('3');
  e.press('=');
  expect(e.display()).toBe('3.');
});
