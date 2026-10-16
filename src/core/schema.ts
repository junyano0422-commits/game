import { z } from 'zod';

export const metricKeys = ['funds', 'assets', 'population', 'satisfaction', 'resilience'] as const;
export const strategyKeys = ['people', 'finance', 'future'] as const;
export const metricKeySchema = z.enum(metricKeys);
export const strategySchema = z.enum(strategyKeys);
export type MetricKey = (typeof metricKeys)[number];
export type Strategy = (typeof strategyKeys)[number];
export type Stats = Record<MetricKey, number>;
export const effectsSchema = z
  .object({
    funds: z.number().finite().optional(),
    assets: z.number().finite().optional(),
    population: z.number().finite().optional(),
    satisfaction: z.number().finite().optional(),
    resilience: z.number().finite().optional(),
  })
  .strict();
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const metricSchema = z
  .object({
    label: z.string().min(1),
    unit: z.string(),
    initial: z.number().finite(),
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .refine(
    (m) => m.min < m.max && m.initial >= m.min && m.initial <= m.max,
    'Invalid metric bounds',
  );
export const definitionSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string(),
  description: z.string(),
  setting: z.string(),
  theme: z.enum(['tower', 'island']),
  metrics: z.object({
    funds: metricSchema,
    assets: metricSchema,
    population: metricSchema,
    satisfaction: metricSchema,
    resilience: metricSchema,
  }),
  modes: z.object({
    quick: z.object({
      label: z.string(),
      turns: z.number().int().min(3).max(60),
      duration: z.string(),
    }),
    full: z.object({
      label: z.string(),
      turns: z.number().int().min(3).max(60),
      duration: z.string(),
    }),
  }),
  economy: effectsSchema,
  market: z.object({ metric: metricKeySchema, shocks: z.array(z.number().finite()).min(1) }),
  repetition: z.object({
    threshold: z.number().int().min(2),
    factor: z.number().min(0).max(1),
    satisfactionCost: z.number().min(0),
  }),
  failure: z
    .object({ metric: metricKeySchema, atOrBelow: z.number().finite(), message: z.string() })
    .array(),
  events: z
    .array(
      z.object({
        id,
        title: z.string(),
        body: z.string(),
        category: z.string(),
        weight: z.number().positive().default(1),
        minTurn: z.number().int().positive().default(1),
        requires: z.array(id).default([]),
        excludes: z.array(id).default([]),
        priority: z.boolean().default(false),
        maxOccurrences: z.number().int().positive().default(99),
        when: z
          .object({
            metric: metricKeySchema,
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .optional(),
        choices: z
          .array(
            z.object({
              id,
              label: z.string(),
              description: z.string(),
              strategy: strategySchema,
              effects: effectsSchema,
              flags: z.array(id).default([]),
              outcome: z.string(),
              delayed: z
                .object({
                  after: z.number().int().min(1).max(10),
                  effects: effectsSchema,
                  message: z.string(),
                })
                .optional(),
            }),
          )
          .min(2),
      }),
    )
    .min(2),
  diagnoses: z.object({
    balanced: z.object({ title: z.string(), body: z.string() }),
    people: z.object({ title: z.string(), body: z.string() }),
    finance: z.object({ title: z.string(), body: z.string() }),
    future: z.object({ title: z.string(), body: z.string() }),
  }),
});
export type GameDefinition = z.infer<typeof definitionSchema>;
export type GameEvent = GameDefinition['events'][number];
export type Choice = GameEvent['choices'][number];
export type Effects = z.infer<typeof effectsSchema>;
export type Mode = keyof GameDefinition['modes'];

export function parseDefinition(input: unknown): GameDefinition {
  const game = definitionSchema.parse(input);
  if (game.metrics.assets.initial <= 0) throw new Error('Initial assets must be positive');
  if (game.modes.full.turns < game.modes.quick.turns)
    throw new Error('Full mode must not be shorter');
  if (new Set(game.events.map((e) => e.id)).size !== game.events.length)
    throw new Error('Duplicate event id');
  const flags = new Set(game.events.flatMap((e) => e.choices.flatMap((c) => c.flags)));
  for (const event of game.events) {
    if (new Set(event.choices.map((c) => c.id)).size !== event.choices.length)
      throw new Error(`Duplicate choice in ${event.id}`);
    if (![...event.requires, ...event.excludes].every((flag) => flags.has(flag)))
      throw new Error(`Unknown flag in ${event.id}`);
    if (!event.choices.some((c) => metricKeys.every((key) => (c.effects[key] ?? 0) >= 0)))
      throw new Error(`No affordable fallback in ${event.id}`);
  }
  // Two unrestricted fallback events guarantee that cooldown never blocks play.
  const fallbacks = game.events.filter(
    (e) =>
      !e.requires.length &&
      !e.excludes.length &&
      !e.when &&
      e.minTurn === 1 &&
      e.maxOccurrences >= 60,
  );
  if (fallbacks.length < 2) throw new Error('Two unrestricted fallback events are required');
  return game;
}
