import { describe, expect, it } from 'vitest';
import {
  actSurvival,
  adjacent,
  createSurvival,
  decodeSurvival,
  encodeSurvival,
  isSurvival,
  nightLimits,
  puzzle,
  survivalDiagnosis,
  survivalShare,
  travelReason,
} from './survival';
import type { SurvivalCommand, SurvivalRun } from './survival';
import { actHaunt, createHaunt, encodeHaunt } from './engine';
import { actNight, createNight, encodeNight } from './revised';
import { playSurvival } from '../../tests/support/survival-policy';

const act = (run: SurvivalRun, command: SurvivalCommand) =>
  actSurvival(run, command) as SurvivalRun;
const searched = () => act(createSurvival(19), { kind: 'search', light: true });
const study = () =>
  act(act(searched(), { kind: 'move', room: 'study' }), { kind: 'search', light: true });

describe('survival exploration', () => {
  it('continues both legacy formats with their original rules and exact next action', () => {
    const classic = actHaunt(createHaunt(19), { kind: 'search', light: true });
    const revised = actNight(createNight(19), { kind: 'search', light: true });
    for (const [run, saved] of [
      [classic, encodeHaunt(classic)],
      [revised, encodeNight(revised)],
    ] as const) {
      expect(decodeSurvival(saved)).toEqual(run);
      expect(isSurvival(decodeSurvival(saved))).toBe(false);
      expect(actSurvival(run, { kind: 'unplug' })).toEqual(actNight(run, { kind: 'unplug' }));
      expect(encodeSurvival(run)).toBe(saved);
    }
  });
  it('limits inventory to four slots, stores without advancing time, and never duplicates supplies', () => {
    let run = searched();
    const snapshot = structuredClone(run);
    run = act(run, { kind: 'take', item: 'battery' });
    expect(snapshot.supplies.living).toContain('battery');
    expect(run.turn).toBe(snapshot.turn);
    expect(run.health).toBe(snapshot.health);
    expect(() => act(run, { kind: 'take', item: 'battery' })).toThrow('そこには');
    run = act(run, { kind: 'store', item: 'battery' });
    expect(run.box).toEqual(['battery']);
    run = act(run, { kind: 'retrieve', item: 'battery' });
    expect(run.box).toEqual([]);
    run = act(run, { kind: 'take', item: 'herb' });
    run = act(run, { kind: 'move', room: 'study' });
    run = act(run, { kind: 'search', light: false });
    run = act(run, { kind: 'take', item: 'key' });
    expect(run.bag).toHaveLength(4);
    expect(() => act(run, { kind: 'take', item: 'powder' })).toThrow('4枠');
    expect(() => act(run, { kind: 'store', item: 'cloth' })).toThrow('居間');
  });
  it('requires carrying the key, consumes it once, and opens a persistent shortcut', () => {
    let run = study();
    expect(run.health).toBe(3); // Awakening gives a warning, never an immediate attack.
    expect(travelReason(run, 'well')).toContain('持ち物');
    expect(() => act(run, { kind: 'move', room: 'well' })).toThrow('持ち物');
    expect(adjacent(run, 'bath')).not.toContain('well');
    run = act(run, { kind: 'take', item: 'key' });
    run = act(run, { kind: 'move', room: 'well' });
    expect(run.wellUnlocked).toBe(true);
    expect(run.bag).not.toContain('key');
    run = act(run, { kind: 'search', light: false });
    expect(adjacent(run, 'bath')).toContain('well');
    expect(travelReason(run, 'bath')).toBe('');
    expect(travelReason(run, 'door')).toContain('隣');
    expect(() => act(run, { kind: 'move', room: 'door' })).toThrow('隣');
    expect(decodeSurvival(encodeSurvival(run))).toEqual(run);
  });
  it('crafts two ingredients into one slot and a flare protects the next two actions', () => {
    let run = act(study(), { kind: 'take', item: 'powder' });
    const before = run.turn;
    run = act(run, { kind: 'craft' });
    expect(run.bag).toEqual(['flare']);
    expect(run.turn).toBe(before + 1);
    run = act(run, { kind: 'use', item: 'flare' });
    expect(run.stun).toBe(2);
    const health = run.health;
    for (let i = 0; i < 2; i++) run = act(run, { kind: 'search', light: false });
    expect(run.health).toBe(health);
    expect(run.stun).toBe(0);
    expect(() => act(run, { kind: 'craft' })).toThrow('布切れ');
  });
  it('caps recovery, rejects unnecessary consumption, and leaves failed actions immutable', () => {
    let run = act(searched(), { kind: 'take', item: 'herb' });
    const before = structuredClone(run);
    expect(() => act(run, { kind: 'use', item: 'herb' })).toThrow('十分');
    expect(run).toEqual(before);
    run.health = 2;
    run = act(run, { kind: 'use', item: 'herb' });
    expect(run.health).toBe(3);
    expect(run.bag).not.toContain('herb');
    run = act(run, { kind: 'take', item: 'battery' });
    run.battery = 5;
    run = act(run, { kind: 'use', item: 'battery' });
    expect(run.battery).toBe(6);
    expect(() => act(run, { kind: 'use', item: 'cloth' })).toThrow('使う場所');
  });
  it('charges quiet movement two turns and one battery, and prevents a pursuing attack', () => {
    const run = study();
    run.hunter = 'study';
    const next = act(run, { kind: 'move', room: 'living', pace: 'quiet' });
    expect(next.turn).toBe(run.turn + 2);
    expect(next.battery).toBe(run.battery - 1);
    expect(next.health).toBe(run.health);
    expect(next.hunter).toBe(run.hunter);
    run.battery = 0;
    const snapshot = structuredClone(run);
    expect(() => act(run, { kind: 'move', room: 'living', pace: 'quiet' })).toThrow('電池1');
    expect(run).toEqual(snapshot);
  });
  it('keeps the living room safe, grants one action after contact, and ends at zero health', () => {
    let run = study();
    run.hunter = 'study';
    run = act(run, { kind: 'search', light: false });
    expect(run.health).toBe(2);
    expect(run.cooldown).toBe(1);
    run = act(run, { kind: 'search', light: false });
    expect(run.health).toBe(2);
    run.health = 1;
    run = act(run, { kind: 'search', light: false });
    expect(run.phase).toBe('taken');
    expect(run.reason).toContain('白い手');
    let safe = study();
    safe = act(safe, { kind: 'move', room: 'living' });
    for (let i = 0; i < 2; i++) safe = act(safe, { kind: 'search', light: false });
    expect(safe.health).toBe(3);
    expect(safe.hunter).not.toBe('living');
  });
  it('uses v3 limits beyond the old time and fear caps', () => {
    let run = createSurvival(19, 'slow');
    run.turn = 25;
    run.fear = 17;
    run = act(run, { kind: 'move', room: 'bath' });
    expect(run.phase).toBe('play');
    expect(run.message).not.toContain('もう、扉は見えない');
    run.turn = nightLimits(run).turns - 1;
    run = act(run, { kind: 'search', light: false });
    expect(run.phase).toBe('taken');
    expect(run.reason).toContain('猶予');
  });
  it('replays item actions and complete endings, rejects forged saves, and shares no puzzle answer', () => {
    const completed = playSurvival(19);
    expect(decodeSurvival(encodeSurvival(completed))).toEqual(completed);
    expect(survivalDiagnosis(completed).title).toContain('館の記憶');
    const share = survivalShare(completed, 'https://example.com/');
    expect(share).toContain(survivalDiagnosis(completed).title);
    expect(share).toContain(`残体力 ${completed.health}/3 / 接触 ${completed.encounters}回`);
    expect(share).not.toContain(puzzle(completed).solution.join(''));
    const saved = JSON.parse(encodeSurvival(createSurvival(19)));
    expect(() => decodeSurvival(JSON.stringify({ ...saved, health: 99 }))).toThrow();
    expect(() =>
      decodeSurvival(JSON.stringify({ ...saved, commands: [{ kind: 'take', item: 'flare' }] })),
    ).toThrow();
    expect(() =>
      decodeSurvival(JSON.stringify({ ...saved, commands: Array(241).fill({ kind: 'wait' }) })),
    ).toThrow();
  });
  it('rewards preparation across 1000 seeds; caution trades time and batteries for health', () => {
    let rushWins = 0,
      preparedWins = 0;
    let preparedHealth = 0,
      cautiousHealth = 0,
      preparedTurns = 0,
      cautiousTurns = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const rush = playSurvival(seed, 'rush');
      const prepared = playSurvival(seed, 'prepared');
      const cautious = playSurvival(seed, 'cautious');
      rushWins += rush.phase === 'escaped' ? 1 : 0;
      preparedWins += prepared.phase === 'escaped' ? 1 : 0;
      expect(cautious.phase).toBe('escaped');
      preparedHealth += prepared.health;
      cautiousHealth += cautious.health;
      preparedTurns += prepared.turn;
      cautiousTurns += cautious.turn;
    }
    expect(preparedWins).toBe(1000);
    expect(preparedWins - rushWins).toBeGreaterThan(150);
    expect(cautiousHealth).toBeGreaterThan(preparedHealth);
    expect(cautiousTurns).toBeGreaterThan(preparedTurns);
  });
  it('supports both modes and the powered-off route without changing save replay', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const mode of ['quick', 'slow'] as const) {
        for (const tv of ['on', 'off'] as const) {
          const run = playSurvival(seed, 'prepared', mode, tv);
          expect(run.phase).toBe('escaped');
          expect(decodeSurvival(encodeSurvival(run))).toEqual(run);
        }
      }
    }
  });
});
