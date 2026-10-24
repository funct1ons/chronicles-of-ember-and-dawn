/**
 * Core battle simulation.
 *
 * The caller owns the clock and drives the battle with a fixed 1/30s step:
 *
 *   createBattle(config) -> stepBattle(state, 1 / 30) repeatedly
 *
 * Everything inside is deterministic for a given `config.seed`: the only
 * source of randomness is {@link nextRandom}, which mutates `state.rng`.
 */
import type { BattleState, Fighter, MatchConfig, Role, Side, TeamState, UnitDef } from './types';
import { UNIT_BY_ID } from '../data/units';
import { chooseAI, allowedUnitsFor, otherSide } from './ai';
import { computeDamage, MIN_DAMAGE, type DamageOptions } from './combat';
import {
  BASE_X,
  BASE_Y,
  FIELD_BOTTOM,
  FIELD_TOP,
  FIELD_WIDTH,
  LANE_COUNT,
  clamp,
  distance,
  laneCenterY,
  laneOfY,
  nextRandom,
  seedRng,
  FIXED_DT,
} from './math';

export { FIELD_WIDTH, FIXED_DT, computeDamage, MIN_DAMAGE };
export type { DamageOptions };

/** Hard cap for a team's income. */
export const MAX_INCOME = 600;
/** Unspent gold carries over between waves, up to this amount. */
export const GOLD_CAP = 6000;
/** At most this many units are recruited by one side in one wave. */
export const WAVE_UNIT_CAP = 18;
/** `Fighter.target` sentinel meaning "march on the enemy fortress". */
export const BASE_TARGET = -1;
/** Delay between battle start and the first wave. */
export const START_COUNTDOWN = 6;
export const DEFAULT_MAX_ROUNDS = 80;
/** Corpses stay on the field for this long. */
export const DEATH_LINGER = 0.6;

const UNIT_RADIUS = 7;
const BASE_RADIUS = 30;
const MIN_SEPARATION = 13;
const FRIEND_GAP = 15;
const LANE_BAND = 12;
/** Distant back rows are protected only during a frontal melee approach. */
const FRONT_WINDOW = 90;
const LANE_PENALTY = 42;
const SPLASH_RADIUS = 48;
const HEAL_AMOUNT = 24;
const SIDES: readonly Side[] = [0, 1];
const CHARGE_ROLES: ReadonlySet<Role> = new Set<Role>(['cavalry', 'knight', 'elite']);

const runtimeStore = new WeakMap<BattleState, Map<number, UnitRuntime>>();

interface UnitRuntime {
  /** Lane the unit currently wants to travel in (soft queue diffusion). */
  lane: number;
  /** Seconds spent unable to advance because of bodies in front. */
  blocked: number;
  /** Cooldown before the next lateral lane shift. */
  laneTimer: number;
  /** Short-lived parking spot requested by nearby advancing melee. */
  yieldUntil?: number;
  yieldX?: number;
  yieldY?: number;
}

interface UnitMotion {
  unit: Fighter;
  startX: number;
  startY: number;
  x: number;
  y: number;
  desiredX: number;
  desiredY: number;
}

interface Objective {
  x: number;
  y: number;
  stop: number;
}

/** Optional evaluation entry point, called after both incomes and before recruitment. */
export type WaveDecision = (state: BattleState, side: Side) => string | undefined;

export interface WavePreview {
  count: number;
  cost: number;
  /** Income gained by this wave, already clamped to MAX_INCOME. */
  income: number;
  supply: number;
}

function defOf(type: string): UnitDef {
  return UNIT_BY_ID[type] ?? (UNIT_BY_ID['levy'] as UnitDef);
}

function isAlive(unit: Fighter): boolean {
  return unit.action !== 'dead' && unit.hp > 0;
}

function makeTeam(config: MatchConfig): TeamState {
  return {
    gold: Math.max(0, config.startingGold),
    income: Math.max(0, config.startingIncome),
    baseHp: Math.max(0, config.baseHp),
    selected: '',
    supplyUsed: 0,
    spent: 0,
    earned: 0,
    kills: 0,
    recruited: 0,
    damage: 0,
  };
}

/** True when `side` is driven by the AI (the non-player side of an AI match). */
export function isAISide(state: BattleState, side: Side): boolean {
  return state.config.ai === true && side !== state.config.playerSide;
}

/** Creates a fresh battle. Both sides start with their first allowed unit selected. */
export function createBattle(config: MatchConfig): BattleState {
  const cfg: MatchConfig = { ...config, allowedUnits: [...config.allowedUnits] };
  if (config.enemyAllowedUnits) cfg.enemyAllowedUnits = [...config.enemyAllowedUnits];
  const teams: [TeamState, TeamState] = [makeTeam(cfg), makeTeam(cfg)];
  const enemySide = otherSide(cfg.playerSide);
  if (cfg.enemyGoldBonus) teams[enemySide].gold += cfg.enemyGoldBonus;
  if (cfg.enemyIncomeBonus) teams[enemySide].income += cfg.enemyIncomeBonus;
  teams[enemySide].gold = Math.max(0, teams[enemySide].gold);

  const state: BattleState = {
    config: cfg,
    time: 0,
    round: 0,
    countdown: START_COUNTDOWN,
    teams,
    units: [],
    events: [],
    winner: null,
    nextId: 1,
    rng: seedRng(cfg.seed),
  };
  for (const side of SIDES) {
    const ids = allowedUnitsFor(cfg, side);
    state.teams[side].selected = ids[0] ?? 'levy';
  }
  runtimeStore.set(state, new Map<number, UnitRuntime>());
  return state;
}

