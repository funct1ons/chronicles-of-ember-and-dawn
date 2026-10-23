/**
 * Shared geometry + deterministic math helpers for the battle simulation.
 *
 * The battle field is 1280x540 world units. Combat happens between y=315 and
 * y=455 on eight horizontal lanes. All randomness must flow through
 * {@link nextRandom} so that a battle is a pure function of its seed.
 */

export const FIELD_WIDTH = 1280;
export const FIELD_HEIGHT = 540;

/** Top and bottom of the battle strip. */
export const FIELD_TOP = 315;
export const FIELD_BOTTOM = 455;

/** Eight soft lanes inside the battle strip. */
export const LANE_COUNT = 8;
export const LANE_GAP = (FIELD_BOTTOM - FIELD_TOP) / (LANE_COUNT - 1);

/** Vertical centre of the strip, used by the forts. */
export const BASE_Y = (FIELD_TOP + FIELD_BOTTOM) / 2;

/** Fort positions: side 0 on the left, side 1 on the right. */
export const BASE_X: readonly [number, number] = [80, 1200];

/** Fixed simulation step. The caller is expected to drive the battle with it. */
export const FIXED_DT = 1 / 30;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Index of the lane that contains `y` (clamped to the strip). */
export function laneOfY(y: number): number {
  const index = Math.round((y - FIELD_TOP) / LANE_GAP);
  return clamp(index, 0, LANE_COUNT - 1) | 0;
}

/** Centre y of a lane. */
export function laneCenterY(lane: number): number {
  return FIELD_TOP + clamp(lane, 0, LANE_COUNT - 1) * LANE_GAP;
}

/** Anything that owns a mutable `rng` seed (the BattleState does). */
export interface RngHolder {
  rng: number;
}

/** Hashes an arbitrary integer seed into a non-zero uint32 state. */
export function seedRng(seed: number): number {
  let value = Number.isFinite(seed) ? Math.floor(seed) : 1;
  value = (value ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value === 0 ? 0x6d2b79f5 : value;
}

/**
 * Mulberry32-style deterministic PRNG. Mutates `holder.rng` and returns a
 * number in [0, 1).
 */
export function nextRandom(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
