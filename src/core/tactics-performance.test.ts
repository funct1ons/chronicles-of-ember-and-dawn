import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {makeSnapshots,verifyEquivalence,benchmarkFixtures} from '../../scripts/verify-tactics-equivalence';
import {UNIT_BY_ID} from '../data/units';
import {allowedUnitsFor} from './ai';
import {useAdvantageForecast} from './tactics';

// Performance is measured by the standalone script, never asserted against noisy wall time.
// The test oracle is the frozen original, not a second call through the optimized module.
describe('forecast side-index exactness and performance fixtures',()=>{
 it('keeps the independent original oracle frozen',()=>{
  const source=readFileSync(new URL('./tactics-reference.test-support.ts',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  expect(createHash('sha256').update(source).digest('hex')).toBe('6263f27a20e2aec40e960b424524bad27b800c404ecde2186ff96127adec4001');
 });
 it('covers every body count 0..150, valid HP, catalogues and per-side supply',()=>{
  const snapshots=makeSnapshots();
  expect([...new Set(snapshots.map(s=>s.state.units.length))].sort((a,b)=>a-b)).toEqual(Array.from({length:151},(_,i)=>i));
  for(const {state:s,name} of snapshots) {
   for(const u of s.units) {
    expect(u.hp,name).toBeGreaterThanOrEqual(0);expect(u.hp,name).toBeLessThanOrEqual(UNIT_BY_ID[u.type].hp);
    expect(u.maxHp,name).toBe(UNIT_BY_ID[u.type].hp);expect(allowedUnitsFor(s.config,u.side),name).toContain(u.type);
   }
   for(const side of [0,1] as const) {
    const supply=s.units.filter(u=>u.side===side&&u.hp>0&&u.action!=='dead').reduce((sum,u)=>sum+UNIT_BY_ID[u.type].supply,0);
    expect(s.teams[side].supplyUsed,name).toBe(supply);expect(supply,name).toBeLessThanOrEqual(s.config.supply);
   }
  }
 });
 it('matches every forecast field, AI selection, RNG and full state exactly',()=>{
  const result=verifyEquivalence();
  expect(result).toMatchObject({snapshots:167,forecastComparisons:3374,fieldComparisons:13496,otherScoreComparisons:10688,aiComparisons:1990,exact:true});
  // Raw floating-point serialization is not a cross-engine golden value (CI Node 22
  // differs from Windows Node 24). Keep Object.is per field/full-state comparisons,
  // then compare independently accumulated original/optimized digests on this runtime.
  expect(result.forecastDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(result.forecastDigest).toBe(result.referenceForecastDigest);
  expect(result.aiAndStateDigest).toBe(result.referenceAiAndStateDigest);
 },120_000);
 it('benchmarks real 150-levy hard/normal and the master small-army forecast path',()=>{
  const fixtures=benchmarkFixtures();
  for(const name of ['hard-150-legal-levy','normal-150-legal-levy']) {
   const s=fixtures.find(f=>f.name===name)!.state;
   expect(s.units).toHaveLength(150);expect(s.teams.map(t=>t.supplyUsed)).toEqual([75,75]);
   expect(s.units.every(u=>u.type==='levy'&&u.hp===70&&u.maxHp===70)).toBe(true);
  }
  const advantage=fixtures.find(f=>f.name==='master-advantage-side-1')!;
  expect(useAdvantageForecast(advantage.state,advantage.side)).toBe(true);
 });
});
