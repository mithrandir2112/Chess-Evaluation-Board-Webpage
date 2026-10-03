import { test, expect } from '@playwright/test';
async function buttonBox(page) {
  return page.locator('#analyzeBtn').evaluate(el => {
    const r = el.getBoundingClientRect(); const p = el.closest('.candidate-panel').getBoundingClientRect();
    return { x: r.x - p.x, y: r.y - p.y, width: r.width, height: r.height };
  });
}
test('Analyze stays fixed through search progress, Stop and completion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/src/stockfish-engine.js*', route => route.fulfill({ contentType: 'text/javascript', body: `window.StockfishEngine = class {
    async cancel() {}
    analyze(fen, options) { window.testInfoUpdate = options.onInfo; return new Promise(resolve => { window.finishSearch = resolve; }); }
  };` }));
  await page.goto('/');
  await page.locator('#analyzeBtn').scrollIntoViewIfNeeded();
  const before = await buttonBox(page);
  const panelHeight = await page.locator('.candidate-panel').evaluate(el => el.getBoundingClientRect().height);
  await page.locator('#analyzeBtn').click();
  await expect(page.locator('#stopBtn')).toBeVisible();
  const during = await buttonBox(page);
  expect(during).toEqual(before);
  expect(await page.locator('.candidate-panel').evaluate(el => el.getBoundingClientRect().height)).toBe(panelHeight);
  await page.locator('#stopBtn').click();
  expect(await buttonBox(page)).toEqual(before);
  await page.locator('#analyzeBtn').click();
  await page.evaluate(() => window.finishSearch({ bestMove: 'e2e4', depth: 14, score: { type: 'cp', value: 47 }, variations: [] }));
  await expect(page.locator('#stopBtn')).toBeHidden();
  expect(await buttonBox(page)).toEqual(before);
});
