import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
async function host(page, attributes, css = '', omitToggle = false) {
  let fixture = html.replace('<html lang="en">', `<html lang="en" ${attributes}>`).replace('</head>', `<style>${css}</style></head>`);
  if (omitToggle) fixture = fixture.replace(/<button id="themeToggle"[\s\S]*?<\/button>/, '');
  await page.route('**/index.html', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('/index.html');
}
test('native follows system without saving it; explicit choice persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(() => localStorage.getItem('chess-ui-theme'))).toBeNull();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('#themeToggle').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('#themeToggle')).toBeVisible();
});
test('host owns theme and tokens without changing stored native choice', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chess-ui-theme','light'));
  await host(page, 'data-theme="dark"', ':root { --theme-page: #102030; --theme-accent: #ffcc11; }');
  await expect(page.locator('#themeToggle')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(16, 32, 48)');
  expect(await page.evaluate(() => localStorage.getItem('chess-ui-theme'))).toBe('light');
  await expect(page.locator('.panel').first()).toHaveCSS('background-color','rgb(23, 34, 51)');
  await page.evaluate(() => { window.savedPiece = document.querySelector('[data-square="e2"] .piece'); document.documentElement.dataset.theme = 'light'; });
  await expect(page.locator('.panel').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
  expect(await page.evaluate(() => window.savedPiece.isConnected)).toBe(true);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'forest'; document.documentElement.dataset.chessColorScheme = 'dark'; document.documentElement.style.setProperty('--theme-accent','#82ddaa'); });
  await expect(page.locator('html')).toHaveAttribute('data-theme','forest');
  await expect(page.locator('#analyzeBtn')).toHaveCSS('background-color','rgb(130, 221, 170)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.analysis-panel').screenshot({ path: testInfo.outputPath('host-forest-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('host-forest-desktop.png') });
  await page.evaluate(() => { document.documentElement.dataset.chessThemeSource = 'native'; });
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('#themeToggle')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(243, 245, 248)');
});
test('host may omit toggle; playing, flipping and engine analysis still work', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await host(page, 'data-chess-theme-source="host" data-theme="ocean" data-chess-color-scheme="dark"', '', true);
  for (const square of ['e2','e4']) await page.locator(`[data-square="${square}"]`).click();
  await page.locator('#flipBoardBtn').click();
  await expect(page.locator('[data-square="e4"] .piece')).toHaveAttribute('data-color','w');
  await page.locator('#depthSelect').selectOption('10');
  await expect(page.locator('#analysisProgress')).toHaveText('Completed at depth 10', { timeout: 45000 });
  await expect(page.locator('#engineName')).toContainText('Stockfish');
  expect(errors).toEqual([]);
});
test('blocked storage still follows system; a late host can take ownership', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'sepia'; });
  await expect(page.locator('html')).toHaveAttribute('data-chess-theme-source','host');
  await expect(page.locator('#themeToggle')).toBeHidden();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme','sepia');
});
test('changing a named host palette preserves drag interaction and board colors', async ({ page }) => {
  await host(page, 'data-theme="forest" data-chess-color-scheme="dark"', ':root { --theme-accent: #82ddaa; --theme-focus: #ee55cc; }');
  const squareColor = await page.locator('[data-square="e2"]').evaluate(el => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'ocean'; document.documentElement.style.setProperty('--theme-accent','#55bbff'); });
  const from = await page.locator('[data-square="e2"] .piece').boundingBox();
  const to = await page.locator('[data-square="e4"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-square="e4"] .piece')).toHaveAttribute('data-color','w');
  expect(await page.locator('[data-square="e2"]').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(squareColor);
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--focus').trim())).toBe('#ee55cc');
});
