import { describe, expect, it } from 'vitest';
import {
  advance,
  canAfford,
  currentEvent,
  decide,
  diagnosis,
  newRun,
  score,
  shareText,
} from './engine';
import type { Run } from './engine';
import { metricKeys, parseDefinition } from './schema';
import type { GameDefinition, Strategy } from './schema';
import { decodeSave, encodeSave, readSave, saveKey, writeSave } from './storage';
import { defaultGame, games } from '../games';
import towerJson from '../games/tower.json' with { type: 'json' };

function pick(game: GameDefinition, run: Run, strategy: Strategy) {
  const choices = currentEvent(game, run).choices;
  return (
    choices.find((c) => c.strategy === strategy && canAfford(run, c)) ??
    choices.find((c) => canAfford(run, c))!
  );
}
function play(
  game: GameDefinition,
  seed: number,
  strategy: Strategy | 'mixed',
  mode: 'quick' | 'full' = 'quick',
) {
  let run = newRun(game, mode, seed);
  while (run.phase !== 'finished') {
    const desired =
      strategy === 'mixed'
        ? (['people', 'finance', 'future'] as const)[(run.turn - 1) % 3]!
        : strategy;
    run = advance(game, decide(game, run, pick(game, run, desired).id));
  }
  return run;
}

describe('configuration and pure game engine', () => {
  it('validates every registered game and rejects duplicate ids and unreachable flags', () => {
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    const duplicate = structuredClone(towerJson);
    duplicate.events[1]!.id = duplicate.events[0]!.id;
    expect(() => parseDefinition(duplicate)).toThrow('Duplicate event');
    const badFlag = structuredClone(towerJson);
    badFlag.events[0]!.requires = ['missing-flag'];
    expect(() => parseDefinition(badFlag)).toThrow('Unknown flag');
    const badBounds = structuredClone(towerJson);
    badBounds.metrics.funds.max = 0;
    expect(() => parseDefinition(badBounds)).toThrow();
  });

  it('is deterministic, immutable, and rejects invalid actions and phases', () => {
    const run = newRun(defaultGame, 'quick', 19);
    const before = structuredClone(run);
    const choice = pick(defaultGame, run, 'people');
    const after = decide(defaultGame, run, choice.id);
    expect(after).toEqual(decide(defaultGame, run, choice.id));
    expect(run).toEqual(before);
    expect(() => decide(defaultGame, run, 'not-a-choice')).toThrow();
    expect(() => decide(defaultGame, after, choice.id)).toThrow();
    expect(() => advance(defaultGame, run)).toThrow();
    expect(() => newRun(defaultGame, 'quick', 0)).toThrow();
    expect(() => shareText(defaultGame, run, 'https://example.com')).toThrow();
  });

  it('always offers a legal zero-cost choice and rejects unaffordable investments', () => {
    const run = newRun(defaultGame, 'quick', 19);
    run.stats.funds = 1;
    const choices = currentEvent(defaultGame, run).choices;
    expect(choices.some((c) => canAfford(run, c))).toBe(true);
    const costly = choices.find((c) => (c.effects.funds ?? 0) < -1)!;
    expect(() => decide(defaultGame, run, costly.id)).toThrow('unavailable');
  });

  it('past investment unlocks a future event and pays its delayed return exactly once', () => {
    let seed = 1;
    while (currentEvent(defaultGame, newRun(defaultGame, 'quick', seed)).id !== 'energy') seed++;
    let invested = advance(
      defaultGame,
      decide(defaultGame, newRun(defaultGame, 'quick', seed), 'solar'),
    );
    let baseline = advance(
      defaultGame,
      decide(defaultGame, newRun(defaultGame, 'quick', seed), 'contract'),
    );
    expect(invested.pending).toHaveLength(1);
    for (let turn = 2; turn <= 3; turn++) {
      const report = decide(defaultGame, invested, pick(defaultGame, invested, 'finance').id);
      expect(report.report!.delayed.length).toBe(turn === 3 ? 1 : 0);
      invested = advance(defaultGame, report);
      baseline = advance(
        defaultGame,
        decide(defaultGame, baseline, pick(defaultGame, baseline, 'finance').id),
      );
    }
    expect(invested.pending).toHaveLength(0);
    expect(currentEvent(defaultGame, invested).id).toBe('eco-return');
    expect(currentEvent(defaultGame, baseline).id).not.toBe('eco-return');
    expect(decide(defaultGame, invested, 'reinvest').report!.delayed).toHaveLength(0);
  });

  it('reduces repeated positive effects without reducing costs, and leaves the market independent', () => {
    let run = newRun(defaultGame, 'quick', 91);
    for (let turn = 1; turn <= 2; turn++)
      run = advance(defaultGame, decide(defaultGame, run, pick(defaultGame, run, 'finance').id));
    const choice = pick(defaultGame, run, 'finance');
    const repeated = decide(defaultGame, run, choice.id);
    const varied = decide(
      defaultGame,
      { ...run, history: run.history.map((h) => ({ ...h, strategy: 'people' })) },
      choice.id,
    );
    expect(repeated.report!.repeated).toBe(true);
    expect(varied.report!.repeated).toBe(false);
    expect(repeated.stats.funds).toBeLessThan(varied.stats.funds);
    expect(repeated.stats.satisfaction).toBe(
      varied.stats.satisfaction - defaultGame.repetition.satisfactionCost,
    );
    expect(repeated.report!.market).toBe(varied.report!.market);
    const investment = pick(defaultGame, run, 'future');
    const futureHistory = {
      ...run,
      history: run.history.map((h) => ({ ...h, strategy: 'future' as const })),
    };
    const repeatedInvestment = decide(defaultGame, futureHistory, investment.id);
    const normalInvestment = decide(defaultGame, run, investment.id);
    expect(repeatedInvestment.stats.funds).toBe(normalInvestment.stats.funds);
    expect(repeatedInvestment.stats.resilience).toBeLessThan(normalInvestment.stats.resilience);
  });

  it('diagnosis depends on actual decisions, rather than wealth or market luck', () => {
    const social = play(defaultGame, 19, 'people');
    const financial = play(defaultGame, 19, 'finance');
    expect(diagnosis(defaultGame, social).key).toBe('people');
    expect(diagnosis(defaultGame, financial).key).toBe('finance');
    const lucky = { ...social, stats: { ...social.stats, assets: 299, funds: 499 } };
    expect(diagnosis(defaultGame, lucky)).toEqual(diagnosis(defaultGame, social));
    const text = shareText(defaultGame, social, 'https://example.com');
    expect(text).toContain(diagnosis(defaultGame, social).title);
    expect(text).toContain('?game=tower-lab');
    expect(text).not.toContain('seed');
  });

  it('ends early with a readable reason when an essential resource collapses', () => {
    const run = newRun(defaultGame, 'full', 19);
    run.stats.satisfaction = 10;
    const choice = pick(defaultGame, run, 'finance');
    const report = decide(defaultGame, run, choice.id);
    expect(report.endReason).toBeTruthy();
    const ended = advance(defaultGame, report);
    expect(ended.phase).toBe('finished');
    expect(() => advance(defaultGame, ended)).toThrow();
  });

  it('runs both modes across games and seeds with finite bounded resources and meaningful strategy differences', () => {
    const totals: Record<string, number> = { mixed: 0, people: 0, finance: 0, future: 0 };
    for (const game of games)
      for (let seed = 1; seed <= 50; seed++)
        for (const mode of ['quick', 'full'] as const) {
          for (const strategy of ['mixed', 'people', 'finance', 'future'] as const) {
            const run = play(game, seed, strategy, mode);
            expect(run.history.length).toBeGreaterThan(0);
            expect(run.history.length).toBeLessThanOrEqual(game.modes[mode].turns);
            if (strategy === 'mixed') expect(run.history).toHaveLength(game.modes[mode].turns);
            for (const key of metricKeys) {
              expect(Number.isFinite(run.stats[key])).toBe(true);
              expect(run.stats[key]).toBeGreaterThanOrEqual(game.metrics[key].min);
              expect(run.stats[key]).toBeLessThanOrEqual(game.metrics[key].max);
            }
            expect(score(game, run)).toBeGreaterThanOrEqual(0);
            expect(score(game, run)).toBeLessThanOrEqual(100);
            totals[strategy]! += score(game, run);
          }
        }
    expect(totals.mixed).toBeGreaterThan(totals.finance!);
    expect(totals.mixed).toBeGreaterThan(totals.people!);
    expect(totals.mixed).toBeGreaterThan(totals.future!);
  });
});

