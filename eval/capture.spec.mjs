// Screenshots for the visual judge (npm run eval:capture). Not an eval case itself. FROZEN.
import { test } from '@playwright/test';
import { open, sel, render } from './e2e/helpers.mjs';

const out = (name) => `eval/artifacts/${name}.png`;

test('capture desktop, close-up, pressed key, digits, without case and mobile', async ({ page }) => {
  await open(page);
  await page.screenshot({ path: out('current-desktop'), animations: 'disabled' });
  const shell = page.locator(sel.part('shell'));
  if (await shell.count()) {
    await shell.screenshot({ path: out('current-device'), animations: 'disabled' });
    const hasHook = await page.evaluate(() => typeof window.m64?.render === 'function');
    if (hasHook) {
      await render(page, '-1234.5678');
      await page.locator(sel.part('display')).screenshot({ path: out('current-display'), animations: 'disabled' });
      await render(page, '0.');
    }
    const key = page.locator(sel.key('5'));
    if (await key.count()) {
      const b = await key.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await shell.screenshot({ path: out('current-pressed') });
      await page.mouse.up();
    }
  }
  const cfg = page.locator('[data-part="foot"] [data-config="case"]');
  if ((await shell.count()) && (await cfg.count())) {
    await cfg.click();
    await page.waitForTimeout(300);
    await shell.screenshot({ path: out('current-device-nocase'), animations: 'disabled' });
    await cfg.click();
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await page.screenshot({ path: out('current-mobile'), fullPage: true, animations: 'disabled' });
});
