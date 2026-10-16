import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const build = new URL('../build/', import.meta.url);
let html = await readFile(new URL('index.html', build), 'utf8');
const script = html.match(/<script[^>]+src="(\/assets\/[^\"]+\.js)"[^>]*><\/script>/);
const style = html.match(/<link[^>]+href="(\/assets\/[^\"]+\.css)"[^>]*>/);
if (!script || !style) throw new Error('Expected one self-contained Vite entry and stylesheet');
let js = await readFile(new URL(script[1].slice(1), build), 'utf8');
const css = await readFile(new URL(style[1].slice(1), build), 'utf8');
// The downloadable demo includes the two new games. The original game retains its existing site.
js = js.replaceAll('"/legacy/"', '"https://tower-board.rosyrobin128.chatgpt.site/"');
html = html.replace(
  script[0],
  () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`,
);
html = html.replace(style[0], () => `<style>${css}</style>`);
const output = new URL('small-worlds-demo.html', build);
await writeFile(output, html);
console.log(`Downloadable demo: ${fileURLToPath(output)}`);