/** Changes the recruitment choice for `side`. Returns false for illegal ids. */
export function selectUnit(state: BattleState, side: Side, id: string): boolean {
  if (!UNIT_BY_ID[id]) return false;
  if (!allowedUnitsFor(state.config, side).includes(id)) return false;
  state.teams[side].selected = id;
  return true;
}

function growthOf(config: MatchConfig): number {
  const growth = config.growth;
  // growth = 0 is a legitimate "no income growth" challenge modifier.
  return Number.isFinite(growth) && growth >= 0 ? growth : 1;
}

function supplyCapOf(config: MatchConfig): number {
  return Math.max(0, Math.floor(config.supply));
}

function selectedDef(state: BattleState, side: Side): UnitDef {
  const team = state.teams[side];
  const allowed = allowedUnitsFor(state.config, side);
  if (team.selected && allowed.includes(team.selected)) return defOf(team.selected);
  return defOf(allowed[0] ?? 'levy');
}

interface WavePlan {
  def: UnitDef;
  count: number;
  cost: number;
  incomeGain: number;
  supply: number;
}

/**
 * What the next wave would buy without touching the state: income is settled
 * first, then as many units as gold / free supply / the 18-unit wave cap allow.
 */
function planWave(state: BattleState, side: Side, includeIncome: boolean): WavePlan {
  const team = state.teams[side];
  const def = selectedDef(state, side);
  const settledGold = Math.max(0, team.gold) + (includeIncome ? Math.max(0, team.income) : 0);
  const budget = Math.min(GOLD_CAP, settledGold);
  const freeSupply = Math.max(0, supplyCapOf(state.config) - team.supplyUsed);
  const byGold = Math.floor(budget / Math.max(1, def.cost));
  const bySupply = Math.floor(freeSupply / Math.max(1, def.supply));
  const count = Math.max(0, Math.min(byGold, bySupply, WAVE_UNIT_CAP));
  const rawGain = Math.round(count * def.income * growthOf(state.config));
  const incomeGain = clamp(rawGain, 0, Math.max(0, MAX_INCOME - team.income));
  return {
    def,
    count,
    cost: count * def.cost,
    incomeGain,
    supply: count * def.supply,
  };
}

/** Preview of the wave that will spawn once the current countdown ends. */
export function previewWave(state: BattleState, side: Side): WavePreview {
  const plan = planWave(state, side, true);
  return { count: plan.count, cost: plan.cost, income: plan.incomeGain, supply: plan.supply };
}

function settleIncome(state: BattleState, side: Side): void {
  const team = state.teams[side];
  const income = Math.max(0, team.income);
  team.gold = Math.min(GOLD_CAP, team.gold + income);
  team.earned += income;
}

function pickSpawnLane(state: BattleState, side: Side): number {
  const baseX = BASE_X[side];
  const counts = new Array<number>(LANE_COUNT).fill(0);
  for (const unit of state.units) {
    if (unit.side !== side || !isAlive(unit)) continue;
    if (Math.abs(unit.x - baseX) > 170) continue;
    const lane = laneOfY(unit.y);
    counts[lane] = (counts[lane] ?? 0) + 1;
  }
  const start = Math.floor(nextRandom(state) * LANE_COUNT) % LANE_COUNT;
  let bestLane = start;
  let bestCount = Number.POSITIVE_INFINITY;
  for (let step = 0; step < LANE_COUNT; step += 1) {
    const lane = (start + step) % LANE_COUNT;
    const count = counts[lane] ?? 0;
    if (count < bestCount) {
      bestCount = count;
      bestLane = lane;
    }
  }
  return bestLane;
}

function runtimeOf(state: BattleState, unit: Fighter): UnitRuntime {
  let map = runtimeStore.get(state);
  if (!map) {
    map = new Map<number, UnitRuntime>();
    runtimeStore.set(state, map);
  }
  let runtime = map.get(unit.id);
  if (!runtime) {
    runtime = { lane: laneOfY(unit.y), blocked: 0, laneTimer: 0 };
    map.set(unit.id, runtime);
  }
  return runtime;
}

/**
 * Keep a legal birth position when a wave meets parked support or earlier recruits.
 * The old 11px row offsets could even produce identical positions in one lane;
 * untangling that birth pile shoved already-visible units by the 13px contact cap.
 * Search only this lane for the closest free x; keep the original slot if free.
 * No RNG is added and ordinary movement/contact constraints are unchanged.
 */
