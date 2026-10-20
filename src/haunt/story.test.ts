import { describe, expect, it } from 'vitest';
import {
  actSurvival,
  createSurvival,
  decodeSurvival,
  encodeSurvival,
  isSurvival,
} from './survival';
import type { SurvivalRun, SurvivalCommand } from './survival';
import { currentStory, objective, storyIds } from './story';
import { audioEvent } from './soundtrack';
import { playSurvival } from '../../tests/support/survival-policy';
const act = (run: SurvivalRun, command: SurvivalCommand) =>
  actSurvival(run, command) as SurvivalRun;
function study() {
  let run = act(createSurvival(19), { kind: 'search', light: true });
  run = act(run, { kind: 'move', room: 'study' });
  return act(run, { kind: 'search', light: true });
}
describe('clear story and contextual audio', () => {
  it('explains the first task, then leads to the actual next room without revealing a solution', () => {
    const run = createSurvival(19);
    expect(objective(run)).toMatchObject({ target: 'living', progress: 0 });
    expect(currentStory(run).meaning).toContain('居間の映像');
    const watched = act(run, { kind: 'search', light: true });
    expect(objective(watched)).toMatchObject({ target: 'study', next: 'study', progress: 1 });
    expect(currentStory(watched).id).toBe('video');
    expect(run.turn).toBe(0);
  });
  it('distinguishes discovering, carrying and storing the key when giving directions', () => {
    let run = study();
    expect(objective(run).text).toContain('鍵」を拾う');
    run = act(run, { kind: 'take', item: 'key' });
    expect(objective(run)).toMatchObject({ target: 'well', next: 'well' });
    run = act(run, { kind: 'move', room: 'living' });
    run = act(run, { kind: 'store', item: 'key' });
    expect(objective(run)).toMatchObject({ target: 'living' });
    expect(objective(run).text).toContain('保管箱');
  });
  it('keeps revelations in discovery order with no repeated chapter for item organization or reload', () => {
    let run = act(createSurvival(19), { kind: 'move', room: 'bath' });
    run = act(run, { kind: 'search', light: true });
    run = act(run, { kind: 'take', item: 'herb' });
    expect(storyIds(run)).toEqual(['arrival', 'bath']);
    const saved = decodeSurvival(encodeSurvival(run));
    expect(currentStory(saved)).toEqual(currentStory(run));
    expect(objective(run)).toMatchObject({ target: 'living', next: 'living' });
  });
  it('resolves the story differently when memories were collected or left behind', () => {
    const lit = playSurvival(19);
    const dark = playSurvival(19, 'prepared', 'quick', 'off');
    expect(currentStory(lit).id).toBe('remembered');
    expect(currentStory(dark).id).toBe('escaped');
    expect(storyIds(lit)).toEqual(['arrival', 'video', 'study', 'well', 'bath', 'remembered']);
    expect(new Set(storyIds(lit)).size).toBe(storyIds(lit).length);
  });
  it('never repeats footsteps or narration just because a supply was picked up', () => {
    const watched = act(createSurvival(19), { kind: 'search', light: true });
    const picked = act(watched, { kind: 'take', item: 'battery' });
    expect(audioEvent(watched, picked)).toEqual({ cue: 'pickup', timed: false });
    expect(audioEvent(picked, picked)).toBeNull();
    expect(currentStory(picked)).toEqual(currentStory(watched));
  });
  it('gives each room an action sound and speaks a revelation once', () => {
    const run = createSurvival(19);
    const watched = act(run, { kind: 'search', light: true });
    expect(audioEvent(run, watched)).toMatchObject({
      cue: 'static',
      voice: currentStory(watched).line,
    });
    const moved = act(watched, { kind: 'move', room: 'study' });
    expect(audioEvent(watched, moved)?.voice).toBeUndefined();
    const read = act(moved, { kind: 'search', light: true });
    expect(audioEvent(moved, read)).toMatchObject({ cue: 'paper', voice: currentStory(read).line });
  });
  it('uses the actual item command rather than the last search when choosing its sound', () => {
    const completed = playSurvival(19);
    let run = createSurvival(19);
    let flare = false,
      heal = false;
    for (const command of completed.commands) {
      const next = act(run, command);
      if (command.kind === 'use' && command.item === 'flare') {
        expect(audioEvent(run, next)?.cue).toBe('flare');
        flare = true;
      }
      if (command.kind === 'use' && command.item === 'battery') {
        expect(audioEvent(run, next)?.cue).toBe('metal');
        heal = true;
      }
      if (command.kind === 'seal') expect(audioEvent(run, next)?.cue).toBe('dawn');
      run = next;
    }
    expect(flare && heal).toBe(true);
  });
  it('plays a new introduction when restarting the same seed instead of reusing the ending', () => {
    const completed = playSurvival(19);
    const restarted = createSurvival(19);
    expect(isSurvival(completed)).toBe(true);
    expect(audioEvent(completed, restarted)).toMatchObject({
      cue: 'ring',
      voice: currentStory(restarted).line,
    });
  });
});
