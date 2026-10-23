/**
 * Chronicles of Ember and Dawn — offline audio director.
 *
 * Responsibilities:
 *  - Orchestral background music per screen, cross-faded with two HTMLAudioElements.
 *  - Web Audio synthesis for battle/UI effects (no downloaded SFX, no chiptune BGM).
 *  - A separate, slowly gusting wind ambience bed.
 *  - Independent music / effects / ambience volume, mute, concurrency limits and cooldowns.
 *
 * Integration contract:
 *   const audio = new AudioManager();
 *   button.addEventListener('click', () => { void audio.unlock(); }, { once: true });
 *   audio.setScene('menu');
 *   // every animation frame:
 *   audio.update(dtSeconds);
 *   // on teardown:
 *   audio.dispose();
 *
 * No external network access is performed by this module. All music is served
 * from same-origin `public/audio` files through Vite's `import.meta.env.BASE_URL`;
 * effects are synthesized locally with Web Audio.
 */

export type AudioScene =
  | 'menu'
  | 'campaign'
  | 'prepare'
  | 'battle'
  | 'climax'
  | 'victory'
  | 'defeat';

export type SoundName =
  | 'select'
  | 'click'
  | 'coin'
  | 'countdown'
  | 'spawn'
  | 'sword'
  | 'shield'
  | 'pike'
  | 'axe'
  | 'bow'
  | 'crossbow'
  | 'magic'
  | 'fire'
  | 'heal'
  | 'horn'
  | 'base'
  | 'collapse'
  | 'victory'
  | 'defeat'
  | 'step'
  | 'warning';

export const SOUND_NAMES: readonly SoundName[] = [
  'select',
  'click',
  'coin',
  'countdown',
  'spawn',
  'sword',
  'shield',
  'pike',
  'axe',
  'bow',
  'crossbow',
  'magic',
  'fire',
  'heal',
  'horn',
  'base',
  'collapse',
  'victory',
  'defeat',
  'step',
  'warning',
];

type TrackId = 'eye' | 'war' | 'hope' | 'final' | 'march';

interface TrackDef {
  file: string;
  /** Static loudness trim to ~-19 LUFS before scene/user levels; original files stay untouched. */
  gain: number;
  title: string;
  author: string;
  source: string;
}

export interface MusicCredit {
  id: TrackId;
  title: string;
  author: string;
  license: 'CC0 1.0';
  source: string;
  file: string;
}

const TRACKS: Record<TrackId, TrackDef> = {
  eye: {
    file: 'eye_of_the_storm.mp3',
    gain: 1.424,
    title: 'Eye of the Storm',
    author: 'Indieteur',
    source: 'https://opengameart.org/content/eye-of-the-storm-0',
  },
  war: {
    file: 'war_theme.ogg',
    gain: 0.448,
    title: 'War Theme',
    author: 'Spring Spring',
    source: 'https://opengameart.org/content/war-theme',
  },
  hope: {
    file: 'hope_orchestral_battle_music.ogg',
    gain: 0.351,
    title: 'Hope (Orchestral Battle Music)',
    author: 'MintoDog',
    source: 'https://opengameart.org/content/hopeorchestral-battle-music',
  },
  final: {
    file: 'the_final_battle.ogg',
    gain: 0.549,
    title: 'The Final Battle',
    author: 'skrjablin',
    source: 'https://opengameart.org/content/the-final-battle',
  },
  march: {
    file: 'epic_march_loop.wav',
    gain: 0.375,
    title: 'Epic March Loop',
    author: 'Eldritch Grim',
    source: 'https://opengameart.org/content/epic-war-loop',
  },
};

const TRACK_IDS: readonly TrackId[] = ['eye', 'war', 'hope', 'final', 'march'];

/** Credits surfaced for an in-game licences panel. All entries are CC0 1.0. */
export const MUSIC_CREDITS: readonly MusicCredit[] = TRACK_IDS.map((id) => ({
  id,
  title: TRACKS[id].title,
  author: TRACKS[id].author,
  license: 'CC0 1.0',
  source: TRACKS[id].source,
  file: TRACKS[id].file,
}));

interface SceneDef {
  track: TrackId;
  /** Scene gain applied below the user's music volume (keeps the mix conservative). */
  music: number;
  /** Cross-fade duration in seconds. */
  fadeIn: number;
  /** Runtime re-use treatment; no audio file is edited. */
  playbackRate: number;
  /** Wind bed level (0..1 relative, before the user's ambience volume). */
  wind: number;
  /** Low distant battle rumble level (0..1 relative). */
  rumble: number;
}

/**
 * Seven narrative states backed by five CC0 orchestral recordings.
 * Victory is a reprise of "Hope"; defeat is a slowed reprise of "Eye of the Storm".
 * These are runtime treatments (rate/gain), never edited or re-encoded files.
 */
