import {describe,it,expect} from 'vitest';
import {computeDamage} from '../core/combat';
import {UNITS,UNIT_BY_ID} from '../data/units';
import {
  CHARGE_ROLES,
  CODEX_GROUPS,
  CODEX_SORTS,
  HEAL_AMOUNT,
  SPLASH_RADIUS,
  WAVE_SECONDS,
  codexAverageHit,
  codexBestTarget,
  codexCounters,
  codexEconomy,
  codexGroupsOf,
  codexHeaviestHit,
  codexHints,
  codexHit,
  codexLightVulnerabilityCount,
  codexMatchup,
  codexMatchups,
  codexMatches,
  codexMeleeRushers,
  codexSearchText,
  codexStatusLabel,
  codexTargets,
  codexValueCounters,
  applyCodexView,
  queryCodex,
  readCodexQuery,
  runCodexQuery,
} from './codex';

const ids = (list: {id: string}[]) => list.map(entry => entry.id);

describe('codex groups and sorting', () => {
  it('partitions the 16 roles into exactly one group each', () => {
    const roles = CODEX_GROUPS.filter(group => group.id !== 'all').flatMap(group => [...group.roles]);
    expect(roles).toHaveLength(16);
    expect(new Set(roles).size).toBe(16);
    expect(new Set(roles)).toEqual(new Set(UNITS.map(unit => unit.role)));
    for (const unit of UNITS) expect(codexGroupsOf(unit)).toHaveLength(1);
  });

  it('ships an "all" group and a codex-order sort first in their option lists', () => {
    expect(CODEX_GROUPS[0].id).toBe('all');
    expect(CODEX_SORTS[0].id).toBe('codex');
    expect(CODEX_GROUPS.map(group => group.label).every(Boolean)).toBe(true);
    expect(CODEX_SORTS.map(sort => sort.label).every(Boolean)).toBe(true);
  });

  it('falls back to safe defaults for unknown or empty control values', () => {
    expect(readCodexQuery({group: 'nope', sort: 'nope', search: '  盾  '})).toEqual({
      group: 'all',
      sort: 'codex',
      search: '盾',
    });
    expect(readCodexQuery({})).toEqual({group: 'all', sort: 'codex', search: ''});
  });

  it('keeps the roster order for the default query', () => {
    expect(queryCodex(UNITS, {group: 'all', sort: 'codex', search: ''})).toEqual(UNITS);
    expect(runCodexQuery({})).toMatchObject({total: 16, hidden: 0});
  });

  it('filters by group', () => {
    const counts: Record<string, number> = {
      infantry: 5,
      ranged: 2,
      cavalry: 2,
      magic: 3,
      siege: 1,
      elite: 3,
    };
    for (const group of CODEX_GROUPS.filter(entry => entry.id !== 'all')) {
      expect(queryCodex(UNITS, {group: group.id, sort: 'codex', search: ''})).toHaveLength(counts[group.id]);
    }
  });

  it('searches names, doctrine and lore with AND semantics for multiple tokens', () => {
    expect(ids(queryCodex(UNITS, {group: 'all', sort: 'codex', search: '灰羽'}))).toEqual(['bow']);
    expect(codexMatches(UNIT_BY_ID['bow'], '逐风')).toBe(false);
    const starfire = queryCodex(UNITS, {group: 'all', sort: 'codex', search: '星火'});
    expect(starfire.length).toBeGreaterThan(3);
    const andMatch = queryCodex(UNITS, {group: 'all', sort: 'codex', search: '星火 神殿'});
    expect(ids(andMatch)).toEqual(['healer']);
    expect(codexSearchText(UNIT_BY_ID['crossbow'])).toContain('钢弦弩手');
    expect(queryCodex(UNITS, {group: 'all', sort: 'codex', search: '不存在的兵种'})).toHaveLength(0);
  });

  it('toggles rendered cards without re-rendering, so search keeps focus', () => {
    type FakeCard = {dataset: {codexId: string}; hidden: boolean; style: {order: string}};
    const cards: FakeCard[] = [
      {dataset: {codexId: 'levy'}, hidden: false, style: {order: '0'}},
      {dataset: {codexId: 'rider'}, hidden: false, style: {order: '1'}},
      {dataset: {codexId: 'bow'}, hidden: false, style: {order: '2'}},
    ];
    applyCodexView(cards as unknown as HTMLElement[], runCodexQuery({group: 'ranged'}));
    expect(cards.map(card => card.hidden)).toEqual([true, true, false]);
    expect(cards[2].style.order).toBe('0');
    applyCodexView(cards as unknown as HTMLElement[], runCodexQuery({}));
    expect(cards.map(card => card.hidden)).toEqual([false, false, false]);
    // order follows the roster rank of each matched unit (levy 0, rider 7, bow 5)
    expect(cards.map(card => card.style.order)).toEqual(['0', '7', '5']);
  });

  it('reports matched and hidden counts for the status line', () => {
    const result = runCodexQuery({group: 'ranged'});
    expect(result.matched).toHaveLength(2);
    expect(result.hidden).toBe(14);
    expect(codexStatusLabel(result)).toContain('2 / 16 条 · 远程');
    const searched = runCodexQuery({search: '灰羽'});
    expect(codexStatusLabel(searched)).toContain('检索「灰羽」');
  });

  it('sorts by price, income efficiency and health', () => {
    const costs = queryCodex(UNITS, {group: 'all', sort: 'cost-asc', search: ''}).map(unit => unit.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    const costsDesc = queryCodex(UNITS, {group: 'all', sort: 'cost-desc', search: ''}).map(unit => unit.cost);
    expect(costsDesc).toEqual([...costsDesc].sort((a, b) => b - a));
    const income = queryCodex(UNITS, {group: 'all', sort: 'income-desc', search: ''});
    for (let i = 1; i < income.length; i++) {
      expect(income[i - 1].income / income[i - 1].cost).toBeGreaterThanOrEqual(
        income[i].income / income[i].cost,
      );
    }
    const hp = queryCodex(UNITS, {group: 'all', sort: 'hp-desc', search: ''}).map(unit => unit.hp);
    expect(hp).toEqual([...hp].sort((a, b) => b - a));
  });
});

describe('codex economy', () => {
  it('derives income and durability efficiency from the published stats', () => {
    const levy = UNIT_BY_ID['levy'];
    const economy = codexEconomy(levy);
    expect(economy.incomePerGold).toBeCloseTo(levy.income / levy.cost);
    expect(economy.incomePerHundred).toBeCloseTo((levy.income / levy.cost) * 100);
    expect(economy.hpPerSupply).toBeCloseTo(levy.hp / levy.supply);
    expect(economy.payoffWaves).toBe(Math.ceil(levy.cost / levy.income));
    expect(economy.payoffSeconds).toBe(Math.ceil(levy.cost / levy.income) * WAVE_SECONDS);
    const rider=UNIT_BY_ID['rider'];
    expect(codexEconomy(rider).payoffWaves).toBe(Math.ceil(rider.cost/rider.income));
    expect(WAVE_SECONDS).toBe(12);
  });

  it('keeps the levy as the most gold-efficient income source', () => {
    const best = [...UNITS].sort((a, b) => b.income / b.cost - a.income / a.cost)[0];
    expect(best.id).toBe('levy');
  });

  it('reports a real average hit and health pool for every attacker', () => {
    for (const unit of UNITS) {
      if (unit.role === 'healer') {
        expect(codexAverageHit(unit)).toBe(0);
        expect(codexEconomy(unit).averageDps).toBe(0);
        continue;
      }
      const expected =
        UNITS.filter(target => target.id !== unit.id)
          .map(target => computeDamage(unit, target))
          .reduce((sum, hit) => sum + hit, 0) / (UNITS.length - 1);
      expect(codexAverageHit(unit)).toBeCloseTo(expected);
      expect(codexEconomy(unit).averageDps).toBeCloseTo(expected / unit.cooldown);
    }
  });

  it('healers deal no damage even though the raw damage model clamps to MIN_DAMAGE', () => {
    const healer = UNIT_BY_ID['healer'];
    expect(computeDamage(healer, UNIT_BY_ID['levy'])).toBe(2);
    expect(codexHit(healer, UNIT_BY_ID['levy'])).toBe(0);
    expect(codexMatchup(healer, UNIT_BY_ID['levy']).dps).toBe(0);
    expect(codexMatchup(healer, UNIT_BY_ID['levy']).ttk).toBe(Number.POSITIVE_INFINITY);
  });

  it('derives the heaviest single hit and hits-to-die from the roster', () => {
    for (const target of UNITS) {
      const expected = Math.max(
        ...UNITS.filter(unit => unit.id !== target.id && unit.role !== 'healer').map(unit =>
          computeDamage(unit, target),
        ),
      );
      expect(codexHeaviestHit(target)).toBe(expected);
      expect(codexEconomy(target).hitsToDie).toBe(Math.ceil(target.hp / expected));
    }
  });
});

describe('matchups are a direct sample of computeDamage', () => {
  it('equals computeDamage for every sustained pair and special-cases healers', () => {
    for (const attacker of UNITS) {
      for (const target of UNITS) {
        if (attacker.id === target.id) continue;
        const matchup = codexMatchup(attacker, target);
        expect(matchup.hit).toBe(attacker.role === 'healer' ? 0 : computeDamage(attacker, target));
        expect(matchup.dps).toBeCloseTo(matchup.hit / attacker.cooldown);
      }
    }
    expect(codexMatchups()).toHaveLength(UNITS.length * (UNITS.length - 1));
  });

  it('only applies the charged first strike to charge roles', () => {
    expect([...CHARGE_ROLES].sort()).toEqual(['cavalry', 'elite', 'knight']);
    for (const unit of UNITS) {
      const matchup = codexMatchup(unit, UNIT_BY_ID['shield']);
      if (CHARGE_ROLES.includes(unit.role)) {
        expect(matchup.chargedHit).toBe(computeDamage(unit, UNIT_BY_ID['shield'], {charge: true}));
        expect(matchup.chargedHit).toBeGreaterThan(matchup.hit);
      } else {
        expect(matchup.chargedHit).toBe(matchup.hit);
      }
    }
  });

  it('counts charge only once in the theoretical attack-cycle budget', () => {
    const attacker=UNIT_BY_ID['rider'],target=UNIT_BY_ID['guardian'];
    const row=codexMatchup(attacker,target);
    const remaining=Math.max(0,target.hp-row.chargedHit);
    expect(row.chargedTtk).toBe((1+Math.ceil(remaining/row.hit))*attacker.cooldown);
    expect(row.chargedTtk).toBeGreaterThan(Math.ceil(target.hp/row.chargedHit)*attacker.cooldown);
  });

  it('exposes fire-mage splash as the real halved secondary damage', () => {
    const firemage = UNIT_BY_ID['firemage'];
    for (const target of UNITS) {
      if (target.id === firemage.id) continue;
      expect(codexMatchup(firemage, target).splashHit).toBe(
        computeDamage(firemage, target, {ranged: true, splash: true}),
      );
    }
    expect(SPLASH_RADIUS).toBe(48);
  });

  it('keeps pike bonuses, assassin backline bonuses and shield reductions intact', () => {
    const pike = UNIT_BY_ID['pike'];
    expect(codexHit(pike, UNIT_BY_ID['rider'])).toBeGreaterThan(codexHit(pike, UNIT_BY_ID['levy']));
    const assassin = UNIT_BY_ID['assassin'];
    expect(codexHit(assassin, UNIT_BY_ID['bow'])).toBeGreaterThan(codexHit(assassin, UNIT_BY_ID['shield']));
    const bow = UNIT_BY_ID['bow'];
    const shieldHit = codexHit(bow, UNIT_BY_ID['shield']);
    expect(shieldHit).toBe(computeDamage(bow, UNIT_BY_ID['shield']));
    expect(shieldHit).toBeLessThan(codexHit(bow, UNIT_BY_ID['levy']));
  });
});

describe('derived counter hints', () => {
  it('never revives the rejected "light armour fears armour-piercing" claim', () => {
    for (const unit of UNITS) {
      for (const hint of codexHints(unit)) {
        expect(`${hint.label}${hint.detail}`).not.toContain('惧穿甲');
        if (unit.armor === 'light' && hint.kind === 'caution') {
          expect(hint.detail).not.toContain('穿甲');
        }
      }
    }
  });

  it('gives every unit at least one caution and every attacker a numeric strength', () => {
    for (const unit of UNITS) {
      const hints = codexHints(unit);
      expect(hints.filter(hint => hint.kind === 'caution').length).toBeGreaterThan(0);
      if (unit.role === 'healer') {
        expect(hints.some(hint => hint.label.includes(`治疗 ${HEAL_AMOUNT}`))).toBe(true);
      } else {
        expect(hints.some(hint => hint.kind === 'strength')).toBe(true);
      }
      for (const hint of hints) {
        expect(hint.detail.length).toBeGreaterThan(0);
        for (const id of hint.ids) expect(UNITS.some(entry => entry.id === id)).toBe(true);
      }
    }
  });

  it('only lists reachable targets for its strongest-damage hints', () => {
    expect(codexTargets('pike').map(row => row.targetId).sort()).toEqual(['knight', 'rider']);
    expect(codexTargets('crossbow').map(row => row.targetId)).not.toContain('ballista');
    expect(codexBestTarget('rider')?.targetId).toBeTruthy();
    for (const unit of UNITS) {
      for (const row of codexTargets(unit.id)) {
        if (UNIT_BY_ID[row.targetId].range >= 120) {
          expect(unit.range >= UNIT_BY_ID[row.targetId].range || unit.speed >= 40).toBe(true);
        }
      }
    }
  });

  it('derives the guardian fear of magic from the ignored defence value', () => {
    const guardian = UNIT_BY_ID['guardian'];
    const counters = codexCounters('guardian');
    expect(counters.map(row => row.attackerId)).toContain('mage');
    expect(codexHit(UNIT_BY_ID['mage'], guardian)).toBe(guardian.armor === 'heavy' ? 48 : 35);
    const magic = codexHints(guardian).find(hint => hint.label === '惧法术');
    expect(magic).toBeDefined();
    expect(magic!.detail).toContain(String(codexHit(UNIT_BY_ID['mage'], guardian)));
    expect(magic!.detail).toContain(String(guardian.defense));
  });

  it('names the real anti-cavalry, backline-hunting and siege mechanics', () => {
    const pikeHint = codexHints('pike').find(hint => hint.label === '拒马 ×2');
    expect(pikeHint?.detail).toContain(UNIT_BY_ID['rider'].name);
    expect(pikeHint?.detail).toContain(UNIT_BY_ID['knight'].name);
    const riderCaution = codexHints('rider').find(hint => hint.label === '惧长枪');
    expect(riderCaution?.ids).toEqual(['pike']);

    const assassinHint = codexHints('assassin').find(hint => hint.label.startsWith('猎杀后排'));
    expect(assassinHint).toBeDefined();
    expect(assassinHint!.detail).toContain(UNIT_BY_ID['bow'].name);

    const siegeHint = codexHints('ballista').find(hint => hint.label === '攻城 ×3');
    expect(siegeHint?.detail).toContain(String(UNIT_BY_ID['ballista'].heavyDamage * 3));
    expect(siegeHint?.detail).toContain('228');
  });

  it('uses the real shield and splash rules on their own cards', () => {
    for (const id of ['shield', 'guardian']) {
      expect(codexHints(id).some(hint => hint.label === '盾墙减伤')).toBe(true);
    }
    const splashHint = codexHints('firemage').find(hint => hint.label === `溅射 ${SPLASH_RADIUS} 范围`);
    expect(splashHint).toBeDefined();
    expect(splashHint!.detail).toContain('×0.5');
  });

  it('warns fragile ranged units about melee rushers that are actually fast', () => {
    const rushers = codexMeleeRushers('bow');
    expect(rushers.length).toBeGreaterThan(0);
    for (const row of rushers) {
      expect(UNIT_BY_ID[row.attackerId].range).toBeLessThan(60);
      expect(UNIT_BY_ID[row.attackerId].speed).toBeGreaterThanOrEqual(40);
    }
    expect(codexHints('bow').some(hint => hint.label === '惧近身突袭')).toBe(true);
  });

  it('counts light-armour vulnerability from the damage columns', () => {
    const expected = UNITS.filter(unit => unit.role !== 'healer' && unit.lightDamage > unit.heavyDamage).length;
    expect(codexLightVulnerabilityCount()).toBe(expected);
    expect(expected).toBeGreaterThan(8);
    const note = codexHints('levy').find(hint => hint.label === '轻甲薄防');
    expect(note?.detail).toContain(String(expected));
  });

  it('ranks cheap answers by damage per gold per second', () => {
    const rows = codexValueCounters('shield', 4);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].dpsPerGold).toBeGreaterThanOrEqual(rows[i].dpsPerGold);
    }
    expect(rows[0].attackerCost).toBeGreaterThan(0);
    expect(rows[0].attackerSupply).toBeGreaterThan(0);
  });
});
