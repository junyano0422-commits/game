import { describe, expect, it } from 'vitest';
import { hauntConfig as config } from './config';
import {
  actHaunt,
  canSeal,
  createHaunt,
  decodeHaunt,
  encodeHaunt,
  hauntDiagnosis,
  hauntShare,
  omen,
  puzzle,
} from './engine';
import type { HauntRun } from './engine';
import type { HauntMode } from './config';
function beforeSeal(seed: number, mode: HauntMode = 'quick') {
  let run = createHaunt(seed, mode);
  run = actHaunt(run, { kind: 'search', light: omen(run).id === 'eyes' });
  run = actHaunt(run, { kind: 'unplug' });
  for (const room of ['bath', 'study', 'well', 'door'] as const) {
    run = actHaunt(run, { kind: 'wait' });
    run = actHaunt(run, { kind: 'move', room });
    if (room !== 'door')
      run = actHaunt(run, {
        kind: 'search',
        light: omen(run).id === 'eyes' && !run.ward && run.battery > 0,
      });
  }
  return run;
}
describe('the well and its curse', () => {
  it('creates stable clues and rejects locked or impossible actions without mutation', () => {
    const run = createHaunt(19);
    const copy = structuredClone(run);
    expect(puzzle(run)).toEqual(puzzle(createHaunt(19)));
    expect(new Set(puzzle(run).solution).size).toBe(3);
    expect(() => actHaunt(run, { kind: 'move', room: 'well' })).toThrow();
    expect(() => actHaunt(run, { kind: 'move', room: 'living' })).toThrow();
    expect(() => actHaunt(run, { kind: 'seal', symbols: ['○', '△', '×'] })).toThrow();
    actHaunt(run, { kind: 'search', light: true });
    expect(run).toEqual(copy);
  });
  it('forecasts the next risk and light prevents the gaze', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = createHaunt(seed);
      const next = actHaunt(run, { kind: 'move', room: 'bath' });
      expect(next.fear).toBe(1 + (omen(run).id === 'steps' ? 3 : 0));
      const naked = actHaunt(run, { kind: 'search', light: false });
      const lit = actHaunt(run, { kind: 'search', light: true });
      expect(lit.fear).toBe(1);
      expect(lit.battery).toBe(run.battery - 1);
      expect(naked.fear - lit.fear).toBe(omen(run).id === 'eyes' ? 3 : 0);
    }
  });
  it('can restore the TV, stops passive curse after unplugging and punishes repeated hiding', () => {
    let run = actHaunt(createHaunt(19), { kind: 'unplug' });
    expect(run.tv).toBe(false);
    expect(() => actHaunt(run, { kind: 'search', light: false })).toThrow();
    run = actHaunt(run, { kind: 'plug' });
    expect(run.tv).toBe(true);
    run = actHaunt(run, { kind: 'search', light: true });
    expect(run.orderKnown).toBe(true);
    run = actHaunt(run, { kind: 'unplug' });
    const first = actHaunt(run, { kind: 'wait' });
    const second = actHaunt(first, { kind: 'wait' });
    expect(first.fear).toBe(Math.max(0, run.fear - 2));
    expect(second.fear).toBe(first.fear + 2);
  });
  it('a collected mirror charm protects exactly once against a later gaze', () => {
    let checked = 0;
    for (let seed = 1; seed <= 50; seed++) {
      let run = actHaunt(createHaunt(seed), { kind: 'move', room: 'bath' });
      run = actHaunt(run, { kind: 'search', light: true });
      expect(run.ward).toBe(true);
      if (omen(run).id !== 'eyes') continue;
      const next = actHaunt(run, { kind: 'search', light: false });
      expect(next.ward).toBe(false);
      expect(next.fear).toBe(run.fear + 1 + 2);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('can solve every tested layout, preserves every clue and replays its ending exactly', () => {
    const solutions = new Set<string>();
    for (let seed = 1; seed <= 100; seed++)
      for (const mode of ['quick', 'slow'] as const) {
        const run = beforeSeal(seed, mode);
        expect(canSeal(run)).toBe(true);
        expect(run.phase).toBe('play');
        solutions.add(puzzle(run).solution.join(''));
        expect(decodeHaunt(encodeHaunt(run))).toEqual(run);
        const escaped = actHaunt(run, { kind: 'seal', symbols: puzzle(run).solution });
        expect(escaped.phase).toBe('escaped');
        expect(escaped.turn).toBeLessThanOrEqual(config.modes[mode].turns);
        expect(decodeHaunt(encodeHaunt(escaped))).toEqual(escaped);
        expect(hauntDiagnosis(escaped).title).toContain('生還者');
      }
    expect(solutions.size).toBe(6);
  });
  it('charges wrong seals and ends the night when time or curse runs out', () => {
    const run = beforeSeal(19);
    const solution = puzzle(run).solution;
    const wrong = actHaunt(run, {
      kind: 'seal',
      symbols: [solution[1]!, solution[0]!, solution[2]!],
    });
    expect(wrong.fear).toBe(run.fear + 4);
    expect(wrong.phase).toBe('play');
    let doomed: HauntRun = createHaunt(19);
    while (doomed.phase === 'play') doomed = actHaunt(doomed, { kind: 'wait' });
    expect(doomed.phase).toBe('taken');
    expect(() => actHaunt(doomed, { kind: 'wait' })).toThrow();
    let timed = createHaunt(19);
    timed = actHaunt(timed, { kind: 'unplug' });
    while (timed.phase === 'play') {
      timed = actHaunt(timed, { kind: 'move', room: timed.room === 'living' ? 'bath' : 'living' });
      if (timed.phase === 'play') timed = actHaunt(timed, { kind: 'wait' });
    }
    expect(timed.turn).toBe(18);
    expect(timed.reason).toContain('猶予');
  });
  it('rejects fabricated state and shares a diagnosis without the puzzle solution', () => {
    const run = beforeSeal(19);
    const raw = JSON.parse(encodeHaunt(run));
    for (const changes of [
      { fear: 0 },
      { seed: 0 },
      { version: 9 },
      { actions: [{ kind: 'move', room: 'well' }] },
    ])
      expect(() => decodeHaunt(JSON.stringify({ ...raw, ...changes }))).toThrow();
    expect(() => decodeHaunt('{bad')).toThrow();
    const share = hauntShare(run, 'https://example.github.io/game/?old=1');
    expect(share).toContain('https://example.github.io/game/?game=zero-echo');
    expect(share).not.toContain(puzzle(run).solution.join(''));
    expect(share).not.toContain('seed');
    expect(hauntShare(run, 'file:///game.html')).not.toContain('file:');
  });
});