const SCENES: Record<AudioScene, SceneDef> = {
  menu: { track: 'eye', music: 0.72, fadeIn: 2.6, playbackRate: 1, wind: 0.15, rumble: 0.02 },
  campaign: { track: 'war', music: 0.68, fadeIn: 2.4, playbackRate: 1, wind: 0.12, rumble: 0.03 },
  prepare: { track: 'hope', music: 0.66, fadeIn: 2, playbackRate: 1, wind: 0.19, rumble: 0.04 },
  battle: { track: 'final', music: 0.78, fadeIn: 1.8, playbackRate: 1, wind: 0.13, rumble: 0.2 },
  climax: { track: 'march', music: 0.84, fadeIn: 1.4, playbackRate: 1, wind: 0.1, rumble: 0.3 },
  // Reuse: "Hope" returns as a brighter, resolved reprise rather than a sixth download.
  victory: { track: 'hope', music: 0.7, fadeIn: 1.6, playbackRate: 1, wind: 0.1, rumble: 0 },
  // Reuse: slowed "Eye of the Storm" reads as a sombre aftermath.
  defeat: { track: 'eye', music: 0.58, fadeIn: 2.8, playbackRate: 0.92, wind: 0.22, rumble: 0.02 },
};

const BASE = import.meta.env.BASE_URL || '/';
const MUSIC_BASE = `${BASE.endsWith('/') ? BASE : `${BASE}/`}audio/`;

const DEFAULT_VOLUMES = { music: 0.7, effects: 0.8, ambience: 0.5 };
const MAX_ACTIVE_SFX = 20;
const SFX_PANORAMA_LIMIT = 1;

export interface AudioManagerOptions {
  initialScene?: AudioScene;
  musicVolume?: number;
  effectsVolume?: number;
  ambienceVolume?: number;
  muted?: boolean;
  /** Preload all five tracks on construction (default true). */
  preload?: boolean;
  /** Log caught audio failures to the console (default false). */
  debug?: boolean;
}

/* ------------------------------------------------------------------ */
/* Web Audio synthesis helpers                                         */
/* ------------------------------------------------------------------ */

interface RenderContext {
  ctx: AudioContext;
  buffer: AudioBuffer;
  destination: AudioNode;
  /** Seconds, already offset slightly into the future. */
  start: number;
  /** Per-shot random pitch scale (frequency multiplier). */
  pitch: number;
  register(node: AudioScheduledSourceNode): void;
}

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  peak?: number;
  attack?: number;
  delay?: number;
  lowpass?: number;
  q?: number;
  detune?: number;
}

interface NoiseOptions {
  dur: number;
  peak?: number;
  attack?: number;
  delay?: number;
  type?: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      // Slightly pink noise is less fatiguing than raw white noise.
      smooth = smooth * 0.82 + white * 0.18;
      data[i] = clamp(smooth * 2.4, -1, 1);
    }
  }
  return buffer;
}

function tone(r: RenderContext, options: ToneOptions): void {
  try {
    const { ctx } = r;
    const t = r.start + (options.delay ?? 0);
    const from = Math.max(8, options.from * r.pitch);
    const to = Math.max(8, (options.to ?? options.from) * r.pitch);
    const peak = Math.max(0.0002, options.peak ?? 0.2);
    const dur = Math.max(0.02, options.dur);
    const attack = Math.min(Math.max(0.002, options.attack ?? 0.005), dur * 0.5);

    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(from, t);
    if (options.to !== undefined && Math.abs(to - from) > 0.01) {
      osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    }
    if (options.detune) osc.detune.setValueAtTime(options.detune, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let tail: AudioNode = gain;
    if (options.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.max(40, options.lowpass), t);
      filter.Q.value = options.q ?? 0.7;
      gain.connect(filter);
      tail = filter;
    }

    osc.connect(gain);
    tail.connect(r.destination);
    osc.start(t);
    osc.stop(t + dur + 0.04);
    r.register(osc);
  } catch {
    /* A failed voice must never break the caller's simulation/render loop. */
  }
}

function noise(r: RenderContext, options: NoiseOptions): void {
  try {
    const { ctx } = r;
    const t = r.start + (options.delay ?? 0);
    const dur = Math.max(0.02, options.dur);
    const peak = Math.max(0.0002, options.peak ?? 0.12);
    const attack = Math.min(Math.max(0.001, options.attack ?? 0.004), dur * 0.5);

    const source = ctx.createBufferSource();
    source.buffer = r.buffer;
    const maxOffset = Math.max(0, r.buffer.duration - dur - 0.05);
    const offset = Math.random() * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = options.type ?? 'bandpass';
    filter.frequency.setValueAtTime(Math.max(40, options.from), t);
    if (options.to !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), t + dur);
    }
    filter.Q.value = options.q ?? 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(r.destination);
    source.start(t, offset, dur + 0.03);
    source.stop(t + dur + 0.04);
    r.register(source);
  } catch {
    /* ignore a single failed layer */
  }
}

function metal(r: RenderContext, freqs: readonly number[], peak: number, dur: number, delay = 0): void {
  freqs.forEach((freq, index) => {
    tone(r, {
      type: 'sine',
      from: freq,
      dur: Math.max(0.07, dur * (1 - index * 0.16)),
      peak: peak / (1 + index * 0.9),
      attack: 0.003,
      delay,
    });
  });
}

