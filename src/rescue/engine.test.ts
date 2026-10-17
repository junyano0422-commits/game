import { describe, expect, it } from 'vitest';
import { rescueConfig as config } from './config';
import {
  cabin,
  countPeople,
  createRescue,
  dailyRescueSeed,
  decodeRescue,
  encodeRescue,
  moveElevator,
  previewRoute,
  rescueResult,
  rescueShare,
  savedPeople,
} from './engine';
import type { RescueRun, TravelMode } from './engine';

function routes(run: RescueRun) {
  return Array.from({ length: config.floors + 1 }, (_, floor) =>
    ['normal', 'eco'].map((travel) => ({
      floor,
      travel: travel as TravelMode,
      route: previewRoute(run, floor, travel as TravelMode),
    })),
  )
    .flat()
    .filter((r) => r.route.available);
}

function smartRescue(seed: number, mode: 'standard' | 'practice' = 'standard') {
  let run = createRescue(seed, mode);
  while (!run.finished) {
    const legal = routes(run);
    const carried = countPeople(cabin(run));
    const ranked = legal
      .map((item) => {
        const perks = item.route.boarding.reduce(
          (sum, p) =>
            sum +
            (p.perk === 'battery' ? 4 : p.perk === 'capacity' ? 2 : p.perk === 'patience' ? 2 : 0),
          0,
        );
        const urgency = item.route.boarding.reduce(
          (sum, p) => sum + (p.deadline - run.turn <= 4 ? p.count : 0),
          0,
        );
        const value =
          item.floor === 0
            ? carried >= run.capacity - 1
              ? 20
              : carried >= 3
                ? 7
                : 2
            : (item.route.count * 3 + perks + urgency) / (item.route.cost + item.route.ticks * 0.7);
        return { ...item, value };
      })
      .sort((a, b) => b.value - a.value);
    if (!ranked[0]) throw Error('Expected a legal move');
    run = moveElevator(run, ranked[0].floor, ranked[0].travel);
  }
  return run;
}

