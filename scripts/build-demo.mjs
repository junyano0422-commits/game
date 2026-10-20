import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const build = new URL('../build/', import.meta.url);
let html = await readFile(new URL('index.html', build), 'utf8');
const script = html.match(/<script[^>]+src="(\/assets\/[^\"]+\.js)"[^>]*><\/script>/);
const style = html.match(/<link[^>]+href="(\/assets\/[^\"]+\.css)"[^>]*>/);
if (!script || !style) throw new Error('Expected one self-contained Vite entry and stylesheet');
let js = await readFile(new URL(script[1].slice(1), build), 'utf8');
const css = await readFile(new URL(style[1].slice(1), build), 'utf8');
// Inline games stay self-contained; the original game retains its existing site.
js = js.replace(
  /(["'`])\/legacy\/\1/g,
  JSON.stringify('https://tower-board.rosyrobin128.chatgpt.site/'),
);
// Bundle image assets into the downloaded edition; hosted builds keep hashed assets lazy-loaded.
const imageReference = /(["'`])(\/assets\/[^"'`]+\.(?:webp|png|jpe?g|svg))\1/g;
const embedded = new Map();
for (const match of js.matchAll(imageReference)) {
  const asset = match[2];
  if (embedded.has(asset)) continue;
  const extension = asset.split('.').at(-1);
  const mime =
    extension === 'svg'
      ? 'image/svg+xml'
      : extension === 'jpg'
        ? 'image/jpeg'
        : `image/${extension}`;
  const bytes = await readFile(new URL(asset.slice(1), build));
  embedded.set(asset, `data:${mime};base64,${bytes.toString('base64')}`);
}
js = js.replace(imageReference, (_full, _quote, asset) => JSON.stringify(embedded.get(asset)));
html = html.replace(
  script[0],
  () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`,
);
html = html.replace(style[0], () => `<style>${css}</style>`);
const output = new URL('small-worlds-demo.html', build);
await writeFile(output, html);
console.log(`Downloadable demo: ${fileURLToPath(output)}`);
const rescue = new URL('last-elevator.html', build);
await writeFile(
  rescue,
  html.replace('<html lang="ja">', '<html lang="ja" data-game="last-elevator">'),
);
console.log(`Rescue game demo: ${fileURLToPath(rescue)}`);

const stall = new URL('night-stall.html', build);
await writeFile(
  stall,
  html.replace('<html lang="ja">', '<html lang="ja" data-game="night-stall">'),
);
console.log(`Stall game demo: ${fileURLToPath(stall)}`);

const haunt = new URL('zero-echo.html', build);
await writeFile(haunt, html.replace('<html lang="ja">', '<html lang="ja" data-game="zero-echo">'));
console.log(`Horror game demo: ${fileURLToPath(haunt)}`);
