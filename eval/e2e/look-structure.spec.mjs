// L-01, L-08, L-11, L-15, L-33 — DOM structure. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens } from './helpers.mjs';

test.beforeEach(async ({ page }) => open(page));

test('L-01 all device parts exist and are visible', async ({ page }) => {
  for (const p of ['shell', 'faceplate', 'head', 'logo', 'switches', 'display', 'keypad', 'foot']) {
    await expect(page.locator(sel.part(p)), `[data-part="${p}"]`).toHaveCount(1);
    await expect(page.locator(sel.part(p)), `[data-part="${p}"] visible`).toBeVisible();
  }
  const nested = await page.evaluate(() => {
    const q = (p) => document.querySelector(`[data-part="${p}"]`);
    return {
      faceplateInShell: q('shell').contains(q('faceplate')),
      logoInHead: q('head').contains(q('logo')),
      partsInFaceplate: ['head', 'switches', 'display', 'keypad', 'foot'].every((p) => q('faceplate').contains(q(p))),
    };
  });
  expect(nested).toEqual({ faceplateInShell: true, logoInHead: true, partsInFaceplate: true });
});

test('L-08 20 keys in reference order with legends and aria-labels', async ({ page }) => {
  const keys = page.locator(sel.keys);
  await expect(keys).toHaveCount(20);
  const actual = await keys.evaluateAll((els) =>
    els.map((e) => ({ key: e.dataset.key, legend: e.innerText.replace(/\s+/g, ''), label: e.getAttribute('aria-label') })),
  );
  expect(actual).toEqual(tokens.keys.map(({ key, legend, label }) => ({ key, legend, label })));
});

test('L-11 three slide switches 0-K, F-2, 0-I (left to right) with role=switch', async ({ page }) => {
  const sw = page.locator('[data-part="switches"] [data-switch]');
  await expect(sw).toHaveCount(3);
  const info = await sw.evaluateAll((els) =>
    els
      .map((e) => ({ id: e.dataset.switch, role: e.getAttribute('role'), checked: e.getAttribute('aria-checked'), x: e.getBoundingClientRect().x, text: e.innerText.replace(/\s+/g, '') }))
      .sort((a, b) => a.x - b.x),
  );
  expect(info.map((i) => i.id)).toEqual(tokens.switches.map((s) => s.id));
  for (const [i, s] of tokens.switches.entries()) {
    expect(info[i].role, `${s.id} role`).toBe('switch');
    expect(['true', 'false'], `${s.id} aria-checked`).toContain(info[i].checked);
    expect(info[i].text.startsWith(s.left) && info[i].text.endsWith(s.right), `${s.id} label "${info[i].text}" should read ${s.left}…${s.right}`).toBe(true);
  }
});

test('L-15 display has 1 sign cell and 8 digit cells with segments a–g + dp', async ({ page }) => {
  const display = page.locator(sel.part('display'));
  await expect(display.locator('[data-part="sign"]')).toHaveCount(1);
  await expect(display.locator('[data-part="sign"] [data-seg="g"]')).toHaveCount(1);
  await expect(display.locator('[data-part="digit"]')).toHaveCount(8);
  const segs = await display.locator('[data-part="digit"]').evaluateAll((cells) =>
    cells.map((c) => [...c.querySelectorAll('[data-seg]')].map((s) => s.dataset.seg).sort().join(',')),
  );
  for (const s of segs) expect(s).toBe('a,b,c,d,dp,e,f,g');
});

test('L-33 accessibility: display aria-live=polite, every key has an aria-label', async ({ page }) => {
  await expect(page.locator(sel.part('display'))).toHaveAttribute('aria-live', 'polite');
  const missing = await page.locator(sel.keys).evaluateAll((els) => els.filter((e) => !e.getAttribute('aria-label')).map((e) => e.dataset.key));
  expect(missing).toEqual([]);
  await expect(page.locator(sel.keys)).toHaveCount(20);
});