describe('rescue routes and consequences', () => {
  it('has deterministic layouts and rejects impossible moves without mutation', () => {
    const run = createRescue(19);
    const before = structuredClone(run);
    expect(run).toEqual(createRescue(19));
    expect(createRescue(20).people).not.toEqual(run.people);
    expect(() => moveElevator(run, 0, 'normal')).toThrow();
    expect(() => moveElevator(run, 99, 'normal')).toThrow();
    const next = moveElevator(run, 3, 'normal');
    expect(run).toEqual(before);
    expect(countPeople(cabin(next))).toBeGreaterThan(0);
    expect(next.battery).toBeLessThan(run.battery);
    expect(savedPeople(next)).toBe(0);
    expect(savedPeople(moveElevator(next, 0, 'normal'))).toBeGreaterThan(0);
  });

  it('delivering the electrician adds power and delivering the leader adds a seat', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let run = createRescue(seed);
      const pickup = moveElevator(run, 3, 'normal');
      expect(cabin(pickup).some((p) => p.id === 'tech')).toBe(true);
      const cost = previewRoute(pickup, 0, 'normal').cost;
      run = moveElevator(pickup, 0, 'normal');
      expect(run.battery).toBe(pickup.battery - cost + 8);
      const upper = moveElevator(run, 7, 'normal');
      const delivered = moveElevator(upper, 0, 'normal');
      expect(delivered.capacity).toBe(run.capacity + 1);
    }
  });

  it('eco travel trades time for power and includes arrival deadlines in the preview', () => {
    const run = createRescue(9);
    expect(previewRoute(run, 3, 'eco').cost).toBeLessThan(previewRoute(run, 3, 'normal').cost);
    expect(previewRoute(run, 3, 'eco').ticks).toBe(2);
    const nearDeadline = { ...run, people: run.people.map((p) => ({ ...p, deadline: 1 })) };
    expect(previewRoute(nearDeadline, 3, 'normal').available).toBe(true);
    expect(previewRoute(nearDeadline, 3, 'eco').available).toBe(false);
    const lastMinute = { ...run, turn: 17 };
    expect(previewRoute(lastMinute, 3, 'normal').available).toBe(false);
  });

  it('makes route planning matter and keeps every person and resource accounted for', () => {
    let smartTotal = 0;
    let directTotal = 0;
    let best = 0;
    for (let seed = 1; seed <= 100; seed++)
      for (const mode of ['standard', 'practice'] as const) {
        const smart = smartRescue(seed, mode);
        smartTotal += savedPeople(smart);
        best = Math.max(best, savedPeople(smart));
        let direct = createRescue(seed, mode);
        while (!direct.finished) {
          const legal = routes(direct).filter((r) => r.travel === 'normal');
          const choice = countPeople(cabin(direct))
            ? legal.find((r) => r.floor === 0)
            : legal.sort((a, b) => a.route.cost - b.route.cost)[0];
          const fallback = choice ?? routes(direct)[0]!;
          direct = moveElevator(direct, fallback.floor, fallback.travel);
        }
        directTotal += savedPeople(direct);
        expect(smart.turn).toBeLessThanOrEqual(config.modes[mode].turns);
        expect(smart.battery).toBeGreaterThanOrEqual(0);
        expect(cabin(smart)).toHaveLength(0);
        expect(countPeople(smart.people)).toBe(countPeople(createRescue(seed).people));
        expect(
          smart.people.every((p) => ['waiting', 'aboard', 'safe', 'stairs'].includes(p.status)),
        ).toBe(true);
        expect(routes(smart)).toHaveLength(0);
        expect(rescueResult(smart).score).toBeGreaterThan(0);
      }
    expect(smartTotal).toBeGreaterThan(directTotal);
    expect(best).toBeGreaterThanOrEqual(18);
  });

  it('never strands a cabin, including forecast power surcharges', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let run = createRescue(seed);
      let step = 0;
      while (!run.finished) {
        const legal = routes(run);
        const choice = legal[(seed + step++) % legal.length]!;
        run = moveElevator(run, choice.floor, choice.travel);
        if (cabin(run).length) expect(previewRoute(run, 0, 'normal').available).toBe(true);
      }
      expect(cabin(run)).toHaveLength(0);
    }
  });
});

describe('rescues can be saved, diagnosed and shared', () => {
  it('replays every move exactly and rejects broken, incompatible and forged histories', () => {
    let run = createRescue(71);
    while (!run.finished) {
      expect(decodeRescue(encodeRescue(run))).toEqual(run);
      const legal = routes(run);
      const choice = legal[0]!;
      run = moveElevator(run, choice.floor, choice.travel);
    }
    expect(decodeRescue(encodeRescue(run))).toEqual(run);
    expect(() => decodeRescue('{broken')).toThrow();
    const raw = JSON.parse(encodeRescue(run));
    for (const changes of [
      { version: 99 },
      { seed: 0 },
      { battery: 999 },
      { moves: [{ floor: 0, travel: 'normal' }] },
    ]) {
      expect(() => decodeRescue(JSON.stringify({ ...raw, ...changes }))).toThrow();
    }
  });
  it('shares no personal information and uses Japan time for the shared daily tower', () => {
    expect(dailyRescueSeed(new Date('2026-10-16T16:00:00Z'))).toBe(
      dailyRescueSeed(new Date('2026-10-17T10:00:00Z')),
    );
    const run = smartRescue(19);
    const text = rescueShare(run, 'https://example.com');
    expect(text).toContain('game=last-elevator');
    expect(text).toContain(rescueResult(run).title);
    expect(rescueShare(run, 'null')).not.toContain('http');
    expect(rescueShare(run, 'https://example.github.io/game/?old=1#results')).toContain(
      'https://example.github.io/game/?game=last-elevator',
    );
    expect(rescueShare(run, 'file:///downloads/last-elevator.html')).not.toContain('file:');
    expect(text).not.toContain('seed');
  });
});
