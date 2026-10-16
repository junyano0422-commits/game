import { metricKeys, strategyKeys } from './schema';
import type { Choice, Effects, GameDefinition, GameEvent, Mode, Stats, Strategy } from './schema';

export interface Decision {
  turn: number;
  eventId: string;
  choiceId: string;
  strategy: Strategy;
  eventTitle: string;
  choiceLabel: string;
}
export interface Report {
  title: string;
  outcome: string;
  before: Stats;
  after: Stats;
  repeated: boolean;
  market: number;
  delayed: string[];
}
export interface Run {
  gameId: string;
  definitionVersion: number;
  mode: Mode;
  seed: number;
  turn: number;
  phase: 'decision' | 'report' | 'finished';
  stats: Stats;
  history: Decision[];
  flags: string[];
  pending: { due: number; effects: Effects; message: string }[];
  report: Report | null;
  endReason: string | null;
}

// Stateless seeded randomness: reloading never rerolls the event or the market.
export function random(seed: number, turn: number, salt: number): number {
  let x = (seed ^ Math.imul(turn, 0x9e3779b1) ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

export function newRun(game: GameDefinition, mode: Mode, seed: number): Run {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Invalid seed');
  return {
    gameId: game.id,
    definitionVersion: game.version,
    mode,
    seed,
    turn: 1,
    phase: 'decision',
    stats: Object.fromEntries(metricKeys.map((key) => [key, game.metrics[key].initial])) as Stats,
    history: [],
    flags: [],
    pending: [],
    report: null,
    endReason: null,
  };
}

export function currentEvent(game: GameDefinition, run: Run): GameEvent {
  if (run.phase !== 'decision') throw new Error('Not a decision phase');
  const eligible = game.events.filter((event) => {
    const condition = event.when;
    return (
      event.minTurn <= run.turn &&
      event.requires.every((flag) => run.flags.includes(flag)) &&
      event.excludes.every((flag) => !run.flags.includes(flag)) &&
      run.history.filter((h) => h.eventId === event.id).length < event.maxOccurrences &&
      run.history.at(-1)?.eventId !== event.id &&
      (!condition ||
        (run.stats[condition.metric] >= (condition.min ?? -Infinity) &&
          run.stats[condition.metric] <= (condition.max ?? Infinity)))
    );
  });
  const priority = eligible.filter((event) => event.priority);
  const pool = priority.length ? priority : eligible;
  let pick = random(run.seed, run.turn, 53) * pool.reduce((sum, e) => sum + e.weight, 0);
  for (const event of pool) {
    pick -= event.weight;
    if (pick < 0) return event;
  }
  if (!pool[0]) throw new Error('No eligible event');
  return pool[0];
}

export function canAfford(run: Run, choice: Choice): boolean {
  return metricKeys.every(
    (key) => (choice.effects[key] ?? 0) >= 0 || run.stats[key] + (choice.effects[key] ?? 0) >= 0,
  );
}

function apply(game: GameDefinition, stats: Stats, effects: Effects, factor = 1): Stats {
  return Object.fromEntries(
    metricKeys.map((key) => {
      const effect = effects[key] ?? 0;
      const { min, max } = game.metrics[key];
      const value = stats[key] + effect * (effect > 0 ? factor : 1);
      return [key, Math.round(Math.max(min, Math.min(max, value)) * 100) / 100];
    }),
  ) as Stats;
}

export function previewChoice(game: GameDefinition, run: Run, choice: Choice) {
  const prior = run.history.slice(-(game.repetition.threshold - 1));
  const repeated =
    prior.length === game.repetition.threshold - 1 &&
    prior.every((h) => h.strategy === choice.strategy);
  const factor = repeated ? game.repetition.factor : 1;
  const effects = Object.fromEntries(
    Object.entries(choice.effects).map(([key, value]) => [
      key,
      Math.round(value * (value > 0 ? factor : 1) * 100) / 100,
    ]),
  ) as Effects;
  return { repeated, factor, effects };
}

export function decide(game: GameDefinition, run: Run, choiceId: string): Run {
  const event = currentEvent(game, run);
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice || !canAfford(run, choice)) throw new Error('Choice unavailable');
  const { repeated, factor } = previewChoice(game, run, choice);
  const due = run.pending.filter((p) => p.due <= run.turn);
  let stats = apply(game, run.stats, choice.effects, factor);
  stats = apply(game, stats, game.economy);
  for (const item of due) stats = apply(game, stats, item.effects);
  const market =
    game.market.shocks[Math.floor(random(run.seed, run.turn, 97) * game.market.shocks.length)]!;
  stats = apply(game, stats, { [game.market.metric]: market });
  if (repeated) stats = apply(game, stats, { satisfaction: -game.repetition.satisfactionCost });
  const pending = run.pending.filter((p) => p.due > run.turn);
  if (choice.delayed)
    pending.push({
      due: run.turn + choice.delayed.after,
      message: choice.delayed.message,
      effects: Object.fromEntries(
        Object.entries(choice.delayed.effects).map(([key, value]) => [
          key,
          value > 0 ? value * factor : value,
        ]),
      ),
    });
  const endReason =
    game.failure.find((rule) => stats[rule.metric] <= rule.atOrBelow)?.message ?? null;
  return {
    ...run,
    stats,
    phase: 'report',
    pending,
    endReason,
    flags: [...new Set([...run.flags, ...choice.flags])],
    history: [
      ...run.history,
      {
        turn: run.turn,
        eventId: event.id,
        choiceId,
        strategy: choice.strategy,
        eventTitle: event.title,
        choiceLabel: choice.label,
      },
    ],
    report: {
      title: event.title,
      outcome: choice.outcome,
      before: run.stats,
      after: stats,
      repeated,
      market,
      delayed: due.map((p) => p.message),
    },
  };
}

export function advance(game: GameDefinition, run: Run): Run {
  if (run.phase !== 'report') throw new Error('Report must be read first');
  if (run.endReason || run.turn >= game.modes[run.mode].turns) return { ...run, phase: 'finished' };
  return { ...run, turn: run.turn + 1, phase: 'decision', report: null };
}

export function diagnosis(game: GameDefinition, run: Run) {
  const counts = Object.fromEntries(
    strategyKeys.map((key) => [key, run.history.filter((h) => h.strategy === key).length]),
  ) as Record<Strategy, number>;
  const ordered = [...strategyKeys].sort((a, b) => counts[b] - counts[a]);
  const key = counts[ordered[0]!] - counts[ordered[2]!] <= 1 ? 'balanced' : ordered[0]!;
  return { ...game.diagnoses[key], key, counts };
}

export function score(game: GameDefinition, run: Run): number {
  // Relative improvement counts alongside social and infrastructure health.
  const growth = (run.stats.assets / game.metrics.assets.initial - 1) * 100;
  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        40 + growth * 0.3 + (run.stats.satisfaction - 50) * 0.5 + (run.stats.resilience - 50) * 0.3,
      ),
    ),
  );
}

export function shareText(game: GameDefinition, run: Run, origin: string): string {
  if (run.phase !== 'finished') throw new Error('Results are not ready');
  const url = new URL('/', origin);
  url.searchParams.set('game', game.id);
  return `${game.title}｜${game.modes[run.mode].label}\n${run.history.length}回の決断で「${diagnosis(game, run).title}」になりました。\n未来スコア ${score(game, run)}/100\n#SmallWorlds\n${url.toString()}`;
}
