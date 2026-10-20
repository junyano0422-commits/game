import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  actHaunt,
  createHaunt,
  decodeHaunt,
  encodeHaunt,
  hauntSaveKey,
  omen,
  puzzle,
} from '../src/haunt/engine';
import { hauntConfig as config } from '../src/haunt/config';
import type { HauntAction, HauntRun } from '../src/haunt/engine';
async function seed(page: Page, run: HauntRun) {
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: hauntSaveKey, save: encodeHaunt(run) },
  );
}
async function state(page: Page) {
  return decodeHaunt(await page.evaluate((key) => localStorage.getItem(key)!, hauntSaveKey));
}
async function action(page: Page, run: HauntRun, a: HauntAction) {
  if (a.kind === 'move')
    await page
      .getByRole('navigation', { name: '探索する部屋' })
      .getByRole('button', { name: new RegExp(config.rooms.find((r) => r.id === a.room)!.name) })
      .click();
  else if (a.kind === 'search')
    await page
      .getByRole('button', {
        name: a.light
          ? 'ライトで調べる'
          : new RegExp(`${config.rooms.find((r) => r.id === run.room)!.object}を調べる`),
      })
      .click();
  else if (a.kind === 'unplug')
    await page.getByRole('button', { name: /テレビのプラグを抜く/ }).click();
  else if (a.kind === 'wait') await page.getByRole('button', { name: /息をひそめる/ }).click();
  return actHaunt(run, a);
}
test('horror game opens from library and a complete puzzle can be solved on screen', async ({
  page,
}) => {
  await seed(page, createHaunt(19));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /NEW.*零時の残響/ }).click();
  await expect(page).toHaveTitle(/零時の残響/);
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  let run = await state(page);
  run = await action(page, run, { kind: 'search', light: omen(run).id === 'eyes' });
  run = await action(page, run, { kind: 'unplug' });
  for (const room of ['bath', 'study', 'well', 'door'] as const) {
    run = await action(page, run, { kind: 'wait' });
    run = await action(page, run, { kind: 'move', room });
    if (room !== 'door')
      run = await action(page, run, {
        kind: 'search',
        light: omen(run).id === 'eyes' && !run.ward && run.battery > 0,
      });
  }
  expect(await state(page)).toEqual(run);
  for (const symbol of puzzle(run).solution)
    await page.getByRole('button', { name: `印 ${symbol}`, exact: true }).click();
  await page.getByRole('button', { name: /封印を結ぶ/ }).click();
  await expect(page.getByRole('heading', { name: '静寂を味方にした生還者' })).toBeVisible();
  expect((await state(page)).phase).toBe('escaped');
  await page.getByRole('button', { name: 'この夜の結末を共有する' }).click();
  await expect(page.getByRole('textbox', { name: '共有する結末' })).toContainText('生還');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('reload preserves clues, a powered-off TV can be restored, and other saves are untouched', async ({
  page,
}) => {
  const run = actHaunt(createHaunt(19), { kind: 'unplug' });
  await seed(page, run);
  await page.addInitScript(() =>
    localStorage.setItem('small-worlds:night-stall:v1', 'preserved-stall'),
  );
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  await expect(page.getByRole('button', { name: /呪いの映像を調べる/ })).toBeDisabled();
  await page.getByRole('button', { name: /テレビの電源を戻す/ }).click();
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  const saved = await state(page);
  expect(saved.orderKnown).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  expect(await state(page)).toEqual(saved);
  expect(await page.evaluate(() => localStorage.getItem('small-worlds:night-stall:v1'))).toBe(
    'preserved-stall',
  );
  await expect(page.getByRole('button', { name: /中庭の井戸/ })).toBeDisabled();
});
test('curse ending and a cancelled restart preserve the previous night', async ({ page }) => {
  let run = createHaunt(19, 'slow');
  while (run.phase === 'play') run = actHaunt(run, { kind: 'wait' });
  await seed(page, run);
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '前の夜の結末を見る' }).click();
  await expect(page.getByRole('heading', { name: '井戸に残された足跡' })).toBeVisible();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: '同じ夜を、もう一度' }).click();
  expect(await state(page)).toEqual(run);
});
test('broken saves are preserved and storage failure still allows exploration', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('small-worlds:zero-echo:v1', 'broken-night'));
  await page.goto('/?game=zero-echo');
  await expect(page.getByRole('alert')).toContainText('記録を読み込めません');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: '映像を再生する' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), hauntSaveKey)).toBe(
    'broken-night',
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '映像を再生する' }).click();
  await expect(page.getByRole('alert')).toContainText('保存できません');
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect(page.getByRole('status')).toContainText('映像の最後');
});
