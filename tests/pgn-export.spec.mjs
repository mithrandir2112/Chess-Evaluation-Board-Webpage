import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function download(page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PGN', exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe('chess-game.pgn');
  return readFile(await file.path(), 'utf8');
}
async function stop(page) {
  await page.waitForTimeout(250);
  await page.locator('#stopBtn').evaluate(button => { if (!button.hidden) button.click(); });
}
test('exports played moves, preserves the input and full history, replaces a continuation, resets', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pgnInput').fill('input draft');
  for (const square of ['e2','e4','e7','e5']) await page.locator(`[data-square="${square}"]`).click();
  expect(await download(page)).toContain('1. e4 e5 *');
  await expect(page.locator('#pgnInput')).toHaveValue('input draft');
  await page.locator('#prevBtn').click();
  expect(await download(page)).toContain('1. e4 e5 *');
  for (const square of ['c7','c5']) await page.locator(`[data-square="${square}"]`).click();
  const changed = await download(page);
  expect(changed).toContain('1. e4 c5 *');
  expect(changed).not.toContain('e5');
  await page.locator('#clearBtn').click();
  const cleared = await download(page);
  expect(cleared.split('\n\n')[1]).toBe('*\n');
  await page.locator('#pgnInput').fill(cleared);
  await page.locator('#parseBtn').click();
  await expect(page.locator('#board .piece')).toHaveCount(32);
});
test('FEN export round trips black-to-move numbering and the initial position', async ({ page }) => {
  await page.goto('/');
  const fen = '4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 19';
  await page.locator('#pgnInput').fill(fen);
  await page.locator('#parseBtn').click();
  for (const square of ['d4','e3']) await page.locator(`[data-square="${square}"]`).click();
  const pgn = await download(page);
  expect(pgn).toContain('[SetUp "1"]');
  expect(pgn).toContain(`[FEN "${fen}"]`);
  expect(pgn).toContain('19... dxe3 *');
  await stop(page);
  await page.locator('#pgnInput').fill(pgn);
  await page.locator('#parseBtn').click();
  await expect(page.locator('[data-square="e3"] .piece')).toHaveAttribute('data-color','b');
});
test('copy uses identical PGN and reports clipboard failure without modifying input', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedPgn = text; } } }));
  await page.getByRole('button', { name: 'Copy PGN', exact: true }).click();
  await expect(page.locator('#pgnExportStatus')).toHaveText('PGN copied.');
  expect(await page.evaluate(() => window.copiedPgn)).toBe(await download(page));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.getByRole('button', { name: 'Copy PGN', exact: true }).click();
  await expect(page.locator('#pgnExportStatus')).toContainText('Clipboard unavailable');
});
test('preserves player headers and exports checkmate SAN', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pgnInput').fill('[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
  await page.locator('#parseBtn').click();
  const pgn = await download(page);
  expect(pgn).toContain('[White "Alice"]');
  expect(pgn).toContain('[Black "Bob"]');
  expect(pgn).toContain('1. f3 e5 2. g4 Qh4# 0-1');
});
