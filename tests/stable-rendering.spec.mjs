import { test, expect } from '@playwright/test';
async function setup(page) {
  await page.route('**/src/stockfish-engine.js*', route => route.fulfill({ contentType: 'text/javascript', body: `window.StockfishEngine = class {
    async cancel() { if (this.reject) { this.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })); this.reject = null; } }
    analyze(fen, options) { window.engineOptions = options; return new Promise((resolve, reject) => { window.engineFinish = resolve; this.reject = reject; }); }
  };` }));
  await page.goto('/');
}
test('engine updates preserve board, history and candidate nodes and panel height', async ({ page }) => {
  await setup(page);
  for (const square of ['e2','e4']) await page.locator(`[data-square="${square}"]`).click();
  await page.waitForFunction(() => window.engineOptions);
  await page.evaluate(() => {
    window.savedNodes = [document.querySelector('[data-square="e4"] .piece'), document.querySelector('#moveList button'), document.querySelector('.candidate-row'), document.querySelector('#depthSelect')];
    window.savedHeight = document.querySelector('#candidateList').getBoundingClientRect().height;
  });
  for (const depth of [4,8,14]) {
    await page.evaluate(depth => window.engineOptions.onInfo({ depth, score: { type: 'cp', value: 47 }, variations: [{ pv: ['e7e5'], score: { type: 'cp', value: 47 } }] }), depth);
    await expect(page.locator('#positionEval')).toHaveText('White +0.47');
    expect(await page.evaluate(() => window.savedNodes.every(node => node.isConnected))).toBe(true);
    expect(await page.locator('#candidateList').evaluate(node => node.getBoundingClientRect().height)).toBe(await page.evaluate(() => window.savedHeight));
  }
  await page.evaluate(() => window.engineFinish({ bestMove: 'e7e5', depth: 14, score: { type: 'cp', value: 47 }, variations: [{ pv: ['e7e5'], score: { type: 'cp', value: 47 } }] }));
  await expect(page.locator('#analysisProgress')).toHaveText('Completed at depth 14');
  expect(await page.evaluate(() => window.savedNodes.every(node => node.isConnected))).toBe(true);
  await page.locator('.candidate-row').first().click();
  await expect(page.locator('[data-square="e5"] .piece')).toHaveAttribute('data-color','b');
  await expect(page.locator('#positionEval')).toHaveText('Analyzing...');
  await expect(page.locator('.candidate-row').first()).toBeDisabled();
});
test('history nodes survive navigation, append and replacement while buttons select correct moves', async ({ page }) => {
  await setup(page);
  for (const square of ['e2','e4','e7','e5']) await page.locator(`[data-square="${square}"]`).click();
  await page.evaluate(() => { window.firstMove = document.querySelector('#moveList button'); });
  await page.locator('#prevBtn').click();
  for (const square of ['c7','c5']) await page.locator(`[data-square="${square}"]`).click();
  expect(await page.evaluate(() => window.firstMove === document.querySelector('#moveList button'))).toBe(true);
  await expect(page.locator('#moveList button')).toHaveText(['e4','c5']);
  await page.locator('#moveList button').first().click();
  await expect(page.locator('#positionLabel')).toHaveText('After e4');
  await page.locator('#moveList button').last().click();
  await expect(page.locator('#positionLabel')).toHaveText('After c5');
});
test('desktop controls are readable and a real engine search keeps the board intact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByText('Analysis workspace', { exact: true })).toHaveCount(0);
  await expect(page.locator('.actions #sampleBtn')).toHaveText('Load Sample');
  for (const id of ['firstBtn','boardThemeSelect','pieceStyleSelect','piecePaletteSelect']) {
    expect((await page.locator(`#${id}`).boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('#depthSelect').selectOption('10');
  await page.evaluate(() => { window.realPiece = document.querySelector('[data-square="e2"] .piece'); });
  await expect(page.locator('#analysisProgress')).toHaveText('Completed at depth 10', { timeout: 45000 });
  await expect(page.locator('#engineName')).toContainText('Stockfish');
  expect(await page.evaluate(() => window.realPiece.isConnected)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('desktop-workspace.png') });
});
