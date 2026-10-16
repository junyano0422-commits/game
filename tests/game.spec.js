import { test, expect } from '@playwright/test';

test('start, score, finish, restart and retain the best score', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await expect(page).toHaveTitle(/STAR TAP/);
  await expect(page.locator('#target')).toBeHidden();
  await page.getByRole('button', { name: /ゲームをはじめる/ }).click();
  await expect(page.locator('#start')).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '星をつかまえる' }).click();
  await expect(page.locator('#score')).toHaveText('3');
  await page.clock.fastForward(20_000);
  await expect(page.getByRole('status')).toContainText('3個');
  await expect(page.locator('#target')).toBeHidden();
  await expect(page.locator('#time')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('3');
  await page.getByRole('button', { name: /もう一度/ }).click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#time')).toHaveText('20');
  await page.reload();
  await expect(page.locator('#best')).toHaveText('3');
  expect(errors).toEqual([]);
});

test('keyboard controls work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#target')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#score')).toHaveText('1');
});

test('target stays within a mobile play area', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /ゲームをはじめる/ }).click();
  const board = await page.locator('.board').boundingBox();
  for (let i = 0; i < 10; i++) {
    const target = await page.locator('#target').boundingBox();
    expect(target.x).toBeGreaterThanOrEqual(board.x);
    expect(target.y).toBeGreaterThanOrEqual(board.y);
    expect(target.x + target.width).toBeLessThanOrEqual(board.x + board.width);
    expect(target.y + target.height).toBeLessThanOrEqual(board.y + board.height);
    await page.locator('#target').click();
  }
  await expect(page.locator('#score')).toHaveText('10');
});
