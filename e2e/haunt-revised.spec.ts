import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  actNight,
  createNight,
  decodeNight,
  encodeNight,
  isRevised,
  omen,
} from '../src/haunt/revised';
import type { NightRun } from '../src/haunt/revised';
import { hauntConfig as config } from '../src/haunt/config';
import { hauntSaveKey } from '../src/haunt/engine';
async function seed(page: Page, run: NightRun) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: hauntSaveKey, value: encodeNight(run) },
  );
}
async function state(page: Page) {
  return decodeNight(await page.evaluate((key) => localStorage.getItem(key)!, hauntSaveKey));
}

test('new game starts at the top and keeps its feedback and controls visible on a phone', async ({
  page,
  isMobile,
}) => {
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '映像を再生する' }).click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(isRevised(await state(page))).toBe(true);
  if (isMobile) {
    await expect(page.locator('.echo-feedback')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.echo-actions')).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect(page.getByRole('button', { name: /調査済み/ })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('映像の最後');
  if (isMobile) await expect(page.locator('.echo-feedback')).toBeInViewport({ ratio: 1 });
  const before = await state(page);
  await page.getByRole('button', { name: /手がかり帳を開く/ }).click();
  const dialog = page.getByRole('dialog', { name: '手がかり帳' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('最後に映るのは');
  await expect(dialog.getByRole('button', { name: '探索に戻る ×' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(await state(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reading the warning, combining both written clues and keeping the TV on reveals a different ending', async ({
  page,
}) => {
  await seed(page, createNight(19));
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  let run = await state(page);
  const search = async () => {
    const light = omen(run).id === 'eyes' && !run.ward;
    await page
      .getByRole('button', {
        name: light
          ? /ライトで調べる/
          : new RegExp(`${config.rooms.find((r) => r.id === run.room)!.object}を調べる`),
      })
      .click();
    run = actNight(run, { kind: 'search', light });
  };
  await search();
  for (const room of ['bath', 'study', 'well', 'door'] as const) {
    if (omen(run).id === 'steps') {
      await expect(page.getByRole('region', { name: '次の危険の予告' })).toContainText('足音');
      await page.getByRole('button', { name: /息をひそめる/ }).click();
      run = actNight(run, { kind: 'wait' });
    }
    await page
      .getByRole('navigation', { name: '探索する部屋' })
      .getByRole('button', { name: new RegExp(config.rooms.find((r) => r.id === room)!.name) })
      .click();
    run = actNight(run, { kind: 'move', room });
    if (room !== 'door') await search();
  }
  expect(await state(page)).toEqual(run);
  const facts = await page.locator('.echo-seal-evidence p').allTextContents();
  const last = facts[0]!.match(/「([^」]+)」/)![1]!;
  const relationship = facts[1]!.match(/「([^」]+)」は「([^」]+)」より先/)!;
  const marks = Object.fromEntries(facts[2]!.split(' ／ ').map((item) => item.trim().split(' ')));
  for (const name of [relationship[1]!, relationship[2]!, last])
    await page.getByRole('button', { name: `印 ${marks[name]}`, exact: true }).click();
  await page.getByRole('button', { name: /封印を結ぶ/ }).click();
  await expect(page.getByRole('heading', { name: '井戸の記憶をほどいた者' })).toBeVisible();
  await expect(page.locator('.echo-ending-message')).toContainText('ありがとう');
  expect((await state(page)).phase).toBe('escaped');
});

test('a powered-off screen changes, sensory warnings remain readable and v2 saves resume exactly', async ({
  page,
}) => {
  let run = actNight(createNight(19), { kind: 'search', light: true });
  run = actNight(run, { kind: 'unplug' });
  await seed(page, run);
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  await expect(page.locator('[data-apparition="screen"]')).toBeVisible();
  await expect(page.getByRole('region', { name: '次の危険の予告' })).toContainText(
    '電源を消した部屋の気配',
  );
  await page.getByRole('button', { name: /手がかり帳を開く/ }).click();
  await expect(page.getByRole('dialog', { name: '手がかり帳' })).toContainText('もう一つの結末');
  await page.getByRole('button', { name: '探索に戻る ×' }).click();
  await page.reload();
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  expect(await state(page)).toEqual(run);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
