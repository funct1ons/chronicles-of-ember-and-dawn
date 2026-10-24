import { computeDamage } from '../core/combat';
import type { Role, UnitDef } from '../core/types';
import { UNITS, UNIT_BY_ID } from '../data/units';

/**
 * Codex (兵种图鉴) pure logic: querying, economy intuition and counter hints.
 *
 * Everything in this module is DOM-free so it can be unit-tested in Node and
 * reused by both the full codex page and the in-battle detail modal. Counter
 * hints are *derived* from `computeDamage` (the same function used by combat,
 * tactics and AI) instead of hand-written claims: the numbers shown on a card
 * are always a direct sample of the live damage model.
 */

/** Seconds between two default waves; only used for payback estimates. */
export const WAVE_SECONDS = 12;
/** Healing per action, mirroring `HEAL_AMOUNT` in simulation.ts. */
export const HEAL_AMOUNT = 24;
/** Radius of the fire mage splash, mirroring `SPLASH_RADIUS` in simulation.ts. */
export const SPLASH_RADIUS = 48;
/**
 * Roles that receive a single charged first strike, mirroring `CHARGE_ROLES`
 * in simulation.ts. It is duplicated here because the simulator keeps it
 * private; `codex.test.ts` guards the behaviour against `computeDamage`.
 */
export const CHARGE_ROLES: readonly Role[] = ['cavalry', 'knight', 'elite'];

// ---------------------------------------------------------------------------
// Groups & sorting
// ---------------------------------------------------------------------------

export type CodexGroupId = 'all' | 'infantry' | 'ranged' | 'cavalry' | 'magic' | 'siege' | 'elite';

export interface CodexGroup {
  id: CodexGroupId;
  label: string;
  hint: string;
  roles: readonly Role[];
}

/** Every one of the 16 roles belongs to exactly one group (validated in tests). */
export const CODEX_GROUPS: readonly CodexGroup[] = [
  { id: 'all', label: '全部', hint: '十六支兵种', roles: [] },
  { id: 'infantry', label: '步兵', hint: '填线与近战', roles: ['infantry', 'skirmisher', 'shield', 'pike', 'brute'] },
  { id: 'ranged', label: '远程', hint: '箭矢与弩矢', roles: ['archer', 'crossbow'] },
  { id: 'cavalry', label: '骑兵', hint: '首击与突破', roles: ['cavalry', 'knight'] },
  { id: 'magic', label: '法术', hint: '无视防御与治疗', roles: ['mage', 'healer', 'firemage'] },
  { id: 'siege', label: '攻城', hint: '轰击要塞', roles: ['siege'] },
  { id: 'elite', label: '精英', hint: '高投入高上限', roles: ['assassin', 'guardian', 'elite'] },
];

export type CodexSortId = 'codex' | 'cost-asc' | 'cost-desc' | 'income-desc' | 'hp-desc';

export const CODEX_SORTS: readonly { id: CodexSortId; label: string }[] = [
  { id: 'codex', label: '名录顺序' },
  { id: 'cost-asc', label: '价格 · 由低到高' },
  { id: 'cost-desc', label: '价格 · 由高到低' },
  { id: 'income-desc', label: '收入效率 · 由高到低' },
  { id: 'hp-desc', label: '生命 · 由高到低' },
];

export interface CodexQuery {
  search: string;
  group: CodexGroupId;
  sort: CodexSortId;
}

export interface CodexQueryInput {
  search?: string | null;
  group?: string | null;
  sort?: string | null;
}

function isGroupId(value: string | null | undefined): value is CodexGroupId {
  return CODEX_GROUPS.some(group => group.id === value);
}

function isSortId(value: string | null | undefined): value is CodexSortId {
  return CODEX_SORTS.some(sort => sort.id === value);
}

/**
 * Normalises raw control values (e.g. `input.value`) into a valid query.
 * Unknown group/sort ids fall back to the defaults, so stale DOM state can
 * never produce an empty or broken view.
 */
