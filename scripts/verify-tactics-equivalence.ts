/** Run: npx tsx scripts/verify-tactics-equivalence.ts [--verify-only]
 * No server, match/report rewrites, or production test hooks. The frozen test-only oracle
 * preserves the pre-optimization implementation; .tmp/v11-tactics-baseline holds raw originals.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {BattleState,Difficulty,Fighter,Side} from '../src/core/types';
import {UNITS,UNIT_BY_ID} from '../src/data/units';
import {defaultConfig} from '../src/data/missions';
import {createBattle} from '../src/core/simulation';
import {laneCenterY} from '../src/core/math';
import * as current from '../src/core/tactics';
import {chooseAI,allowedUnitsFor} from '../src/core/ai';
import * as reference from '../src/core/tactics-reference.test-support';
import {sourceFingerprint} from './fingerprint';

export interface Snapshot {name:string;state:BattleState;exhaustive:boolean;}
const sides=[0,1] as const;
const horizons=[0,.65,1.3,16,22,34];
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function blank(seed:number):BattleState {
 const s=createBattle({...defaultConfig(),seed,supply:80,startingGold:600,startingIncome:250});
 s.time=160;s.round=13;s.countdown=.25;
 s.events=[{kind:'wave',x:80,y:385,side:0}];
 return s;
}
function add(s:BattleState,side:Side,type:string,x:number,y:number,over:Partial<Fighter>={}) {
 const d=UNIT_BY_ID[type];
 const u:Fighter={id:s.nextId++,side,type,x,y,hp:d.hp,maxHp:d.hp,cooldown:0,action:'idle',actionTime:0,target:null,born:148,charge:['cavalry','knight','elite'].includes(d.role),...over};
 s.units.push(u);if(u.hp>0&&u.action!=='dead')s.teams[side].supplyUsed+=d.supply;
 return u;
}
function rng(seed:number) {
 let x=seed>>>0;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
/** Independent snapshot construction: no AI picks, simulation stepping, or game RNG. */
export function makeSnapshots():Snapshot[] {
 const snapshots:Snapshot[]=[];
 for(let count=0;count<=150;count++) {
  const random=rng(0x51f15e+count*7919),s=blank(5000+count);
  s.config.playerSide=(count%2) as Side;
  s.config.growth=[0,.5,1,2][count%4];s.round=[0,1,13,79,80][count%5];
  if(count%7===0){s.config.allowedUnits=['healer','shield','firemage'];s.config.enemyAllowedUnits=['pike','rider','bow'];}
  for(const side of sides) {
   const bodyCount=Math.floor(count/2)+(side===0?count%2:0);
   const legal=allowedUnitsFor(s.config,side).map(id=>UNIT_BY_ID[id]);
   // At high body counts, use a legal 1-supply catalogue rather than exceeding 80 supply.
   const roster=bodyCount*3>80?UNITS.filter(d=>d.supply===1):legal;
   if(bodyCount*3>80){if(side===s.config.playerSide)s.config.allowedUnits=roster.map(d=>d.id);else s.config.enemyAllowedUnits=roster.map(d=>d.id);}
   for(let i=0;i<bodyCount;i++) {
    const fits=roster.filter(d=>s.teams[side].supplyUsed+d.supply+(bodyCount-i-1)*Math.min(...roster.map(r=>r.supply))<=80);
    const d=fits[Math.floor(random()*fits.length)];
    assert.ok(d,`legal roster ${count}/${side}/${i}`);
    const mode=count%4;
    const x=mode===0?(side===0?100+Math.floor(i/8)*44:1180-Math.floor(i/8)*44):mode===1?590+side*45+Math.floor(random()*35):mode===2?(side===0?1060:220)+Math.floor(random()*45):300+Math.floor(random()*650);
    const dead=(i+count)%19===0;
    add(s,side,d.id,x,laneCenterY(i%8)+(mode===3?(random()-.5)*12:0),{
     hp:dead?0:Math.max(1,d.hp*[1,.25,.75][(i+count)%3]),action:dead?'dead':i%3===0?'hurt':'walk',
     cooldown:[0,.5,d.cooldown][i%3],born:160-(i%8)*12,charge:i%2===0&&['cavalry','knight','elite'].includes(d.role),
    });
   }
   s.teams[side].gold=[0,23,24,130,600,900,6000][(count+side)%7];
   s.teams[side].income=[0,80,250,598,600][(count+side)%5];
   s.teams[side].baseHp=[40,500,2500][(count+side)%3];
  }
  // Scramble sides and stable tie order instead of always grouping side 0 first.
  for(let i=s.units.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[s.units[i],s.units[j]]=[s.units[j],s.units[i]];}
  snapshots.push({name:`count-${String(count).padStart(3,'0')}`,state:s,exhaustive:false});
 }
 const special=(name:string,build:(s:BattleState)=>void)=>{const state=blank(9000+snapshots.length);build(state);snapshots.push({name,state,exhaustive:true});};
 special('healing-reservations-and-front',s=>{
  for(const side of sides){const sign=side===0?1:-1;for(const [id,dx,hp] of [['healer',0,90],['shield',50,100],['healer',2,90],['shield',50,100],['bow',10,25],['healer',4,60]] as const)add(s,side,id,side===0?530+sign*dx:750+sign*dx,385,{hp});}
 });
 special('splash-radius-and-pending-deaths',s=>{
  for(const side of sides){const x=side===0?540:650;add(s,side,'firemage',x,385);add(s,side,'healer',x-10,385);
   for(const offset of [0,12,47.999,48,48.001])add(s,(1-side) as Side,'levy',x+(side===0?90:-90)+offset,385,{hp:5});}
 });
 special('equal-target-scores-and-healing-needs',s=>{
  s.teams.forEach(t=>t.gold=0);
  for(const side of sides){const x=side===0?580:620;add(s,side,'healer',x,385);add(s,side,'shield',x,375,{hp:120});add(s,side,'shield',x,395,{hp:120});add(s,side,'firemage',x,385);}
 });
 special('mixed-side-screening-and-tick-order',s=>{
  for(const side of sides)for(const [i,id] of ['rider','bow','shield','healer','firemage','pike','assassin'].entries())add(s,side,id,570+side*50+i*3,365+(i%3)*10,{cooldown:i%2?.66:0,hp:UNIT_BY_ID[id].hp*.5});
  s.units.reverse();
 });
 special('dead-bodies-do-not-target-or-block',s=>{
  for(const side of sides){add(s,side,'healer',560+side*80,385);add(s,side,'shield',590+side*20,385,{hp:5});add(s,side,'firemage',530+side*140,385);add(s,side,'guardian',600,385,{hp:0,action:'dead'});}
 });
 special('simultaneous-lethal-charge',s=>{
  s.teams.forEach(t=>t.gold=0);for(const side of sides)for(let i=0;i<4;i++)add(s,side,'rider',590+side*30,345+i*20,{hp:1,charge:true});
 });
 special('near-base-terminal-and-siege',s=>{
  s.teams.forEach(t=>{t.gold=0;t.baseHp=30;});for(const side of sides){add(s,side,'ballista',side===0?1170:110,385);add(s,side,'bow',side===0?1130:150,405);}
 });
 for(const side of sides)special(`only-side-${side}`,s=>{
  for(let i=0;i<8;i++)add(s,side,['healer','firemage','shield','rider'][i%4],550+i*15,laneCenterY(i));
 });
 for(const side of sides)special(`master-advantage-side-${side}`,s=>{
  for(let i=0;i<20;i++)add(s,side,'levy',side===0?510+i*4:770-i*4,laneCenterY(i%8));
  for(let i=0;i<2;i++)add(s,(1-side) as Side,'levy',side===0?730:550,laneCenterY(i));
 });
 special('restricted-unaffordable-and-income-cap',s=>{
  s.config.allowedUnits=['healer','firemage','ballista'];s.config.enemyAllowedUnits=['pike','rider'];s.config.growth=0;s.round=80;s.teams[0].gold=5;s.teams[1].gold=130;s.teams.forEach(t=>t.income=600);
  add(s,0,'healer',560,385);add(s,1,'pike',620,385);
 });
 special('full-supply-no-recruits',s=>{for(const side of sides)for(let i=0;i<40;i++)add(s,side,'shield',side===0?400+i*3:880-i*3,laneCenterY(i%8));});
 special('empty-rich-recruitment',s=>s.teams.forEach(t=>t.gold=6000));
 special('legal-150-levy-pressure',s=>{
  s.teams.forEach(t=>{t.gold=600;t.income=600;});
  for(const side of sides)for(let i=0;i<75;i++)add(s,side,'levy',side===0?100+Math.floor(i/8)*44:1180-Math.floor(i/8)*44,laneCenterY(i%8),{cooldown:.5,action:'walk',born:160-(i%8)*12});
 });
 special('dense-healing-and-splash',s=>{
  for(const side of sides){for(let i=0;i<64;i++)add(s,side,'levy',570+side*75+Math.floor(i/8)*2,laneCenterY(i%8),{hp:i%3?35:70});
   add(s,side,'healer',555+side*100,375);add(s,side,'healer',557+side*100,395);add(s,side,'firemage',540+side*130,385);}
 });
 return snapshots;
}