function freeSpawnX(state: BattleState, side: Side, preferred: number, y: number): number {
  const intervals: { lo: number; hi: number }[] = [];
  let occupied = false;
  for (const other of state.units) {
    if (!isAlive(other)) continue;
    const separation = other.side === side ? FRIEND_GAP : MIN_SEPARATION;
    const dy = Math.abs(other.y - y);
    if (dy >= separation) continue;
    const gap = Math.sqrt(separation * separation - dy * dy) + 1e-6;
    const interval = { lo: other.x - gap, hi: other.x + gap };
    intervals.push(interval);
    if (preferred > interval.lo && preferred < interval.hi) occupied = true;
  }
  if (!occupied) return preferred;
  intervals.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  let left = preferred, right = preferred;
  for (const interval of intervals) {
    if (right > interval.lo && right < interval.hi) right = interval.hi;
  }
  for (let i = intervals.length - 1; i >= 0; i--) {
    const interval = intervals[i]!;
    if (left > interval.lo && left < interval.hi) left = interval.lo;
  }
  const min = BASE_X[0] + 8, max = BASE_X[1] - 8;
  if (left < min && right > max) return preferred; // No legal slot (over-cap injected states).
  if (left < min) return right;
  if (right > max) return left;
  const dl = preferred - left, dr = right - preferred;
  // Ties prefer the fortress side, independent of faction's world direction.
  return Math.abs(dl - dr) < 1e-8 ? (side === 0 ? left : right) : dl < dr ? left : right;
}

function spawnUnit(state: BattleState, side: Side, def: UnitDef, waveIndex: number): Fighter {
  const lane = pickSpawnLane(state, side);
  const dir = side === 0 ? 1 : -1;
  const preferred = clamp(BASE_X[side] + dir * (BASE_RADIUS + 8 + (waveIndex % 4) * 11), BASE_X[0] + 8, BASE_X[1] - 8);
  const y = laneCenterY(lane);
  const x = freeSpawnX(state, side, preferred, y);
  const unit: Fighter = {
    id: state.nextId,
    side,
    type: def.id,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    cooldown: 0,
    action: 'walk',
    actionTime: 0,
    target: null,
    born: state.time,
    charge: CHARGE_ROLES.has(def.role),
  };
  state.nextId += 1;
  state.units.push(unit);
  runtimeOf(state, unit).lane = lane;
  state.teams[side].supplyUsed += def.supply;
  state.events.push({ kind: 'spawn', x, y, side, type: def.id });
  return unit;
}

function spawnWave(state: BattleState, side: Side): number {
  const team = state.teams[side];
  const plan = planWave(state, side, false);
  if (plan.count <= 0) return 0;
  team.gold = Math.max(0, team.gold - plan.cost);
  team.spent += plan.cost;
  team.recruited += plan.count;
  team.income = Math.min(MAX_INCOME, team.income + plan.incomeGain);
  for (let index = 0; index < plan.count; index += 1) {
    spawnUnit(state, side, plan.def, index);
  }
  return plan.count;
}

function maxRoundsOf(config: MatchConfig): number {
  const value = config.maxRounds;
  return Number.isFinite(value) && value !== undefined && value > 0 ? Math.max(1, Math.floor(value)) : DEFAULT_MAX_ROUNDS;
}

function roundDurationOf(config: MatchConfig): number {
  const value = config.roundDuration;
  return Number.isFinite(value) && value > 0 ? Math.max(0.5, value) : 6;
}

function finish(state: BattleState, winner: Side | 'draw', x: number, y: number): void {
  if (state.winner !== null) return;
  state.winner = winner;
  state.events.push({
    kind: 'victory',
    x,
    y,
    side: winner === 'draw' ? 0 : winner,
    amount: winner === 'draw' ? -1 : Math.max(0, state.teams[winner].baseHp),
  });
}

function resolveRoundLimit(state: BattleState): void {
  if (state.winner !== null) return;
  const hp0 = state.teams[0].baseHp;
  const hp1 = state.teams[1].baseHp;
  if (Math.abs(hp0 - hp1) < 0.001) finish(state, 'draw', FIELD_WIDTH / 2, BASE_Y);
  else finish(state, hp0 > hp1 ? 0 : 1, FIELD_WIDTH / 2, BASE_Y);
}

function checkBases(state: BattleState): void {
  if (state.winner !== null) return;
  const side0Down = state.teams[0].baseHp <= 0;
  const side1Down = state.teams[1].baseHp <= 0;
  if (!side0Down && !side1Down) return;
  if (side0Down && side1Down) finish(state, 'draw', FIELD_WIDTH / 2, BASE_Y);
  else if (side0Down) finish(state, 1, BASE_X[0], BASE_Y);
  else finish(state, 0, BASE_X[1], BASE_Y);
}

/**
 * Runs one wave: settle both incomes, run both hooks (or the default AI),
 * then recruit with identical rules for both sides. Emits one `wave` event.
 */
function runWave(state: BattleState, decisionHook?: WaveDecision): void {
  state.round += 1;
  for (const side of SIDES) settleIncome(state, side);
  for (const side of SIDES) {
    if (!decisionHook && !isAISide(state, side)) continue;
    const choice = decisionHook ? decisionHook(state, side) : chooseAI(state, side);
    if (choice !== undefined) selectUnit(state, side, choice);
  }
  let spawned = 0;
  for (const side of SIDES) spawned += spawnWave(state, side);
  state.events.push({ kind: 'wave', x: FIELD_WIDTH / 2, y: BASE_Y, side: 0, amount: spawned });
  const duration = roundDurationOf(state.config);
  // The final recruits get a full window even when this tick overshot spawning.
  state.countdown = state.round >= maxRoundsOf(state.config) ? duration : state.countdown + duration;
}

