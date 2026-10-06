// G-01 / G-02 — golden screenshots of the device (with / without case). Pending until the orchestrator
// accepts the look (F3, re-frozen after F8) and runs `npm run eval:golden`. FROZEN.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { open } from './helpers.mjs';

const tokens = JSON.parse(readFileSync(new URL('../../spec/tokens.json', import.meta.url), 'utf8'));
const pending = (name) => !existsSync(new URL(`../golden/${name}`, import.meta.url)) && !process.env.GOLDEN_UPDATE;
const opts = { maxDiffPixelRatio: tokens.golden.maxDiffPixelRatio, animations: 'disabled' };

test('G-01 golden: device with case (initial desktop state) is pixel-stable', async ({ page }) => {
  test.skip(pending('m64-case-on.png'), 'golden pending');
  await open(page);
  await expect(page.locator('[data-part="shell"]')).toHaveScreenshot('m64-case-on.png', opts);
});

test('G-02 golden: device without case is pixel-stable', async ({ page }) => {
  test.skip(pending('m64-case-off.png'), 'golden pending (created after F8 acceptance)');
  await open(page);
  await page.locator('[data-part="foot"] [data-config="case"]').click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-part="shell"]')).toHaveScreenshot('m64-case-off.png', opts);
});
