import { z } from 'zod';
import { advance, currentEvent, decide, newRun } from './engine';
import type { Run } from './engine';
import type { GameDefinition } from './schema';

export const saveKey = (gameId: string) => `small-worlds:v1:${gameId}`;
const saveSchema = z
  .object({
    version: z.literal(1),
    definitionVersion: z.number().int(),
    gameId: z.string(),
    mode: z.enum(['quick', 'full']),
    seed: z.number().int().min(1).max(0xffffffff),
    phase: z.enum(['decision', 'report', 'finished']),
    history: z.array(z.object({ eventId: z.string(), choiceId: z.string() }).strict()).max(60),
  })
  .strict();
export type SaveResult =
  | { kind: 'empty' }
  | { kind: 'ready'; run: Run }
  | { kind: 'error'; message: string };

// Store only inputs. Replay through the engine validates funds, phases and history.
export function encodeSave(run: Run): string {
  return JSON.stringify({
    version: 1,
    definitionVersion: run.definitionVersion,
    gameId: run.gameId,
    mode: run.mode,
    seed: run.seed,
    phase: run.phase,
    history: run.history.map(({ eventId, choiceId }) => ({ eventId, choiceId })),
  });
}

export function decodeSave(game: GameDefinition, text: string): Run {
  if (text.length > 50_000) throw new Error('Save too large');
  const save = saveSchema.parse(JSON.parse(text));
  if (save.gameId !== game.id || save.definitionVersion !== game.version)
    throw new Error('Incompatible game version');
  if (save.history.length > game.modes[save.mode].turns) throw new Error('Invalid run length');
  let run = newRun(game, save.mode, save.seed);
  for (let i = 0; i < save.history.length; i++) {
    const record = save.history[i]!;
    if (currentEvent(game, run).id !== record.eventId) throw new Error('Invalid event history');
    run = decide(game, run, record.choiceId);
    if (i < save.history.length - 1 || save.phase !== 'report') run = advance(game, run);
  }
  if (run.phase !== save.phase) throw new Error('Invalid save phase');
  return run;
}

export function readSave(game: GameDefinition, storage: Pick<Storage, 'getItem'>): SaveResult {
  try {
    const raw = storage.getItem(saveKey(game.id));
    return raw === null ? { kind: 'empty' } : { kind: 'ready', run: decodeSave(game, raw) };
  } catch {
    return {
      kind: 'error',
      message:
        '保存データを読み込めませんでした。元のデータは保持しています。新しく始めると上書きされます。',
    };
  }
}

export function writeSave(run: Run, storage: Pick<Storage, 'setItem'>): boolean {
  try {
    storage.setItem(saveKey(run.gameId), encodeSave(run));
    return true;
  } catch {
    return false;
  }
}