function thump(
  r: RenderContext,
  from: number,
  to: number,
  dur: number,
  peak: number,
  delay = 0,
): void {
  tone(r, { type: 'sine', from, to, dur, peak, attack: 0.006, delay });
}

interface SfxDef {
  /** Base loudness before intensity / effects volume. */
  gain: number;
  /** Total wall-clock footprint used for voice bookkeeping. */
  duration: number;
  /** Minimum seconds between two shots of this name. */
  cooldown: number;
  /** Higher priority sounds may evict lower priority voices when saturated. */
  priority: number;
  /** Per-name concurrency cap. */
  maxVoices: number;
  /** Random frequency spread (0.05 = ±5%). */
  pitch: number;
  render: (r: RenderContext) => void;
}

/**
 * All effects are synthesized. They are deliberately layered (transient + body +
 * tail) rather than single tones so combat reads as physical instead of chiptune.
 */
const SFX: Record<SoundName, SfxDef> = {
  select: {
    gain: 0.5,
    duration: 0.15,
    cooldown: 0.045,
    priority: 2,
    maxVoices: 2,
    pitch: 0.02,
    render: (r) => {
      tone(r, { type: 'sine', from: 720, to: 980, dur: 0.075, peak: 0.22 });
      tone(r, { type: 'triangle', from: 1440, dur: 0.05, peak: 0.05, delay: 0.012 });
    },
  },
  click: {
    gain: 0.45,
    duration: 0.08,
    cooldown: 0.05,
    priority: 1,
    maxVoices: 2,
    pitch: 0.03,
    render: (r) => {
      noise(r, { dur: 0.03, from: 2600, type: 'highpass', q: 0.7, peak: 0.14, attack: 0.001 });
      tone(r, { type: 'triangle', from: 1800, to: 1200, dur: 0.035, peak: 0.06 });
    },
  },
  coin: {
    gain: 0.6,
    duration: 0.4,
    cooldown: 0.09,
    priority: 3,
    maxVoices: 3,
    pitch: 0.015,
    render: (r) => {
      tone(r, { type: 'triangle', from: 1318.5, dur: 0.16, peak: 0.18 });
      tone(r, { type: 'triangle', from: 1760, dur: 0.26, peak: 0.15, delay: 0.055 });
      tone(r, { type: 'sine', from: 3520, dur: 0.08, peak: 0.04, delay: 0.05 });
    },
  },
  countdown: {
    gain: 0.9,
    duration: 0.36,
    cooldown: 0.5,
    priority: 5,
    maxVoices: 1,
    pitch: 0.01,
    render: (r) => {
      thump(r, 220, 130, 0.18, 0.35);
      noise(r, { dur: 0.14, from: 800, to: 420, peak: 0.1, q: 0.9 });
      tone(r, { type: 'triangle', from: 440, dur: 0.08, peak: 0.08, delay: 0.02 });
    },
  },
  spawn: {
    gain: 0.8,
    duration: 0.36,
    cooldown: 0.12,
    priority: 3,
    maxVoices: 4,
    pitch: 0.05,
    render: (r) => {
      thump(r, 160, 70, 0.26, 0.32);
      noise(r, { dur: 0.28, from: 500, to: 1600, peak: 0.08, attack: 0.02, q: 0.8 });
      tone(r, { type: 'triangle', from: 330, to: 660, dur: 0.18, peak: 0.05, delay: 0.02 });
    },
  },
  sword: {
    gain: 0.9,
    duration: 0.36,
    cooldown: 0.07,
    priority: 5,
    maxVoices: 6,
    pitch: 0.06,
    render: (r) => {
      noise(r, { dur: 0.11, from: 3200, type: 'highpass', q: 0.7, peak: 0.16, attack: 0.001 });
      metal(r, [2380, 3510, 5070], 0.18, 0.3);
      thump(r, 170, 85, 0.1, 0.1);
    },
  },
  shield: {
    gain: 0.9,
    duration: 0.55,
    cooldown: 0.08,
    priority: 5,
    maxVoices: 4,
    pitch: 0.05,
    render: (r) => {
      thump(r, 150, 65, 0.18, 0.28);
      metal(r, [780, 1210, 1930], 0.17, 0.5);
      noise(r, { dur: 0.12, from: 850, peak: 0.08, q: 1.1 });
    },
  },
  pike: {
    gain: 0.85,
    duration: 0.24,
    cooldown: 0.09,
    priority: 5,
    maxVoices: 3,
    pitch: 0.06,
    render: (r) => {
      noise(r, { dur: 0.06, from: 520, peak: 0.18, q: 1.6, attack: 0.001 });
      tone(r, { type: 'triangle', from: 260, to: 140, dur: 0.1, peak: 0.1 });
      metal(r, [1900, 2850], 0.06, 0.14, 0.015);
    },
  },
  axe: {
    gain: 1,
    duration: 0.34,
    cooldown: 0.12,
    priority: 6,
    maxVoices: 3,
    pitch: 0.07,
    render: (r) => {
      noise(r, { dur: 0.14, from: 1600, to: 280, type: 'lowpass', q: 0.8, peak: 0.22, attack: 0.001 });
      thump(r, 110, 48, 0.26, 0.3);
      metal(r, [850, 1520], 0.05, 0.18, 0.02);
    },
  },
  bow: {
    gain: 0.85,
    duration: 0.28,
    cooldown: 0.08,
    priority: 5,
    maxVoices: 5,
    pitch: 0.06,
    render: (r) => {
      tone(r, { type: 'triangle', from: 320, to: 150, dur: 0.12, peak: 0.12 });
      noise(r, { dur: 0.2, from: 1100, to: 2600, peak: 0.09, attack: 0.015, q: 1.2 });
      tone(r, { type: 'sine', from: 900, to: 400, dur: 0.08, peak: 0.04, delay: 0.01 });
    },
  },
  crossbow: {
    gain: 0.8,
    duration: 0.32,
    cooldown: 0.1,
    priority: 5,
    maxVoices: 4,
    pitch: 0.05,
    render: (r) => {
      noise(r, { dur: 0.04, from: 2300, peak: 0.2, q: 2, attack: 0.001 });
      metal(r, [1600, 2400], 0.05, 0.1);
      noise(r, { dur: 0.14, from: 900, to: 380, peak: 0.1, delay: 0.03, q: 0.9 });
      noise(r, { dur: 0.2, from: 1500, to: 3200, peak: 0.06, delay: 0.07, q: 0.8 });
    },
  },
  magic: {
    gain: 0.85,
    duration: 0.75,
    cooldown: 0.14,
    priority: 6,
    maxVoices: 3,
    pitch: 0.035,
    render: (r) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone(r, {
          type: 'sine',
          from: freq,
          dur: 0.55 - index * 0.05,
          peak: 0.07,
          delay: index * 0.045,
        });
      });
      noise(r, { dur: 0.55, from: 700, to: 4200, peak: 0.05, attack: 0.08, q: 1.4 });
      tone(r, { type: 'sine', from: 2093, to: 1046.5, dur: 0.6, peak: 0.03, delay: 0.1 });
    },
  },
  fire: {
    gain: 0.9,
    duration: 0.6,
    cooldown: 0.16,
    priority: 6,
    maxVoices: 3,
    pitch: 0.05,
    render: (r) => {
      noise(r, { dur: 0.5, from: 1100, to: 380, type: 'lowpass', q: 0.8, peak: 0.14, attack: 0.012 });
      noise(r, { dur: 0.2, from: 2600, peak: 0.06, delay: 0.04, q: 0.8 });
      thump(r, 95, 45, 0.3, 0.12);
      for (let i = 0; i < 3; i += 1) {
        noise(r, {
          dur: 0.04,
          from: 3200,
          peak: 0.04,
          delay: 0.06 + Math.random() * 0.3,
          q: 2,
        });
      }
    },
  },
  heal: {
    gain: 0.8,
    duration: 0.85,
    cooldown: 0.5,
    priority: 5,
    maxVoices: 2,
    pitch: 0.02,
    render: (r) => {
      [392, 523.25, 659.25].forEach((freq, index) => {
        tone(r, {
          type: 'triangle',
          from: freq,
          dur: 0.75,
          peak: 0.06,
          delay: index * 0.09,
        });
      });
      tone(r, { type: 'sine', from: 1046.5, dur: 0.55, peak: 0.035, delay: 0.27 });
      noise(r, { dur: 0.65, from: 1400, to: 4200, peak: 0.025, attack: 0.12, q: 1.2 });
    },
  },
  horn: {
    gain: 1,
    duration: 1,
    cooldown: 1.4,
    priority: 8,
    maxVoices: 1,
    pitch: 0,
    render: (r) => {
      tone(r, { type: 'sawtooth', from: 155.56, dur: 0.3, peak: 0.12, attack: 0.06, lowpass: 900 });
      tone(r, {
        type: 'sawtooth',
        from: 233.08,
        dur: 0.5,
        peak: 0.12,
        attack: 0.09,
        delay: 0.26,
        lowpass: 1100,
      });
      tone(r, { type: 'triangle', from: 466.16, dur: 0.42, peak: 0.035, delay: 0.28 });
      tone(r, { type: 'sine', from: 116.54, dur: 0.5, peak: 0.05, delay: 0.26 });
    },
  },
  base: {
    gain: 1,
    duration: 0.85,
    cooldown: 0.35,
    priority: 8,
    maxVoices: 2,
    pitch: 0.03,
    render: (r) => {
      thump(r, 72, 42, 0.7, 0.42);
      noise(r, { dur: 0.55, from: 240, type: 'lowpass', q: 0.8, peak: 0.16, attack: 0.005 });
      tone(r, { type: 'sawtooth', from: 58, to: 38, dur: 0.5, peak: 0.07, lowpass: 220 });
    },
  },
  collapse: {
    gain: 1,
    duration: 1.9,
    cooldown: 1.6,
    priority: 9,
    maxVoices: 1,
    pitch: 0.03,
    render: (r) => {
      noise(r, { dur: 1.7, from: 900, to: 110, type: 'lowpass', q: 0.7, peak: 0.2, attack: 0.03 });
      thump(r, 90, 32, 1.2, 0.3);
      tone(r, { type: 'sawtooth', from: 70, to: 40, dur: 1.4, peak: 0.05, lowpass: 180 });
      for (let i = 0; i < 4; i += 1) {
        noise(r, {
          dur: 0.16,
          from: 1200 + Math.random() * 1400,
          peak: 0.05,
          delay: 0.15 + i * 0.3 + Math.random() * 0.1,
          q: 1.5,
        });
      }
    },
  },
  victory: {
    gain: 1,
    duration: 1.6,
    cooldown: 4,
    priority: 10,
    maxVoices: 1,
    pitch: 0,
    render: (r) => {
      [523.25, 659.25, 783.99].forEach((freq, index) => {
        tone(r, {
          type: 'sawtooth',
          from: freq,
          dur: 0.42,
          peak: 0.09,
          attack: 0.02,
          delay: index * 0.14,
          lowpass: 2400,
        });
      });
      [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
        tone(r, {
          type: 'triangle',
          from: freq,
          dur: 1.05,
          peak: 0.045,
          attack: 0.03,
          delay: 0.46,
        });
      });
    },
  },
  defeat: {
    gain: 1,
    duration: 2.3,
    cooldown: 4,
    priority: 10,
    maxVoices: 1,
    pitch: 0,
    render: (r) => {
      [392, 349.23, 293.66, 220].forEach((freq, index) => {
        tone(r, {
          type: 'triangle',
          from: freq,
          dur: 0.85,
          peak: 0.075,
          delay: index * 0.28,
          lowpass: 1200,
        });
      });
      tone(r, { type: 'sine', from: 110, dur: 2, peak: 0.05, attack: 0.1, delay: 0.5 });
    },
  },
  step: {
    gain: 0.35,
    duration: 0.1,
    cooldown: 0.09,
    priority: 1,
    maxVoices: 4,
    pitch: 0.08,
    render: (r) => {
      noise(r, { dur: 0.07, from: 420, type: 'lowpass', q: 0.8, peak: 0.05, attack: 0.002 });
      thump(r, 95, 75, 0.06, 0.05);
    },
  },
  warning: {
    gain: 0.9,
    duration: 0.8,
    cooldown: 1.4,
    priority: 7,
    maxVoices: 1,
    pitch: 0,
    render: (r) => {
      tone(r, { type: 'triangle', from: 880, dur: 0.45, peak: 0.08, attack: 0.01 });
      tone(r, { type: 'triangle', from: 1174.66, dur: 0.45, peak: 0.06, delay: 0.13, attack: 0.01 });
      tone(r, { type: 'sine', from: 1760, dur: 0.3, peak: 0.025, delay: 0.13 });
    },
  },
};

