import { describe, expect, it } from 'vitest';
import { UNIT_BY_ID } from '../data/units';
import type { BattleState, Fighter, MatchConfig, Side } from './types';
import { createBattle, stepBattle } from './simulation';
import { BASE_X, FIELD_BOTTOM, FIELD_TOP, laneCenterY } from './math';

const DT = 1 / 30;
function battle(): BattleState {
  const config: MatchConfig = {
    mode: 'local', biome: 'plains', difficulty: 2, seed: 1, startingGold: 0,
    startingIncome: 0, supply: 80, growth: 1, roundDuration: 12, baseHp: 2500,
    ai: false, playerSide: 0, allowedUnits: Object.keys(UNIT_BY_ID), maxRounds: 80,
  };
  const state = createBattle(config);
  state.countdown = 1e9;
  return state;
}
function add(state: BattleState, side: Side, type: string, x: number, y: number): Fighter {
  const def = UNIT_BY_ID[type]!;
  const unit: Fighter = {
    id: state.nextId++, side, type, x, y, hp: def.hp, maxHp: def.hp,
    cooldown: 1e6, action: 'idle', actionTime: 0, target: null, born: 0, charge: false,
  };
  state.units.push(unit);
  state.teams[side].supplyUsed += def.supply;
  return unit;
}
function point(unit: Fighter) { return { x: unit.x, y: unit.y }; }
function sweptGap(a: {x: number; y: number}, b: {x: number; y: number}, endA: Fighter, endB: Fighter): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const vx = endB.x - endA.x - dx, vy = endB.y - endA.y - dy;
  const t = Math.max(0, Math.min(1, -(dx * vx + dy * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(dx + t * vx, dy + t * vy);
}

const walls: [string, Side, number, boolean][] = [
  ['axe', 0, DT, false], ['axe', 1, 0.1, true],
  ['guardian', 0, 0.1, true], ['guardian', 1, DT, false],
];
describe('local formation flow', () => {
  it.each(walls)('lets every %s behind a legal eight-lane bow wall engage (side=%s dt=%s reversed=%s)', (type, side, dt, reverse) => {
    const state = battle();
    const x = (value: number) => side === 0 ? value : 1280 - value;
    const enemySide = side === 0 ? 1 : 0;
    for (let lane = 0; lane < 8; lane++) {
      const enemy = add(state, enemySide, 'guardian', x(720), laneCenterY(lane));
      enemy.hp = enemy.maxHp = 1e6;
      add(state, side, 'bow', x(575), laneCenterY(lane));
    }
    const melee: Fighter[] = [];
    for (let row = 0; row < (type === 'axe' ? 2 : 1); row++) {
      for (let lane = 0; lane < 8; lane++) {
        const unit = add(state, side, type, x(500 - row * 15), laneCenterY(lane));
        unit.cooldown = 0;
        melee.push(unit);
      }
    }
    expect(state.teams.every((team) => team.supplyUsed <= 80)).toBe(true);
    if (reverse) state.units.reverse();
    const attacked = new Set<number>();
    let minimumFriendGap = Infinity;
    let maximumStep = 0;
    for (let tick = 0; tick < Math.ceil(20 / dt); tick++) {
      const before = new Map(state.units.map((unit) => [unit.id, point(unit)]));
      stepBattle(state, dt);
      for (const unit of melee) if (unit.action === 'attack') attacked.add(unit.id);
      for (const unit of state.units) {
        const start = before.get(unit.id)!;
        maximumStep = Math.max(maximumStep, Math.hypot(unit.x - start.x, unit.y - start.y));
        expect(unit.y).toBeGreaterThanOrEqual(FIELD_TOP);
        expect(unit.y).toBeLessThanOrEqual(FIELD_BOTTOM);
      }
      const friends = state.units.filter((unit) => unit.side === side);
      for (let i = 0; i < friends.length; i++) for (let j = i + 1; j < friends.length; j++) {
        minimumFriendGap = Math.min(minimumFriendGap, Math.hypot(friends[i]!.x - friends[j]!.x, friends[i]!.y - friends[j]!.y));
      }
    }
    const waiting = melee.filter((unit) => !attacked.has(unit.id)).map((unit) => ({ id: unit.id, x: unit.x, y: unit.y, target: unit.target }));
    expect(attacked.size, JSON.stringify({ waiting, minimumFriendGap })).toBe(melee.length);
    expect(minimumFriendGap).toBeGreaterThanOrEqual(15 - 1e-5);
    expect(maximumStep).toBeLessThanOrEqual(28 * 1.35 * dt + 13 + 1e-5);
  });

  it.each([0, 1] as const)('does not apply a 15px backwards queue snap to a stationary mage (side=%s)', (side) => {
    const state = battle();
    const x = (value: number) => side === 0 ? value : 1280 - value;
    const mage = add(state, side, 'mage', x(968), 375);
    add(state, side, 'healer', x(968.01), 387);
    add(state, side === 0 ? 1 : 0, 'guardian', x(1080), 375);
    const start = mage.x;
    stepBattle(state, DT);
    expect(Math.abs(mage.x - start)).toBeLessThan(0.1);
  });

  it.each([DT, 0.1])('does not project already-flanking enemies back into faction order (dt=%s)', (dt) => {
    const state = battle();
    const flanker = add(state, 0, 'assassin', 795, 375);
    const enemy = add(state, 1, 'guardian', 600, 375);
    stepBattle(state, dt);
    expect(Math.abs(flanker.x - 795)).toBeLessThanOrEqual(UNIT_BY_ID.assassin!.speed * dt + 1e-8);
    expect(Math.abs(enemy.x - 600)).toBeLessThanOrEqual(UNIT_BY_ID.guardian!.speed * dt + 1e-8);
    expect(flanker.x).toBeGreaterThan(enemy.x);
  });
});

describe('reinforcements at an occupied fortress', () => {
  it.each([0, 1] as const)('does not spawn a wave into parked support or shove it by a correction cap (side=%s)', (side) => {
    const state = battle();
    const x = (value: number) => side === 0 ? value : 1280 - value;
    const parked: Fighter[] = [];
    for (let lane = 0; lane < 8; lane++) {
      parked.push(add(state, side, 'ballista', x(150), laneCenterY(lane)));
      add(state, side === 0 ? 1 : 0, 'guardian', x(300), laneCenterY(lane));
    }
    state.config.supply = 100;
    state.teams[side].gold = 6000;
    state.teams[side].selected = 'runner';
    state.countdown = 0;
    const before = new Map(state.units.map(unit => [unit.id, point(unit)]));
    stepBattle(state, DT);
    const spawns = state.events.filter(event => event.kind === 'spawn');
    expect(spawns).toHaveLength(18);
    // Recruitment itself must provide legal positions, rather than relying on
    // the movement solver to explosively untangle an overlapping birth pile.
    let minimumBirthGap = Infinity;
    for (let i = 0; i < spawns.length; i++) {
      const born = spawns[i]!;
      for (const unit of before.values()) minimumBirthGap = Math.min(minimumBirthGap, Math.hypot(born.x - unit.x, born.y - unit.y));
      for (let j = 0; j < i; j++) minimumBirthGap = Math.min(minimumBirthGap, Math.hypot(born.x - spawns[j]!.x, born.y - spawns[j]!.y));
    }
    expect.soft(minimumBirthGap).toBeGreaterThanOrEqual(15 - 1e-5);
    let maximumParkedStep = 0, minimumFriendGap = Infinity;
    for (const unit of parked) {
      const start = before.get(unit.id)!;
      maximumParkedStep = Math.max(maximumParkedStep, Math.hypot(unit.x - start.x, unit.y - start.y));
    }
    const friends = state.units.filter(unit => unit.side === side);
    for (let i = 0; i < friends.length; i++) for (let j = i + 1; j < friends.length; j++) {
      minimumFriendGap = Math.min(minimumFriendGap, Math.hypot(friends[i]!.x - friends[j]!.x, friends[i]!.y - friends[j]!.y));
    }
    expect(maximumParkedStep).toBeLessThan(2);
    expect(minimumFriendGap).toBeGreaterThanOrEqual(15 - 1e-5);
  });

  it('chooses the same free birth slots without extra randomness or unit-array-order dependence', () => {
    const a = battle();
    a.countdown = 0;
    a.config.supply = 100;
    a.teams[0].gold = a.teams[1].gold = 6000;
    a.teams[0].selected = a.teams[1].selected = 'runner';
    for (let lane = 0; lane < 8; lane++) {
      add(a, 0, 'ballista', 150, laneCenterY(lane));
      add(a, 1, 'ballista', 1130, laneCenterY(lane));
    }
    const b = structuredClone(a);
    b.units.reverse();
    for (let tick = 0; tick < 30; tick++) {
      stepBattle(a, DT);
      stepBattle(b, DT);
      expect(a.rng).toBe(b.rng);
      expect(a.events.filter(event => event.kind === 'spawn')).toEqual(b.events.filter(event => event.kind === 'spawn'));
      const positions = (state: BattleState) => [...state.units].sort((left, right) => left.id - right.id).map(unit => [unit.id, unit.x, unit.y]);
      expect(positions(a)).toEqual(positions(b));
    }
  });
});

describe('cross-lane and boundary contacts', () => {
  it.each([DT, 0.1])('keeps swept enemy bodies separated and corrections bounded at dt=%s', (dt) => {
    for (const y of [FIELD_TOP, 375, FIELD_BOTTOM - 20]) {
      for (const x of [BASE_X[0] + 8, 625, BASE_X[1] - 50]) {
        const state = battle();
        const a = add(state, 0, 'runner', x + 30, y);
        const b = add(state, 1, 'runner', x, y + 20);
        for (let tick = 0; tick < Math.ceil(4 / dt); tick++) {
          const startA = point(a), startB = point(b);
          stepBattle(state, dt);
          expect(sweptGap(startA, startB, a, b)).toBeGreaterThanOrEqual(13 - 1e-5);
          for (const [unit, start] of [[a, startA], [b, startB]] as const) {
            expect(Math.hypot(unit.x - start.x, unit.y - start.y)).toBeLessThanOrEqual(52 * 1.35 * dt + 13 + 1e-5);
            expect(unit.x).toBeGreaterThanOrEqual(BASE_X[0] + 8);
            expect(unit.x).toBeLessThanOrEqual(BASE_X[1] - 8);
            expect(unit.y).toBeGreaterThanOrEqual(FIELD_TOP);
            expect(unit.y).toBeLessThanOrEqual(FIELD_BOTTOM);
          }
        }
      }
    }
  });

  it.each([DT, 0.1])('resolves dense full-width multi-body contacts, including boundary lanes (dt=%s)', (dt) => {
    const state = battle();
    for (let row = 0; row < 4; row++) for (let lane = 0; lane < 8; lane++) {
      add(state, 0, 'levy', 600 - row * 15, laneCenterY(lane));
      add(state, 1, 'levy', 650 + row * 15, laneCenterY(lane));
    }
    let minimumFriend = Infinity, minimumEnemy = Infinity, minimumSwept = Infinity, maximumStep = 0;
    for (let tick = 0; tick < Math.ceil(8 / dt); tick++) {
      const before = state.units.map(point);
      stepBattle(state, dt);
      for (let i = 0; i < state.units.length; i++) {
        const a = state.units[i]!;
        maximumStep = Math.max(maximumStep, Math.hypot(a.x - before[i]!.x, a.y - before[i]!.y));
        expect(a.y).toBeGreaterThanOrEqual(FIELD_TOP);
        expect(a.y).toBeLessThanOrEqual(FIELD_BOTTOM);
        for (let j = i + 1; j < state.units.length; j++) {
          const b = state.units[j]!;
          const gap = Math.hypot(a.x - b.x, a.y - b.y);
          if (a.side === b.side) minimumFriend = Math.min(minimumFriend, gap);
          else {
            minimumEnemy = Math.min(minimumEnemy, gap);
            minimumSwept = Math.min(minimumSwept, sweptGap(before[i]!, before[j]!, a, b));
          }
        }
      }
    }
    expect(minimumFriend).toBeGreaterThanOrEqual(15 - 1e-5);
    expect(minimumEnemy).toBeGreaterThanOrEqual(13 - 1e-5);
    expect(minimumSwept).toBeGreaterThanOrEqual(13 - 1e-5);
    expect(maximumStep).toBeLessThanOrEqual(31 * 1.35 * dt + 13 + 1e-5);
  });

  it('uses a stable frame snapshot rather than unit-array order for movement', () => {
    const a = battle();
    for (let i = 0; i < 6; i++) {
      add(a, 0, i % 2 ? 'axe' : 'bow', 550 + i * 16, laneCenterY(i));
      add(a, 1, 'guardian', 720 - i * 16, laneCenterY(7 - i));
    }
    const b = structuredClone(a);
    b.units.reverse();
    for (let tick = 0; tick < 120; tick++) {
      stepBattle(a, 0.1);
      stepBattle(b, 0.1);
      const positions = (state: BattleState) => [...state.units].sort((left, right) => left.id - right.id).map((unit) => [unit.id, unit.x, unit.y]);
      expect(positions(a)).toEqual(positions(b));
    }
  });
});
