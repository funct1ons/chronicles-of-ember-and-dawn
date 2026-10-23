import { describe, expect, it, vi } from 'vitest';
import * as ai from './ai';
import type { BattleState, Fighter, MatchConfig, Side } from './types';
import { UNIT_BY_ID } from '../data/units';
import {
  BASE_TARGET,
  DEATH_LINGER,
  FIELD_WIDTH,
  GOLD_CAP,
  MAX_INCOME,
  START_COUNTDOWN,
  WAVE_UNIT_CAP,
  computeDamage,
  createBattle,
  damageOf,
  previewWave,
  selectUnit,
  stepBattle,
} from './simulation';
import { allowedUnitsFor } from './ai';
import { laneOfY, BASE_X, BASE_Y } from './math';
import type { WaveDecision } from './simulation';

const ALL_UNITS = [
  'levy',
  'runner',
  'shield',
  'pike',
  'axe',
  'bow',
  'crossbow',
  'rider',
  'knight',
  'mage',
  'healer',
  'ballista',
  'assassin',
  'guardian',
  'firemage',
  'paladin',
];

const DT = 1 / 30;

function config(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    mode: 'local',
    biome: 'plains',
    difficulty: 2,
    seed: 1,
    startingGold: 0,
    startingIncome: 0,
    supply: 40,
    growth: 1,
    roundDuration: 6,
    baseHp: 2500,
    ai: false,
    playerSide: 0,
    allowedUnits: [...ALL_UNITS],
    maxRounds: 80,
    ...over,
  };
}

function laneY(lane: number): number {
  return 315 + lane * 20;
}

function advance(state: BattleState, seconds: number): void {
  const steps = Math.max(1, Math.round(seconds / DT));
  for (let step = 0; step < steps; step += 1) stepBattle(state, DT);
}

/** Stops wave spawning so combat tests stay isolated. */
function quiet(state: BattleState): BattleState {
  state.countdown = 1e9;
  return state;
}

function addUnit(
  state: BattleState,
  side: Side,
  type: string,
  x: number,
  y: number,
  over: Partial<Fighter> = {},
): Fighter {
  const def = UNIT_BY_ID[type];
  if (!def) throw new Error(`unknown unit ${type}`);
  const unit: Fighter = {
    id: state.nextId,
    side,
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    cooldown: 0,
    action: 'idle',
    actionTime: 0,
    target: null,
    born: state.time,
    charge: def.role === 'cavalry' || def.role === 'knight' || def.role === 'elite',
    ...over,
  };
  state.nextId += 1;
  state.units.push(unit);
  state.teams[side].supplyUsed += def.supply;
  return unit;
}

function unitDef(id: string) {
  const def = UNIT_BY_ID[id];
  if (!def) throw new Error(`unknown unit ${id}`);
  return def;
}

describe('createBattle', () => {
  it('sets up a fresh battle from the config', () => {
    const state = createBattle(config({ startingGold: 120, startingIncome: 33, baseHp: 3000, seed: 9 }));
    expect(state.time).toBe(0);
    expect(state.round).toBe(0);
    expect(state.countdown).toBe(START_COUNTDOWN);
    expect(START_COUNTDOWN).toBe(6);
    expect(state.units).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.winner).toBeNull();
    expect(state.teams[0].gold).toBe(120);
    expect(state.teams[0].income).toBe(33);
    expect(state.teams[0].baseHp).toBe(3000);
    expect(state.teams[0].supplyUsed).toBe(0);
    expect(state.teams[1].baseHp).toBe(3000);
    expect(state.teams[0].selected).toBe('levy');
    expect(state.teams[1].selected).toBe('levy');
    expect(FIELD_WIDTH).toBe(1280);
    expect(state.nextId).toBe(1);
  });

  it('honours enemyAllowedUnits for the non-player side', () => {
    const state = createBattle(config({ playerSide: 0, enemyAllowedUnits: ['levy'] }));
    expect(allowedUnitsFor(state.config, 1)).toEqual(['levy']);
    expect(selectUnit(state, 1, 'shield')).toBe(false);
    expect(selectUnit(state, 0, 'shield')).toBe(true);
  });
});

