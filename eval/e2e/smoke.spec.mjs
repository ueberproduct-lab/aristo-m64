// E-00 — scaffold. FROZEN.
import { test, expect } from '@playwright/test';

test('E-00 server answers on localhost with the Aristo M 64 page', async ({ page }) => {
  const res = await page.goto('/');
  expect(res.status()).toBe(200);
  await expect(page).toHaveTitle('Aristo M 64');
  const external = [];
  page.on('request', (r) => !/^(http:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(r.url()) && external.push(r.url()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(external, 'no external requests (fonts/CDNs)').toEqual([]);
});
