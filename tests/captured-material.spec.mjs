import { test, expect } from '@playwright/test';
import captures from '../src/captured-material.js';
const board = fen => fen.split('/').map(rank => [...rank].flatMap(c => /\d/.test(c) ? Array(Number(c)).fill(null) : [c]));
test('FEN inventory accounts for visible promotion and excludes kings', () => {
  const result = captures.infer(board('rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNQ'));
  expect(result.b).toEqual(['R']);
  expect(result.w).toEqual([]);
});
test('recorded captures include en passant and rewind', () => {
  const history = [
    { game: { board: board('4k3/8/8/3pP3/8/8/8/4K3'), turn: 'w' } },
    { move: { from: 'e5', to: 'd6', flag: 'ep' }, game: { board: board('4k3/8/3P4/8/8/8/8/4K3'), turn: 'b' } },
  ];
  expect(captures.atPly(history, 1)).toEqual({ w: ['p'], b: [] });
  expect(captures.atPly(history, 0)).toEqual({ w: [], b: [] });
});
for (const width of [390, 768, 1101, 1440]) {
  test(`new-game startup and capture rows at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('#board .piece')).toHaveCount(32);
    await expect(page.locator('#analyzeBtn')).toBeEnabled();
    await expect(page.locator('#positionLabel')).toHaveText('Start position');
    await page.locator('#pgnInput').fill('1. e4 d5 2. exd5 Qxd5');
    await page.locator('#parseBtn').click();
    await expect(page.locator('#bottomCaptures')).toHaveAttribute('aria-label', /Captured by white: 1 pawn/);
    await expect(page.locator('#topCaptures')).toHaveAttribute('aria-label', /Captured by black: 1 pawn/);
    await page.locator('#flipBoardBtn').click();
    await expect(page.locator('#topCaptures')).toHaveAttribute('aria-label', /Captured by white: 1 pawn/);
    await page.locator('#prevBtn').click();
    await expect(page.locator('#bottomCaptures')).toHaveAttribute('aria-label', /Captured by black: none/);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.board-panel').screenshot({ path: testInfo.outputPath(`captures-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#clearBtn').click();
    await page.waitForTimeout(350);
    await expect(page.locator('#board .piece')).toHaveCount(32);
    await expect(page.locator('.captured-piece')).toHaveCount(0);
    await expect(page.locator('#analyzeBtn')).toBeEnabled();
    await expect(page.locator('#positionEval')).toHaveText('Not analyzed');
    await page.locator('#pgnInput').fill('rnbqkbnr/1ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    await page.locator('#parseBtn').click();
    await expect(page.locator('#topCaptures')).toHaveAttribute('aria-label', /Captured by white: 1 pawn. Inferred from FEN/);
  });
}

test('promotion captures are recorded as captures of the victim, not the pawn', () => {
  const history = [
    { game: { board: board('r3k3/1P6/8/8/8/8/8/4K3'), turn: 'w' } },
    { move: { from: 'b7', to: 'a8', promotion: 'q' }, game: { board: board('Q3k3/8/8/8/8/8/8/4K3'), turn: 'b' } },
  ];
  expect(captures.atPly(history, 1)).toEqual({ w: ['r'], b: [] });
});
test('PGN setup positions, duplicate captures, and clearing accessibility state', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pgnInput').fill('[SetUp "1"]\n[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"]\n1. exd6');
  await page.locator('#parseBtn').click();
  await expect(page.locator('#bottomCaptures')).toHaveAttribute('aria-label', /8 pawns.*Inferred from FEN/);
  await page.locator('#prevBtn').click();
  await expect(page.locator('#bottomCaptures')).toHaveAttribute('aria-label', /7 pawns/);
  await page.locator('#clearBtn').click();
  await expect(page.locator('#bottomCaptures')).toHaveAttribute('aria-label', 'Captured by white: none. Recorded moves.');
  await page.locator('#sampleBtn').click();
  await expect(page.locator('#board .piece')).toHaveCount(32);
  await page.waitForTimeout(250);
  await page.locator('#clearBtn').click();
  await page.waitForTimeout(250);
  await expect(page.locator('#positionLabel')).toHaveText('Start position');
  await expect(page.locator('#analysisProgress')).toHaveText('Ready');
});

test('black-to-move PGN setup keeps its move number and capture ownership', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pgnInput').fill('[SetUp "1"]\n[FEN "4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 19"]\n19... dxe3');
  await page.locator('#parseBtn').click();
  await expect(page.locator('.move-number')).toHaveText('19...');
  await expect(page.locator('#topCaptures')).toHaveAttribute('aria-label', /Captured by black: 8 pawns/);
});

test('fresh game is immediately playable with no sample moves', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#moveList .move-token')).toHaveCount(0);
  await expect(page.locator('#pgnInput')).toHaveValue('');
  await expect(page.locator('.captured-piece')).toHaveCount(0);
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.locator('[data-square="e4"] .piece')).toHaveAttribute('data-color', 'w');
  await expect(page.locator('#moveList .move-token')).toHaveText('e4');
  await page.locator('#clearBtn').click();
  await expect(page.locator('[data-square="e2"] .piece')).toHaveAttribute('data-color', 'w');
  await expect(page.locator('#moveList .move-token')).toHaveCount(0);
});