describe('waves and economy', () => {
  it('settles income before buying units', () => {
    // 20 gold + 10 income = 30, so exactly one 24g levy can be bought and 6g remain.
    // Buying first would have left 30 gold in the bank instead.
    const state = createBattle(
      config({ startingGold: 20, startingIncome: 10, allowedUnits: ['levy'], roundDuration: 6 }),
    );
    advance(state, 6.5);
    expect(state.round).toBe(1);
    expect(state.teams[0].gold).toBe(6);
    expect(state.teams[0].income).toBe(16);
    expect(state.teams[0].supplyUsed).toBe(1);
    expect(state.teams[0].spent).toBe(24);
    expect(state.teams[0].recruited).toBe(1);
    expect(state.units.filter((unit) => unit.side === 0 && unit.action !== 'dead')).toHaveLength(1);
  });

  it('carries leftover gold between waves and emits one wave event', () => {
    const state = createBattle(
      config({ startingGold: 0, startingIncome: 10, allowedUnits: ['levy'], roundDuration: 6 }),
    );
    let waveEvents = 0;
    const steps = Math.round(18.5 / DT);
    for (let step = 0; step < steps; step += 1) {
      stepBattle(state, DT);
      waveEvents += state.events.filter((event) => event.kind === 'wave').length;
    }
    expect(waveEvents).toBe(3);
    expect(state.round).toBe(3);
    // 10 + 10 + 10 = 30, one levy costs 24 -> 6 left, income 10 + 6.
    expect(state.teams[0].gold).toBe(6);
    expect(state.teams[0].income).toBe(16);
    expect(state.teams[0].earned).toBe(30);
    expect(state.units.filter((unit) => unit.side === 0)).toHaveLength(1);
  });

  it('caps a wave at 18 units and keeps the leftover gold', () => {
    const state = createBattle(
      config({ startingGold: 100000, startingIncome: 0, supply: 100, allowedUnits: ['levy'] }),
    );
    advance(state, 6.5);
    expect(state.units.filter((unit) => unit.side === 0)).toHaveLength(WAVE_UNIT_CAP);
    expect(state.teams[0].supplyUsed).toBe(18);
    expect(state.teams[0].gold).toBe(GOLD_CAP - 18 * 24);
    expect(state.teams[0].gold).toBe(5568);
  });

  it('never buys past the supply cap', () => {
    const state = createBattle(
      config({ startingGold: 1000, startingIncome: 0, supply: 4, allowedUnits: ['levy'], roundDuration: 2 }),
    );
    advance(state, 10.5);
    expect(state.round).toBe(3);
    expect(state.teams[0].supplyUsed).toBe(4);
    expect(state.units.filter((unit) => unit.side === 0)).toHaveLength(4);
    expect(previewWave(state, 0)).toEqual({ count: 0, cost: 0, income: 0, supply: 0 });
  });

  it('scales income growth and clamps it at MAX_INCOME', () => {
    const grown = createBattle(
      config({ startingGold: 96, startingIncome: 0, supply: 40, allowedUnits: ['levy'], growth: 2 }),
    );
    advance(grown, 6.5);
    expect(grown.teams[0].recruited).toBe(4);
    expect(grown.teams[0].income).toBe(48);

    const capped = createBattle(
      config({ startingGold: 0, startingIncome: 590, supply: 40, allowedUnits: ['levy'], growth: 2 }),
    );
    advance(capped, 6.5);
    expect(capped.teams[0].income).toBe(MAX_INCOME);
    expect(MAX_INCOME).toBe(600);
  });

  it('treats growth = 0 as no income growth (not as full growth)', () => {
    const state = createBattle(
      config({ startingGold: 96, startingIncome: 0, supply: 40, allowedUnits: ['levy'], growth: 0 }),
    );
    expect(previewWave(state, 0)).toEqual({ count: 4, cost: 96, income: 0, supply: 4 });
    advance(state, 6.5);
    expect(state.teams[0].recruited).toBe(4);
    expect(state.teams[0].income).toBe(0);
    expect(state.teams[0].gold).toBe(0);
    expect(previewWave(state, 0)).toEqual({ count: 0, cost: 0, income: 0, supply: 0 });
  });

  it('caps settled gold at GOLD_CAP', () => {
    const state = createBattle(
      config({ startingGold: 5900, startingIncome: 200, supply: 0, allowedUnits: ['levy'] }),
    );
    advance(state, 6.5);
    expect(state.teams[0].gold).toBe(GOLD_CAP);
    expect(GOLD_CAP).toBe(6000);
  });
});

