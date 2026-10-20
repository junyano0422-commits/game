import { describe, expect, it } from 'vitest';
import {
  actNight,
  apparition,
  createNight,
  decodeNight,
  encodeNight,
  fragments,
  isRevised,
  nightDiagnosis,
  nightShare,
  omen,
  puzzle,
} from './revised';
import type { NightRun } from './revised';
import { actHaunt, createHaunt, encodeHaunt } from './engine';
import type { HauntMode } from './config';

function expedition(
  seed: number,
  mode: HauntMode = 'quick',
  policy: 'adaptive' | 'fixed' | 'lit' = 'adaptive',
  finish = true,
) {
  let run: NightRun = createNight(seed, mode);
  const act = (a: Parameters<typeof actNight>[1]) => {
    if (run.phase === 'play') run = actNight(run, a);
  };
  act({ kind: 'search', light: policy === 'fixed' || omen(run).id === 'eyes' });
  if (policy !== 'lit') act({ kind: 'unplug' });
  for (const room of ['bath', 'study', 'well', 'door'] as const) {
    if (run.phase !== 'play') break;
    if (policy === 'fixed' || omen(run).id === 'steps') act({ kind: 'wait' });
    act({ kind: 'move', room });
    if (room !== 'door')
      act({
        kind: 'search',
        light: policy !== 'fixed' && omen(run).id === 'eyes' && !run.ward && run.battery > 0,
      });
  }
  if (finish) act({ kind: 'seal', symbols: puzzle(run).solution });
  return run;
}
describe('a revised night keeps choices meaningful', () => {
  it('preserves v1 saves and their exact next move without applying new rules', () => {
    const classic = actHaunt(createHaunt(19), { kind: 'search', light: true });
    expect(decodeNight(encodeHaunt(classic))).toEqual(classic);
    const next = actNight(classic, { kind: 'unplug' });
    expect(next).toEqual(actHaunt(classic, { kind: 'unplug' }));
    expect(JSON.parse(encodeNight(next)).version).toBe(1);
    expect(isRevised(next)).toBe(false);
  });
  it('hiding works on footsteps, protects the next move and is harmful in silence', () => {
    let tested = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const run = createNight(seed);
      const snapshot = structuredClone(run);
      const hidden = actNight(run, { kind: 'wait' });
      if (!isRevised(hidden)) throw Error('Expected v2');
      expect(run).toEqual(snapshot);
      if (omen(run).id === 'steps') {
        expect(hidden.passage).toBe(true);
        expect(hidden.hides).toBe(1);
        const move = actNight(hidden, { kind: 'move', room: 'bath' });
        expect(move.fear).toBe(hidden.fear + 1);
        expect(isRevised(move) && move.passage).toBe(false);
        tested++;
      } else {
        expect(hidden.fear).toBe(3);
        expect(hidden.passage).toBe(false);
      }
      const twice = actNight(hidden, { kind: 'wait' });
      expect(twice.fear).toBe(hidden.fear + 3);
    }
    expect(tested).toBeGreaterThan(0);
  });
  it('requires combining two facts into a unique room order, with no memorization', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const run = expedition(seed, 'quick', 'adaptive', false);
      const facts = fragments(run)!;
      const p = puzzle(run);
      expect(facts.video).toContain('最後');
      expect(facts.diary).toContain('より先');
      const rooms = ['bath', 'study', 'well'] as const;
      const possible = rooms.flatMap((a) =>
        rooms.filter((b) => b !== a).map((b) => [a, b, rooms.find((c) => c !== a && c !== b)!]),
      );
      const matches = possible.filter(
        (order) =>
          order[2] === p.order[2] && order.indexOf(p.order[0]!) < order.indexOf(p.order[1]!),
      );
      expect(matches).toEqual([p.order]);
    }
  });
  it('rewards reading danger cues more than repeating the old safe routine', () => {
    let fixedWins = 0,
      adaptiveWins = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      fixedWins += expedition(seed, 'quick', 'fixed').phase === 'escaped' ? 1 : 0;
      const adaptive = expedition(seed);
      adaptiveWins += adaptive.phase === 'escaped' ? 1 : 0;
      expect(decodeNight(encodeNight(adaptive))).toEqual(adaptive);
    }
    expect(adaptiveWins).toBe(1000);
    expect(fixedWins).toBeGreaterThan(0);
    expect(fixedWins).toBeLessThan(800);
  });
  it('supports both escape strategies in both modes without stranding a tested layout', () => {
    for (let seed = 1; seed <= 100; seed++)
      for (const mode of ['quick', 'slow'] as const)
        for (const policy of ['adaptive', 'lit'] as const) {
          const run = expedition(seed, mode, policy);
          expect(run.phase).toBe('escaped');
          expect(run.battery).toBeGreaterThanOrEqual(0);
          expect(decodeNight(encodeNight(run))).toEqual(run);
          if (policy === 'lit') expect(nightDiagnosis(run).title).toBe('井戸の記憶をほどいた者');
        }
  });
  it('changes the apparition with actual history and does not award a watched ending for the last power switch', () => {
    const initial = createNight(19);
    const cut = actNight(initial, { kind: 'unplug' });
    expect(apparition(initial).id).toBe('shadow');
    expect(apparition(cut).id).toBe('screen');
    let run = expedition(19, 'slow', 'adaptive', false);
    run = actNight(run, { kind: 'move', room: 'living' });
    run = actNight(run, { kind: 'plug' });
    run = actNight(run, { kind: 'move', room: 'door' });
    run = actNight(run, { kind: 'seal', symbols: puzzle(run).solution });
    expect(run.phase).toBe('escaped');
    expect(run.tv).toBe(true);
    expect(nightDiagnosis(run).title).not.toBe('闇を見届けた生還者');
    expect(nightDiagnosis(run).title).not.toBe('井戸の記憶をほどいた者');
  });
  it('rejects forged v2 histories and retains a shareable ending without exposing the solution', () => {
    const run = expedition(19);
    const raw = JSON.parse(encodeNight(run));
    for (const changes of [
      { version: 3 },
      { seed: 0 },
      { remembered: ['bath', 'study', 'well'] },
      { actions: [{ kind: 'move', room: 'well' }] },
    ])
      expect(() => decodeNight(JSON.stringify({ ...raw, ...changes }))).toThrow();
    expect(() => decodeNight('x'.repeat(12001))).toThrow();
    const share = nightShare(run, 'https://example.github.io/game/zero-echo.html?old=1');
    expect(share).toContain(nightDiagnosis(run).title);
    expect(share).toContain('/game/zero-echo.html?game=zero-echo');
    expect(share).not.toContain(puzzle(run).solution.join(''));
    expect(share).not.toContain('seed');
  });
});
