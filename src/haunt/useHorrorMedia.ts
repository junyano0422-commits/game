import { useEffect, useRef, useState } from 'react';
import { HorrorAudio, localJapaneseVoice, mediaSettingsKey, readMediaSettings } from './audio';
import { audioEvent } from './soundtrack';
import type { MediaSettings } from './audio';
import type { NightRun } from './revised';
import { nightLimits, isSurvival, hunterClose } from './survival';
export function useHorrorMedia(run: NightRun | null, playing: boolean) {
  const [settings, setSettings] = useState(readMediaSettings);
  const [audio] = useState(() => new HorrorAudio());
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  useEffect(() => {
    const refresh = () => setVoiceAvailable(!!localJapaneseVoice());
    refresh();
    const speech = window.speechSynthesis;
    speech?.addEventListener?.('voiceschanged', refresh);
    return () => speech?.removeEventListener?.('voiceschanged', refresh);
  }, []);
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
    if (run.phase === 'play')
      audio.scene(
        run.room,
        Math.max(run.fear / nightLimits(run).fear, hunterClose(run) ? 0.85 : 0),
      );
    else audio.quiet();
    const key = `${run.seed}-${run.mode}-${run.turn}-${run.phase}-${isSurvival(run) ? run.commands.length : run.actions.length}`;
    if (heardKey.current === key) return;
    const event = audioEvent(previous.current, run);
    if (event) {
      if (event.timed) {
        audio.stopEffects();
        audio.stopVoice();
      }
      audio.play(event.cue);
      if (event.warning) audio.play(event.warning, 0.8);
      if (event.voice) audio.whisper(event.voice, settings.voice && voiceAvailable);
    }
    heardKey.current = key;
    previous.current = run;
  }, [audio, playing, run, ready, paused, settings.sound, settings.voice, voiceAvailable]);
  async function read(text: string) {
    if (!settings.sound || !voiceAvailable) return;
    await activate();
    audio.stopEffects();
    audio.whisper(text, true);
  }
  return { settings, update, activate, toggle, ready, paused, failed, voiceAvailable, read };
}