/**
 * Advances by `dt` seconds (normally 1/30). When supplied, decisionHook replaces
 * built-in AI for both sides; undefined/illegal choices keep the prior selection.
 */
export function stepBattle(state: BattleState, dt: number, decisionHook?: WaveDecision): void {
  state.events.length = 0;
  if (state.winner !== null) return;
  const step = clamp(Number.isFinite(dt) ? dt : FIXED_DT, 0, 0.1);
  if (step <= 0) return;
  state.time += step;
  state.countdown -= step;
  let waves = 0;
  while (state.countdown <= 0 && state.winner === null && waves < 4) {
    if (state.round >= maxRoundsOf(state.config)) {
      resolveRoundLimit(state);
      break;
    }
    runWave(state, decisionHook);
    waves += 1;
  }
  if (state.winner !== null) return;
  updateUnits(state, step);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

function updateUnits(state: BattleState, dt: number): void {
  removeExpiredCorpses(state);
  const units = state.units;
  for (const unit of units) {
    if (!isAlive(unit)) continue;
    if (unit.cooldown > 0) unit.cooldown = Math.max(0, unit.cooldown - dt);
    unit.actionTime += dt;
  }
  acquireTargets(state);
  // Plan against the same frame snapshot; sorting only the motions preserves
  // the game's existing action/attack order while making movement order-stable.
  const motions = units.filter(isAlive).sort((a, b) => a.id - b.id).map((unit) => moveUnit(state, unit, dt));
  separateBodies(motions);
  for (const motion of motions) applyMotion(motion);
  for (const unit of units) {
    if (isAlive(unit)) performAction(state, unit);
  }
  checkBases(state);
}

function removeExpiredCorpses(state: BattleState): void {
  const now = state.time;
  let hasExpired = false;
  for (const unit of state.units) {
    if (unit.action === 'dead' && now - (unit.deathTime ?? now) > DEATH_LINGER) {
      hasExpired = true;
      break;
    }
  }
  if (!hasExpired) return;
  const map = runtimeStore.get(state);
  state.units = state.units.filter((unit) => {
    const expired = unit.action === 'dead' && now - (unit.deathTime ?? now) > DEATH_LINGER;
    if (expired) map?.delete(unit.id);
    return !expired;
  });
}

/**
 * Per-lane front lines used to steer distant frontal melee target selection.
 * `fronts[0][lane]` is the right-most side-0 unit, `fronts[1][lane]` the
 * left-most side-1 unit.
 */
function computeFronts(state: BattleState): [number[], number[]] {
  const fronts: [number[], number[]] = [
    new Array<number>(LANE_COUNT).fill(Number.NEGATIVE_INFINITY),
    new Array<number>(LANE_COUNT).fill(Number.POSITIVE_INFINITY),
  ];
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    const lane = laneOfY(unit.y);
    const row = fronts[unit.side];
    const current = row[lane] ?? (unit.side === 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
    row[lane] = unit.side === 0 ? Math.max(current, unit.x) : Math.min(current, unit.x);
  }
  return fronts;
}

function targetUnit(state: BattleState, unit: Fighter): Fighter | null {
  const id = unit.target;
  if (id === null || id === BASE_TARGET) return null;
  for (const candidate of state.units) {
    if (candidate.id !== id) continue;
    return isAlive(candidate) ? candidate : null;
  }
  return null;
}

function pickEnemy(state: BattleState, unit: Fighter, fronts: [number[], number[]]): Fighter | null {
  const dir = unit.side === 0 ? 1 : -1;
  const lane = laneOfY(unit.y);
  const def = defOf(unit.type);
  let best: Fighter | null = null;
  let bestInRange = false;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const enemy of state.units) {
    if (!isAlive(enemy) || enemy.side === unit.side) continue;
    const enemyLane = laneOfY(enemy.y);
    const row = fronts[enemy.side];
    const front = row[enemyLane];
    const inRange = distance(unit.x, unit.y, enemy.x, enemy.y) <= def.range + UNIT_RADIUS;
    if (!inRange && def.range < 120 && enemyLane === lane && front !== undefined &&
        Number.isFinite(front) && dir * (front - unit.x) >= 0 &&
        dir * (enemy.x - front) >= FRONT_WINDOW) {
      // Only protect a distant back row during a frontal melee approach.
      // A front behind the attacker (or in another lane) is not a barrier.
      continue;
    }
    const score =
      Math.abs(enemy.x - unit.x) +
      Math.abs(enemyLane - lane) * LANE_PENALTY +
      Math.abs(enemy.y - unit.y) * 0.25;
    if (best === null || (inRange && !bestInRange) || (inRange === bestInRange &&
        (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && enemy.id < best.id)))) {
      best = enemy;
      bestInRange = inRange;
      bestScore = score;
    }
  }
  return best;
}

