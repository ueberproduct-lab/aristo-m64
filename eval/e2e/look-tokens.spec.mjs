// L-02, L-03, L-13, L-24, L-26, L-27, L-29, L-30 — computed styles vs. tokens. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, lab, parseCssColor, displayValue } from './helpers.mjs';

test.beforeEach(async ({ page }) => open(page));

const textStyle = (selector) => async (page) =>
  page.locator(selector).evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n, host = el;
    while ((n = walker.nextNode())) if (n.textContent.trim()) { host = n.parentElement; break; }
    const cs = getComputedStyle(host);
    return {
      text: el.textContent.replace(/\s+/g, ' ').trim(),
      transform: cs.textTransform,
      caps: cs.fontVariantCaps || cs.fontVariant,
      letterSpacing: parseFloat(cs.letterSpacing) || 0,
      fontSize: parseFloat(cs.fontSize),
      color: cs.color,
      family: cs.fontFamily,
    };
  });

const isCaps = (s) => s.transform === 'uppercase' || /small-caps/.test(s.caps) || s.text === s.text.toUpperCase();

test('L-02 logo "ARISTO M 64": caps, tracked, light, sans-serif', async ({ page }) => {
  const s = await textStyle(sel.part('logo'))(page);
  expect(s.text.toLowerCase()).toBe('aristo m 64');
  expect(isCaps(s), 'rendered as capitals / small caps').toBe(true);
  expect(s.letterSpacing / s.fontSize, 'letter-spacing ≥ 0.08em').toBeGreaterThanOrEqual(0.08);
  expect(lab(parseCssColor(s.color))[0], 'logo lightness L*').toBeGreaterThanOrEqual(80);
  expect(/(^|,)\s*serif\s*(,|$)|times|georgia/i.test(s.family), `font-family ${s.family} must be sans-serif`).toBe(false);
});

test('L-03 foot "MADE IN GERMANY": caps, tracked ≥0.1em, smaller than logo', async ({ page }) => {
  const foot = await textStyle(sel.part('foot'))(page);
  const logo = await textStyle(sel.part('logo'))(page);
  expect(foot.text.toUpperCase()).toBe('MADE IN GERMANY');
  expect(isCaps(foot)).toBe(true);
  expect(foot.letterSpacing / foot.fontSize).toBeGreaterThanOrEqual(0.1);
  expect(foot.fontSize).toBeLessThan(logo.fontSize);
});

test('L-13 :root exposes every color token as CSS custom property', async ({ page }) => {
  const actual = await page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim().toLowerCase()]));
  }, Object.keys(tokens.colors));
  expect(actual).toEqual(tokens.colors);
});

test('L-24 key color classes follow the reference', async ({ page }) => {
  const actual = await page.locator(sel.keys).evaluateAll((els) => els.map((e) => [e.dataset.key, e.dataset.color]));
  expect(actual).toEqual(tokens.keys.map((k) => [k.key, k.color]));
});

test('L-26 legends are bold, dark and centered on the key', async ({ page }) => {
  const rows = await page.locator(sel.keys).evaluateAll((els) =>
    els.map((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) if (n.textContent.trim()) break;
      if (!n) return { key: el.dataset.key, missing: true };
      const cs = getComputedStyle(n.parentElement);
      const range = document.createRange();
      range.selectNodeContents(n);
      const t = range.getBoundingClientRect();
      const k = el.getBoundingClientRect();
      return {
        key: el.dataset.key,
        weight: Number(cs.fontWeight),
        color: cs.color,
        dx: Math.abs(t.x + t.width / 2 - (k.x + k.width / 2)) / k.width,
        dy: Math.abs(t.y + t.height / 2 - (k.y + k.height / 2)) / k.height,
      };
    }),
  );
  expect(rows).toHaveLength(20);
  for (const r of rows) {
    expect(r.missing, `${r.key} has legend text`).toBeFalsy();
    expect(r.weight, `${r.key} font-weight`).toBeGreaterThanOrEqual(600);
    expect(lab(parseCssColor(r.color))[0], `${r.key} legend lightness`).toBeLessThanOrEqual(25);
    expect(r.dx, `${r.key} horizontal centering`).toBeLessThanOrEqual(0.15);
    expect(r.dy, `${r.key} vertical centering`).toBeLessThanOrEqual(0.15);
  }
});

test('L-27 keys: slightly rounded corners and raised (box-shadow)', async ({ page }) => {
  const { min, max } = tokens.geometry.keyRadiusOfWidth;
  const rows = await page.locator(sel.keys).evaluateAll((els) =>
    els.map((e) => {
      const cs = getComputedStyle(e);
      return { key: e.dataset.key, radius: parseFloat(cs.borderTopLeftRadius), width: e.getBoundingClientRect().width, shadow: cs.boxShadow };
    }),
  );
  expect(rows).toHaveLength(20);
  for (const r of rows) {
    expect(r.radius / r.width, `${r.key} radius/width`).toBeGreaterThanOrEqual(min);
    expect(r.radius / r.width, `${r.key} radius/width`).toBeLessThanOrEqual(max);
    expect(r.shadow, `${r.key} box-shadow`).not.toBe('none');
  }
});

test('L-29 K and F/2 switches carry a light grey veil and do nothing; power switch does not', async ({ page }) => {
  const style = (id) =>
    page.locator(sel.sw(id)).evaluate((e) => {
      let op = 1, filter = '';
      for (let n = e; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        op *= Number(cs.opacity);
        if (cs.filter !== 'none') filter += cs.filter;
      }
      return { op, filter, disabled: e.getAttribute('aria-disabled'), checked: e.getAttribute('aria-checked') };
    });
  for (const id of ['k', 'dec']) {
    const s = await style(id);
    expect(s.disabled, `${id} aria-disabled`).toBe('true');
    const veiled = (s.op >= 0.55 && s.op <= 0.85) || /grayscale|saturate/.test(s.filter);
    expect(veiled, `${id} veil: opacity ${s.op.toFixed(2)} filter "${s.filter}"`).toBe(true);
    const before = await displayValue(page);
    await page.locator(sel.sw(id)).click({ force: true });
    expect((await style(id)).checked, `${id} must not toggle`).toBe(s.checked);
    expect(await displayValue(page)).toBe(before);
  }
  const p = await style('power');
  expect(p.disabled).not.toBe('true');
  expect(p.op).toBeGreaterThanOrEqual(0.95);
  expect(/grayscale|saturate/.test(p.filter)).toBe(false);
});

test('L-30 cursor: pointer on keys and power switch', async ({ page }) => {
  const cursors = await page.locator(sel.keys).evaluateAll((els) => els.map((e) => getComputedStyle(e).cursor));
  expect(cursors).toHaveLength(20);
  expect(new Set(cursors)).toEqual(new Set(['pointer']));
  expect(await page.locator(sel.sw('power')).evaluate((e) => getComputedStyle(e).cursor)).toBe('pointer');
});
