import { test, expect } from '@playwright/test';

const piece = (page, square) => page.locator(`[data-square="${square}"] .piece`);
async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function start(page, style) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('combobox', { name: 'Piece style', exact: true }).selectOption(style);
  await pauseAnalysis(page);
}
async function pauseAnalysis(page) {
  // Allow the app's 180ms automatic-analysis debounce to fire. A fast engine
  // can finish before Stop is clicked, so stop only if it is still running.
  await page.waitForTimeout(250);
  await page.locator('#stopBtn').evaluate(button => {
    if (!button.hidden) button.click();
  });
  await expect(page.getByRole('button', { name: 'Analyze', exact: true })).toBeEnabled();
}
async function pickup(page, square) {
  const source = piece(page, square);
  const point = await center(source);
  const box = await source.boundingBox();
  const fontSize = await source.evaluate(node => getComputedStyle(node).fontSize);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const pointer = { x: point.x + 8, y: point.y - 8 };
  await page.mouse.move(pointer.x, pointer.y, { steps: 3 });
  const ghost = page.locator('.drag-ghost');
  await expect(ghost).toBeVisible();
  const dragged = await ghost.boundingBox();
  expect(Math.abs(dragged.width - box.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(dragged.height - box.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(dragged.x + dragged.width / 2 - pointer.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(dragged.y + dragged.height / 2 - pointer.y)).toBeLessThanOrEqual(1);
  await expect(ghost).toHaveCSS('font-size', fontSize);
}
async function drop(page, square, legal = true) {
  const point = await center(page.locator(`[data-square="${square}"]`));
  await page.mouse.move(point.x, point.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  if (legal) await pauseAnalysis(page);
}

for (const width of [1440, 390]) {
  for (const style of ['classic', 'modern', 'minimal', 'vector', 'broadcast']) {
    test(`${style} drag keeps its size and pointer alignment at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await start(page, style);
      await pickup(page, 'e2');
      if (style === 'vector') await page.screenshot({ path: testInfo.outputPath('vector-drag.png') });
      await drop(page, 'e4');
      await expect(piece(page, 'e4')).toHaveAttribute('data-piece', 'p');
      await expect(piece(page, 'e2')).toHaveCount(0);
      // Opposite color and move-history navigation retain the same behavior.
      await pickup(page, 'd7');
      await drop(page, 'd5');
      await page.getByRole('button', { name: 'Previous move', exact: true }).click();
      await expect(piece(page, 'd7')).toHaveCount(1);
    });
  }
}

test('flipped vector board preserves capture and rejects an illegal drop', async ({ page }) => {
  await start(page, 'vector');
  await page.getByRole('button', { name: 'Show Black at bottom' }).click();
  await pickup(page, 'e2');
  await drop(page, 'e5', false);
  await expect(piece(page, 'e2')).toHaveCount(1);
  await pickup(page, 'e2'); await drop(page, 'e4');
  await pickup(page, 'd7'); await drop(page, 'd5');
  await pickup(page, 'e4'); await drop(page, 'd5');
  await expect(piece(page, 'd5')).toHaveAttribute('data-color', 'w');
});

test('pointer cancellation clears the drag without moving the piece', async ({ page }) => {
  await start(page, 'broadcast');
  await page.evaluate(() => window.addEventListener('pointerdown', event => {
    window.dragTestPointerId = event.pointerId;
  }, { once: true }));
  await pickup(page, 'e2');
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.dragTestPointerId })));
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(piece(page, 'e2')).toHaveCount(1);
  await page.mouse.up();
});
