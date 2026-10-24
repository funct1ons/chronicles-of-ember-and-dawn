import type { BattleState, Fighter } from '../core/types';

interface Position { x: number; y: number }

/** Render-only snapshots. Never writes to the deterministic simulation. */
export class MotionHistory {
 private state: BattleState | null = null;
 private time = 0;
 private previous = new Map<number, Position>();
 private alpha = 0;

 captureBeforeStep(state: BattleState): void {
  this.state = state;
  this.time = state.time;
  this.previous.clear();
  for (const unit of state.units) this.previous.set(unit.id, { x: unit.x, y: unit.y });
  this.alpha = 0;
 }

 clear(): void {
  this.state = null;
  this.previous.clear();
  this.alpha = 0;
 }

 /** null freezes the last presented fraction; progress cannot rewind within a step. */
 beginFrame(state: BattleState | null, alpha: number | null): void {
  if (state !== this.state || (state && state.time < this.time)) {
   this.clear();
   return;
  }
  if (alpha !== null) {
   const next = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
   this.alpha = Math.max(this.alpha, next);
  }
 }

 position(unit: Fighter): Position {
  const start = this.previous.get(unit.id);
  if (!start) return unit; // No phantom travel for new recruits.
  return { x: start.x + (unit.x - start.x) * this.alpha,
   y: start.y + (unit.y - start.y) * this.alpha };
 }
}

/** A 4Hz horizontal impulse, bounded in DEVICE pixels, with a time-based envelope. */
export class ImpactShake {
 private age = Infinity;
 hit(): void { this.age = 0; }
 clear(): void { this.age = Infinity; }
 advance(dt: number, reducedMotion: boolean): number {
  if (reducedMotion) { this.clear(); return 0; }
  this.age += Math.max(0, dt);
  if (this.age > 1) return 0;
  return Math.round(2 * Math.exp(-6 * this.age) * Math.sin(2 * Math.PI * 4 * this.age));
 }
}
