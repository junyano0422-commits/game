import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { mediaSettingsKey } from '../src/haunt/audio';
import { hauntSaveKey } from '../src/haunt/engine';

async function observeContexts(page: Page) {
  await page.addInitScript(() => {
    const native = window.AudioContext;
    const contexts: AudioContext[] = [];
    Object.defineProperty(window, '__horrorContexts', { value: contexts });
    window.AudioContext = class extends native {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
    };
  });
}
async function contextStates(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __horrorContexts: AudioContext[] }).__horrorContexts.map(
      (context) => context.state,
    ),
  );
}

test('native audio starts on a tap, mutes, stops when hidden, resumes on request and closes on exit', async ({
  page,
}) => {
  await observeContexts(page);
  await page.goto('/?game=zero-echo');
  await expect(page.locator('.echo-app')).toHaveClass(/echo-illustrated/);
  expect(await contextStates(page)).toEqual([]);
  await page.getByRole('button', { name: '映像を再生する' }).click();
  await expect(page.locator('.echo-app')).toHaveAttribute('data-sound', 'on');
  await expect.poll(() => contextStates(page)).toEqual(['running']);
  const initial = await page.evaluate((key) => localStorage.getItem(key), hauntSaveKey);
  await page.getByRole('button', { name: '消音にする' }).click();
  await expect.poll(() => contextStates(page)).toEqual(['suspended']);
  await page.getByRole('button', { name: '音を入れる', exact: true }).click();
  await expect.poll(() => contextStates(page)).toEqual(['running']);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => contextStates(page)).toEqual(['suspended']);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.echo-app')).toHaveAttribute('data-sound', 'paused');
  expect(await contextStates(page)).toEqual(['suspended']);
  await page.getByRole('button', { name: '音を再開' }).click();
  await expect.poll(() => contextStates(page)).toEqual(['running']);
  expect(await page.evaluate((key) => localStorage.getItem(key), hauntSaveKey)).toBe(initial);
  const img = page.locator('.echo-art-source');
  expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(1000);
  const displayedImage = page.locator('.echo-scene .echo-atlas-image').first();
  await expect(displayedImage).toBeVisible();
  expect(
    await displayedImage.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(1000);
  await page.getByRole('button', { name: '← ゲーム一覧' }).click();
  await expect.poll(() => contextStates(page)).toEqual(['closed']);
});

test('all sound cues produce bounded non-silent native audio, including alternating stereo footsteps', async ({
  page,
}) => {
  const source = ts.transpileModule(await readFile('src/haunt/audio.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  await page.goto('about:blank');
  const results = await page.evaluate(async (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try {
      const { renderSoundCue } = await import(url);
      const results = [];
      for (const cue of ['ring', 'steps', 'static', 'drip', 'creak', 'reveal', 'impact', 'dawn']) {
        const rate = 24000;
        const context = new OfflineAudioContext(2, Math.ceil(rate * 2.8), rate);
        renderSoundCue(context, context.destination, cue);
        const buffer = await context.startRendering();
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        let squares = 0,
          peak = 0,
          finite = true;
        for (let i = 0; i < left.length; i++) {
          squares += left[i]! * left[i]!;
          peak = Math.max(peak, Math.abs(left[i]!));
          finite = finite && Number.isFinite(left[i]!) && Number.isFinite(right[i]!);
        }
        const energy = (data: Float32Array, start: number, end: number) => {
          let sum = 0;
          for (let i = Math.floor(start * rate); i < end * rate; i++) sum += data[i]! * data[i]!;
          return sum;
        };
        results.push({
          cue,
          rms: Math.sqrt(squares / left.length),
          peak,
          finite,
          firstLeft: energy(left, 0.03, 0.2),
          firstRight: energy(right, 0.03, 0.2),
          secondLeft: energy(left, 0.46, 0.63),
          secondRight: energy(right, 0.46, 0.63),
        });
      }
      return results;
    } finally {
      URL.revokeObjectURL(url);
    }
  }, source);
  for (const result of results) {
    expect(result.finite, result.cue).toBe(true);
    expect(result.rms, result.cue).toBeGreaterThan(0.0001);
    expect(result.peak, result.cue).toBeLessThan(0.8);
  }
  const steps = results.find((r) => r.cue === 'steps')!;
  expect(steps.firstLeft).toBeGreaterThan(steps.firstRight * 2);
  expect(steps.secondRight).toBeGreaterThan(steps.secondLeft * 2);
});

test('sound and motion settings persist, silent play creates no audio and remains operable', async ({
  page,
}) => {
  await observeContexts(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?game=zero-echo');
  await page.getByRole('checkbox', { name: /音ありで遊ぶ/ }).uncheck();
  await page.getByRole('button', { name: '映像を再生する' }).click();
  expect(await contextStates(page)).toEqual([]);
  await expect(page.locator('.echo-app')).toHaveAttribute('data-sound', 'off');
  await expect(page.locator('.echo-app')).toHaveClass(/echo-restrained/);
  await page.getByRole('button', { name: '音・演出の設定' }).click();
  const dialog = page.getByRole('dialog', { name: '音・演出の設定' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'ささやき声' }).uncheck();
  const slider = dialog.getByRole('slider', { name: '効果音の音量' });
  await slider.focus();
  await slider.press('End');
  await expect(dialog.locator('output')).toHaveText('100%');
  await page.getByRole('button', { name: 'ゲームに戻る ×' }).click();
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect(page.locator('.echo-feedback')).toContainText('映像の最後');
  expect(await contextStates(page)).toEqual([]);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    mediaSettingsKey,
  );
  expect(saved).toMatchObject({ sound: false, voice: false, volume: 100, impact: false });
  await page.reload();
  await page.getByRole('button', { name: '記録した夜の続きへ' }).click();
  expect(await contextStates(page)).toEqual([]);
  await expect(page.locator('.echo-app')).toHaveClass(/echo-restrained/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unavailable audio and a failed image download keep the game playable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.route('**/assets/nightmares-*.webp', (route) => route.abort());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?game=zero-echo');
  await page.getByRole('button', { name: '映像を再生する' }).click();
  await expect(page.locator('.echo-media-notice')).toContainText('音を開始できませんでした');
  await expect(page.locator('.echo-app')).not.toHaveClass(/echo-illustrated/);
  await page.getByRole('button', { name: /呪いの映像を調べる/ }).click();
  await expect(page.locator('.echo-feedback')).toContainText('映像の最後');
  expect(errors).toEqual([]);
});

test('standalone edition embeds and displays its images without separate asset requests', async ({
  page,
}) => {
  const assetRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/')) assetRequests.push(r.url());
  });
  await page.goto('/zero-echo.html');
  await expect(page.locator('.echo-app')).toHaveClass(/echo-illustrated/);
  await page.getByRole('button', { name: '映像を再生する' }).click();
  const image = page.locator('.echo-scene .echo-atlas-image').first();
  await expect(image).toBeVisible();
  const dimensions = await image.evaluate((el) => {
    const img = el as HTMLImageElement;
    const rect = img.getBoundingClientRect();
    return {
      dataUrl: img.src.startsWith('data:image/webp;base64,'),
      naturalWidth: img.naturalWidth,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(dimensions.dataUrl).toBe(true);
  expect(dimensions.naturalWidth).toBe(1536);
  expect(dimensions.width).toBeGreaterThan(500);
  expect(dimensions.height).toBeGreaterThan(200);
  expect(assetRequests).toEqual([]);
});
