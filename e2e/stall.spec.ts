import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { actStall, createStall, decodeStall, encodeStall, stallSaveKey } from '../src/stall/engine';
import { stallConfig } from '../src/stall/config';
import type { StallRun } from '../src/stall/engine';
async function state(page: Page) {
  return decodeStall(await page.evaluate((key) => localStorage.getItem(key)!, stallSaveKey));
}
async function seed(page: Page, run: StallRun) {
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: stallSaveKey, save: encodeStall(run) },
  );
}
async function openFrozen(page: Page) {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.goto('/?game=night-stall');
  await page.clock.pauseAt(new Date('2026-10-19T12:00:10Z'));
}

test('stall is reachable from library and cooks, serves and shares a complete short night', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: /NEW.*夜空のおにぎり屋台/ }).click();
  await page.clock.pauseAt(new Date('2026-10-19T12:00:10Z'));
  await expect(page).toHaveTitle(/夜空のおにぎり屋台/);
  await page.getByRole('radio', { name: /ひと晩体験/ }).check();
  await page.getByRole('button', { name: 'のれんを出す' }).click();
  for (let i = 0; i < 4; i++) {
    let run = await state(page);
    while (!run.orders.length) {
      await page.clock.runFor(200);
      run = await state(page);
    }
    const order = run.orders[0]!;
    await page.getByRole('button', { name: '焼き台1におにぎりを置く' }).click();
    await page.clock.runFor(2800);
    await page.getByRole('button', { name: /くるっ！ 裏返す/ }).click();
    await page.clock.runFor(2800);
    await page.getByRole('button', { name: /火から下ろして、お皿へ/ }).click();
    const flavor = stallConfig.flavors.find((f) => f.id === order.flavor)!;
    await page
      .getByRole('group', { name: 'おにぎりの味' })
      .getByRole('button', { name: new RegExp(flavor.name) })
      .click();
    await page
      .locator(`[data-order="${order.id}"]`)
      .getByRole('button', { name: /の注文に出す/ })
      .click();
  }
  await expect(page.getByRole('heading', { name: '焼き色の魔法使い' })).toBeVisible();
  expect((await state(page)).perfect).toBe(4);
  await page.getByRole('button', { name: '屋台の評判を共有する' }).click();
  await expect(page.getByRole('textbox', { name: '共有する屋台の結果' })).toContainText(
    '4人においしい笑顔',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('pauses cooking, saves the actual heat, and resumes exactly after reload', async ({
  page,
}) => {
  await openFrozen(page);
  await page.getByRole('button', { name: 'のれんを出す' }).click();
  await page.getByRole('button', { name: '焼き台1におにぎりを置く' }).click();
  await page.clock.runFor(1800);
  await page.getByRole('button', { name: 'Ⅱ 一時停止' }).click();
  const paused = await state(page);
  expect(paused.pans[0]!.heat[0]).toBe(27);
  await page.clock.runFor(10000);
  expect(await state(page)).toEqual(paused);
  await page.reload();
  await page.getByRole('button', { name: '保存した屋台の続きから' }).click();
  expect(await state(page)).toEqual(paused);
  await page.clock.runFor(1000);
  expect((await state(page)).pans[0]!.heat[0]).toBeGreaterThan(27);
  await page.getByRole('button', { name: 'Ⅱ 一時停止' }).click();
  await expect(page.getByRole('dialog', { name: '屋台も、ひと休み。' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('can skip unaffordable equipment and preserves the original games saves', async ({ page }) => {
  // A complete first night with no sales is allowed, so skipping upgrades stays playable.
  const run = actStall(createStall(19), { kind: 'tick', count: 300 });
  await seed(page, run);
  await page.addInitScript(() =>
    localStorage.setItem('small-worlds:last-elevator:v1', 'unchanged-rescue-save'),
  );
  await openFrozen(page);
  await page.getByRole('button', { name: '保存した屋台の続きから' }).click();
  await expect(page.getByRole('heading', { name: '次の夜は、どんな屋台に？' })).toBeVisible();
  await expect(page.getByRole('button', { name: /3つめの焼き台/ })).toBeDisabled();
  await page.getByRole('button', { name: '今の設備で、次の夜へ' }).click();
  expect((await state(page)).night).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem('small-worlds:last-elevator:v1'))).toBe(
    'unchanged-rescue-save',
  );
});

test('storage errors allow play and corrupt saves are preserved until an approved restart', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('small-worlds:night-stall:v1', 'broken-save'),
  );
  await openFrozen(page);
  await expect(page.getByRole('alert')).toContainText('保存データを読み込めません');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'のれんを出す' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), stallSaveKey)).toBe('broken-save');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'のれんを出す' }).click();
  await expect(page.getByRole('alert')).toContainText('保存できません');
  await page.getByRole('button', { name: '焼き台1におにぎりを置く' }).click();
  await expect(page.getByRole('button', { name: /くるっ！ 裏返す/ })).toBeVisible();
});

test('purchased grill unlocks a third burner and the favorite flavor brings back a regular', async ({
  page,
}) => {
  let run = createStall(19);
  while (run.phase === 'night') {
    if (!run.orders.length) {
      run = actStall(run, { kind: 'tick', count: 1 });
      continue;
    }
    const order = run.orders[0]!;
    for (const action of [
      { kind: 'start', pan: 0 },
      { kind: 'tick', count: 14 },
      { kind: 'flip', pan: 0 },
      { kind: 'tick', count: 14 },
      { kind: 'plate', pan: 0 },
      { kind: 'flavor', pan: 0, flavor: order.flavor },
      { kind: 'serve', pan: 0, order: order.id },
    ] as const)
      run = actStall(run, action);
  }
  await seed(page, run);
  await openFrozen(page);
  await page.getByRole('button', { name: '保存した屋台の続きから' }).click();
  await page.getByRole('button', { name: /3つめの焼き台/ }).click();
  const upgraded = await state(page);
  expect(upgraded.upgrades).toEqual(['grill']);
  expect(upgraded.cash).toBe(run.cash - 90);
  expect(upgraded.orders[0]!.regular).toBe(true);
  await expect(page.getByRole('button', { name: '焼き台3におにぎりを置く' })).toBeVisible();
  await expect(page.getByText('♡ また来てくれた常連さん')).toBeVisible();
});
