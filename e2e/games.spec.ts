import { test, expect } from '@playwright/test';
import { gameById } from '../src/games';
import { newRun } from '../src/core/engine';
import { encodeSave, saveKey } from '../src/core/storage';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

test('Pages security policy allows both new and original games to run', async ({ page }) => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const policy = headers
    .split('\n')
    .find((line) => line.includes('Content-Security-Policy:'))!
    .split('Content-Security-Policy:')[1]!
    .trim();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'Content-Security-Policy': policy },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  await page.locator('button[data-choice]').first().click();
  await expect(page.getByRole('button', { name: /次の相談へ/ })).toBeVisible();
  await page.goto('/legacy/');
  await page.locator('#start').click();
  await page.locator('[data-choice]:not([disabled])').last().click();
  await expect(page.locator('#simple-next')).toBeVisible();
});

test('game library, accessible modes, and mobile layout', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      external.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ひとつの決断から');
  await expect(page.getByRole('radio', { name: /5分でひと旅/ })).toBeChecked();
  await page.getByRole('button', { name: /島のまちづくり.*選ぶ|ISLAND & COMMUNITY/ }).click();
  await expect(page).toHaveURL(/game=island-town/);
  await page.getByRole('radio', { name: /じっくり育てる/ }).check();
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('島のまちづくり');
  await expect(page.getByText('1 / 24', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external).toEqual([]);
});

for (const gameId of ['tower-lab', 'island-town']) {
  test(`${gameId}: complete a short game, resume and copy a personal diagnosis`, async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/?game=${gameId}`);
    await page.getByRole('button', { name: /この世界をはじめる/ }).click();
    for (let turn = 1; turn <= 10; turn++) {
      await expect(page.getByText(`${turn}年目の決断`, { exact: true })).toBeVisible();
      const choices = page.locator('button[data-choice]');
      await choices.nth((turn - 1) % 3).click();
      await expect(
        page.getByRole('heading', { name: '小さな決断が、景色を変えた。' }),
      ).toBeVisible();
      if (turn === 2) {
        const funds = await page.getByTestId('metric-funds').innerText();
        await page.reload();
        await page.getByRole('button', { name: /続きからあそぶ/ }).click();
        await expect(page.getByTestId('metric-funds')).toHaveText(funds);
        await expect(
          page.getByRole('heading', { name: '小さな決断が、景色を変えた。' }),
        ).toBeVisible();
      }
      await page
        .getByRole('button', { name: turn === 10 ? /育てた未来と診断を見る/ : /次の相談へ/ })
        .click();
    }
    await expect(page.getByRole('heading', { name: '未来を編む調整役' })).toBeVisible();
    await page.getByRole('button', { name: 'テキストをコピー' }).click();
    await expect(page.getByRole('status')).toContainText('結果をコピーしました');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('未来を編む調整役');
    expect(copied).toContain(`game=${gameId}`);
    await page.reload();
    await page.getByRole('button', { name: '保存した結果を見る' }).click();
    await expect(page.getByRole('heading', { name: '未来を編む調整役' })).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('save slots are independent and replacing a run needs confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  await page.locator('button[data-choice]').first().click();
  await page.getByRole('button', { name: /次の相談へ/ }).click();
  await page.getByRole('button', { name: '← ゲーム一覧' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /新しくはじめる/ }).click();
  await expect(page.getByRole('button', { name: /続きからあそぶ（2/ })).toBeVisible();
  await page.getByRole('button', { name: /ISLAND & COMMUNITY/ }).click();
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  await page.getByRole('button', { name: '← ゲーム一覧' }).click();
  await page.getByRole('button', { name: /BUILDING & PEOPLE/ }).click();
  await page.getByRole('button', { name: /続きからあそぶ（2/ }).click();
  await expect(page.getByText('2年目の決断', { exact: true })).toBeVisible();
});

test('corrupt saves are preserved and storage failures do not break play', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('small-worlds:v1:tower-lab', '{broken');
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('元のデータは保持');
  expect(await page.evaluate(() => localStorage.getItem('small-worlds:v1:tower-lab'))).toBe(
    '{broken',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  await expect(page.getByText('保存できません。画面を閉じると進行を失います。')).toBeVisible();
  await page.locator('button[data-choice]:enabled').last().click();
  await expect(page.getByRole('button', { name: /次の相談へ/ })).toBeVisible();
});

test('sharing failure keeps a manually copyable result', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /この世界をはじめる/ }).click();
  for (let turn = 1; turn <= 10; turn++) {
    await page
      .locator('button[data-choice]')
      .nth((turn - 1) % 3)
      .click();
    await page
      .getByRole('button', { name: turn === 10 ? /育てた未来と診断を見る/ : /次の相談へ/ })
      .click();
  }
  await page.getByRole('button', { name: 'テキストをコピー' }).click();
  await expect(page.getByRole('status')).toContainText('下のテキスト');
  await expect(page.getByRole('textbox', { name: '共有テキスト' })).toHaveValue(/未来を編む調整役/);
});

test('reload cannot reroll a pending decision', async ({ page }) => {
  const game = gameById('tower-lab');
  const save = encodeSave(newRun(game, 'quick', 19));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: saveKey(game.id),
    value: save,
  });
  await page.goto('/');
  await page.getByRole('button', { name: /続きからあそぶ/ }).click();
  const title = await page.locator('#decision-title').innerText();
  await page.reload();
  await page.getByRole('button', { name: /続きからあそぶ/ }).click();
  await expect(page.locator('#decision-title')).toHaveText(title);
});

test('original tower game still completes ten decisions and resumes its existing save format', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) array.fill(19);
      return array;
    };
  });
  await page.goto('/legacy/');
  await expect(page).toHaveTitle(/タワマン理事長/);
  await page.locator('#start').click();
  for (let turn = 1; turn <= 10; turn++) {
    await page.locator('[data-choice]:not([disabled])').last().click();
    await page.locator('#simple-next').waitFor({ state: 'visible' });
    if (turn === 1) {
      await page.reload();
      await page.locator('#resume').click();
    }
    await page.locator('#simple-next').click();
  }
  await expect(page.locator('.personality-card')).toBeVisible();
  await expect(page.locator('.easy-highlights')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('tower-board-v3'))).toBe(true);
  await page.locator('#share').click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/\/legacy\/$/);
  await expect(page.locator('#image')).toBeHidden();
  expect(errors).toEqual([]);
});

test('original full-mode result exports a valid PNG', async ({ page }) => {
  // Produce a real full-mode run using the original engine, then exercise its saved-result UI.
  const require = createRequire(import.meta.url);
  const legacy = require('../public/legacy/engine.js');
  const state = legacy.makeGame('koiwa', 19);
  for (let turn = 0; turn < 30 && !state.ended; turn++) {
    legacy.beginYear(state);
    if (state.phase === 'repair') legacy.chooseRepair(state, 'standard');
    const event = legacy.currentEvent(state);
    legacy.chooseEvent(
      state,
      event.choices.findIndex((choice: { cost?: number }) => !choice.cost),
    );
    legacy.nextYear(state);
    if (state.phase === 'assembly')
      legacy.chooseDirection(state, legacy.CAMPAIGN_DATA.directions[state.year][0].id);
  }
  expect(state.phase).toBe('result');
  await page.addInitScript(
    (save) => localStorage.setItem('tower-board-v3', save),
    JSON.stringify(state),
  );
  await page.goto('/legacy/');
  await page.locator('#resume').click();
  await expect(page.locator('#image')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '結果画像を保存' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('tower-board-result.png');
  const file = await download.path();
  const bytes = readFileSync(file!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1260);
});
