import { expect, test } from '@playwright/test';
import { hauntSaveKey } from '../src/haunt/survival';

test('a small phone can read the goal and result without the thumb controls covering them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?game=zero-echo');
  await expect(page.locator('.echo-intro')).toContainText('館を片付け');
  await page.getByRole('button', { name: '映像を再生する' }).click();
  await expect(page.getByRole('region', { name: '今の目的' })).toContainText('居間の映像');
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect(page.getByRole('region', { name: 'この館の物語' })).toContainText('三つの封印');
  await expect
    .poll(async () => {
      const result = await page.locator('.echo-feedback').boundingBox();
      const dock = await page.locator('.echo-control-dock').boundingBox();
      return result!.y + result!.height <= dock!.y - 8;
    })
    .toBe(true);
  const quick = page.getByRole('region', { name: 'すぐ使える道具' });
  const before = JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, hauntSaveKey));
  await quick.getByRole('button', { name: /予備電池を拾う/ }).click();
  const after = JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, hauntSaveKey));
  expect(after.commands).toHaveLength(before.commands.length + 1);
  await expect(page.getByRole('dialog', { name: '探索マップ・持ち物' })).not.toBeVisible();
  const button = await quick.getByRole('button', { name: /予備電池を使う/ }).boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('local Japanese voices arriving late enable preview; dialogue speaks once and supply pickups do not repeat it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const remote = { name: 'Remote Japanese', lang: 'ja-JP', localService: false };
    const local = { name: 'Local Japanese', lang: 'ja-JP', localService: true };
    class MockSpeech extends EventTarget {
      voices = [remote];
      calls: { text: string; name: string; rate: number; pitch: number }[] = [];
      getVoices() {
        return this.voices;
      }
      speak(u: SpeechSynthesisUtterance) {
        this.calls.push({ text: u.text, name: u.voice!.name, rate: u.rate, pitch: u.pitch });
      }
      cancel() {}
      load() {
        this.voices = [remote, local];
        this.dispatchEvent(new Event('voiceschanged'));
      }
    }
    const speech = new MockSpeech();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, '__storySpeech', { value: speech });
  });
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '音・演出の設定' }).click();
  const dialog = page.getByRole('dialog', { name: '音・演出の設定' });
  await expect(dialog.locator('.echo-voice-status')).toContainText(
    '利用できる日本語音声がありません',
  );
  await expect(dialog.getByRole('button', { name: '声を試聴する' })).toBeDisabled();
  await page.evaluate(() =>
    (window as unknown as { __storySpeech: { load: () => void } }).__storySpeech.load(),
  );
  await expect(dialog.getByRole('button', { name: '声を試聴する' })).toBeEnabled();
  await dialog.getByRole('button', { name: '声を試聴する' }).click();
  const calls = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __storySpeech: { calls: { text: string; name: string; rate: number; pitch: number }[] };
          }
        ).__storySpeech.calls,
    );
  await expect.poll(async () => (await calls()).length).toBe(1);
  await dialog.getByRole('button', { name: 'ゲームに戻る ×' }).click();
  await page.getByRole('button', { name: '映像を再生する' }).click();
  await expect.poll(async () => (await calls()).length).toBe(2);
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect.poll(async () => (await calls()).length).toBe(3);
  expect((await calls()).at(-1)).toMatchObject({ name: 'Local Japanese', rate: 0.92, pitch: 0.95 });
  expect((await calls()).at(-1)!.text).toContain('三つの印');
  await page
    .getByRole('region', { name: 'すぐ使える道具' })
    .getByRole('button', { name: /予備電池を拾う/ })
    .click();
  expect(await calls()).toHaveLength(3);
});