function acquireTargets(state: BattleState): void {
  const fronts = computeFronts(state);
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    const def = defOf(unit.type);
    if (def.role === 'healer') {
      unit.target = null;
      continue;
    }
    if (canStrikeBase(state, unit, def)) {
      unit.target = BASE_TARGET;
      continue;
    }
    const enemy = pickEnemy(state, unit, fronts);
    unit.target = enemy ? enemy.id : BASE_TARGET;
  }
}

/**
 * True when the unit stands at the enemy fortress and nothing is engaging it.
 * This keeps fortresses damageable while reinforcement waves keep spawning;
 * defenders that spawn nearby are still fought first.
 */
function canStrikeBase(state: BattleState, unit: Fighter, def: UnitDef): boolean {
  const baseX = BASE_X[otherSide(unit.side)];
  if (Math.abs(unit.x - baseX) > def.range + BASE_RADIUS) return false;
  const engageRange = Math.max(80, def.range + 24);
  for (const enemy of state.units) {
    if (!isAlive(enemy) || enemy.side === unit.side) continue;
    if (distance(unit.x, unit.y, enemy.x, enemy.y) <= engageRange) return false;
  }
  return true;
}

function nearestWoundedAlly(state: BattleState, healer: Fighter, maxDistance: number): Fighter | null {
  let best: Fighter | null = null;
  let bestDistance = maxDistance;
  for (const ally of state.units) {
    if (ally.id === healer.id || ally.side !== healer.side || !isAlive(ally)) continue;
    if (ally.maxHp - ally.hp < 1) continue;
    const gap = distance(healer.x, healer.y, ally.x, ally.y);
    if (gap > bestDistance) continue;
    if (best === null || gap < bestDistance || (gap === bestDistance && ally.id < best.id)) {
      best = ally;
      bestDistance = gap;
    }
  }
  return best;
}

function friendlyFrontX(state: BattleState, side: Side, excludeId: number): number | null {
  let front: number | null = null;
  for (const unit of state.units) {
    if (unit.side !== side || unit.id === excludeId || !isAlive(unit)) continue;
    front = front === null ? unit.x : side === 0 ? Math.max(front, unit.x) : Math.min(front, unit.x);
  }
  return front;
}

function moveObjective(state: BattleState, unit: Fighter, def: UnitDef, target: Fighter | null): Objective {
  const dir = unit.side === 0 ? 1 : -1;
  if (def.role === 'healer') {
    const wounded = nearestWoundedAlly(state, unit, 320);
    if (wounded) return { x: wounded.x, y: wounded.y, stop: def.range * 0.7 };
    const front = friendlyFrontX(state, unit.side, unit.id);
    if (front !== null) return { x: front - dir * 70, y: unit.y, stop: 8 };
    return { x: unit.x, y: unit.y, stop: 0 };
  }
  if (!target) {
    return { x: BASE_X[otherSide(unit.side)], y: unit.y, stop: def.range + BASE_RADIUS * 0.8 };
  }
  // Leave room for a second melee row to strike without overlapping allies.
  return { x: target.x, y: target.y, stop: Math.max(MIN_SEPARATION, def.range * (def.range < 120 ? 0.6 : 0.78)) };
}

/**
 * Repositions a unit for one frame. Friendly units act as a soft queue and the
 * front-most body of each allied lane; enemies are impassable. When the queue
 * does not move for a moment the unit shifts into an emptier lane.
 */
function moveUnit(state: BattleState, unit: Fighter, dt: number): UnitMotion {
  const def = defOf(unit.type);
  const dir = unit.side === 0 ? 1 : -1;
  const runtime = runtimeOf(state, unit);
  if (runtime.laneTimer > 0) runtime.laneTimer = Math.max(0, runtime.laneTimer - dt);

  const target = def.role === 'healer' ? null : targetUnit(state, unit);
  const parking = yieldToMelee(state, unit, def, runtime);
  const objective = parking ?? moveObjective(state, unit, def, target);
  const speed = Math.max(0, def.speed);
  const startX = unit.x;
  const startY = unit.y;

  let goalY = objective.y;
  const laneY = laneCenterY(runtime.lane);
  if (Math.abs(unit.y - laneY) < 1) runtime.lane = laneOfY(unit.y);
  if (!parking && (runtime.laneTimer > 0 || runtime.lane !== laneOfY(unit.y))) {
    // Commit to the new lane while dodging a jam instead of sliding back.
    goalY = laneY;
  }

  let desiredX = unit.x;
  const dx = objective.x - unit.x;
  const gap = Math.abs(dx);
  if (gap > objective.stop) {
    const step = Math.min(speed * dt, gap - objective.stop);
    desiredX = unit.x + (dx >= 0 ? 1 : -1) * step;
  }

  const lateral = speed * 0.9 * dt;
  const dy = goalY - unit.y;
  const desiredY = Math.abs(dy) <= lateral ? goalY : unit.y + Math.sign(dy) * lateral;

  const limit = forwardLimit(state, unit, desiredY);
  let nextX = desiredX;
  // A queue can cancel forward intent, never manufacture a backwards step.
  if (dir * (desiredX - startX) > 0) {
    if (dir === 1) nextX = Math.min(nextX, Math.max(startX, limit));
    else nextX = Math.max(nextX, Math.min(startX, limit));
  }
  nextX = clamp(nextX, BASE_X[0] + 8, BASE_X[1] - 8);

  const blocked = dir * (desiredX - nextX) > 0.001;
  if (blocked) runtime.blocked += dt;
  else runtime.blocked = Math.max(0, runtime.blocked - dt * 1.5);
  if (runtime.blocked > 0.35 && runtime.laneTimer <= 0) shiftLane(state, unit, runtime);

  const nextY = clamp(desiredY, FIELD_TOP, FIELD_BOTTOM);
  return { unit, startX, startY, x: nextX, y: nextY, desiredX: nextX, desiredY: nextY };
}

