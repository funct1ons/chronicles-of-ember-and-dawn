/**
 * Pure mixing math for the music bus.
 *
 * Everything here is a plain function so it can be unit tested without a DOM or
 * an AudioContext. `AudioManager` only performs I/O with these numbers.
 *
 * Design notes:
 *  - `musicLevel` never looks at the playhead. The old director feathered the file
 *    boundaries to zero ("seam"), which guaranteed ~1.7s of silence on every loop.
 *    Loudness now depends only on the mix, so a loop boundary is inaudible.
 *  - Looping itself is handled by overlapping two decks (`loopCrossfade`), which
 *    keeps `out^2 + in^2 === 1`: neither side is ever silent.
 *  - The climax intensity step is a small, documented gain lift so it can be
 *    verified in dB instead of by ear.
 */

/** Seconds of deck overlap across the loop point (both decks play simultaneously). */
export const LOOP_OVERLAP_SECONDS = 1.6;

/** Start priming the standby deck this many seconds before the loop point. */
export const LOOP_PRIME_SECONDS = 20;

/**
 * Hard ceiling for a single music element. Leaves headroom for the +2dB climax
 * lift and for effects that the browser mixes on top of the music element.
 */
export const MUSIC_CEILING = 0.95;

/** Extra gain the same battle track receives at climax intensity. */
export const CLIMAX_LIFT_DB = 2;

/** Scene coefficient of the battle theme at normal intensity. */
export const BATTLE_SCENE_GAIN = 0.78;

/** Scene coefficient at climax: the same track, ~+2dB, still below the ceiling. */
export const CLIMAX_SCENE_GAIN = Number(
  (BATTLE_SCENE_GAIN * 10 ** (CLIMAX_LIFT_DB / 20)).toFixed(3),
);

/** Percussion layer level relative to the user's music volume (not the effects bus). */
export const CLIMAX_LAYER_LEVEL = 0.18;

export interface MusicLevelInput {
  /** User music slider (0..1). The climax layer uses the same value. */
  musicVolume: number;
  /** Per-track loudness trim (already equalised to ~-19 LUFS). */
  trackGain: number;
  /** Scene coefficient (battle vs climax etc.). */
  sceneGain: number;
  /** Scene cross-fade envelope for this deck (0..1). */
  fade: number;
  /** Loop-overlap envelope for this deck (0..1). */
  loopFade: number;
  /** Ducking factor applied while loud effects play. */
  duck: number;
  muted: boolean;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Element volume for one music deck.
 * Deliberately independent of `currentTime` / `duration`.
 */
export function musicLevel(input: MusicLevelInput): number {
  if (input.muted || !(input.musicVolume > 0)) return 0;
  const level =
    input.musicVolume *
    input.trackGain *
    input.sceneGain *
    clamp01(input.fade) *
    clamp01(input.loopFade) *
    clamp01(input.duck);
  if (!Number.isFinite(level) || level <= 0) return 0;
  return Math.min(MUSIC_CEILING, level);
}

export interface LoopCrossfade {
  /** Envelope for the deck that is finishing the cycle. */
  out: number;
  /** Envelope for the deck that is starting the next cycle. */
  in: number;
}

/** Constant-power loop cross-fade envelopes for a playhead. */
export function loopCrossfade(
  at: number,
  duration: number,
  overlap: number = LOOP_OVERLAP_SECONDS,
): LoopCrossfade {
  if (!Number.isFinite(duration) || duration <= 0) return { out: 1, in: 0 };
  const window = Math.min(Math.max(overlap, 0.1), duration * 0.25);
  const remaining = duration - (Number.isFinite(at) ? at : 0);
  if (remaining >= window) return { out: 1, in: 0 };
  const progress = clamp01((window - remaining) / window);
  if (progress >= 1) return { out: 0, in: 1 };
  return { out: Math.cos((progress * Math.PI) / 2), in: Math.sin((progress * Math.PI) / 2) };
}

/** Gain ratio expressed in dB, useful for assertions and metrics. */
export function gainRatioDb(from: number, to: number): number {
  if (!(from > 0) || !(to > 0)) return 0;
  return 20 * Math.log10(to / from);
}
