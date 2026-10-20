import type { NightRun } from './revised';
export type SoundCue =
  | 'ring'
  | 'steps'
  | 'static'
  | 'drip'
  | 'creak'
  | 'reveal'
  | 'impact'
  | 'dawn'
  | 'paper'
  | 'glass'
  | 'metal'
  | 'cloth'
  | 'flare'
  | 'pickup'
  | 'breath';
export const soundCues: SoundCue[] = [
  'ring',
  'steps',
  'static',
  'drip',
  'creak',
  'reveal',
  'impact',
  'dawn',
  'paper',
  'glass',
  'metal',
  'cloth',
  'flare',
  'pickup',
  'breath',
];
export function localJapaneseVoice() {
  try {
    return window.speechSynthesis
      ?.getVoices()
      .find((v) => v.localService && /^ja(?:-|_)?/i.test(v.lang));
  } catch {
    return undefined;
  }
}
export type MediaSettings = { sound: boolean; voice: boolean; volume: number; impact: boolean };
export const mediaSettingsKey = 'small-worlds:zero-echo:media:v1';
export function readMediaSettings(): MediaSettings {
  const fallback = {
    sound: true,
    voice: true,
    volume: 55,
    impact: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(mediaSettingsKey) ?? 'null');
    if (!saved || typeof saved !== 'object') return fallback;
    return {
      sound: typeof saved.sound === 'boolean' ? saved.sound : fallback.sound,
      voice: typeof saved.voice === 'boolean' ? saved.voice : fallback.voice,
      volume:
        typeof saved.volume === 'number' && Number.isFinite(saved.volume)
          ? Math.min(100, Math.max(0, saved.volume))
          : fallback.volume,
      impact: typeof saved.impact === 'boolean' ? saved.impact : fallback.impact,
    };
  } catch {
    return fallback;
  }
}
function noise(context: BaseAudioContext, seconds: number) {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let state = 19037;
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = (state / 0xffffffff) * 2 - 1;
  }
  return buffer;
}
function envelope(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  volume: number,
) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.03, duration * 0.1));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(destination);
  return gain;
}
function tone(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  from: number,
  to: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const gain = envelope(context, destination, start, duration, volume);
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(start + duration);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
function breath(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  frequency: number,
  volume: number,
) {
  const gain = envelope(context, destination, start, duration, volume);
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 1.5;
  filter.connect(gain);
  const source = context.createBufferSource();
  source.buffer = noise(context, duration);
  source.connect(filter);
  source.start(start);
  source.stop(start + duration);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
/** Shared by the live game and offline output verification. No media downloads are needed. */
export function renderSoundCue(
  context: BaseAudioContext,
  destination: AudioNode,
  cue: SoundCue,
  at = context.currentTime,
) {
  if (cue === 'steps')
    for (let i = 0; i < 3; i++) {
      const pan = context.createStereoPanner();
      pan.pan.value = i % 2 === 0 ? -0.7 : 0.65;
      pan.connect(destination);
      tone(context, pan, at + i * 0.43, 0.19, 76, 39, 0.11);
      breath(context, pan, at + i * 0.43, 0.15, 220, 0.17);
      breath(context, pan, at + i * 0.43 + 0.025, 0.19, 1150, 0.055);
      // Disconnect after scheduled sources stop, including in OfflineAudioContext.
      const sentinel = context.createOscillator();
      const silence = context.createGain();
      silence.gain.value = 0;
      sentinel.connect(silence);
      silence.connect(pan);
      sentinel.start(at);
      sentinel.stop(at + 1.6);
      sentinel.onended = () => {
        sentinel.disconnect();
        silence.disconnect();
        pan.disconnect();
      };
    }
  else if (cue === 'ring')
    for (let i = 0; i < 2; i++) {
      tone(context, destination, at + i * 0.65, 0.42, 480, 475, 0.055);
      tone(context, destination, at + i * 0.65, 0.42, 620, 610, 0.035);
    }
  else if (cue === 'static') {
    breath(context, destination, at, 0.7, 2100, 0.14);
    tone(context, destination, at, 0.6, 1200, 210, 0.018);
  } else if (cue === 'drip') {
    for (const [i, level] of [1, 0.3, 0.1].entries()) {
      tone(context, destination, at + i * 0.26, 0.17, 1450, 520, 0.06 * level);
      breath(context, destination, at + i * 0.26, 0.08, 2200, 0.035 * level);
    }
  } else if (cue === 'creak') {
    tone(context, destination, at, 0.8, 140, 49, 0.035, 'triangle');
    breath(context, destination, at, 0.55, 460, 0.045);
  } else if (cue === 'reveal') {
    tone(context, destination, at, 0.9, 870, 530, 0.035);
    tone(context, destination, at + 0.1, 1, 1160, 760, 0.02);
  } else if (cue === 'impact') {
    tone(context, destination, at, 1.25, 91, 29, 0.22);
    breath(context, destination, at, 0.85, 960, 0.13);
    tone(context, destination, at + 0.12, 0.8, 263, 73, 0.035, 'triangle');
  } else if (cue === 'paper' || cue === 'cloth') {
    for (let i = 0; i < 3; i++)
      breath(
        context,
        destination,
        at + i * 0.12,
        0.18,
        cue === 'paper' ? 1550 : 720,
        0.085 - i * 0.015,
      );
  } else if (cue === 'metal' || cue === 'glass') {
    breath(context, destination, at, 0.08, 3300, 0.06);
    for (const [i, f] of (cue === 'metal' ? [780, 1270, 2090] : [1540, 2310, 3470]).entries())
      tone(context, destination, at + i * 0.025, 0.5 / (i + 1), f, f * 0.985, 0.045 / (i + 1));
  } else if (cue === 'flare') {
    breath(context, destination, at, 0.13, 2700, 0.2);
    breath(context, destination, at + 0.08, 0.8, 900, 0.12);
    tone(context, destination, at, 0.32, 112, 44, 0.1);
  } else if (cue === 'pickup') {
    breath(context, destination, at, 0.07, 1600, 0.08);
    tone(context, destination, at, 0.06, 350, 210, 0.035);
  } else if (cue === 'breath') {
    breath(context, destination, at, 0.45, 650, 0.055);
    breath(context, destination, at + 0.35, 0.55, 420, 0.045);
  } else
    for (const [i, frequency] of [261.63, 329.63, 392].entries())
      tone(context, destination, at + i * 0.13, 1.5, frequency, frequency, 0.035);
}
export function cueForTurn(previous: NightRun | null, next: NightRun): SoundCue {
  if (next.phase === 'taken') return 'impact';
  if (next.phase === 'escaped') return 'dawn';
  if (!previous && next.turn === 0) return 'ring';
  if (previous && next.fear - previous.fear >= 3) return 'impact';
  const action = next.actions.at(-1);
  if (action?.kind === 'move') return 'creak';
  if (action?.kind === 'search') return 'reveal';
  if (action?.kind === 'unplug' || action?.kind === 'plug') return 'static';
  return 'drip';
}
export class HorrorAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private heart: GainNode | null = null;
  private air: BiquadFilterNode | null = null;
  private volume = 0.55;
  private spoken = false;
  private voiceGeneration = 0;
  private sceneLevel = 0;
  private cueBuses = new Set<GainNode>();
  onStateChange: ((running: boolean) => void) | null = null;
  async enable(): Promise<boolean> {
    try {
      if (!this.context || this.context.state === 'closed') this.create();
      const context = this.context!;
      if (context.state !== 'running') await context.resume();
      if (document.hidden) {
        await context.suspend();
        return false;
      }
      this.setVolume(this.volume * 100);
      return context.state === 'running';
    } catch {
      return false;
    }
  }
  private create() {
    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) throw Error('Audio is unavailable');
    const context = new Constructor();
    this.context = context;
    context.onstatechange = () => this.onStateChange?.(context.state === 'running');
    const master = context.createGain();
    master.gain.value = this.volume * 0.7;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(context.destination);
    this.master = master;
    const ambient = context.createGain();
    ambient.gain.value = 0;
    ambient.connect(master);
    this.ambient = ambient;
    for (const frequency of [43, 44.2]) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(ambient);
      oscillator.start();
    }
    const source = context.createBufferSource();
    source.buffer = noise(context, 3);
    source.loop = true;
    const air = context.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 400;
    this.air = air;
    const wind = context.createGain();
    wind.gain.value = 0.025;
    source.connect(air);
    air.connect(wind);
    wind.connect(ambient);
    source.start();
    const pulse = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = pulse.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      const a = t % 1.3;
      const beat = Math.exp(-a * 30) + (a > 0.18 ? Math.exp(-(a - 0.18) * 35) * 0.65 : 0);
      samples[i] = Math.sin(t * 2 * Math.PI * 57) * beat * 0.3;
    }
    const heartbeat = context.createBufferSource();
    heartbeat.buffer = pulse;
    heartbeat.loop = true;
    const heart = context.createGain();
    heart.gain.value = 0;
    heartbeat.connect(heart);
    heart.connect(ambient);
    heartbeat.start();
    this.heart = heart;
  }
  setVolume(percent: number) {
    const nextVolume = Math.max(0, Math.min(1, percent / 100));
    if (nextVolume !== this.volume) this.stopVoice();
    this.volume = nextVolume;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(this.volume * 0.7, this.context.currentTime, 0.04);
  }
  scene(room: string, tension: number) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    this.sceneLevel = room === 'living' ? 0.35 : 0.6;
    this.ambient?.gain.setTargetAtTime(this.spoken ? 0.12 : this.sceneLevel, c.currentTime, 0.5);
    this.air?.frequency.setTargetAtTime(
      room === 'living' ? 1300 : room === 'well' ? 230 : 650,
      c.currentTime,
      0.35,
    );
    this.heart?.gain.setTargetAtTime(Math.max(0, tension - 0.35) * 0.55, c.currentTime, 0.35);
  }
  quiet() {
    this.sceneLevel = 0;
    if (this.context) this.ambient?.gain.setTargetAtTime(0, this.context.currentTime, 0.18);
  }
  play(cue: SoundCue, delay = 0) {
    if (this.context?.state !== 'running' || !this.master) return;
    const bus = this.context.createGain();
    bus.connect(this.master);
    this.cueBuses.add(bus);
    renderSoundCue(this.context, bus, cue, this.context.currentTime + delay);
    setTimeout(
      () => {
        bus.disconnect();
        this.cueBuses.delete(bus);
      },
      (delay + 3) * 1000,
    );
  }
  stopEffects() {
    for (const bus of this.cueBuses) bus.disconnect();
    this.cueBuses.clear();
  }
  whisper(text: string, enabled: boolean) {
    if (
      !enabled ||
      this.context?.state !== 'running' ||
      document.hidden ||
      !('speechSynthesis' in window)
    )
      return;
    // Only local Japanese voices: no remote speech provider and no actor imitation.
    try {
      const voice = localJapaneseVoice();
      if (!voice) return;
      const generation = ++this.voiceGeneration;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = 'ja-JP';
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      utterance.volume = this.volume * 0.65;
      const restore = () => {
        if (generation !== this.voiceGeneration) return;
        this.spoken = false;
        if (this.context)
          this.ambient?.gain.setTargetAtTime(this.sceneLevel, this.context.currentTime, 0.25);
      };
      utterance.onend = restore;
      utterance.onerror = restore;
      window.speechSynthesis.speak(utterance);
      this.spoken = true;
      this.ambient?.gain.setTargetAtTime(0.12, this.context.currentTime, 0.12);
    } catch {
      /* Voice availability does not block the game or its sound effects. */
    }
  }
  stopVoice() {
    this.voiceGeneration++;
    try {
      if (this.spoken && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      /* The browser may revoke the speech service. */
    }
    this.spoken = false;
    if (this.context)
      this.ambient?.gain.setTargetAtTime(this.sceneLevel, this.context.currentTime, 0.2);
  }

  async pause() {
    this.stopVoice();
    this.stopEffects();
    if (this.context && this.context.state === 'running')
      await this.context.suspend().catch(() => {});
  }
  dispose() {
    this.stopVoice();
    this.stopEffects();
    const c = this.context;
    if (c) c.onstatechange = null;
    this.context = null;
    this.master = null;
    this.ambient = null;
    this.air = null;
    this.heart = null;
    if (c && c.state !== 'closed') void c.close().catch(() => {});
  }
}