function applyMotion(motion: UnitMotion): void {
  const { unit, startX, startY } = motion;
  unit.x = motion.x;
  unit.y = motion.y;
  const moved = Math.abs(unit.x - startX) > 0.01 || Math.abs(unit.y - startY) > 0.01;
  if (unit.action === 'hurt' && unit.actionTime < 0.12) return;
  if (moved) {
    unit.action = 'walk';
  } else if (unit.action === 'attack' && unit.actionTime < 0.18) {
    // keep the attack pose for a beat
  } else {
    unit.action = 'idle';
  }
}

/** Forward x limit from the local circular cross-section of bodies ahead. */
function forwardLimit(state: BattleState, unit: Fighter, y: number): number {
  const dir = unit.side === 0 ? 1 : -1;
  let limit = dir === 1 ? BASE_X[1] - 8 : BASE_X[0] + 8;
  for (const other of state.units) {
    if (other.id === unit.id || !isAlive(other)) continue;
    const ahead = dir * (other.x - unit.x);
    if (ahead <= 0) continue;
    const separation = other.side === unit.side ? FRIEND_GAP : MIN_SEPARATION;
    const dy = other.y - y;
    if (Math.abs(dy) >= separation) continue;
    const gap = Math.sqrt(separation * separation - dy * dy);
    limit = dir === 1 ? Math.min(limit, other.x - gap) : Math.max(limit, other.x + gap);
  }
  return limit;
}

function laneSpace(state: BattleState, unit: Fighter, lane: number): number {
  const dir = unit.side === 0 ? 1 : -1;
  const y = laneCenterY(lane);
  let space = 400;
  for (const other of state.units) {
    if (other.id === unit.id || !isAlive(other)) continue;
    if (Math.abs(other.y - y) > LANE_BAND) continue;
    const ahead = dir * (other.x - unit.x);
    if (ahead <= 0) continue;
    const gap = other.side === unit.side ? FRIEND_GAP : MIN_SEPARATION;
    space = Math.min(space, ahead - gap);
  }
  return Math.max(0, space);
}

/** Differential lane flow: move to a neighbouring lane when the current one jams. */
function shiftLane(state: BattleState, unit: Fighter, runtime: UnitRuntime): void {
  const current = laneOfY(unit.y);
  const currentSpace = laneSpace(state, unit, current);
  let bestLane = current;
  let bestSpace = currentSpace;
  for (const offset of [1, -1]) {
    const lane = current + offset;
    if (lane < 0 || lane >= LANE_COUNT) continue;
    const space = laneSpace(state, unit, lane);
    // Small openings matter in full-width queues; a 12px threshold discarded
    // the only usable route and forced units back into an occupied neighbour.
    if (space > bestSpace + 1) {
      bestSpace = space;
      bestLane = lane;
    }
  }
  if (bestLane === current && runtime.blocked > 1.6) {
    // Fully boxed in: alternate neighbours deterministically to break the jam.
    const lane = current + (unit.id % 2 === 0 ? 1 : -1);
    if (lane >= 0 && lane < LANE_COUNT) bestLane = lane;
  }
  if (bestLane === current) return;
  runtime.lane = bestLane;
  runtime.blocked = 0;
  runtime.laneTimer = 0.6;
}

/**
 * Open local role channels, not ghost allies: paired support lanes park in
 * staggered rows on odd lanes, leaving the even lanes for advancing melee.
 * Only nearby requests activate parking; all friendly body constraints remain.
 */
function yieldToMelee(state: BattleState, unit: Fighter, def: UnitDef, runtime: UnitRuntime): Objective | null {
  if (def.range < 120) return null;
  const dir = unit.side === 0 ? 1 : -1;
  let requested = false;
  for (const ally of state.units) {
    if (ally.side !== unit.side || !isAlive(ally) || defOf(ally.type).range >= 120) continue;
    const behind = dir * (unit.x - ally.x);
    if (behind < 0 || behind > 60 || Math.abs(ally.y - unit.y) > 30) continue;
    const target = targetUnit(state, ally);
    if (target && distance(ally.x, ally.y, target.x, target.y) <= defOf(ally.type).range + UNIT_RADIUS) continue;
    requested = true;
    break;
  }
  if (requested) {
    if (runtime.yieldUntil === undefined || runtime.yieldUntil < state.time) {
      const lane = laneOfY(unit.y);
      runtime.yieldY = laneCenterY(Math.min(LANE_COUNT - 1, lane - lane % 2 + 1));
      runtime.yieldX = clamp(unit.x - dir * (lane % 2 === 0 ? FRIEND_GAP * 1.5 : 0), BASE_X[0] + 8, BASE_X[1] - 8);
    }
    runtime.yieldUntil = state.time + 1.5;
  }
  if (runtime.yieldUntil === undefined || runtime.yieldUntil < state.time) return null;
  return { x: runtime.yieldX ?? unit.x, y: runtime.yieldY ?? unit.y, stop: 0 };
}