/* ------------------------------------------------------------------ */
/* Audio manager                                                       */
/* ------------------------------------------------------------------ */

interface MusicVoice {
  track: TrackId;
  el: HTMLAudioElement;
  /** Cross-fade factor 0..1. */
  gain: number;
  target: number;
  /** Fade factor change per second. */
  fadeRate: number;
  /** Smoothed scene gain (lets a same-track scene change stay continuous). */
  sceneGain: number;
  sceneTarget: number;
}

interface ActiveSfx {
  name: SoundName;
  priority: number;
  endTime: number;
  cut?: () => void;
}

export class AudioManager {
  private readonly options: Required<AudioManagerOptions>;
  private activeScene: AudioScene;
  private musicVolume: number;
  private effectsVolume: number;
  private ambienceVolume: number;
  private muted: boolean;
  private unlocked = false;
  private disposed = false;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambienceOut: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private windSources: AudioBufferSourceNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  private readonly elements = new Map<TrackId, HTMLAudioElement>();
  private current: MusicVoice | null = null;
  private outgoing: MusicVoice | null = null;

  private activeSfx: ActiveSfx[] = [];
  private readonly cooldowns = new Map<SoundName, number>();

  private ambientLevel = 0;
  private ambientTarget = 0;
  private rumbleLevel = 0;
  private rumbleTarget = 0;
  private windPhase = Math.random() * 100;
  private duckRemaining = 0;
  private duckGain = 1;