describe('selection and preview', () => {
  it('only selects allowed units and previews the exact wave purchase', () => {
    const state = createBattle(
      config({ startingGold: 96, startingIncome: 0, supply: 10, allowedUnits: ['levy', 'shield'] }),
    );
    expect(selectUnit(state, 0, 'shield')).toBe(true);
    expect(selectUnit(state, 0, 'knight')).toBe(false);
    expect(selectUnit(state, 0, 'not-a-unit')).toBe(false);
    expect(previewWave(state, 0)).toEqual({ count: 1, cost: 65, income: 10, supply: 2 });
    advance(state, 6.5);
    expect(state.teams[0].gold).toBe(31);
    expect(state.teams[0].income).toBe(10);
    expect(state.teams[0].supplyUsed).toBe(2);
    expect(state.units.filter((unit) => unit.side === 0 && unit.type === 'shield')).toHaveLength(1);
  });

  it('previews zero when the selection is unaffordable', () => {
    const state = createBattle(config({ startingGold: 10, startingIncome: 0, allowedUnits: ['knight'] }));
    expect(selectUnit(state, 0, 'knight')).toBe(true);
    expect(previewWave(state, 0)).toEqual({ count: 0, cost: 0, income: 0, supply: 0 });
  });
});

describe('damage model', () => {
  it('picks light or heavy damage for the target armour', () => {
    const axe = unitDef('axe');
    const levy = unitDef('levy');
    const shield = unitDef('shield');
    const lightHit = computeDamage(axe, levy);
    const heavyHit = computeDamage(axe, shield);
    expect(lightHit).toBe(29); // 30 - 1 defence
    expect(heavyHit).toBe(47); // 53 - 6 defence
    expect(heavyHit).toBeGreaterThan(lightHit);
  });

  it('lets mages ignore defence while shields soften ranged physical damage', () => {
    const mage = unitDef('mage');
    const crossbow = unitDef('crossbow');
    const bow = unitDef('bow');
    const shield = unitDef('shield');
    const guardian = unitDef('guardian');
    const levy = unitDef('levy');
    expect(computeDamage(mage, shield)).toBe(48); // full heavy damage, no defence subtraction
    expect(computeDamage(crossbow, shield)).toBe(22); // (43 * 0.65) - 6 shield wall
    expect(computeDamage(crossbow, shield)).toBeLessThan(computeDamage(crossbow, shield, { ranged: false }));
    expect(computeDamage(mage, shield)).toBeGreaterThan(computeDamage(crossbow, shield));
    expect(computeDamage(bow, shield)).toBe(2); // heavy armour + shield wall clamp
    expect(computeDamage(bow, levy)).toBe(24); // 25 - 1 defence, no shield bonus against light infantry
    expect(computeDamage(crossbow, guardian)).toBeLessThan(computeDamage(crossbow, guardian, { ranged: false }));
  });

  it('doubles pike damage against cavalry and applies the charge strike', () => {
    const pike = unitDef('pike');
    const rider = unitDef('rider');
    const knight = unitDef('knight');
    const levy = unitDef('levy');
    expect(computeDamage(pike, rider)).toBe(41); // 22 * 2 - 3
    expect(computeDamage(pike, knight)).toBe(45); // 26 * 2 - 7
    expect(computeDamage(rider, levy, { charge: true })).toBe(62); // 35 * 1.8 - 1
    expect(computeDamage(rider, levy)).toBe(34);
  });

  it('never deals less than the minimum damage', () => {
    const runner = unitDef('runner');
    const guardian = unitDef('guardian');
    expect(computeDamage(runner, guardian)).toBe(2); // 7 - 10 clamps to 2
  });

  it('applies hits and clears the event list every step', () => {
    const state = quiet(createBattle(config()));
    const axe = addUnit(state, 0, 'axe', 400, laneY(3));
    const levy = addUnit(state, 1, 'levy', 415, laneY(3));
    const axe2 = addUnit(state, 0, 'axe', 400, laneY(6));
    const shield = addUnit(state, 1, 'shield', 415, laneY(6));
    stepBattle(state, DT);
    expect(levy.hp).toBe(unitDef('levy').hp - 29);
    expect(shield.hp).toBe(unitDef('shield').hp - 47);
    expect(state.events.some((event) => event.kind === 'hit' && event.side === 0)).toBe(true);
    expect(state.teams[0].damage).toBeGreaterThanOrEqual(29 + 47);
    expect(axe.cooldown).toBeGreaterThan(0);
    // A second immediate step cannot attack again, and events start empty.
    stepBattle(state, DT);
    expect(state.events).toHaveLength(0);
    expect(levy.hp).toBe(unitDef('levy').hp - 29);
    expect(axe2.hp).toBeGreaterThan(0);
    expect(damageOf(axe, levy)).toBe(29);
  });

  it('splashes fireballs onto nearby enemies', () => {
    const state = quiet(createBattle(config()));
    const fire = addUnit(state, 0, 'firemage', 400, laneY(3));
    const primary = addUnit(state, 1, 'levy', 520, laneY(3));
    const neighbour = addUnit(state, 1, 'levy', 540, laneY(4));
    stepBattle(state, DT);
    expect(fire.target).toBe(primary.id);
    expect(primary.hp).toBe(30); // 40 magic damage
    expect(neighbour.hp).toBe(50); // 50% splash
    expect(state.events.filter((event) => event.kind === 'shot' && event.type === 'firemage')).toHaveLength(2);
  });

  it('heals wounded allies', () => {
    const state = quiet(createBattle(config()));
    const healer = addUnit(state, 0, 'healer', 400, laneY(3));
    const wounded = addUnit(state, 0, 'levy', 440, laneY(3), { hp: 10 });
    addUnit(state, 1, 'levy', 900, laneY(3));
    stepBattle(state, DT);
    expect(wounded.hp).toBe(34);
    expect(healer.action).toBe('attack');
    expect(state.events.some((event) => event.kind === 'heal' && event.amount === 24)).toBe(true);
  });

  it.each([false, true])('heals the most wounded ally regardless of array order (reverse=%s)', (reverse) => {
    const state = quiet(createBattle(config()));
    const healer = addUnit(state, 0, 'healer', 400, laneY(3));
    const near = addUnit(state, 0, 'shield', 420, laneY(3), { hp: 249, cooldown: 100 });
    const far = addUnit(state, 0, 'guardian', 500, laneY(3), { hp: 100, cooldown: 100 });
    if (reverse) state.units.reverse();
    stepBattle(state, DT);
    expect(healer.target).toBe(far.id);
    expect(far.hp).toBe(124);
    expect(near.hp).toBe(249);
    expect(state.events.find((event) => event.kind === 'heal')?.amount).toBe(24);
  });

  it('breaks healing ties by distance, then stable id, inside the full range', () => {
    const state = quiet(createBattle(config()));
    const healer = addUnit(state, 0, 'healer', 400, laneY(3));
    const far = addUnit(state, 0, 'shield', 500, laneY(3), { hp: 200 });
    const near = addUnit(state, 0, 'shield', 420, laneY(3), { hp: 200 });
    addUnit(state, 0, 'guardian', 600, laneY(3), { hp: 1 });
    stepBattle(state, DT);
    expect(healer.target).toBe(near.id);
    expect(near.hp).toBe(224);
    expect(far.hp).toBe(200);
  });

  it.each([false, true])('breaks equal-distance healing ties by stable id (reverse=%s)', (reverse) => {
    const state = quiet(createBattle(config()));
    const healer = addUnit(state, 0, 'healer', 400, 375);
    const first = addUnit(state, 0, 'shield', 420, 355, { hp: 200 });
    const second = addUnit(state, 0, 'shield', 420, 395, { hp: 200 });
    if (reverse) state.units.reverse();
    stepBattle(state, DT);
    expect(healer.target).toBe(first.id);
    expect(first.hp).toBe(224);
    expect(second.hp).toBe(200);
  });

  it('emits shots from the attacker to each impact, while hits stay at the impact', () => {
    const state = quiet(createBattle(config()));
    const fire = addUnit(state, 0, 'firemage', 400, laneY(3));
    const primary = addUnit(state, 1, 'guardian', 520, laneY(3));
    const splashTarget = addUnit(state, 1, 'guardian', 540, laneY(4));
    const axe = addUnit(state, 0, 'axe', 700, laneY(7));
    const victim = addUnit(state, 1, 'guardian', 720, laneY(7));
    stepBattle(state, DT);
    const shots = state.events.filter((event) => event.kind === 'shot' && event.side === 0);
    expect(shots).toHaveLength(2);
    for (const shot of shots) {
      expect([shot.x, shot.y]).toEqual([fire.x, fire.y]);
    }
    expect(shots.map((event) => [event.targetX, event.targetY])).toEqual([
      [primary.x, primary.y], [splashTarget.x, splashTarget.y],
    ]);
    const hit = state.events.find((event) => event.kind === 'hit' && event.type === axe.type && event.side === 0);
    expect([hit?.x, hit?.y]).toEqual([victim.x, victim.y]);
  });

  it('deals triple siege damage to the fortress', () => {
    const state = quiet(createBattle(config({ baseHp: 2500 })));
    const artillery=addUnit(state, 0, 'ballista', 1050, laneY(3));
    stepBattle(state, DT);
    expect(state.teams[1].baseHp).toBe(2500 - 76 * 3);
    expect(state.events.some((event) => event.kind === 'base' && event.amount === 228)).toBe(true);
    const projectile=state.events.find(event=>event.kind==='shot'&&event.type==='ballista');
    expect([projectile?.x,projectile?.y]).toEqual([artillery.x,artillery.y]);
    expect([projectile?.targetX,projectile?.targetY]).toEqual([BASE_X[1],BASE_Y]);
    expect(state.teams[0].damage).toBe(228);
  });
});