/** Object.is on every field: no tolerance, rounding, or aggregate-score-only check. */
export function verifyEquivalence(snapshots=makeSnapshots()) {
 let forecastComparisons=0,otherScoreComparisons=0,aiComparisons=0;
 const forecastHash=createHash('sha256'),aiHash=createHash('sha256');
 for(const snapshot of snapshots) {
  const {state:s,name}=snapshot,before=structuredClone(s);
  assert.ok(s.units.length<=150,name);assert.ok(s.teams.every(t=>t.supplyUsed<=80),name);
  for(const side of sides) {
   const enemyLegal=allowedUnitsFor(s.config,(1-side) as Side).map(id=>UNIT_BY_ID[id]);
   const candidates=snapshot.exhaustive?UNITS:[UNITS[(s.units.length*7+side)%UNITS.length]];
   const times=snapshot.exhaustive?horizons:[horizons[s.units.length%horizons.length]];
   for(const d of candidates)for(const horizon of times) {
    const expected=reference.forecastWave(s,side,d,enemyLegal,horizon);
    const actual=current.forecastWave(s,side,d,enemyLegal,horizon);
    for(const key of ['score','count','income','combat'] as const)assert.ok(Object.is(actual[key],expected[key]),`${name}/${side}/${d.id}/${horizon}/${key}: ${actual[key]} != ${expected[key]}`);
    forecastHash.update(JSON.stringify([name,side,d.id,horizon,actual]));forecastComparisons++;
   }
   for(const d of UNITS)for(const key of ['fastWaveScore','strategicWaveScore'] as const){assert.deepStrictEqual(current[key](s,side,d),reference[key](s,side,d),`${name}/${side}/${d.id}/${key}`);otherScoreComparisons++;}
   assert.equal(current.useAdvantageForecast(s,side),reference.useAdvantageForecast(s,side),`${name}/${side}/advantage`);
   for(const level of [0,1,2,3,4] as const) {
    const expected=structuredClone(s),actual=structuredClone(s);expected.config.difficulty=actual.config.difficulty=level;
    const unchanged=structuredClone(actual);
    for(let repeat=0;repeat<(snapshot.exhaustive?3:1);repeat++) {
     const expectedPick=reference.chooseAI(expected,side),actualPick=chooseAI(actual,side);
     assert.equal(actualPick,expectedPick,`${name}/${side}/${level}/${repeat}/choice`);
     assert.equal(actual.rng,expected.rng,`${name}/${side}/${level}/${repeat}/rng`);
     assert.deepStrictEqual(actual,expected,`${name}/${side}/${level}/${repeat}/state`);
     assert.deepStrictEqual({...actual,rng:unchanged.rng},unchanged,`${name}/${side}/${level}/${repeat}/only-rng-may-change`);
     aiHash.update(JSON.stringify([name,side,level,repeat,actualPick,actual.rng,digest(actual)]));aiComparisons++;
    }
   }
  }
  assert.deepStrictEqual(s,before,`${name}/score-calls-do-not-mutate-state-or-rng`);
 }
 return {snapshots:snapshots.length,bodyCounts:[...new Set(snapshots.map(s=>s.state.units.length))].sort((a,b)=>a-b),forecastComparisons,fieldComparisons:forecastComparisons*4,otherScoreComparisons,aiComparisons,forecastDigest:forecastHash.digest('hex'),aiAndStateDigest:aiHash.digest('hex'),exact:true};
}

