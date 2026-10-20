import type { SoundCue } from './audio';
import type { PlayRun } from './survival';
import { isSurvival, omen } from './survival';
import { currentStory } from './story';
import { cueForTurn } from './audio';
export type AudioEvent = { cue: SoundCue; warning?: SoundCue; voice?: string; timed: boolean };
export function audioEvent(previous: PlayRun | null, run: PlayRun): AudioEvent | null {
  const sameNight =
    previous &&
    previous.seed === run.seed &&
    previous.mode === run.mode &&
    previous.turn <= run.turn;
  const before = sameNight ? previous : null;
  if (isSurvival(run)) {
    const old = before && isSurvival(before) ? before : null;
    if (old && old.commands.length === run.commands.length) return null;
    const command = run.commands.at(-1);
    if (old && command && ['take', 'store', 'retrieve'].includes(command.kind))
      return { cue: 'pickup', timed: false };
    let cue: SoundCue = !old ? (run.turn === 0 ? 'ring' : 'creak') : 'breath';
    if (run.phase === 'escaped') cue = 'dawn';
    else if (run.phase === 'taken' || (old && run.encounters > old.encounters)) cue = 'impact';
    else if (old && command) {
      if (command.kind === 'craft') cue = 'paper';
      else if (command.kind === 'use')
        cue = command.item === 'flare' ? 'flare' : command.item === 'herb' ? 'cloth' : 'metal';
      else if (command.kind === 'move')
        cue =
          !old.wellUnlocked && run.wellUnlocked ? 'metal' : 'pace' in command ? 'breath' : 'creak';
      else if (command.kind === 'search')
        cue =
          run.room === 'living'
            ? 'static'
            : run.room === 'study'
              ? 'paper'
              : run.room === 'bath'
                ? 'glass'
                : 'drip';
      else if (command.kind === 'plug' || command.kind === 'unplug') cue = 'static';
      else if (run.fear - old.fear >= 3) cue = 'impact';
    }
    const beat = currentStory(run);
    const voice =
      (!old && run.turn === 0) || (old && beat.id !== currentStory(old).id) ? beat.line : undefined;
    const changed = !old || omen(old).id !== omen(run).id || old.room !== run.room;
    const warning =
      run.phase === 'play' && cue !== 'impact' && changed
        ? omen(run).id === 'steps'
          ? 'steps'
          : undefined
        : undefined;
    return { cue, warning, voice, timed: true };
  }
  return { cue: cueForTurn(before, run), timed: true };
}
