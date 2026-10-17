import { test, expect } from '@playwright/test';
import {
  cabin,
  countPeople,
  createRescue,
  encodeRescue,
  moveElevator,
  previewRoute,
  rescueResult,
  rescueSaveKey,
  savedPeople,
} from '../src/rescue/engine';
import type { RescueRun } from '../src/rescue/engine';

function legalRoute(run: RescueRun) {
  if (cabin(run).length) return { floor: 0, travel: 'normal' as const };
  for (const travel of ['normal', 'eco'] as const) {
    const floor = Array.from({ length: 11 }, (_, floor) => floor)
      .filter((floor) => previewRoute(run, floor, travel).available)
      .sort((a, b) => previewRoute(run, a, travel).cost - previewRoute(run, b, travel).cost)[0];
    if (floor !== undefined) return { floor, travel };
  }
  throw new Error('Expected a legal route before the result screen');
}

test('new game can be reached from the library and explains its controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /NEW.*ラスト・エレベーター/ }).click();
  await expect(page).toHaveURL(/game=last-elevator/);
  await expect(page).toHaveTitle(/ラスト・エレベーター/);
  await page.getByRole('button', { name: '遊び方 ?' }).click();
  await expect(page.getByRole('heading', { name: '3分でわかる、最後の一便。' })).toBeVisible();
  await page.getByRole('button', { name: '救出をはじめる' }).click();
  await expect(page.getByRole('button', { name: /4Fへ向かう/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rescues power a later rescue; state survives a reload', async ({ page }) => {
  const initial = createRescue(19);
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: rescueSaveKey, save: encodeRescue(initial) },
  );
  await page.goto('/?game=last-elevator');
  await page.getByRole('button', { name: '救出の続きから' }).click();
  await page.locator('[data-floor="3"]').click();
  await page.getByRole('button', { name: /4Fへ向かう/ }).click();
  const picked = moveElevator(initial, 3, 'normal');
  await expect(page.getByLabel(`${countPeople(cabin(picked))}人が搭乗中`)).toBeVisible();
  await page.getByRole('button', { name: /人を避難所へ届ける/ }).click();
  await expect(page.getByRole('status')).toContainText('ミナさんが予備電源を接続');
  const saved = await page.evaluate((key) => localStorage.getItem(key), rescueSaveKey);
  await page.reload();
  await page.getByRole('button', { name: '救出の続きから' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), rescueSaveKey)).toBe(saved);
  await page.locator('[data-floor="7"]').click();
  await page.getByRole('button', { name: /8Fへ向かう/ }).click();
  await page.getByRole('button', { name: /人を避難所へ届ける/ }).click();
  await expect(page.getByRole('status')).toContainText('定員＋1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a complete rescue has a diagnosis, copyable result and protected restart', async ({
  page,
  context,
}) => {
  let run = createRescue(19);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: rescueSaveKey, save: encodeRescue(run) },
  );
  await page.goto('/?game=last-elevator');
  await page.getByRole('button', { name: '救出の続きから' }).click();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  while (!run.finished) {
    const { floor, travel } = legalRoute(run);
    await page.getByRole('radio', { name: travel === 'normal' ? /通常走行/ : /節電走行/ }).check();
    await page.locator(`[data-floor="${floor}"]`).click();
    await page.locator('.rescue-go').click();
    run = moveElevator(run, floor, travel);
  }
  const result = rescueResult(run);
  await expect(
    page.getByRole('heading', { name: `あなたが届けた、${savedPeople(run)}人の安心。` }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: result.title })).toBeVisible();
  await page.getByRole('button', { name: '結果をコピー', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('コピーしました');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'ラスト・エレベーター',
  );
  await page.getByRole('button', { name: /作戦を変えて、もう一度/ }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /今日のタワーをやり直す/ }).click();
  await expect(page.getByRole('button', { name: '前の救出結果を見る' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a blocked save does not prevent play', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await page.goto('/?game=last-elevator');
  await page.getByRole('button', { name: '救出をはじめる' }).click();
  await expect(page.getByRole('alert')).toContainText('保存できません');
  await page.getByRole('button', { name: /4Fへ向かう/ }).click();
  await expect(page.getByRole('button', { name: /人を避難所へ届ける/ })).toBeEnabled();
});