export function benchmarkFixtures():{name:string;state:BattleState;side:Side;level:Difficulty}[] {
 const pressure=blank(919);pressure.teams.forEach(t=>{t.gold=600;t.income=600;});
 for(const side of sides)for(let i=0;i<75;i++)add(pressure,side,'levy',side===0?100+Math.floor(i/8)*44:1180-Math.floor(i/8)*44,laneCenterY(i%8),{cooldown:.5,action:'walk',born:160-(i%8)*12});
 const fixtures=[{name:'hard-150-legal-levy',state:pressure,side:1 as Side,level:3 as Difficulty},{name:'normal-150-legal-levy',state:structuredClone(pressure),side:1 as Side,level:2 as Difficulty}];
 const snapshots=makeSnapshots();
 for(const [name,level,side] of [['mixed-side-screening-and-tick-order',3,0],['healing-reservations-and-front',3,1],['master-advantage-side-1',4,1],['count-000',3,1]] as const)fixtures.push({name,state:structuredClone(snapshots.find(s=>s.name===name)!.state),side,level});
 return fixtures;
}
export function runBenchmarks(samples=21,batch=2,warmup=8) {
 return benchmarkFixtures().map(fixture=>{
  const s=fixture.state;s.config.difficulty=fixture.level;
  const originalRng=s.rng,times:{reference:number[];optimized:number[]}={reference:[],optimized:[]};
  const measure=(fn:typeof chooseAI)=>{
   let elapsed=0;
   for(let i=0;i<batch;i++){s.rng=originalRng;const start=performance.now();fn(s,fixture.side);elapsed+=performance.now()-start;}
   return elapsed/batch;
  };
  for(let i=0;i<warmup;i++){measure(reference.chooseAI);measure(chooseAI);}
  // Alternate order within the same process to reduce warmup / host-load bias.
  for(let i=0;i<samples;i++)for(const key of (i%2?['optimized','reference']:['reference','optimized']) as ('reference'|'optimized')[])times[key].push(measure(key==='reference'?reference.chooseAI:chooseAI));
  const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted[sorted.length-1],samplesMs:values};};
  const before=stats(times.reference),after=stats(times.optimized);
  return {name:fixture.name,units:s.units.length,side:fixture.side,difficulty:fixture.level,warmup,samples,batch,reference:before,optimized:after,medianReductionPercent:100*(1-after.medianMs/before.medianMs)};
 });
}
async function main() {
 const verification=verifyEquivalence();
 if(process.argv.includes('--verify-only')){console.log(JSON.stringify(verification,null,2));return;}
 const source=await sourceFingerprint();
 const hashFile=async(path:string)=>createHash('sha256').update(await readFile(path)).digest('hex');
 const harness={path:'scripts/verify-tactics-equivalence.ts',sha256:await hashFile('scripts/verify-tactics-equivalence.ts'),testPath:'src/core/tactics-performance.test.ts',testSha256:await hashFile('src/core/tactics-performance.test.ts')};
 const report={generated:new Date().toISOString(),harness,baseline:{sourceSha256:'1256fbbf4d74153abd7fadc8c80fd6606a3b8219e7c4e79278791524ce87407c',tacticsSha256:'d95d6c49b3606ac93406eadc27332cd411d971a6b7da31ae191b341b878d8cef',aiSha256:'ea4a1cd7891168a9faebe93cd98c0ebe081e4e5bab45f535831c5a00e71fc471',rawCopy:'.tmp/v11-tactics-baseline',oracle:'src/core/tactics-reference.test-support.ts',oracleSha256:await hashFile('src/core/tactics-reference.test-support.ts')},source,verification,environment:{node:process.version,platform:process.platform,arch:process.arch},method:'Node, same-process alternating original/optimized order, warmup excluded, identical RNG before each timed chooseAI, cloning excluded; not a browser gate or 521-match regression.',sampleMeaning:'Each sample is the arithmetic mean of batch individually timed calls. maxMs is the maximum sample mean, not the maximum individual call.',benchmarks:runBenchmarks(),limitations:['The isolated 144.8ms browser failure is not a reproduced logical bug; its root cause remains unconfirmed.','Timing includes host scheduling and GC; Node evidence does not establish the browser <100ms gate.','The parent agent must rerun the fingerprinted 521 matches and browser performance tests.']};
 await writeFile('docs/metrics/v11-tactics-equivalence.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,benchmarks:report.benchmarks.map(({reference,optimized,...row})=>({...row,referenceMedianMs:reference.medianMs,optimizedMedianMs:optimized.medianMs,referenceMaxMs:reference.maxMs,optimizedMaxMs:optimized.maxMs}))},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