export function readCodexQuery(input: CodexQueryInput = {}): CodexQuery {
  return {
    search: (input.search ?? '').trim().replace(/\s+/g, ' '),
    group: isGroupId(input.group) ? input.group : 'all',
    sort: isSortId(input.sort) ? input.sort : 'codex',
  };
}

export function codexGroupsOf(unit: UnitDef): CodexGroupId[] {
  return CODEX_GROUPS.filter(group => group.roles.includes(unit.role)).map(group => group.id);
}

export function codexGroupLabelsOf(unit: UnitDef): string[] {
  return CODEX_GROUPS.filter(group => group.roles.includes(unit.role)).map(group => group.label);
}

/** Search haystack: names, doctrine, lore and the numeric price tags. */
export function codexSearchText(unit: UnitDef): string {
  return [
    unit.name,
    unit.title,
    unit.doctrine,
    unit.description,
    unit.ability,
    unit.lore,
    ...codexGroupLabelsOf(unit),
    unit.armor === 'heavy' ? '重甲' : '轻甲',
    String(unit.cost),
    String(unit.income),
  ]
    .join(' ')
    .toLowerCase();
}

export function codexMatches(unit: UnitDef, query: CodexQuery | CodexQueryInput | string): boolean {
  const normalised =
    typeof query === 'string' ? readCodexQuery({ search: query }) : readCodexQuery(query);
  if (normalised.group !== 'all' && !codexGroupsOf(unit).includes(normalised.group)) return false;
  const tokens = normalised.search.toLowerCase().split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = codexSearchText(unit);
  return tokens.every(token => haystack.includes(token));
}

function compareUnits(a: UnitDef, b: UnitDef, sort: CodexSortId): number {
  switch (sort) {
    case 'cost-asc':
      return a.cost - b.cost;
    case 'cost-desc':
      return b.cost - a.cost;
    case 'income-desc':
      return b.income / b.cost - a.income / a.cost;
    case 'hp-desc':
      return b.hp - a.hp;
    default:
      return 0;
  }
}