describe('targeting and front line', () => {
  it('does not dive past the enemy front row to chase a backline archer', () => {
    const state = quiet(createBattle(config()));
    const attacker = addUnit(state, 1, 'axe', 600, laneY(3));
    const shield = addUnit(state, 0, 'shield', 560, laneY(3));
    addUnit(state, 0, 'bow', 350, laneY(3));
    stepBattle(state, DT);
    expect(attacker.target).toBe(shield.id);
    expect(attacker.target).not.toBe(BASE_TARGET);
  });

  it('prefers enemies in the same lane', () => {
    const state = quiet(createBattle(config()));
    const attacker = addUnit(state, 1, 'axe', 600, laneY(3));
    const sameLane = addUnit(state, 0, 'shield', 560, laneY(3));
    addUnit(state, 0, 'shield', 500, laneY(5));
    stepBattle(state, DT);
    expect(attacker.target).toBe(sameLane.id);
  });

  it('prefers an enemy already in range over an out-of-range same-lane target', () => {
    const state = quiet(createBattle(config()));
    const bow = addUnit(state, 0, 'bow', 500, 375);
    const guardian = addUnit(state, 1, 'guardian', 650, 315, { cooldown: 100 });
    addUnit(state, 1, 'mage', 740, 375, { cooldown: 100 });
    stepBattle(state, DT);
    expect(bow.target).toBe(guardian.id);
    expect(guardian.hp).toBeLessThan(guardian.maxHp);
  });

  it.each([0, 1] as const)('does not give a nearby backline immunity from a front behind side %s', (side) => {
    const state = quiet(createBattle(config()));
    const x = (value: number) => side === 0 ? value : 1280 - value;
    const attacker = addUnit(state, side, 'assassin', x(795), 375);
    addUnit(state, side === 0 ? 1 : 0, 'guardian', x(600), 375, { cooldown: 100 });
    const mage = addUnit(state, side === 0 ? 1 : 0, 'mage', x(810), 375, { cooldown: 100 });
    stepBattle(state, DT);
    expect(attacker.target).toBe(mage.id);
    expect(mage.hp).toBeLessThan(mage.maxHp);
  });

  it('march on the enemy fortress when no defenders remain', () => {
    const state = quiet(createBattle(config()));
    const attacker = addUnit(state, 0, 'levy', 500, laneY(3));
    stepBattle(state, DT);
    expect(attacker.target).toBe(BASE_TARGET);
  });
});

