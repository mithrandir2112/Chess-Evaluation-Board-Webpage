import { test, expect } from '@playwright/test';
for (const theme of ['light','dark']) {
  test(`settings and PGN actions in ${theme} mode`, async ({ page }, testInfo) => {
    await page.addInitScript(theme => localStorage.setItem('chess-ui-theme', theme), theme);
    await page.goto('/');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('heading', { name: 'Stockfish Settings', exact: true })).toBeVisible();
      const depth = await page.locator('#depthSelect').boundingBox();
      const analyze = await page.locator('#analyzeBtn').boundingBox();
      const controls = await page.locator('.engine-controls').boundingBox();
      expect(depth.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(analyze.x + analyze.width - controls.x - controls.width)).toBeLessThanOrEqual(1);
      const download = await page.locator('#downloadPgnBtn').boundingBox();
      const actions = await page.locator('.pgn-export-actions').boundingBox();
      expect(Math.abs(download.x + download.width - actions.x - actions.width + 8)).toBeLessThanOrEqual(1);
      const colors = await page.locator('#downloadPgnBtn').evaluate(el => ({ color: getComputedStyle(el).color, border: getComputedStyle(el).borderTopColor }));
      expect(colors.border).not.toBe('rgb(217, 222, 232)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.analysis-panel').screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
    }
  });
}