export function queryCodex(units: UnitDef[], query: CodexQuery | CodexQueryInput): UnitDef[] {
  const normalised = readCodexQuery(query);
  const order = new Map(units.map((unit, index) => [unit.id, index]));
  return units
    .filter(unit => codexMatches(unit, normalised))
    .sort(
      (a, b) =>
        compareUnits(a, b, normalised.sort) ||
        // Keep the caller's roster order for ties (and for the default sort).
        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
}

export interface CodexResult {
  query: CodexQuery;
  matched: UnitDef[];
  ids: string[];
  total: number;
  hidden: number;
}

/** Full query result for one render/update pass (no DOM mutation). */
export function runCodexQuery(
  query: CodexQuery | CodexQueryInput,
  units: UnitDef[] = UNITS,
): CodexResult {
  const normalised = readCodexQuery(query);
  const matched = queryCodex(units, normalised);
  return {
    query: normalised,
    matched,
    ids: matched.map(unit => unit.id),
    total: units.length,
    hidden: units.length - matched.length,
  };
}

export function codexStatusLabel(result: CodexResult): string {
  const group = CODEX_GROUPS.find(entry => entry.id === result.query.group)?.label ?? '全部';
  const search = result.query.search ? ` · 检索「${result.query.search}」` : '';
  return `${result.matched.length} / ${result.total} 条 · ${group}${search}`;
}

/**
 * Applies a query to already-rendered cards without re-rendering the page:
 * hidden cards are toggled via the `hidden` attribute and visible cards are
 * reordered with CSS `order`, so the search input keeps focus and the caret.
 */
export function applyCodexView(cards: Iterable<HTMLElement>, result: CodexResult): void {
  const rank = new Map(result.ids.map((id, index) => [id, index]));
  for (const card of cards) {
    const index = rank.get(card.dataset.codexId ?? '');
    card.hidden = index === undefined;
    if (index !== undefined) card.style.order = String(index);
  }
}

/**
 * Page-level wiring helper: applies the query to rendered cards, the status
 * line and the empty state. It never re-renders markup, so the search input
 * keeps focus and the caret while typing.
 *
 * Usage (main side): read `[data-codex-search]`, `[data-codex-group]` and
 * `[data-codex-sort]`, then call this with `runCodexQuery(query)` on `input`,
 * `change` and `search` events.
 */
export function applyCodexPage(root: ParentNode, result: CodexResult): void {
  applyCodexView(root.querySelectorAll<HTMLElement>('[data-codex-entry]'), result);
  const status = root.querySelector<HTMLElement>('[data-codex-status]');
  if (status) status.textContent = codexStatusLabel(result);
  const empty = root.querySelector<HTMLElement>('[data-codex-empty]');
  if (empty) empty.hidden = result.matched.length > 0;
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

export interface CodexEconomy {
  /** Income added to the per-wave income for each gold spent. */
  incomePerGold: number;
  incomePerHundred: number;
  hpPerGold: number;
  hpPerHundred: number;
  hpPerSupply: number;
  /** Waves needed to earn the price back at ×1 income growth. */
  payoffWaves: number;
  payoffSeconds: number;
  /** Mean effective damage against the whole roster. */
  averageHit: number;
  averageDps: number;
  dpsPerGold: number;
  dpsPerSupply: number;
  /** Heaviest single hit currently reachable in the roster. */
  heaviestHit: number;
  hitsToDie: number;
}

/** Effective damage of one attack, with the healer exception applied. */
export function codexHit(attacker: UnitDef, target: UnitDef): number {
  // Healers are excluded from targeting by the simulator, so they deal no
  // damage even though `computeDamage` would clamp the result to MIN_DAMAGE.
  if (attacker.role === 'healer') return 0;
  return computeDamage(attacker, target);
}

export function codexAverageHit(attacker: UnitDef, units: UnitDef[] = UNITS): number {
  if (attacker.role === 'healer') return 0;
  const targets = units.filter(target => target.id !== attacker.id);
  if (targets.length === 0) return 0;
  return targets.reduce((sum, target) => sum + codexHit(attacker, target), 0) / targets.length;
}

export function codexHeaviestHit(target: UnitDef, units: UnitDef[] = UNITS): number {
  return units
    .filter(attacker => attacker.id !== target.id && attacker.role !== 'healer')
    .reduce((max, attacker) => Math.max(max, codexHit(attacker, target)), 0);
}

export function codexEconomy(unit: UnitDef, units: UnitDef[] = UNITS): CodexEconomy {
  const averageHit = codexAverageHit(unit, units);
  const averageDps = unit.role === 'healer' ? 0 : averageHit / unit.cooldown;
  const heaviestHit = codexHeaviestHit(unit, units);
  return {
    incomePerGold: unit.income / unit.cost,
    incomePerHundred: (unit.income / unit.cost) * 100,
    hpPerGold: unit.hp / unit.cost,
    hpPerHundred: (unit.hp / unit.cost) * 100,
    hpPerSupply: unit.hp / unit.supply,
    payoffWaves: Math.ceil(unit.cost / unit.income),
    payoffSeconds: Math.ceil(unit.cost / unit.income) * WAVE_SECONDS,
    averageHit,
    averageDps,
    dpsPerGold: averageDps / unit.cost,
    dpsPerSupply: averageDps / unit.supply,
    heaviestHit,
    hitsToDie: heaviestHit > 0 ? Math.ceil(unit.hp / heaviestHit) : Number.POSITIVE_INFINITY,
  };
}

// ---------------------------------------------------------------------------
// Matchups derived from computeDamage
// ---------------------------------------------------------------------------

export interface CodexMatchup {
  attackerId: string;
  attackerName: string;
  attackerCost: number;
  attackerSupply: number;
  targetId: string;
  targetName: string;
  /** Sustained hit, exactly what `computeDamage` returns in combat. */
  hit: number;
  /** First strike for charge roles; equal to `hit` otherwise. */
  chargedHit: number;
  /** Secondary splash damage per extra target (fire mage only, else 0). */
  splashHit: number;
  dps: number;
  dpsPerGold: number;
  dpsPerSupply: number;
  /** Seconds of continuous attacks needed to remove the target's HP. */
  ttk: number;
  chargedTtk: number;
}

export function codexMatchup(attacker: UnitDef, target: UnitDef): CodexMatchup {
  const hit = codexHit(attacker, target);
  const charge = CHARGE_ROLES.includes(attacker.role);
  const chargedHit = charge && attacker.role !== 'healer' ? computeDamage(attacker, target, { charge: true }) : hit;
  const splashHit =
    attacker.role === 'firemage' && hit > 0
      ? computeDamage(attacker, target, { ranged: true, splash: true })
      : 0;
  const dps = hit / attacker.cooldown;
  const ttk = hit > 0 ? Math.ceil(target.hp / hit) * attacker.cooldown : Number.POSITIVE_INFINITY;
  // Charge boosts the FIRST hit only, never each subsequent attack.
  const chargedTtk =
    hit > 0 ? (1 + Math.ceil(Math.max(0, target.hp - chargedHit) / hit)) * attacker.cooldown : Number.POSITIVE_INFINITY;
  return {
    attackerId: attacker.id,
    attackerName: attacker.name,
    attackerCost: attacker.cost,
    attackerSupply: attacker.supply,
    targetId: target.id,
    targetName: target.name,
    hit,
    chargedHit,
    splashHit,
    dps,
    dpsPerGold: dps / attacker.cost,
    dpsPerSupply: dps / attacker.supply,
    ttk,
    chargedTtk,
  };
}

/** The complete 16×16 sheet: one row per ordered pair. */
export function codexMatchups(units: UnitDef[] = UNITS): CodexMatchup[] {
  const sheet: CodexMatchup[] = [];
  for (const attacker of units) {
    for (const target of units) {
      if (attacker.id === target.id) continue;
      sheet.push(codexMatchup(attacker, target));
    }
  }
  return sheet;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function lookup(id: string, units: UnitDef[]): UnitDef | undefined {
  return units.find(unit => unit.id === id) ?? UNIT_BY_ID[id];
}

function byThreat(a: CodexMatchup, b: CodexMatchup): number {
  return (
    b.dps - a.dps ||
    a.ttk - b.ttk ||
    a.targetId.localeCompare(b.targetId) ||
    a.attackerId.localeCompare(b.attackerId)
  );
}

/**
 * Whether the pair can actually meet: melee range differences are irrelevant,
 * but a longer-ranged target must be out-ranged or run down by a fast unit.
 */
function canEngage(attacker: UnitDef, target: UnitDef): boolean {
  if (target.range < 120) return true;
  return attacker.range >= target.range || attacker.speed >= 40;
}

/**
 * Targets this unit hits unusually hard for its own average: sustained DPS at
 * least 1.2× its roster median. Units without a clear specialisation (e.g. the
 * levy, whose damage is even across light targets) return an empty list instead
 * of a misleading "counter" claim; their card still shows mechanic hints.
 */
export function codexTargets(id: string, limit = 3, units: UnitDef[] = UNITS): CodexMatchup[] {
  const attacker = lookup(id, units);
  if (!attacker || attacker.role === 'healer') return [];
  const rows = units
    .filter(target => target.id !== attacker.id && canEngage(attacker, target))
    .map(target => codexMatchup(attacker, target))
    .filter(row => row.hit > 0);
  if (rows.length === 0) return [];
  const baseline = median(rows.map(row => row.dps));
  return rows
    .filter(row => row.dps >= baseline * 1.2)
    .sort((a, b) => b.dps - a.dps || a.ttk - b.ttk || a.targetId.localeCompare(b.targetId))
    .slice(0, limit);
}

/** Highest sustained damage this unit deals to any single target. */
export function codexBestTarget(id: string, units: UnitDef[] = UNITS): CodexMatchup | undefined {
  const attacker = lookup(id, units);
  if (!attacker || attacker.role === 'healer') return undefined;
  return units
    .filter(target => target.id !== attacker.id && canEngage(attacker, target))
    .map(target => codexMatchup(attacker, target))
    .filter(row => row.hit > 0)
    .sort(byThreat)[0];
}

/** Strongest incoming threats against this unit, ranked by sustained DPS. */
export function codexCounters(id: string, limit = 3, units: UnitDef[] = UNITS): CodexMatchup[] {
  const target = lookup(id, units);
  if (!target) return [];
  return units
    .filter(attacker => attacker.id !== target.id && attacker.role !== 'healer')
    .map(attacker => codexMatchup(attacker, target))
    .filter(row => row.hit > 0)
    .sort(byThreat)
    .slice(0, limit);
}

/** Cheapest answers to this unit, ranked by damage per second per gold. */
export function codexValueCounters(id: string, limit = 3, units: UnitDef[] = UNITS): CodexMatchup[] {
  const target = lookup(id, units);
  if (!target) return [];
  return units
    .filter(attacker => attacker.id !== target.id && attacker.role !== 'healer')
    .map(attacker => codexMatchup(attacker, target))
    .filter(row => row.hit > 0)
    .sort((a, b) => b.dpsPerGold - a.dpsPerGold || byThreat(a, b))
    .slice(0, limit);
}

/** Number of roster units whose anti-light damage beats their anti-heavy one. */
export function codexLightVulnerabilityCount(units: UnitDef[] = UNITS): number {
  return units.filter(unit => unit.role !== 'healer' && unit.lightDamage > unit.heavyDamage).length;
}

/** Incoming threats that must close the distance: fast melee attackers only. */
export function codexMeleeRushers(id: string, limit = 2, units: UnitDef[] = UNITS): CodexMatchup[] {
  const target = lookup(id, units);
  if (!target) return [];
  return units
    .filter(
      attacker =>
        attacker.id !== target.id &&
        attacker.role !== 'healer' &&
        attacker.range < 60 &&
        attacker.speed >= 40,
    )
    .map(attacker => codexMatchup(attacker, target))
    .filter(row => row.hit > 0)
    .sort((a, b) => a.ttk - b.ttk || b.dps - a.dps)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

export interface CodexHint {
  kind: 'strength' | 'caution';
  label: string;
  detail: string;
  ids: string[];
}

function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

function formatRange(values: number[], decimals = 0): string {
  if (values.length === 0) return '—';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max
    ? formatNumber(min, decimals)
    : `${formatNumber(min, decimals)}–${formatNumber(max, decimals)}`;
}

function hint(kind: CodexHint['kind'], label: string, detail: string, ids: string[] = []): CodexHint {
  return { kind, label, detail, ids };
}

/**
 * Data-derived hints for one unit:
 * - strengths come from the damage sheet (targets it hits above its own median),
 * - cautions come from the incoming damage sheet plus explicit model rules
 *   (`computeDamage` armour/defence/magic handling, charge, splash, siege).
 *
 * Wording is deliberately hedged: hints quote per-hit and per-second numbers
 * instead of promising absolute counters, because positioning and range are not
 * part of `computeDamage`.
 */
export function codexHints(unitOrId: UnitDef | string, units: UnitDef[] = UNITS): CodexHint[] {
  const unit = typeof unitOrId === 'string' ? lookup(unitOrId, units) : unitOrId;
  if (!unit) return [];
  const hints: CodexHint[] = [];
  const targets = codexTargets(unit.id, 3, units);
  const counters = codexCounters(unit.id, 3, units);

  if (unit.role === 'healer') {
    hints.push(
      hint(
        'strength',
        `治疗 ${HEAL_AMOUNT} 点`,
        `每次行动治疗附近盟友 ${HEAL_AMOUNT} 点生命，自身不造成伤害；须与战斗单位同队。`,
      ),
    );
  } else {
    if (targets.length > 0) {
      hints.push(
        hint(
          'strength',
          `伤害适性 · ${targets.map(row => row.targetName).join('、')}`,
          `每击 ${formatRange(targets.map(row => row.hit))}，约 ${formatRange(targets.map(row => row.dps), 1)} 伤害/秒；理论击杀 ${formatRange(targets.map(row => row.ttk), 1)} 秒（按实际伤害与攻击间隔）。`,
          targets.map(row => row.targetId),
        ),
      );
    }
    const mechanic = codexMechanicHint(unit, targets[0] ?? codexBestTarget(unit.id, units), units);
    if (mechanic) hints.push(mechanic);
  }

  if (counters.length > 0) {
    hints.push(
      hint(
        'caution',
        `最惧 ${counters.map(row => row.attackerName).join('、')}`,
        `承受每击 ${formatRange(counters.map(row => row.hit))}，约 ${formatRange(counters.map(row => row.dps), 1)} 伤害/秒；最快 ${formatNumber(Math.min(...counters.map(row => row.ttk)), 1)} 秒清空 ${unit.hp} 生命（数值参考，不含走位与射程）。`,
        counters.map(row => row.attackerId),
      ),
    );
  }

  const structural = codexStructuralCaution(unit, units);
  if (structural) hints.push(structural);


  return hints;
}

function codexMechanicHint(
  unit: UnitDef,
  target: CodexMatchup | undefined,
  units: UnitDef[],
): CodexHint | null {
  const sample = target ? { hit: target.hit, name: target.targetName } : null;
  const sampleHit = sample?.hit ?? 0;
  const sampleName = sample?.name ?? '首个目标';
  switch (unit.role) {
    case 'pike': {
      const rider = lookup('rider', units);
      const knight = lookup('knight', units);
      const riderHit = rider ? codexHit(unit, rider) : 0;
      const knightHit = knight ? codexHit(unit, knight) : 0;
      return hint(
        'strength',
        '拒马 ×2',
        `对骑兵与重骑的伤害翻倍：${rider?.name ?? '轻骑'} 每击 ${riderHit}，${knight?.name ?? '重骑'} 每击 ${knightHit}；冷却 ${unit.cooldown} 秒。`,
        [rider?.id, knight?.id].filter((id): id is string => Boolean(id)),
      );
    }
    case 'assassin': {
      const bow = lookup('bow', units);
      const mage = lookup('mage', units);
      const bowHit = bow ? codexHit(unit, bow) : 0;
      const mageHit = mage ? codexHit(unit, mage) : 0;
      return hint(
        'strength',
        '猎杀后排 ×1.6',
        `对远程轻甲与法术单位 ×1.6：${bow?.name ?? '弓手'} 每击 ${bowHit}，${mage?.name ?? '术士'} 每击 ${mageHit}；冷却 ${unit.cooldown} 秒。`,
        [bow?.id, mage?.id].filter((id): id is string => Boolean(id)),
      );
    }
    case 'firemage':
      return hint(
        'strength',
        `溅射 ${SPLASH_RADIUS} 范围`,
        `主目标 ${sampleHit} 点；范围内每个额外目标 ${target?.splashHit ?? 0} 点（×0.5），冷却 ${unit.cooldown} 秒。`,
        target ? [target.targetId] : [],
      );
    case 'siege':
      return hint(
        'strength',
        '攻城 ×3',
        `对要塞每击 ${unit.heavyDamage * 3}，对单位每击 ${sampleHit}（${sampleName}）；冷却 ${unit.cooldown} 秒。`,
        target ? [target.targetId] : [],
      );
    case 'shield':
    case 'guardian':
      return hint(
        'strength',
        '盾墙减伤',
        `承受远程物理伤害 ×0.65，再减 ${unit.defense} 点防御；法术无视这两项减免。`,
      );
    case 'mage':
      return hint(
        'strength',
        '无视防御',
        `法术伤害不扣目标防御：对曜石禁卫每击仍为 ${lookup('guardian', units) ? codexHit(unit, lookup('guardian', units)!) : 0}（其防御 ${lookup('guardian', units)?.defense ?? 0} 点）。`,
        ['guardian'],
      );
    default:
      break;
  }
  if (CHARGE_ROLES.includes(unit.role)) {
    return hint(
      'strength',
      '首击 ×1.8',
      `冲锋首击对${sampleName}为 ${target?.chargedHit ?? sampleHit}，之后回落至 ${sampleHit}；冷却 ${unit.cooldown} 秒。`,
      target ? [target.targetId] : [],
    );
  }
  if (unit.lightDamage > unit.heavyDamage * 1.2) {
    return hint(
      'strength',
      '清轻甲',
      `对轻甲每击 ${unit.lightDamage}，对重甲每击 ${unit.heavyDamage}（未计防御减免）；攻击间隔 ${unit.cooldown} 秒。`,
    );
  }
  if (unit.heavyDamage > unit.lightDamage * 1.2) {
    return hint(
      'strength',
      '破重甲',
      `对重甲每击 ${unit.heavyDamage}，对轻甲每击 ${unit.lightDamage}（未计防御减免）；攻击间隔 ${unit.cooldown} 秒。`,
    );
  }
  return null;
}

function codexStructuralCaution(unit: UnitDef, units: UnitDef[]): CodexHint | null {
  const mage = lookup('mage', units);
  const pike = lookup('pike', units);
  if (unit.role === 'healer') {
    const rushers = codexMeleeRushers(unit.id, 2, units);
    const names = rushers.map(row => row.attackerName).join('、');
    return hint(
      'caution',
      '无自卫能力',
      `自身不造成伤害；${names ? `${names}贴身后约 ${formatNumber(Math.min(...rushers.map(row => row.ttk)), 1)} 秒即可清空 ${unit.hp} 生命。` : '必须由战斗单位环护。'}`,
      rushers.map(row => row.attackerId),
    );
  }
  if ((unit.role === 'cavalry' || unit.role === 'knight') && pike) {
    return hint(
      'caution',
      '惧长枪',
      `${pike.name} 对骑兵与重骑每击 ×2：对本品 ${codexHit(pike, unit)} 点，冷却 ${pike.cooldown} 秒。`,
      [pike.id],
    );
  }
  if (unit.armor === 'heavy' && unit.defense >= 5 && mage) {
    return hint(
      'caution',
      '惧法术',
      `法术无视防御：${mage.name} 对本品每击 ${codexHit(mage, unit)}，${unit.defense} 点防御完全不参与减伤。`,
      [mage.id],
    );
  }
  if (unit.range >= 120 && unit.hp <= 130) {
    const rushers = codexMeleeRushers(unit.id, 2, units);
    if (rushers.length > 0) {
      return hint(
        'caution',
        '惧近身突袭',
        `贴身后射程失效：${rushers.map(row => row.attackerName).join('、')}可在 ${formatNumber(Math.min(...rushers.map(row => row.ttk)), 1)}–${formatNumber(Math.max(...rushers.map(row => row.ttk)), 1)} 秒内清空 ${unit.hp} 生命。`,
        rushers.map(row => row.attackerId),
      );
    }
  }
  if (unit.armor === 'light' && unit.defense <= 2) {
    const count = codexLightVulnerabilityCount(units);
    const defense =
      unit.defense > 0
        ? `${unit.defense} 点防御只能在非魔法伤害中扣减一次`
        : '没有可扣减的防御值';
    return hint(
      'caution',
      '轻甲薄防',
      `十六个兵种里有 ${count} 个对轻甲的伤害高于对重甲；${defense}。`,
    );
  }
  if (unit.cooldown >= 2.5) {
    return hint(
      'caution',
      `装填 ${unit.cooldown} 秒`,
      `两次出手之间无法输出，须由前排替它争取时间；生命仅 ${unit.hp}。`,
    );
  }
  if (unit.speed <= 20) {
    return hint(
      'caution',
      `机动 ${unit.speed}`,
      `转向缓慢，既难回援也难脱身；单兵占用 ${unit.supply} 人口。`,
    );
  }
  if (unit.supply >= 6) {
    return hint(
      'caution',
      `人口 ${unit.supply}`,
      `单兵占用 ${unit.supply} 人口，一次折损就会拖慢后续波次；价格 ${unit.cost} 金币。`,
    );
  }
  return null;
}