describe('crowd control', () => {
  it('prevents opposing units from passing through each other', () => {
    const state = quiet(createBattle(config()));
    const left = addUnit(state, 0, 'guardian', 500, laneY(3));
    const right = addUnit(state, 1, 'guardian', 510, laneY(3));
    let smallestGap = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 150; step += 1) {
      stepBattle(state, DT);
      smallestGap = Math.min(smallestGap, right.x - left.x);
    }
    expect(smallestGap).toBeGreaterThan(12);
    expect(left.x).toBeLessThan(right.x);
    expect(left.hp).toBeGreaterThan(0);
    expect(right.hp).toBeGreaterThan(0);
  });

  it('diffuses a queued column into free lanes instead of deadlocking', () => {
    const state = quiet(createBattle(config()));
    const defender = addUnit(state, 1, 'guardian', 700, laneY(3), { hp: 3000, maxHp: 3000 });
    const queue: Fighter[] = [];
    for (let index = 0; index < 6; index += 1) {
      queue.push(addUnit(state, 0, 'axe', 480 + index * 15, laneY(3)));
    }
    let spread = 0;
    let closest = 480;
    for (let step = 0; step < 300; step += 1) {
      stepBattle(state, DT);
      const lanes = new Set(queue.filter((unit) => unit.action !== 'dead').map((unit) => laneOfY(unit.y)));
      spread = Math.max(spread, lanes.size);
      closest = Math.max(closest, ...queue.map((unit) => unit.x));
    }
    expect(spread).toBeGreaterThan(1);
    expect(closest).toBeGreaterThan(620);
    expect(defender.hp).toBeLessThan(3000);
    expect(queue.some((unit) => unit.action !== 'dead')).toBe(true);
  });

  it('releases supply on death and removes corpses after the linger timer', () => {
    const state = quiet(createBattle(config()));
    const killer = addUnit(state, 0, 'axe', 400, laneY(3));
    const victim = addUnit(state, 1, 'levy', 415, laneY(3), { hp: 1 });
    advance(state, 0.2);
    expect(victim.action).toBe('dead');
    expect(victim.hp).toBe(0);
    expect(state.teams[1].supplyUsed).toBe(0);
    expect(state.teams[0].kills).toBe(1);
    expect(state.units.some((unit) => unit.id === victim.id)).toBe(true);
    advance(state, DEATH_LINGER + 0.3);
    expect(state.units.some((unit) => unit.id === victim.id)).toBe(false);
    expect(killer.hp).toBeGreaterThan(0);
  });
});