describe('versioned saves and deterministic replay', () => {
  it('round-trips decisions, reports and results without losing pending returns', () => {
    for (const game of games) {
      let run = newRun(game, 'quick', 17);
      while (run.phase !== 'finished') {
        expect(decodeSave(game, encodeSave(run))).toEqual(run);
        const report = decide(game, run, pick(game, run, 'future').id);
        expect(decodeSave(game, encodeSave(report))).toEqual(report);
        run = advance(game, report);
      }
      expect(decodeSave(game, encodeSave(run))).toEqual(run);
    }
  });

  it('rejects corrupt, tampered, incompatible, oversized and cross-game saves', () => {
    const run = play(defaultGame, 19, 'mixed');
    const raw = encodeSave(run);
    expect(() => decodeSave(defaultGame, '{oops')).toThrow();
    expect(() => decodeSave(defaultGame, 'x'.repeat(50_001))).toThrow();
    expect(() => decodeSave(games[1]!, raw)).toThrow();
    for (const changes of [
      { version: 99 },
      { definitionVersion: 99 },
      { seed: 0 },
      { phase: 'decision' },
      { stats: { funds: 999 } },
      { history: [{ eventId: 'missing', choiceId: 'missing' }] },
    ]) {
      expect(() =>
        decodeSave(defaultGame, JSON.stringify({ ...JSON.parse(raw), ...changes })),
      ).toThrow();
    }
  });

  it('isolates game saves and does not delete corrupt data or crash on storage failure', () => {
    expect(saveKey(games[0]!.id)).not.toBe(saveKey(games[1]!.id));
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(readSave(defaultGame, storage).kind).toBe('empty');
    const run = newRun(defaultGame, 'quick', 19);
    expect(writeSave(run, storage)).toBe(true);
    expect(readSave(defaultGame, storage)).toEqual({ kind: 'ready', run });
    storage.setItem(saveKey(defaultGame.id), '{broken');
    expect(readSave(defaultGame, storage).kind).toBe('error');
    expect(storage.getItem(saveKey(defaultGame.id))).toBe('{broken');
    expect(
      writeSave(run, {
        setItem() {
          throw new Error('quota');
        },
      }),
    ).toBe(false);
    expect(
      readSave(defaultGame, {
        getItem() {
          throw new Error('blocked');
        },
      }).kind,
    ).toBe('error');
  });
});
