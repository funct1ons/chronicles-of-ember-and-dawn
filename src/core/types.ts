export type Side = 0 | 1;
export type Armor = 'light' | 'heavy';
export type Role = 'infantry' | 'skirmisher' | 'shield' | 'pike' | 'brute' | 'archer' | 'crossbow' | 'cavalry' | 'knight' | 'mage' | 'healer' | 'siege' | 'assassin' | 'guardian' | 'firemage' | 'elite';
export interface UnitDef {
  id: string; name: string; title: string; description: string; role: Role;
  cost: number; income: number; supply: number; hp: number; armor: Armor; defense: number;
  lightDamage: number; heavyDamage: number; cooldown: number; range: number; speed: number;
  ability: string; color: string;
}
export type Biome = 'plains' | 'wastes' | 'snow' | 'ruins';
export type Difficulty = 0 | 1 | 2 | 3 | 4;
export interface MatchConfig {
  mode: 'classic' | 'campaign' | 'challenge' | 'custom' | 'local';
  biome: Biome; difficulty: Difficulty; seed: number;
  startingGold: number; startingIncome: number; supply: number; growth: number;
  roundDuration: number; baseHp: number; ai: boolean; playerSide: Side;
  allowedUnits: string[]; enemyAllowedUnits?: string[]; missionId?: string;
  enemyGoldBonus?: number; enemyIncomeBonus?: number; maxRounds?: number;
}
export interface Fighter {
  id: number; side: Side; type: string; x: number; y: number; hp: number; maxHp: number;
  cooldown: number; action: 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';
  actionTime: number; target: number | null; born: number; deathTime?: number; charge?: boolean;
}
export interface TeamState {
  gold: number; income: number; baseHp: number; selected: string; supplyUsed: number;
  spent: number; earned: number; kills: number; recruited: number; damage: number;
}
export interface BattleEvent {
  kind: 'spawn' | 'hit' | 'shot' | 'death' | 'base' | 'wave' | 'heal' | 'victory';
  x: number; y: number; side: Side; type?: string; targetX?: number; targetY?: number; amount?: number;
}
export interface BattleState {
  config: MatchConfig; time: number; round: number; countdown: number;
  teams: [TeamState, TeamState]; units: Fighter[]; events: BattleEvent[];
  winner: Side | 'draw' | null; nextId: number; rng: number;
}
export interface Mission {
  id: string; name: string; subtitle: string; text: string; biome: Biome; difficulty: Difficulty;
  allowedUnits: string[]; enemyAllowedUnits?: string[]; gold?: number; income?: number;
  supply?: number; growth?: number; enemyGoldBonus?: number; enemyIncomeBonus?: number;
}
