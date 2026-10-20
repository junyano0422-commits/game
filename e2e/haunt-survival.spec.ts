import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { hauntConfig } from '../src/haunt/config';
import { itemById } from '../src/haunt/survival-config';
import {
  actSurvival,
  createSurvival,
  decodeSurvival,
  encodeSurvival,
  hauntSaveKey,
  isSurvival,
} from '../src/haunt/survival';
import type { SurvivalCommand, SurvivalRun } from '../src/haunt/survival';
import { playSurvival } from '../tests/support/survival-policy';

async function state(page: Page) {
  return decodeSurvival(await page.evaluate((key) => localStorage.getItem(key)!, hauntSaveKey));
}
async function resume(page: Page, run: SurvivalRun) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: hauntSaveKey, value: encodeSurvival(run) },
  );
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
}
async function command(page: Page, run: SurvivalRun, cmd: SurvivalCommand) {
  if (cmd.kind === 'take' || cmd.kind === 'use' || cmd.kind === 'craft') {
    await page.getByRole('button', { name: /探索マップ・持ち物/ }).click();
    const dialog = page.getByRole('dialog', { name: '探索マップ・持ち物' });
    if (cmd.kind === 'take')
      await dialog.getByRole('button', { name: `${itemById(cmd.item).name}を拾う` }).click();
    else if (cmd.kind === 'use')
      await dialog
        .locator('article')
        .filter({ hasText: itemById(cmd.item).name })
        .getByRole('button', { name: /使う/ })
        .click();
    else await dialog.getByRole('button', { name: /調合：/ }).click();
    await dialog.getByRole('button', { name: '探索に戻る ×' }).click();
  } else if (cmd.kind === 'move') {
    await page
      .getByRole('navigation', { name: '探索する部屋' })
      .getByRole('button', {
        name: new RegExp(hauntConfig.rooms.find((r) => r.id === cmd.room)!.name),
      })
      .click();
  } else if (cmd.kind === 'search') {
    await page
      .getByRole('button', {
        name: cmd.light
          ? /ライトで調べる/
          : new RegExp(`${hauntConfig.rooms.find((r) => r.id === run.room)!.object}を調べる`),
      })
      .click();
  } else if (cmd.kind === 'wait') await page.getByRole('button', { name: /息をひそめる/ }).click();
  else if (cmd.kind === 'seal') {
    const facts = await page.locator('.echo-seal-evidence p').allTextContents();
    const last = facts[0]!.match(/「([^」]+)」/)![1]!;
    const relationship = facts[1]!.match(/「([^」]+)」は「([^」]+)」より先/)!;
    const marks = Object.fromEntries(facts[2]!.split(' ／ ').map((item) => item.trim().split(' ')));
    for (const name of [relationship[1]!, relationship[2]!, last])
      await page.getByRole('button', { name: `印 ${marks[name]}`, exact: true }).click();
    await page.getByRole('button', { name: /封印を結ぶ/ }).click();
  } else throw Error(`Unhandled UI command: ${cmd.kind}`);
  return actSurvival(run, cmd) as SurvivalRun;
}

test('new exploration preserves supplies and storage without spending a turn; dialogs support Escape', async ({
  page,
}) => {
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '映像を再生する' }).click();
  expect(isSurvival(await state(page))).toBe(true);
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  const before = await state(page);
  await page.getByRole('button', { name: /探索マップ・持ち物/ }).click();
  const dialog = page.getByRole('dialog', { name: '探索マップ・持ち物' });
  await expect(dialog.getByRole('button', { name: '探索に戻る ×' })).toBeFocused();
  await expect(dialog.getByRole('img')).toHaveAccessibleName(/現在地は居間/);
  await dialog.getByRole('button', { name: /予備電池を拾う/ }).click();
  await dialog
    .locator('article')
    .filter({ hasText: '布切れ' })
    .getByRole('button', { name: '保管する' })
    .click();
  await expect(dialog.getByRole('button', { name: '布切れを取り出す' })).toBeVisible();
  await dialog.getByRole('button', { name: '布切れを取り出す' }).click();
  expect((await state(page)).turn).toBe(before.turn);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  const saved = await state(page);
  await page.reload();
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  expect(await state(page)).toEqual(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a full survival route crafts a flare, opens the shortcut, resumes, and solves the displayed clues', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let run = createSurvival(19);
  await resume(page, run);
  const completed = playSurvival(19);
  for (const cmd of completed.commands) {
    run = await command(page, run, cmd);
    expect(await state(page)).toEqual(run);
    if (run.phase === 'play') await expect(page.locator('.echo-scene')).toHaveCount(1);
    if (cmd.kind === 'craft') {
      await page.reload();
      await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
      expect(await state(page)).toEqual(run);
    }
    if (cmd.kind === 'search' && run.room === 'well') {
      await expect(
        page.getByRole('navigation').getByRole('button', { name: '浴室', exact: true }),
      ).toBeEnabled();
    }
  }
  await expect(page.getByRole('heading', { name: '館の記憶を持ち帰った者' })).toBeVisible();
  await page.getByRole('button', { name: 'この夜の結末を共有する' }).click();
  await expect(page.getByRole('textbox', { name: '共有する結末' })).toContainText('館の記憶');
  expect(run).toEqual(completed);
  expect(errors).toEqual([]);
});

test('quiet travel pays its displayed costs and the map explicitly offers normal travel', async ({
  page,
}) => {
  const run = actSurvival(createSurvival(19), { kind: 'search', light: true }) as SurvivalRun;
  await resume(page, run);
  await page.getByRole('checkbox', { name: /慎重に移動/ }).check();
  await page.getByRole('navigation').getByRole('button', { name: '書斎', exact: true }).click();
  const quiet = actSurvival(run, { kind: 'move', room: 'study', pace: 'quiet' });
  expect(await state(page)).toEqual(quiet);
  await page.getByRole('button', { name: /探索マップ・持ち物/ }).click();
  const dialog = page.getByRole('dialog', { name: '探索マップ・持ち物' });
  await dialog.getByRole('button', { name: '居間へ（通常1手）' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await state(page)).toEqual(actSurvival(quiet, { kind: 'move', room: 'living' }));
});