  constructor(options: AudioManagerOptions = {}) {
    this.options = {
      initialScene: options.initialScene ?? 'menu',
      musicVolume: clamp(options.musicVolume ?? DEFAULT_VOLUMES.music, 0, 1),
      effectsVolume: clamp(options.effectsVolume ?? DEFAULT_VOLUMES.effects, 0, 1),
      ambienceVolume: clamp(options.ambienceVolume ?? DEFAULT_VOLUMES.ambience, 0, 1),
      muted: options.muted ?? false,
      preload: options.preload ?? true,
      debug: options.debug ?? false,
    };
    this.activeScene = SCENES[this.options.initialScene]
      ? this.options.initialScene
      : 'menu';
    this.musicVolume = this.options.musicVolume;
    this.effectsVolume = this.options.effectsVolume;
    this.ambienceVolume = this.options.ambienceVolume;
    this.muted = this.options.muted;
    this.syncAmbienceTargets();
    this.prepareElements();
  }

  get scene(): AudioScene {
    return this.activeScene;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Must be called from a real user gesture (pointerup/keydown). Creates and
   * resumes the AudioContext, primes the wind bed and starts the recorded BGM.
   */
  async unlock(): Promise<void> {
    if (this.disposed) return;
    try {
      this.ensureContext();
      const ctx = this.ctx;
      if (ctx && ctx.state !== 'running') {
        await ctx.resume();
      }
      this.unlocked = true;
      this.ensureAmbience();
      this.applyGains();
      this.syncScene();
      this.syncAmbience(true);
    } catch (error) {
      this.report('unlock failed', error);
    }
  }

  /**
   * Changing scenes starts a soft two-deck cross-fade. Repeating the current
   * scene is a no-op (useful for UI re-renders).
   */
  setScene(scene: AudioScene): void {
    if (this.disposed) return;
    if (!SCENES[scene] || scene === this.activeScene) return;
    this.activeScene = scene;
    this.syncAmbienceTargets();
    if (this.unlocked) this.syncScene();
  }

  /** music / effects / ambience in the 0..1 range; out-of-range values are clamped. */
  setVolumes(music: number, effects: number, ambience: number): void {
    if (this.disposed) return;
    this.musicVolume = clamp(music, 0, 1);
    this.effectsVolume = clamp(effects, 0, 1);
    this.ambienceVolume = clamp(ambience, 0, 1);
    this.applyGains();
  }

  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.muted = Boolean(muted);
    this.applyGains();
  }

