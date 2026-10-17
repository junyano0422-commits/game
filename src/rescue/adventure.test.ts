import { describe, expect, it } from 'vitest';
import {
  answerConsultation,
  adventureResult,
  createAdventure,
  decodePlaySave,
  encodePlaySave,
  playMove,
  playPreview,
} from './adventure';
import type { AdventureRun } from './adventure';
import { cabin, createRescue, encodeRescue, moveElevator } from './engine';

function firstReturn(seed = 19) {
  return playMove(playMove(createAdventure(seed), 3, 'normal'), 0, 'normal') as AdventureRun;
}

describe('rescue consultations', () => {
  it('requires an answer, branches resources and adds a time-limited call', () => {
    const run = firstReturn();
    expect(run.pending).toBe('rooftop');
    expect(playPreview(run, 7, 'normal').available).toBe(false);
    expect(() => playMove(run, 7, 'normal')).toThrow();
    const accepted = answerConsultation(run, 'accept');
    expect(accepted.people.find((p) => p.id === 'photo-team')).toMatchObject({
      count: 2,
      deadline: run.turn + 6,
    });
    const supplied = answerConsultation(run, 'supply');
    expect(supplied.battery).toBe(run.battery + 8);
    expect(supplied.turn).toBe(run.turn + 1);
    expect(supplied.people.some((p) => p.id === 'photo-team')).toBe(false);
    expect(run.answered).toEqual([]);
  });
  it('past rescue changes the later consultation and choices change future deadlines', () => {
    let run = answerConsultation(firstReturn(), 'accept');
    run = playMove(playMove(run, 7, 'normal'), 0, 'normal') as AdventureRun;
    expect(run.pending).toBe('lights');
    const diverted = answerConsultation(run, 'divert');
    const comforted = answerConsultation(run, 'comfort');
    expect(diverted.battery).toBe(run.battery + 10);
    expect(comforted.battery).toBe(run.battery - 4);
    const waiting = run.people.find((p) => p.status === 'waiting')!;
    expect(diverted.people.find((p) => p.id === waiting.id)!.deadline).toBe(waiting.deadline - 2);
    expect(comforted.people.find((p) => p.id === waiting.id)!.deadline).toBe(waiting.deadline + 3);
    expect(() => answerConsultation(diverted, 'continue')).toThrow();
  });
  it('awards the chosen goal and rooftop rescue once, based on delivered residents', () => {
    let run = answerConsultation(firstReturn(), 'accept');
    const photo = run.people.find((p) => p.id === 'photo-team')!;
    run = playMove(playMove(run, photo.floor, 'normal'), 0, 'normal') as AdventureRun;
    expect(adventureResult(run).rooftop).toBe(true);
    const result = adventureResult(run);
    expect(result.score).toBe(run.score + run.battery * 3 + 220);
    expect(adventureResult(decodePlaySave(encodePlaySave(run)))).toEqual(result);
    let goal = createAdventure(19, 'practice');
    for (const floor of [3, 7, 9]) {
      goal = playMove(playMove(goal, floor, 'normal'), 0, 'normal') as AdventureRun;
      if (goal.pending)
        goal = answerConsultation(goal, goal.pending === 'rooftop' ? 'supply' : 'continue');
    }
    expect(adventureResult(goal).goal?.complete).toBe(true);
    expect(adventureResult(goal).score).toBe(goal.score + goal.battery * 3 + 350);
  });
  it('preserves classic saves exactly and rejects fabricated decision histories', () => {
    const classic = moveElevator(createRescue(19), 3, 'normal');
    expect(decodePlaySave(encodeRescue(classic))).toEqual(classic);
    const run = answerConsultation(firstReturn(), 'supply');
    expect(decodePlaySave(encodePlaySave(run))).toEqual(run);
    const raw = JSON.parse(encodePlaySave(run));
    raw.actions[2].event = 'lights';
    expect(() => decodePlaySave(JSON.stringify(raw))).toThrow();
  });
  it('replays complete adventures and never strands riders for either branch', () => {
    for (let seed = 1; seed <= 60; seed++)
      for (const mode of ['standard', 'practice'] as const) {
        let run = createAdventure(seed, mode, seed % 2 ? 'highrise' : 'full-house');
        let steps = 0;
        while (!run.finished) {
          expect(++steps).toBeLessThan(30);
          if (run.pending)
            run = answerConsultation(
              run,
              run.pending === 'rooftop'
                ? seed % 2
                  ? 'accept'
                  : 'supply'
                : ['continue', 'divert', 'comfort'][seed % 3]!,
            );
          else {
            const legal = Array.from({ length: 11 }, (_, floor) =>
              ['normal', 'eco'].map((travel) => ({ floor, travel: travel as 'normal' | 'eco' })),
            )
              .flat()
              .filter((r) => playPreview(run, r.floor, r.travel).available);
            expect(legal.length).toBeGreaterThan(0);
            const choice = cabin(run).length
              ? legal.find((r) => r.floor === 0)!
              : legal[(seed + steps) % legal.length]!;
            run = playMove(run, choice.floor, choice.travel) as AdventureRun;
          }
          expect(decodePlaySave(encodePlaySave(run))).toEqual(run);
          expect(run.battery).toBeGreaterThanOrEqual(0);
        }
        expect(cabin(run)).toHaveLength(0);
        const result = adventureResult(run);
        expect(result.score).toBeGreaterThan(0);
        expect(adventureResult(run)).toEqual(result);
      }
  });
});
