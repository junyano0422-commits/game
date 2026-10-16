import './style.css';

const scoreElement = document.querySelector('#score');
const timeElement = document.querySelector('#time');
const bestElement = document.querySelector('#best');
const target = document.querySelector('#target');
const start = document.querySelector('#start');
const message = document.querySelector('#message');
const duration = 20_000;
let score = 0;
let deadline = 0;
let timer;
let playing = false;
let best = 0;

try {
  const stored = Number(localStorage.getItem('star-tap-best'));
  if (Number.isSafeInteger(stored) && stored > 0) best = stored;
} catch {
  // The game also works when browser storage is unavailable.
}
bestElement.textContent = best;

function moveTarget() {
  target.style.left = `calc((100% - 64px) * ${Math.random()})`;
  target.style.top = `calc((100% - 64px) * ${Math.random()})`;
}

function finish() {
  playing = false;
  clearInterval(timer);
  target.hidden = true;
  timeElement.textContent = '0';
  if (score > best) {
    best = score;
    bestElement.textContent = best;
    try { localStorage.setItem('star-tap-best', String(best)); } catch { /* Optional storage. */ }
  }
  message.textContent = `タイムアップ！ ${score}個の星をつかまえました。`;
  message.hidden = false;
  start.disabled = false;
  start.textContent = 'もう一度あそぶ ↗';
  start.focus({ preventScroll: true });
}

start.addEventListener('click', () => {
  clearInterval(timer);
  score = 0;
  scoreElement.textContent = '0';
  timeElement.textContent = '20';
  deadline = Date.now() + duration;
  playing = true;
  message.hidden = true;
  start.disabled = true;
  target.hidden = false;
  moveTarget();
  target.focus({ preventScroll: true });
  timer = setInterval(() => {
    const remaining = Math.max(0, deadline - Date.now());
    timeElement.textContent = Math.ceil(remaining / 1000);
    if (remaining === 0) finish();
  }, 100);
});

target.addEventListener('click', () => {
  if (!playing) return;
  if (Date.now() >= deadline) {
    finish();
    return;
  }
  scoreElement.textContent = ++score;
  moveTarget();
});