  /**
   * Fire a synthesized effect.
   * @param name one of SOUND_NAMES
   * @param intensity 0..1; scales loudness (defaults to 1)
   * @param pan -1 (left) .. 1 (right)
   */
  play(name: string, intensity = 1, pan = 0): void {
    if (this.disposed || this.muted) return;
    const key = name as SoundName;
    const def = SFX[key];
    if (!def) return;
    const ctx = this.ctx;
    if (!this.unlocked || !ctx || ctx.state !== 'running' || !this.sfxGain || !this.noiseBuffer) {
      return;
    }

    try {
      const now = ctx.currentTime;
      this.pruneVoices(now);

      const last = this.cooldowns.get(key);
      if (last !== undefined && now - last < def.cooldown) return;

      const voice = this.reserveVoice(key, def, now);
      if (!voice) return;
      if (def.priority >= 8) this.duckRemaining = Math.max(this.duckRemaining, key==='collapse'?1.8:1.1);
      this.cooldowns.set(key, now);

      const p = clamp(intensity, 0, 1);
      const pitch = 1 + (Math.random() * 2 - 1) * def.pitch;
      const out = ctx.createGain();
      out.gain.value = clamp(def.gain * (0.35 + 0.65 * p), 0, 1);

      let tail: AudioNode = out;
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = clamp(pan, -SFX_PANORAMA_LIMIT, SFX_PANORAMA_LIMIT);
        out.connect(panner);
        tail = panner;
      }
      tail.connect(this.sfxGain);

      const sources: AudioScheduledSourceNode[] = [];
      const renderContext: RenderContext = {
        ctx,
        buffer: this.noiseBuffer,
        destination: out,
        start: now + 0.004,
        pitch,
        register: (node) => {
          sources.push(node);
        },
      };

      voice.cut = () => {
        try {
          const at = ctx.currentTime;
          out.gain.cancelScheduledValues(at);
          out.gain.setTargetAtTime(0.0001, at, 0.01);
          for (const source of sources) {
            try {
              source.stop(at + 0.06);
            } catch {
              /* already stopped */
            }
          }
        } catch {
          /* ignore */
        }
      };

      def.render(renderContext);
    } catch (error) {
      this.report(`effect "${name}" failed`, error);
    }
  }

  /**
   * Advance cross-fades, ambient gusts and voice bookkeeping. Call once per
   * animation frame with the elapsed seconds (dt is clamped to 0.25s).
   */
  update(dt: number): void {
    if (this.disposed) return;
    const delta = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
    this.duckRemaining = Math.max(0, this.duckRemaining-delta);
    const duckTarget=this.duckRemaining>0?.62:1;
    this.duckGain+=(duckTarget-this.duckGain)*(1-Math.exp(-delta/(duckTarget<this.duckGain?.08:.7)));

    for (const voice of this.musicVoices()) {
      if (voice.gain < voice.target) {
        voice.gain = Math.min(voice.target, voice.gain + voice.fadeRate * delta);
      } else if (voice.gain > voice.target) {
        voice.gain = Math.max(voice.target, voice.gain - voice.fadeRate * delta);
      }
      const smooth = delta > 0 ? 1 - Math.exp(-delta / 0.65) : 0;
      voice.sceneGain += (voice.sceneTarget - voice.sceneGain) * smooth;
      this.applyMusicVolume(voice);
    }

    if (this.outgoing && this.outgoing.gain <= 0.001) {
      this.stopVoice(this.outgoing);
      this.outgoing = null;
    }

    if (this.ctx) this.pruneVoices(this.ctx.currentTime);

    this.windPhase = (this.windPhase + delta) % 1000;
    const ambienceSmooth = delta > 0 ? 1 - Math.exp(-delta / 0.9) : 0;
    this.ambientLevel += (this.ambientTarget - this.ambientLevel) * ambienceSmooth;
    this.rumbleLevel += (this.rumbleTarget - this.rumbleLevel) * ambienceSmooth;
    const gust =
      0.84 + 0.1 * Math.sin(this.windPhase * 0.27) + 0.06 * Math.sin(this.windPhase * 0.71 + 1.7);
    this.applyAmbience(gust);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;

    for (const el of this.elements.values()) {
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        /* ignore teardown races */
      }
    }
    this.elements.clear();
    this.current = null;
    this.outgoing = null;
    this.activeSfx = [];
    this.cooldowns.clear();

    for (const source of this.windSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.windSources = [];

    try {
      this.windGain?.disconnect();
      this.rumbleGain?.disconnect();
      this.ambienceOut?.disconnect();
      this.sfxGain?.disconnect();
      this.compressor?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      /* ignore */
    }

    const ctx = this.ctx;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.ambienceOut = null;
    this.windGain = null;
    this.rumbleGain = null;
    this.noiseBuffer = null;

    if (ctx) {
      void ctx.close().catch(() => {
        /* already closed */
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Music                                                             */
  /* ---------------------------------------------------------------- */

  private prepareElements(): void {
    if (typeof Audio === 'undefined') return;
    for (const id of TRACK_IDS) {
      try {
        const el = new Audio();
        el.preload = this.options.preload ? 'auto' : 'none';
        el.loop = true;
        el.volume = 0;
        el.src = `${MUSIC_BASE}${TRACKS[id].file}`;
        if (this.options.preload) el.load();
        this.elements.set(id, el);
      } catch (error) {
        this.report(`could not prepare track "${id}"`, error);
      }
    }
  }

  private musicVoices(): MusicVoice[] {
    const voices: MusicVoice[] = [];
    if (this.outgoing) voices.push(this.outgoing);
    if (this.current) voices.push(this.current);
    return voices;
  }

  private syncScene(): void {
    if (this.disposed || !this.unlocked) return;
    const def = SCENES[this.activeScene];

    if (this.current && this.current.track === def.track) {
      this.current.sceneTarget = def.music;
      try {
        this.current.el.playbackRate = def.playbackRate;
      } catch {
        /* ignore */
      }
      if (this.current.el.paused) void this.playElement(this.current);
      return;
    }

    const el = this.elements.get(def.track);
    if (!el) return;

    // A -> B -> A within one cross-fade: revive the deck that is fading out.
    if (this.outgoing && this.outgoing.el === el) {
      const revived = this.outgoing;
      this.outgoing = null;
      if (this.current) {
        this.current.target = 0;
        this.current.fadeRate = 1 / Math.max(1.1, def.fadeIn * 0.85);
        this.outgoing = this.current;
      }
      this.current = revived;
      revived.target = 1;
      revived.fadeRate = 1 / Math.max(0.6, def.fadeIn);
      revived.sceneTarget = def.music;
      try {
        revived.el.playbackRate = def.playbackRate;
      } catch {
        /* ignore */
      }
      if (revived.el.paused) void this.playElement(revived);
      return;
    }

    if (this.outgoing) {
      this.stopVoice(this.outgoing);
      this.outgoing = null;
    }

    if (this.current) {
      this.current.target = 0;
      this.current.fadeRate = 1 / Math.max(1.1, def.fadeIn * 0.85);
      this.outgoing = this.current;
      this.current = null;
    }

    try {
      el.currentTime = 0;
      el.playbackRate = def.playbackRate;
    } catch {
      /* metadata may not be loaded yet; play() will start at 0 */
    }

    const voice: MusicVoice = {
      track: def.track,
      el,
      gain: 0,
      target: 1,
      fadeRate: 1 / Math.max(0.6, def.fadeIn),
      sceneGain: def.music,
      sceneTarget: def.music,
    };
    this.current = voice;
    this.applyMusicVolume(voice);
    void this.playElement(voice);
  }

  private async playElement(voice: MusicVoice): Promise<void> {
    try {
      this.applyMusicVolume(voice);
      await voice.el.play();
    } catch (error) {
      // Autoplay policy or an unsupported codec: unlock()/setScene() can retry.
      this.report('music playback blocked', error);
    }
  }

  private stopVoice(voice: MusicVoice): void {
    try {
      voice.el.pause();
    } catch {
      /* ignore */
    }
    try {
      voice.el.currentTime = 0;
    } catch {
      /* ignore */
    }
    try {
      voice.el.volume = 0;
    } catch {
      /* ignore */
    }
  }

  private applyMusicVolume(voice: MusicVoice): void {
    try {
      if (this.muted || this.musicVolume <= 0) {
        voice.el.volume = 0;
        return;
      }
      const duration=voice.el.duration;
      const at=voice.el.currentTime;
      // Gently feather file boundaries instead of exposing raw discontinuities.
      // This is deliberately not advertised as sample-accurate gapless editing.
      const seam=Number.isFinite(duration)&&duration>5?Math.max(0,Math.min(1,at/.6,(duration-at)/1.1)):1;
      voice.el.volume = clamp(this.musicVolume * TRACKS[voice.track].gain * voice.sceneGain * voice.gain * this.duckGain * seam, 0, 1);
    } catch {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ambience                                                          */
  /* ---------------------------------------------------------------- */

  private syncAmbienceTargets(): void {
    const def = SCENES[this.activeScene];
    this.ambientTarget = def.wind;
    this.rumbleTarget = def.rumble;
  }

  private ensureAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.noiseBuffer || this.windGain) return;
    try {
      this.ambienceOut = ctx.createGain();
      this.ambienceOut.gain.value = this.ambienceVolume;
      this.ambienceOut.connect(this.masterGain);

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windGain.connect(this.ambienceOut);

      this.rumbleGain = ctx.createGain();
      this.rumbleGain.gain.value = 0;
      this.rumbleGain.connect(this.ambienceOut);

      const low = ctx.createBufferSource();
      low.buffer = this.noiseBuffer;
      low.loop = true;
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.value = 480;
      lowFilter.Q.value = 0.7;
      low.connect(lowFilter);
      lowFilter.connect(this.windGain);

      const high = ctx.createBufferSource();
      high.buffer = this.noiseBuffer;
      high.loop = true;
      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'bandpass';
      highFilter.frequency.value = 1250;
      highFilter.Q.value = 0.8;
      const highGain = ctx.createGain();
      highGain.gain.value = 0.32;
      high.connect(highFilter);
      highFilter.connect(highGain);
      highGain.connect(this.windGain);

      const rumble = ctx.createBufferSource();
      rumble.buffer = this.noiseBuffer;
      rumble.loop = true;
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 85;
      rumbleFilter.Q.value = 0.9;
      rumble.connect(rumbleFilter);
      rumbleFilter.connect(this.rumbleGain);

      const start = ctx.currentTime + 0.02;
      low.start(start, Math.random() * 1.4);
      high.start(start, 0.6 + Math.random() * 1.2);
      rumble.start(start, Math.random() * 1.2);
      this.windSources = [low, high, rumble];
    } catch (error) {
      this.report('ambience setup failed', error);
    }
  }

  private syncAmbience(immediate: boolean): void {
    this.syncAmbienceTargets();
    if (immediate) {
      this.ambientLevel = this.ambientTarget;
      this.rumbleLevel = this.rumbleTarget;
    }
    this.applyAmbience(0.9);
  }

  private applyAmbience(gust: number): void {
    try {
      if (this.windGain) this.windGain.gain.value = clamp(this.ambientLevel * gust, 0, 1);
      if (this.rumbleGain) this.rumbleGain.gain.value = clamp(this.rumbleLevel * 0.45 * gust, 0, 1);
    } catch {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------------- */
  /* Web Audio plumbing                                                */
  /* ---------------------------------------------------------------- */

  private ensureContext(): void {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;
      const ctor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!ctor) return;

      let ctx: AudioContext;
      try {
        ctx = new ctor({ latencyHint: 'interactive' });
      } catch {
        ctx = new ctor();
      }
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.8;
      this.masterGain.connect(ctx.destination);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = this.effectsVolume;

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.22;

      this.sfxGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.noiseBuffer = createNoiseBuffer(ctx, 2.5);
    } catch (error) {
      this.report('AudioContext unavailable', error);
    }
  }

  private applyGains(): void {
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      try {
        this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : 0.8, now, 0.02);
        this.sfxGain?.gain.setTargetAtTime(this.effectsVolume, now, 0.03);
        this.ambienceOut?.gain.setTargetAtTime(this.ambienceVolume, now, 0.03);
      } catch {
        /* ignore */
      }
    }
    for (const voice of this.musicVoices()) this.applyMusicVolume(voice);
  }

  private reserveVoice(name: SoundName, def: SfxDef, now: number): ActiveSfx | null {
    this.pruneVoices(now);

    const sameName = this.activeSfx.reduce(
      (count, voice) => count + (voice.name === name ? 1 : 0),
      0,
    );
    if (sameName >= def.maxVoices) return null;

    if (this.activeSfx.length >= MAX_ACTIVE_SFX) {
      let victimIndex = -1;
      let lowest = Number.POSITIVE_INFINITY;
      for (let i = 0; i < this.activeSfx.length; i += 1) {
        if (this.activeSfx[i].priority < lowest) {
          lowest = this.activeSfx[i].priority;
          victimIndex = i;
        }
      }
      if (victimIndex < 0 || lowest > def.priority) return null;
      const [victim] = this.activeSfx.splice(victimIndex, 1);
      try {
        victim.cut?.();
      } catch {
        /* ignore */
      }
    }

    const voice: ActiveSfx = {
      name,
      priority: def.priority,
      endTime: now + def.duration,
    };
    this.activeSfx.push(voice);
    return voice;
  }

  private pruneVoices(now: number): void {
    if (this.activeSfx.length === 0) return;
    this.activeSfx = this.activeSfx.filter((voice) => voice.endTime > now);
  }

  private report(message: string, error: unknown): void {
    if (this.options.debug && typeof console !== 'undefined') {
      console.warn(`[audio] ${message}`, error);
    }
  }
}