describe('match flow', () => {
  it('lets the AI recruit with the income settled in the same wave', () => {
    const state = createBattle(
      config({
        ai: true,
        playerSide: 0,
        startingGold: 0,
        startingIncome: 500,
        difficulty: 4,
        roundDuration: 6,
        allowedUnits: ALL_UNITS,
      }),
    );
    advance(state, 6.5);
    expect(state.round).toBe(1);
    expect(state.units.some((unit) => unit.side === 0)).toBe(true);
    expect(state.units.some((unit) => unit.side === 1)).toBe(true);
    expect(state.teams[1].recruited).toBeGreaterThan(0);
  });

  it('keeps default AI on only the non-player side, after both incomes and before spawning', () => {
    const state = createBattle(config({ ai: true, playerSide: 1, startingGold: 20, startingIncome: 100, allowedUnits: ['levy', 'shield'] }));
    state.countdown = DT;
    const observed: unknown[] = [];
    const picker = vi.spyOn(ai, 'chooseAI').mockImplementation((battle, side) => {
      observed.push({ side, round: battle.round, gold: battle.teams.map((team) => team.gold), units: battle.units.length });
      return 'shield';
    });
    try {
      stepBattle(state, DT);
      expect(observed).toEqual([{ side: 0, round: 1, gold: [120, 120], units: 0 }]);
      expect(picker).toHaveBeenCalledTimes(1);
      expect(state.teams.map((team) => team.selected)).toEqual(['shield', 'levy']);
      expect(state.teams.map((team) => team.recruited)).toEqual([1, 5]);
    } finally {
      picker.mockRestore();
    }
  });

  it('runs both decision hooks after both incomes, and before either spawn', () => {
    const state = createBattle(config({ ai: true, startingGold: 20, startingIncome: 100, allowedUnits: ['levy', 'shield'] }));
    state.countdown = DT;
    const seen: unknown[] = [];
    const hook: WaveDecision = (battle, side) => {
      seen.push({ side, round: battle.round, gold: battle.teams.map((team) => team.gold), units: battle.units.length });
      return side === 0 ? 'shield' : 'levy';
    };
    stepBattle(state, DT, hook);
    expect(seen).toEqual([
      { side: 0, round: 1, gold: [120, 120], units: 0 },
      { side: 1, round: 1, gold: [120, 120], units: 0 },
    ]);
    expect(state.teams.map((team) => team.selected)).toEqual(['shield', 'levy']);
    expect(state.teams.map((team) => team.recruited)).toEqual([1, 5]);
    expect(state.units.filter((unit) => unit.side === 1).every((unit) => unit.type === 'levy')).toBe(true);
  });

  it('keeps selections for undefined/illegal hook returns, without falling back to built-in AI', () => {
    const state = createBattle(config({ ai: true, difficulty: 0, startingGold: 500, allowedUnits: ['levy', 'knight'] }));
    selectUnit(state, 0, 'knight');
    selectUnit(state, 1, 'knight');
    state.countdown = DT;
    const control = structuredClone(state);
    control.config.ai = false;
    stepBattle(control, DT);
    const picker = vi.spyOn(ai, 'chooseAI');
    try {
      stepBattle(state, DT, (_battle, side) => side === 0 ? 'bow' : undefined);
      expect(picker).not.toHaveBeenCalled();
    } finally {
      picker.mockRestore();
    }
    expect(state.rng).toBe(control.rng);
    expect(state.units).toEqual(control.units);
    expect(state.teams.map((team) => team.selected)).toEqual(['knight', 'knight']);
    expect(state.units).toHaveLength(4);
    expect(state.units.every((unit) => unit.type === 'knight')).toBe(true);
  });

  it('gives the final wave a full combat window without spawning or settling another wave', () => {
    const state = createBattle(config({ maxRounds: 1, roundDuration: 1, startingGold: 24, allowedUnits: ['levy'] }));
    state.countdown = DT;
    stepBattle(state, DT);
    expect(state.round).toBe(1);
    expect(state.winner).toBeNull();
    expect(state.units).toHaveLength(2);
    const spawnedAt = state.time;
    const startX = state.units[0]!.x;
    advance(state, 0.9);
    expect(state.winner).toBeNull();
    expect(state.units[0]!.x).toBeGreaterThan(startX);
    advance(state, 0.2);
    expect(state.winner).toBe('draw');
    expect(state.time - spawnedAt).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(state.round).toBe(1);
    expect(state.teams.map((team) => team.recruited)).toEqual([1, 1]);
    expect(state.teams.map((team) => team.earned)).toEqual([0, 0]);
  });

  it('allows the final recruits to actually fight after their spawn frame', () => {
    const state = createBattle(config({ maxRounds: 1, roundDuration: 2, startingGold: 24, supply: 80, allowedUnits: ['levy'] }));
    state.teams[1].gold = 0;
    state.countdown = 0.01; // Deliberately overshoot the wave boundary at dt=0.1.
    for (let lane = 0; lane < 8; lane++) {
      addUnit(state, 1, 'guardian', 150, laneY(lane), { hp: 1e6, maxHp: 1e6, cooldown: 1e6 });
    }
    stepBattle(state, 0.1);
    expect(state.winner).toBeNull();
    const spawnedAt = state.time;
    let attackedAfterSpawn = false;
    for (let tick = 0; tick < 19; tick++) {
      stepBattle(state, 0.1);
      if (state.events.some((event) => event.kind === 'hit' && event.side === 0)) attackedAfterSpawn = true;
      expect(state.winner).toBeNull();
    }
    expect(attackedAfterSpawn).toBe(true);
    for (let tick = 0; tick < 2 && state.winner === null; tick++) stepBattle(state, 0.1);
    expect(state.winner).toBe('draw');
    expect(state.time - spawnedAt).toBeGreaterThanOrEqual(2 - 1e-9);
    expect(state.round).toBe(1);
    expect(state.teams[0].recruited).toBe(1);
  });

  it('declares a draw when both fortresses fall together', () => {
    const state = quiet(createBattle(config()));
    state.teams[0].baseHp = 0;
    state.teams[1].baseHp = 0;
    stepBattle(state, DT);
    expect(state.winner).toBe('draw');
    expect(state.events.some((event) => event.kind === 'victory')).toBe(true);
    const time = state.time;
    stepBattle(state, DT);
    expect(state.time).toBe(time);
  });

  it('ends the battle when a fortress is destroyed', () => {
    const state = quiet(createBattle(config({ baseHp: 100 })));
    addUnit(state, 0, 'ballista', 1050, laneY(3));
    stepBattle(state, DT);
    expect(state.teams[1].baseHp).toBe(0);
    expect(state.winner).toBe(0);
    expect(state.events.some((event) => event.kind === 'victory' && event.side === 0)).toBe(true);
  });

  it('resolves the round limit on fortress health', () => {
    const state = createBattle(
      config({ maxRounds: 2, roundDuration: 1, startingGold: 0, startingIncome: 0, allowedUnits: ['levy'] }),
    );
    state.teams[1].baseHp = 1000;
    let sawVictory = false;
    const steps = Math.round(8.5 / DT);
    for (let step = 0; step < steps; step += 1) {
      stepBattle(state, DT);
      if (state.events.some((event) => event.kind === 'victory')) sawVictory = true;
    }
    expect(state.round).toBe(2);
    expect(state.winner).toBe(0);
    expect(sawVictory).toBe(true);
    expect(state.events).toHaveLength(0); // frozen battle clears its event list
  });

  it('draws at the round limit when both fortresses are equal', () => {
    const state = createBattle(
      config({ maxRounds: 2, roundDuration: 1, startingGold: 0, startingIncome: 0, allowedUnits: ['levy'] }),
    );
    let victoryCount = 0;
    const steps = Math.round(8.5 / DT);
    for (let step = 0; step < steps; step += 1) {
      stepBattle(state, DT);
      victoryCount += state.events.filter((event) => event.kind === 'victory').length;
    }
    expect(state.round).toBe(2);
    expect(state.winner).toBe('draw');
    expect(victoryCount).toBe(1);
  });
});

describe('performance', () => {
  it('simulates 150 units for 300 steps quickly', () => {
    const state = quiet(
      createBattle(config({ supply: 500, startingGold: 0, startingIncome: 0, allowedUnits: ALL_UNITS })),
    );
    const mix = ['levy', 'runner', 'shield', 'pike', 'axe', 'bow', 'crossbow', 'rider', 'mage',
      'healer', 'assassin', 'guardian', 'firemage', 'knight', 'paladin'];
    for (let index = 0; index < 75; index += 1) {
      const type = mix[index % mix.length] ?? 'levy';
      addUnit(state, 0, type, 300 + (index % 10) * 22, laneY(index % 8));
      addUnit(state, 1, type, 980 - (index % 10) * 22, laneY((index + 3) % 8));
    }
    expect(state.units).toHaveLength(150);
    const started = performance.now();
    for (let step = 0; step < 300; step += 1) stepBattle(state, DT);
    const elapsed = performance.now() - started;
    expect(state.units.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });
});
