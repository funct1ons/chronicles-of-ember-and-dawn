import { describe, expect, it } from 'vitest';
import type { BattleState, Fighter, MatchConfig, Side } from './types';
import { UNIT_BY_ID } from '../data/units';
import { allowedUnitsFor, chooseAI, cheapestAllowed } from './ai';
import { createBattle, stepBattle } from './simulation';
import { laneCenterY } from './math';

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
    difficulty: 4,
    seed: 7,
    startingGold: 500,
    startingIncome: 50,
    supply: 60,
    growth: 1,
    roundDuration: 4,
    baseHp: 2500,
    ai: true,
    playerSide: 0,
    allowedUnits: [...ALL_UNITS],
    maxRounds: 80,
    ...over,
  };
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
    charge: false,
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

describe('chooseAI', () => {
  it('is deterministic for a seeded battle', () => {
    const first = createBattle(config({ seed: 4242, difficulty: 2 }));
    const second = createBattle(config({ seed: 4242, difficulty: 2 }));
    const picksFirst: string[] = [];
    const picksSecond: string[] = [];
    for (let wave = 0; wave < 6; wave += 1) {
      picksFirst.push(chooseAI(first, 1));
      picksSecond.push(chooseAI(second, 1));
      expect(first.rng).toBe(second.rng);
    }
    expect(picksFirst).toEqual(picksSecond);
    expect(first.rng).not.toBe(createBattle(config({ seed: 4242 })).rng);
  });

  it('only ever returns allowed, affordable units', () => {
    for (const difficulty of [0, 1, 2, 3, 4] as const) {
      const state = createBattle(
        config({ difficulty, startingGold: 437, supply: 17, startingIncome: 0, allowedUnits: ALL_UNITS }),
      );
      const allowed = allowedUnitsFor(state.config, 1);
      for (let sample = 0; sample < 8; sample += 1) {
        const pick = chooseAI(state, 1);
        expect(allowed).toContain(pick);
        const def = unitDef(pick);
        expect(def.cost).toBeLessThanOrEqual(437);
        expect(def.supply).toBeLessThanOrEqual(17);
        state.rng = (state.rng + 0x9e3779b9) >>> 0;
      }
    }
  });

  it('cheapestAllowed stays within a restricted elite-only catalogue',()=>{expect(cheapestAllowed(config({allowedUnits:['knight','ballista']}),0)).toBe('knight');});

  it('falls back to a legal choice when nothing is affordable', () => {
    const state = createBattle(
      config({ startingGold: 5, startingIncome: 0, supply: 60, allowedUnits: ['knight', 'ballista'] }),
    );
    const pick = chooseAI(state, 1);
    expect(allowedUnitsFor(state.config, 1)).toContain(pick);
    expect(unitDef(pick).cost).toBeGreaterThan(5);
  });

  it('picks anti-heavy damage against a heavy-armour army', () => {
    const state = createBattle(
      config({
        difficulty: 4,
        startingGold: 2000,
        supply: 60,
        allowedUnits: ['levy', 'runner', 'axe', 'bow', 'crossbow', 'mage', 'pike'],
      }),
    );
    state.round = 22;
    for (let index = 0; index < 6; index += 1) {
      addUnit(state, 1, 'shield', 600 + index * 18, laneCenterY(index % 4));
    }
    const pick = chooseAI(state, 0);
    const def = unitDef(pick);
    expect(def.heavyDamage).toBeGreaterThan(def.lightDamage * 1.2);
  });

  it('buys an effective interceptor instead of economic filler under cavalry pressure', () => {
    const state = createBattle(
      config({
        difficulty: 4,
        startingGold: 2000,
        supply: 60,
        allowedUnits: ['levy', 'pike', 'bow', 'axe', 'rider'],
      }),
    );
    state.round = 22;
    for (let index = 0; index < 6; index += 1) {
      addUnit(state, 1, 'rider', 260 + index * 4, laneCenterY(index % 4));
    }
    // At 2000 gold, the 18-unit wave cap makes 15 cavalry or 18 bows legitimate
    // alternatives to 18 pikes. Do not hard-code a nominal counter regardless of budget.
    expect(['pike', 'bow', 'rider']).toContain(chooseAI(state, 0));
  });

  it('keeps low difficulties legal and imperfect without cheating', () => {
    const state = createBattle(
      config({ difficulty: 0, startingGold: 200, startingIncome: 0, supply: 10, allowedUnits: ALL_UNITS }),
    );
    const picks = new Set<string>();
    for (let sample = 0; sample < 12; sample += 1) {
      picks.add(chooseAI(state, 0));
      expect(state.teams[0].gold).toBe(200);
      expect(state.teams[0].supplyUsed).toBe(0);
    }
    expect(picks.size).toBeGreaterThan(0);
    for (const pick of picks) expect(allowedUnitsFor(state.config, 0)).toContain(pick);
  });

  it('produces identical battles for identical seeds', () => {
    const run = (seed: number): BattleState => {
      const state = createBattle(
        config({ seed, difficulty: 3, startingGold: 400, startingIncome: 40, roundDuration: 4 }),
      );
      for (let step = 0; step < 300; step += 1) stepBattle(state, DT);
      return state;
    };
    const first = run(11);
    const second = run(11);
    expect(first.rng).toBe(second.rng);
    expect(first.round).toBe(second.round);
    expect(first.winner).toBe(second.winner);
    expect(first.teams[0].gold).toBe(second.teams[0].gold);
    expect(first.teams[1].gold).toBe(second.teams[1].gold);
    const snapshot = (state: BattleState) =>
      state.units.map((unit) => [unit.id, unit.side, unit.type, unit.x, unit.y, unit.hp]);
    expect(snapshot(first)).toEqual(snapshot(second));
  });
});
