import { describe, expect, it } from 'vitest';
import { stallConfig as config } from './config';
import {
  actStall,
  createStall,
  decodeStall,
  encodeStall,
  evening,
  quality,
  stallDiagnosis,
  stallShare,
} from './engine';
import type { StallRun } from './engine';

function meal(
  run: StallRun,
  flavor = run.orders[0]!.flavor,
  heatTicks = Math.ceil(42 / evening(run).heat),
) {
  const order = run.orders[0]!;
  let next = actStall(run, { kind: 'start', pan: 0 });
  next = actStall(next, { kind: 'tick', count: heatTicks });
  next = actStall(next, { kind: 'flip', pan: 0 });
  next = actStall(next, { kind: 'tick', count: heatTicks });
  next = actStall(next, { kind: 'plate', pan: 0 });
  next = actStall(next, { kind: 'flavor', pan: 0, flavor });
  return actStall(next, { kind: 'serve', pan: 0, order: order.id });
}
function finishNight(run: StallRun) {
  let next = run;
  let limit = 0;
  while (next.phase === 'night') {
    if (++limit > 300) throw Error('Night did not finish');
    next = next.orders.length ? meal(next) : actStall(next, { kind: 'tick', count: 1 });
  }
  return next;
}

describe('night stall cooking and customers', () => {
  it('has repeatable orders, immutable actions and rejects invalid kitchen operations', () => {
    const run = createStall(19);
    const copy = structuredClone(run);
    expect(createStall(19)).toEqual(run);
    expect(createStall(20).orders).not.toEqual(run.orders);
    expect(() => actStall(run, { kind: 'flip', pan: 0 })).toThrow();
    expect(() => actStall(run, { kind: 'start', pan: 2 })).toThrow();
    const next = actStall(run, { kind: 'start', pan: 0 });
    expect(next.stock).toBe(run.stock - 1);
    expect(run).toEqual(copy);
    expect(() => actStall(next, { kind: 'start', pan: 0 })).toThrow();
    expect(() => actStall(next, { kind: 'plate', pan: 0 })).toThrow();
  });
  it('rewards both golden sides, matching flavors and combos', () => {
    const run = createStall(19);
    const perfect = meal(run);
    expect(perfect.perfect).toBe(1);
    expect(perfect.cash).toBe(47);
    const two = meal(perfect);
    expect(two.cash).toBe(96);
    expect(two.bestCombo).toBe(2);
    const wrong = meal(run, run.orders[0]!.flavor === 'soy' ? 'butter' : 'soy');
    expect(wrong.wrong).toBe(1);
    expect(wrong.cash).toBe(0);
    expect(wrong.missed).toBe(1);
    const raw = meal(run, run.orders[0]!.flavor, 5);
    expect(raw.cash).toBe(0);
    const burnt = meal(run, run.orders[0]!.flavor, 31);
    expect(burnt.cash).toBe(0);
    expect(burnt.burned).toBe(1);
  });
  it('stops cooking on a plate while the other burner keeps heating', () => {
    let run = actStall(createStall(19), { kind: 'start', pan: 0 });
    run = actStall(run, { kind: 'tick', count: 14 });
    run = actStall(run, { kind: 'flip', pan: 0 });
    run = actStall(run, { kind: 'tick', count: 14 });
    run = actStall(run, { kind: 'plate', pan: 0 });
    run = actStall(run, { kind: 'start', pan: 1 });
    run = actStall(run, { kind: 'tick', count: 35 });
    expect(quality(run.pans[0]!)).toBe('perfect');
    expect(quality(run.pans[1]!)).toBe('burnt');
  });
  it('lets waiting guests leave, closes the shop and cannot run after results', () => {
    const run = actStall(createStall(19, 'quick'), { kind: 'tick', count: 210 });
    expect(run.phase).toBe('result');
    expect(run.missed).toBe(4);
    expect(run.orders).toHaveLength(0);
    expect(run.pans.every((p) => p.stage === 'empty')).toBe(true);
    expect(() => actStall(run, { kind: 'start', pan: 0 })).toThrow();
    expect(stallDiagnosis(run).stars).toBe(1);
  });
  it('pays for lasting equipment and brings back a favorite flavor from the previous night', () => {
    const night = finishNight(createStall(19));
    expect(night.phase).toBe('upgrade');
    expect(night.perfect).toBe(6);
    const run = actStall(night, { kind: 'upgrade', id: 'grill' });
    expect(run.cash).toBe(night.cash - 90);
    expect(run.pans).toHaveLength(3);
    const favorite = [...config.flavors].sort(
      (a, b) => night.flavors[b.id] - night.flavors[a.id],
    )[0]!.id;
    expect(run.orders[0]).toMatchObject({ regular: true, flavor: favorite });
    const calm = actStall(night, { kind: 'upgrade', id: 'lantern' });
    expect(calm.orders[0]!.patience).toBe(run.orders[0]!.patience + 25);
    expect(() => actStall(createStall(19), { kind: 'upgrade', id: 'grill' })).toThrow();
    const poor = actStall(createStall(19), { kind: 'tick', count: 300 });
    expect(() => actStall(poor, { kind: 'upgrade', id: 'grill' })).toThrow();
  });
  it('completes different evenings without losing orders or resources', () => {
    for (let seed = 1; seed <= 30; seed++)
      for (const mode of ['quick', 'story'] as const) {
        let run = createStall(seed, mode);
        while (run.phase !== 'result') {
          run = finishNight(run);
          expect(decodeStall(encodeStall(run))).toEqual(run);
          if (run.phase === 'upgrade')
            run = actStall(run, {
              kind: 'upgrade',
              id: config.upgrades[(seed + run.night) % 3]!.id,
            });
        }
        expect(run.served).toBe(config.modes[mode].guests * config.modes[mode].nights);
        expect(run.missed).toBe(0);
        expect(run.cash).toBeGreaterThan(0);
        expect(stallDiagnosis(run).stars).toBe(5);
      }
  });
});
describe('night stall saving and sharing', () => {
  it('reconstructs a cooking pan exactly without allowing fabricated money or invalid histories', () => {
    let run = actStall(createStall(19), { kind: 'start', pan: 0 });
    run = actStall(run, { kind: 'tick', count: 9 });
    expect(decodeStall(encodeStall(run))).toEqual(run);
    const raw = JSON.parse(encodeStall(run));
    for (const changes of [
      { cash: 9999 },
      { version: 9 },
      { seed: 0 },
      { actions: [{ kind: 'serve', pan: 0, order: 100 }] },
      { actions: [{ kind: 'tick', count: 10000 }] },
    ])
      expect(() => decodeStall(JSON.stringify({ ...raw, ...changes }))).toThrow();
    expect(() => decodeStall('{oops')).toThrow();
  });
  it('shares a diagnosis and project-relative URL without save histories or personal data', () => {
    const run = finishNight(createStall(19, 'quick'));
    const shared = stallShare(run, 'https://example.github.io/game/?previous=1#result');
    expect(shared).toContain(stallDiagnosis(run).title);
    expect(shared).toContain('https://example.github.io/game/?game=night-stall');
    expect(shared).not.toContain('seed');
    expect(shared).not.toContain('actions');
    expect(stallShare(run, 'file:///downloads/night-stall.html')).not.toContain('file:');
  });
});
