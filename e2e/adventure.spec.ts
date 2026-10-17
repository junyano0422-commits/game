import { test, expect } from '@playwright/test';
import {
  createAdventure,
  encodePlaySave,
  decodePlaySave,
  isAdventure,
} from '../src/rescue/adventure';
import { rescueSaveKey } from '../src/rescue/engine';

test('new rescue consultation blocks travel, changes calls and survives reload', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: rescueSaveKey, save: encodePlaySave(createAdventure(19)) },
  );
  await page.goto('/?game=last-elevator');
  await page.getByRole('button', { name: '救出の続きから' }).click();
  await page.getByRole('button', { name: /4Fへ向かう/ }).click();
  await page.getByRole('button', { name: /人を避難所へ届ける/ }).click();
  await expect(page.getByRole('heading', { name: '予定外のSOS。引き受ける？' })).toBeVisible();
  await expect(page.locator('.rescue-go')).toBeDisabled();
  await page.locator('[data-consultation="accept"]').click();
  const saved = await page.evaluate((key) => localStorage.getItem(key)!, rescueSaveKey);
  const state = decodePlaySave(saved);
  expect(isAdventure(state) && state.answered).toEqual(['rooftop']);
  expect(state.people.some((p) => p.id === 'photo-team')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '救出の続きから' }).click();
  await expect(page.getByRole('heading', { name: '予定外のSOS。引き受ける？' })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), rescueSaveKey)).toBe(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
