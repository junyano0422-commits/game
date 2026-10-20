import { useEffect, useRef, useState } from 'react';
import { HorrorAudio, cueForTurn, mediaSettingsKey, readMediaSettings } from './audio';
import type { MediaSettings } from './audio';
import type { NightRun } from './revised';
import { isRevised, omen } from './revised';
import { hauntConfig } from './config';
export function useHorrorMedia(run: NightRun | null, playing: boolean) {
  const [settings, setSettings] = useState(readMediaSettings);
  const [audio] = useState(() => new HorrorAudio());
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const epoch = useRef(0);
  const heardKey = useRef('');
  const previous = useRef<NightRun | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(mediaSettingsKey, JSON.stringify(settings));
    } catch {
      /* Media preferences never overwrite game saves. */
    }
    audio.setVolume(settings.volume);
    if (!settings.voice) audio.stopVoice();
  }, [settings, audio]);
  useEffect(() => {
    audio.onStateChange = (running) => {
      setReady(running);
      if (!running && playing && settings.sound) setPaused(true);
    };
    return () => {
      audio.onStateChange = null;
    };
  }, [audio, playing, settings.sound]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        epoch.current++;
        setPaused(true);
        setReady(false);
        void audio.pause();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [audio]);
  useEffect(() => {
    if (!playing) {
      epoch.current++;
      setReady(false);
      void audio.pause();
    }
  }, [audio, playing]);
  useEffect(() => () => audio.dispose(), [audio]);
  async function activate(next = settings) {
    if (!next.sound) return;
    const request = ++epoch.current;
    setPaused(false);
    audio.setVolume(next.volume);
    const ok = await audio.enable();
    if (request !== epoch.current || document.hidden) {
      void audio.pause();
      return;
    }
    setReady(ok);
    setFailed(!ok);
    if (ok && !playing) audio.play('drip');
  }
  function update(next: MediaSettings) {
    setSettings(next);
    if (!next.sound) {
      epoch.current++;
      setReady(false);
      void audio.pause();
    } else if (!settings.sound) void activate(next);
  }
  function toggle() {
    if (ready && settings.sound) update({ ...settings, sound: false });
    else {
      const next = { ...settings, sound: true };
      setSettings(next);
      void activate(next);
    }
  }
  useEffect(() => {
    if (!playing || !run || !ready || !settings.sound || paused) return;
    if (run.phase === 'play') audio.scene(run.room, run.fear / hauntConfig.modes[run.mode].fear);
    else audio.quiet();
    const key = `${run.seed}-${run.mode}-${run.turn}-${run.phase}`;
    if (heardKey.current === key) return;
    const before = previous.current;
    const cue = !before && run.turn > 0 && run.phase === 'play' ? 'drip' : cueForTurn(before, run);
    audio.play(cue);
    if (run.phase === 'play' && cue !== 'impact')
      audio.play(
        omen(run).id === 'steps' ? 'steps' : omen(run).id === 'eyes' ? 'static' : 'drip',
        0.45,
      );
    if (run.phase === 'taken') audio.whisper('みつけた', settings.voice);
    else if (run.phase === 'escaped') audio.whisper('もう、わすれないで', settings.voice);
    else if (
      isRevised(run) &&
      run.remembered.length > (before && isRevised(before) ? before.remembered.length : 0)
    )
      audio.whisper('わすれないで', settings.voice);
    else if (
      before &&
      before.fear < hauntConfig.modes[run.mode].fear * 0.7 &&
      run.fear >= hauntConfig.modes[run.mode].fear * 0.7
    )
      audio.whisper('すぐ、うしろにいる', settings.voice);
    heardKey.current = key;
    previous.current = run;
  }, [audio, playing, run, ready, paused, settings.sound, settings.voice]);
  return { settings, update, activate, toggle, ready, paused, failed };
}