/** Apply a contact correction with a per-body, per-frame 13px total cap. */
function correctMotion(motion: UnitMotion, dx: number, dy: number): void {
  let cx = motion.x + dx - motion.desiredX;
  let cy = motion.y + dy - motion.desiredY;
  const length = Math.hypot(cx, cy);
  if (length > MIN_SEPARATION) {
    cx *= MIN_SEPARATION / length;
    cy *= MIN_SEPARATION / length;
  }
  motion.x = clamp(motion.desiredX + cx, BASE_X[0] + 8, BASE_X[1] - 8);
  motion.y = clamp(motion.desiredY + cy, FIELD_TOP, FIELD_BOTTOM);
}

/**
 * Bounded local circle contacts, including swept lateral crossings. Contact
 * normals come from the frame's geometry, never from faction left/right order.
 * Allied queues use the same solver with their larger 15px spacing.
 */
function separateBodies(motions: UnitMotion[]): void {
  // Dense boundary queues need extra convergence passes; ordinary frames exit early.
  for (let pass = 0; pass < 128; pass++) {
    let worst = 0;
    for (let i = 0; i < motions.length; i++) {
      const a = motions[i]!;
      for (let j = i + 1; j < motions.length; j++) {
        const b = motions[j]!;
        const separation = a.unit.side === b.unit.side ? FRIEND_GAP : MIN_SEPARATION;
        const sx = b.startX - a.startX, sy = b.startY - a.startY;
        const ex = b.x - a.x, ey = b.y - a.y;
        if (Math.min(sx, ex) > separation || Math.max(sx, ex) < -separation ||
            Math.min(sy, ey) > separation || Math.max(sy, ey) < -separation) continue;
        const vx = ex - sx, vy = ey - sy;
        const speed2 = vx * vx + vy * vy;
        const start2 = sx * sx + sy * sy;
        const radius2 = separation * separation;
        let nx = sx, ny = sy;
        if (start2 >= radius2 - 1e-8) {
          if (speed2 < 1e-16) continue;
          const dot = sx * vx + sy * vy;
          const closest = clamp(-dot / speed2, 0, 1);
          if ((sx + closest * vx) ** 2 + (sy + closest * vy) ** 2 >= radius2 - 1e-8) continue;
          const discriminant = Math.max(0, dot * dot - speed2 * (start2 - radius2));
          const contact = clamp((-dot - Math.sqrt(discriminant)) / speed2, 0, 1);
          nx = sx + contact * vx;
          ny = sy + contact * vy;
        }
        const normalLength = Math.hypot(nx, ny);
        if (normalLength > 1e-8) { nx /= normalLength; ny /= normalLength; }
        else { nx = 1; ny = 0; }
        const overlap = separation - ex * nx - ey * ny;
        if (overlap <= 1e-8) continue;
        worst = Math.max(worst, overlap);
        const push = (overlap + 1e-8) * 0.5;
        const ax = a.x, ay = a.y, bx = b.x, by = b.y;
        correctMotion(a, -nx * push, -ny * push);
        correctMotion(b, nx * push, ny * push);
        // Transfer a wall-clamped body's unspent share to the other body.
        const usedA = (ax - a.x) * nx + (ay - a.y) * ny;
        const usedB = (b.x - bx) * nx + (b.y - by) * ny;
        if (usedA < push - 1e-8) correctMotion(b, nx * (push - usedA), ny * (push - usedA));
        if (usedB < push - 1e-8) correctMotion(a, -nx * (push - usedB), -ny * (push - usedB));
      }
    }
    if (worst <= 1e-7) break;
  }
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export function damageOf(attacker: Fighter, target: Fighter, options: DamageOptions = {}): number {
  return computeDamage(defOf(attacker.type), defOf(target.type), {
    ...options,
    charge: options.charge ?? attacker.charge === true,
  });
}

function killUnit(state: BattleState, unit: Fighter, killer: Side): void {
  if (unit.action === 'dead') return;
  unit.hp = 0;
  unit.action = 'dead';
  unit.actionTime = 0;
  unit.deathTime = state.time;
  unit.target = null;
  unit.charge = false;
  const def = defOf(unit.type);
  const team = state.teams[unit.side];
  team.supplyUsed = Math.max(0, team.supplyUsed - def.supply);
  if (killer !== unit.side) state.teams[killer].kills += 1;
  state.events.push({ kind: 'death', x: unit.x, y: unit.y, side: unit.side, type: unit.type });
}

function splash(state: BattleState, attacker: Fighter, def: UnitDef, x: number, y: number, primaryId: number): void {
  for (const other of state.units) {
    if (other.id === primaryId || other.side === attacker.side || !isAlive(other)) continue;
    if (distance(x, y, other.x, other.y) > SPLASH_RADIUS) continue;
    const damage = computeDamage(def, defOf(other.type), { ranged: true, splash: true });
    other.hp = Math.max(0, other.hp - damage);
    state.teams[attacker.side].damage += damage;
    state.events.push({
      kind: 'shot',
      x: attacker.x,
      y: attacker.y,
      side: attacker.side,
      type: attacker.type,
      targetX: other.x,
      targetY: other.y,
      amount: damage,
    });
    if (other.hp <= 0) killUnit(state, other, attacker.side);
    else {
      other.action = 'hurt';
      other.actionTime = 0;
    }
  }
}

function strikeUnit(state: BattleState, attacker: Fighter, def: UnitDef, target: Fighter): void {
  const ranged = def.range >= 120;
  const damage = damageOf(attacker, target, { ranged });
  target.hp = Math.max(0, target.hp - damage);
  state.teams[attacker.side].damage += damage;
  const impactX = target.x;
  const impactY = target.y;
  attacker.cooldown = Math.max(0.2, def.cooldown);
  attacker.action = 'attack';
  attacker.actionTime = 0;
  state.events.push({
    kind: ranged ? 'shot' : 'hit',
    x: ranged ? attacker.x : impactX,
    y: ranged ? attacker.y : impactY,
    side: attacker.side,
    type: attacker.type,
    targetX: ranged ? impactX : attacker.x,
    targetY: ranged ? impactY : attacker.y,
    amount: damage,
  });
  if (attacker.charge) attacker.charge = false;
  if (def.role === 'firemage') splash(state, attacker, def, impactX, impactY, target.id);
  if (target.hp <= 0) {
    killUnit(state, target, attacker.side);
    return;
  }
  target.action = 'hurt';
  target.actionTime = 0;
}

function strikeBase(state: BattleState, attacker: Fighter, def: UnitDef, baseX: number): void {
  let damage = def.role === 'siege' ? def.heavyDamage * 3 : def.heavyDamage;
  if (attacker.charge) {
    damage *= 1.8;
    attacker.charge = false;
  }
  damage = Math.max(MIN_DAMAGE, Math.round(damage));
  const defender = state.teams[otherSide(attacker.side)];
  defender.baseHp = Math.max(0, defender.baseHp - damage);
  state.teams[attacker.side].damage += damage;
  attacker.cooldown = Math.max(0.2, def.cooldown);
  attacker.action = 'attack';
  attacker.actionTime = 0;
  if (def.range >= 120) state.events.push({
    kind: 'shot', x: attacker.x, y: attacker.y,
    side: attacker.side, type: attacker.type,
    targetX: baseX, targetY: BASE_Y,
  });
  state.events.push({
    kind: 'base',
    x: baseX,
    y: BASE_Y,
    side: attacker.side,
    type: attacker.type,
    amount: damage,
  });
  if (defender.baseHp <= 0) checkBases(state);
}

function healAlly(state: BattleState, healer: Fighter, def: UnitDef): boolean {
  let best: Fighter | null = null;
  let missing = 0;
  let bestDistance = def.range;
  for (const ally of state.units) {
    if (ally.id === healer.id || ally.side !== healer.side || !isAlive(ally)) continue;
    const missingHp = ally.maxHp - ally.hp;
    if (missingHp < 1) continue;
    const gap = distance(healer.x, healer.y, ally.x, ally.y);
    if (gap > def.range) continue;
    if (best === null || missingHp > missing || (missingHp === missing &&
        (gap < bestDistance || (gap === bestDistance && ally.id < best.id)))) {
      best = ally;
      missing = missingHp;
      bestDistance = gap;
    }
  }
  if (!best) return false;
  const amount = Math.min(HEAL_AMOUNT, missing);
  best.hp = Math.min(best.maxHp, best.hp + amount);
  healer.target = best.id;
  healer.cooldown = Math.max(0.2, def.cooldown);
  healer.action = 'attack';
  healer.actionTime = 0;
  state.events.push({
    kind: 'heal',
    x: best.x,
    y: best.y,
    side: healer.side,
    type: healer.type,
    targetX: healer.x,
    targetY: healer.y,
    amount,
  });
  return true;
}

function performAction(state: BattleState, unit: Fighter): void {
  if (unit.cooldown > 0) return;
  const def = defOf(unit.type);
  if (def.role === 'healer') {
    healAlly(state, unit, def);
    return;
  }
  const target = targetUnit(state, unit);
  if (target) {
    if (distance(unit.x, unit.y, target.x, target.y) <= def.range + UNIT_RADIUS) {
      strikeUnit(state, unit, def, target);
    }
    return;
  }
  if (unit.target !== BASE_TARGET) return;
  const baseX = BASE_X[otherSide(unit.side)];
  if (Math.abs(unit.x - baseX) <= def.range + BASE_RADIUS) strikeBase(state, unit, def, baseX);
}
